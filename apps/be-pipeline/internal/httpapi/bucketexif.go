package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/exif"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

// getPhotoTimeout bounds downloading one original from R2.
const getPhotoTimeout = 30 * time.Second

// getPhotoFunc opens a photo in R2; storage.GetPhoto in production.
type getPhotoFunc func(ctx context.Context, cfg settings.R2, key string) (io.ReadCloser, error)

// handleBucketExif reads the original JPEG at the body's "key" in the R2
// bucket from Settings and responds as POST /exif does, so a photo already in
// the bucket can get its photo data without being uploaded again. The file
// name is the one the key keeps.
func handleBucketExif(extractor exif.Extractor, r2 func() (settings.R2, error), get getPhotoFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Key string `json:"key"`
		}
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxFieldBytes)).Decode(&body); err != nil || body.Key == "" {
			writeError(w, http.StatusBadRequest, `expected a JSON body with a "key"`)
			return
		}
		cfg, err := r2()
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}

		path, status, msg := downloadPhoto(r.Context(), cfg, get, body.Key)
		if status != http.StatusOK {
			writeError(w, status, msg)
			return
		}
		defer os.Remove(path) //nolint:errcheck // best-effort cleanup

		res, status, msg := analyzePhoto(extractor, path, storage.OriginalName(body.Key))
		if status != http.StatusOK {
			writeError(w, status, msg)
			return
		}
		writeJSON(w, http.StatusOK, res)
	}
}

// downloadPhoto saves the JPEG at key to a temp file the caller removes. On
// failure it returns the status and message to send.
func downloadPhoto(ctx context.Context, cfg settings.R2, get getPhotoFunc, key string) (string, int, string) {
	ctx, cancel := context.WithTimeout(ctx, getPhotoTimeout)
	defer cancel()
	photo, err := get(ctx, cfg, key)
	var gerr *storage.GetError
	switch {
	case errors.As(err, &gerr) && gerr.BadKey:
		return "", http.StatusBadRequest, gerr.Message
	case errors.As(err, &gerr) && gerr.NotFound:
		return "", http.StatusNotFound, gerr.Message
	case errors.As(err, &gerr):
		return "", http.StatusBadGateway, gerr.Message
	case err != nil:
		slog.Error("get photo failed", "err", err)
		return "", http.StatusInternalServerError, "could not read the photo from R2"
	}
	defer photo.Close() //nolint:errcheck // read-only

	path, err := saveTemp(io.LimitReader(photo, maxUploadBytes+1))
	if err != nil {
		slog.Error("saving photo failed", "err", err)
		return "", http.StatusBadGateway, "Couldn't download the photo from R2."
	}
	if status, msg := checkSavedJPEG(path); status != http.StatusOK {
		_ = os.Remove(path)
		return "", status, msg
	}
	return path, http.StatusOK, ""
}

// checkSavedJPEG checks the file at path is a JPEG no bigger than an upload.
func checkSavedJPEG(path string) (int, string) {
	f, err := os.Open(path) //nolint:gosec // path comes from os.CreateTemp
	if err != nil {
		return http.StatusInternalServerError, "could not read the photo"
	}
	defer f.Close() //nolint:errcheck // read-only
	info, err := f.Stat()
	if err != nil {
		return http.StatusInternalServerError, "could not read the photo"
	}
	if info.Size() > maxUploadBytes {
		return http.StatusRequestEntityTooLarge, "photo is too large"
	}
	head := make([]byte, 512)
	n, _ := io.ReadFull(f, head)
	if http.DetectContentType(head[:n]) != "image/jpeg" {
		return http.StatusUnsupportedMediaType, "That object in R2 isn't a JPEG."
	}
	return http.StatusOK, ""
}

// handleCombined reads ALLPHOTOS.json, ALLALBUMS.json and ALLTAGS.json on the
// base branch from Settings and on the photo data pull request, which pages
// keep until they're committed again. It only reads from GitHub.
func handleCombined(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, err := store.GitHub()
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.Combined(ctx, cfg)
		var perr *github.PublishError
		if errors.As(err, &perr) {
			writeError(w, perr.Status, perr.Message)
			return
		}
		if err != nil {
			slog.Error("read combined photo data failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read ALLPHOTOS.json, ALLALBUMS.json and ALLTAGS.json")
			return
		}
		writeJSON(w, http.StatusOK, result)
	}
}
