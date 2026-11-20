package httpapi

import (
	"context"
	"errors"
	"fmt"
	"image"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/contactsheet"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/offline"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/versions"
)

// contactSheetsTimeout bounds making one request's contact sheets: reading
// every photo, drawing the sheets and putting them in R2. Small versions
// usually come from the offline copy, so most of it is drawing.
const contactSheetsTimeout = 5 * time.Minute

// sheetImageTimeout bounds reading one photo that isn't a Small version
// kept offline, over the internet.
const sheetImageTimeout = 30 * time.Second

// maxSheetImageBytes is the largest photo read over the internet for a
// tile: an original JPEG, with room to spare.
const maxSheetImageBytes = 60 << 20

// maxContactSheetPhotos is how many photos one request can put on sheets:
// every photo in the portfolio, with room to grow.
const maxContactSheetPhotos = 3000

// sheetReaders is how many photos are read at once for a sheet.
const sheetReaders = 8

// sheetImageFunc reads the photo at a URL; openSheetImage in production.
type sheetImageFunc func(ctx context.Context, cfg settings.R2, url string) (image.Image, error)

// uploadSheetsFunc puts encoded sheets in R2 and gives their links;
// storage.UploadContactSheets in production.
type uploadSheetsFunc func(ctx context.Context, cfg settings.R2, sheets [][]byte) ([]string, error)

// sheetExpiryFunc makes sure R2 deletes sheets after a day, or says why it
// couldn't; storage.EnsureContactSheetExpiry in production.
type sheetExpiryFunc func(ctx context.Context, cfg settings.R2) string

// contactSheetPhoto is one photo to put on a sheet.
type contactSheetPhoto struct {
	// Label is the name the prompt calls the photo by, drawn under it.
	Label string `json:"label"`
	// URL is the photo's image: its Small version, best, or any public
	// image link.
	URL string `json:"url"`
}

// contactSheetsRequest is the body of POST /photos/bucket/contact-sheets:
// the photos in the order the prompt lists them, so the Nth is tile N.
type contactSheetsRequest struct {
	Photos []contactSheetPhoto `json:"photos"`
}

// contactSheetLink is one sheet in R2 and the tiles on it.
type contactSheetLink struct {
	// URL is the sheet's public link, which works for about a day.
	URL string `json:"url"`
	// First and Last are the numbers of its first and last tiles, counted
	// from 1 across every sheet.
	First int `json:"first"`
	Last  int `json:"last"`
}

// contactSheetsResponse is the answer of POST /photos/bucket/contact-sheets.
type contactSheetsResponse struct {
	Sheets []contactSheetLink `json:"sheets"`
	// Missing is the labels of the photos that couldn't be read, drawn as
	// gray tiles so the numbers still match.
	Missing []string `json:"missing"`
	// ExpiryProblem says why R2 couldn't be set to delete the sheets after a
	// day, with how to set it in the Cloudflare dashboard; "" when it's set.
	ExpiryProblem string `json:"expiryProblem"`
}

// handleContactSheets draws the body's photos as numbered contact sheets of
// 30, puts them in R2's contact-sheets/ folder and answers with their public
// links, so an LLM can look at many photos in a few images. The first time
// it works for a bucket, it also adds the lifecycle rule that deletes the
// sheets after a day.
func handleContactSheets(loadR2 func() (settings.R2, error), read sheetImageFunc, upload uploadSheetsFunc, expiry sheetExpiryFunc) http.HandlerFunc {
	var expirySet sync.Map // buckets known to have the rule, by account and name
	return func(w http.ResponseWriter, r *http.Request) {
		var req contactSheetsRequest
		if !decodeEntryUpTo(w, r, &req, "contact sheets", 2<<20) {
			return
		}
		if len(req.Photos) == 0 || len(req.Photos) > maxContactSheetPhotos {
			writeError(w, http.StatusBadRequest, fmt.Sprintf("Send 1 to %d photos to put on contact sheets.", maxContactSheetPhotos))
			return
		}
		cfg, err := loadR2()
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), contactSheetsTimeout)
		defer cancel()
		resp, err := makeContactSheets(ctx, cfg, req.Photos, read, upload)
		if err != nil {
			writeContactSheetsError(w, err)
			return
		}
		bucket := cfg.AccountID + "/" + cfg.Bucket
		if _, ok := expirySet.Load(bucket); !ok {
			if resp.ExpiryProblem = expiry(ctx, cfg); resp.ExpiryProblem == "" {
				expirySet.Store(bucket, true)
			}
		}
		writeJSON(w, http.StatusOK, resp)
	}
}

// makeContactSheets draws photos on sheets of contactsheet.PerSheet, one
// sheet at a time so only one sheet's photos are in memory, and puts them in
// R2.
func makeContactSheets(ctx context.Context, cfg settings.R2, photos []contactSheetPhoto, read sheetImageFunc, upload uploadSheetsFunc) (contactSheetsResponse, error) {
	resp := contactSheetsResponse{Sheets: []contactSheetLink{}, Missing: []string{}}
	var encoded [][]byte
	for start := 0; start < len(photos); start += contactsheet.PerSheet {
		part := photos[start:min(start+contactsheet.PerSheet, len(photos))]
		tiles := readTiles(ctx, cfg, part, start, read)
		for _, tile := range tiles {
			if tile.Image == nil {
				resp.Missing = append(resp.Missing, tile.Label)
			}
		}
		if err := ctx.Err(); err != nil {
			return contactSheetsResponse{}, err
		}
		data, err := contactsheet.Encode(contactsheet.Draw(tiles))
		if err != nil {
			return contactSheetsResponse{}, err
		}
		encoded = append(encoded, data)
		resp.Sheets = append(resp.Sheets, contactSheetLink{First: start + 1, Last: start + len(part)})
	}
	links, err := upload(ctx, cfg, encoded)
	if err != nil {
		return contactSheetsResponse{}, err
	}
	for i := range resp.Sheets {
		resp.Sheets[i].URL = links[i]
	}
	return resp, nil
}

// readTiles reads part's photos, sheetReaders at a time, as tiles numbered
// from start+1; a photo that can't be read gets a nil Image.
func readTiles(ctx context.Context, cfg settings.R2, part []contactSheetPhoto, start int, read sheetImageFunc) []contactsheet.Tile {
	tiles := make([]contactsheet.Tile, len(part))
	limit := make(chan struct{}, sheetReaders)
	var wg sync.WaitGroup
	for i, photo := range part {
		tiles[i] = contactsheet.Tile{Number: start + i + 1, Label: photo.Label}
		wg.Go(func() {
			limit <- struct{}{}
			defer func() { <-limit }()
			img, err := read(ctx, cfg, photo.URL)
			if err != nil {
				slog.Warn("contact sheet photo not read", "url", photo.URL, "err", err)
				return
			}
			tiles[i].Image = img
		})
	}
	wg.Wait()
	return tiles
}

// writeContactSheetsError says why the sheets couldn't be made.
func writeContactSheetsError(w http.ResponseWriter, err error) {
	var uerr *storage.UploadError
	switch {
	case errors.As(err, &uerr) && uerr.NotConfigured:
		writeError(w, http.StatusBadRequest, uerr.Message)
	case errors.As(err, &uerr):
		writeError(w, http.StatusBadGateway, "Couldn't put the contact sheets in R2: "+uerr.Message)
	case errors.Is(err, context.DeadlineExceeded):
		writeError(w, http.StatusGatewayTimeout, "Making the contact sheets took too long. Try fewer photos.")
	default:
		slog.Error("contact sheets failed", "err", err)
		writeError(w, http.StatusInternalServerError, "could not make the contact sheets")
	}
}

// openSheetImage reads the photo at raw: a Small version (or another
// thumbnail) from the offline copy, downloading it from R2 first when it
// isn't kept yet, and any other link over the internet.
func openSheetImage(file smallFileFunc) sheetImageFunc {
	return func(ctx context.Context, cfg settings.R2, raw string) (image.Image, error) {
		if _, ok := offline.ThumbnailKey(raw); ok {
			path, err := file(ctx, cfg, raw)
			if err != nil {
				return nil, err
			}
			f, err := os.Open(path) //nolint:gosec // a file in the offline folder, named from a thumbnail key
			if err != nil {
				return nil, err
			}
			defer f.Close() //nolint:errcheck // read-only
			return versions.Decode(f)
		}
		return fetchSheetImage(ctx, raw)
	}
}

// fetchSheetImage downloads and reads the image at raw, an http or https
// link.
func fetchSheetImage(ctx context.Context, raw string) (image.Image, error) {
	if !strings.HasPrefix(raw, "https://") && !strings.HasPrefix(raw, "http://") {
		return nil, fmt.Errorf("not a web link: %q", raw)
	}
	ctx, cancel := context.WithTimeout(ctx, sheetImageTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, raw, nil)
	if err != nil {
		return nil, err
	}
	res, err := http.DefaultClient.Do(req) //nolint:gosec // a photo link from the pipeline's own page
	if err != nil {
		return nil, err
	}
	defer res.Body.Close() //nolint:errcheck // read-only
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%s answered %s", raw, res.Status)
	}
	return versions.Decode(io.LimitReader(res.Body, maxSheetImageBytes))
}

// deleteContactSheetsTimeout bounds deleting contact sheets: every set at
// once can be a few hundred sheets, one request each. The BFF's wait for it
// comes from contactSheetsTimeout, which shares its path.
const deleteContactSheetsTimeout = 2 * time.Minute

// deleteSheetsFunc deletes one set of sheets, or all of them for "";
// storage.DeleteContactSheets in production.
type deleteSheetsFunc func(ctx context.Context, cfg settings.R2, set string) (storage.DeletedContactSheets, error)

// deleteContactSheetsRequest is the body of DELETE
// /photos/bucket/contact-sheets.
type deleteContactSheetsRequest struct {
	// Set is the folder of one set of sheets, such as
	// 20261115-045000-1a2b3c4d, or "" for every set.
	Set string `json:"set"`
}

// handleDeleteContactSheets deletes one set of contact sheets from R2, or
// every set, for Explore Bucket, since R2 can't always be set to delete them
// by itself. It answers 200 with how many went and which didn't.
func handleDeleteContactSheets(loadR2 func() (settings.R2, error), del deleteSheetsFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req deleteContactSheetsRequest
		if !decodeEntryUpTo(w, r, &req, "contact sheets", 1<<12) {
			return
		}
		cfg, err := loadR2()
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), deleteContactSheetsTimeout)
		defer cancel()
		res, err := del(ctx, cfg, req.Set)
		var lerr *storage.ListError
		switch {
		case errors.As(err, &lerr):
			writeError(w, http.StatusBadRequest, lerr.Message)
		case err != nil:
			slog.Error("delete contact sheets failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not delete the contact sheets")
		default:
			writeJSON(w, http.StatusOK, res)
		}
	}
}
