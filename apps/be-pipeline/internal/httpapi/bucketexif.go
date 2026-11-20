package httpapi

import (
	"context"
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
func handleBucketExif(extractor exif.Extractor, r2 func() (settings.R2, error), get getPhotoFunc, overrides overridesFunc) http.HandlerFunc {
	return withBody(`photo's key`, maxFieldBytes, func(w http.ResponseWriter, r *http.Request, body bucketKeyRequest) {
		if body.Key == "" {
			writeError(w, http.StatusBadRequest, keyMessage)
			return
		}
		withSettings(r2, getPhotoTimeout, func(ctx context.Context, w http.ResponseWriter, r *http.Request, cfg settings.R2) {
			path, status, msg := downloadPhoto(ctx, cfg, get, body.Key)
			if status != http.StatusOK {
				writeError(w, status, msg)
				return
			}
			defer os.Remove(path) //nolint:errcheck // best-effort cleanup

			res, status, msg := analyzePhoto(extractor, path, storage.OriginalName(body.Key), overrides.read(r.Context()))
			if status != http.StatusOK {
				writeError(w, status, msg)
				return
			}
			writeJSON(w, http.StatusOK, res)
		})(w, r)
	})
}

// bucketKeyRequest is the body of a request about one photo in R2.
type bucketKeyRequest struct {
	// Key is the original JPEG's object key.
	Key string `json:"key"`
}

// keyMessage is the answer to a request about a photo in R2 that doesn't
// say which.
const keyMessage = "Say which photo in R2 this is for: its key is missing."

// downloadPhoto saves the JPEG at key to a temp file the caller removes. On
// failure it returns the status and message to send.
func downloadPhoto(ctx context.Context, cfg settings.R2, get getPhotoFunc, key string) (string, int, string) {
	ctx, cancel := context.WithTimeout(ctx, getPhotoTimeout)
	defer cancel()
	photo, err := get(ctx, cfg, key)
	if err != nil {
		status, msg := getPhotoError(err)
		return "", status, msg
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

// getPhotoError is the status and message to send when get couldn't open a
// photo in R2.
func getPhotoError(err error) (int, string) {
	var gerr *storage.GetError
	switch {
	case errors.As(err, &gerr) && gerr.BadKey:
		return http.StatusBadRequest, gerr.Message
	case errors.As(err, &gerr) && gerr.NotFound:
		return http.StatusNotFound, gerr.Message
	case errors.As(err, &gerr):
		return http.StatusBadGateway, gerr.Message
	default:
		slog.Error("get photo failed", "err", err)
		return http.StatusInternalServerError, "Couldn't read the photo from R2."
	}
}

// checkSavedJPEG checks the file at path is a JPEG no bigger than an upload.
func checkSavedJPEG(path string) (int, string) {
	f, err := os.Open(path) //nolint:gosec // path comes from os.CreateTemp
	if err != nil {
		return http.StatusInternalServerError, "Couldn't read the photo."
	}
	defer f.Close() //nolint:errcheck // read-only
	info, err := f.Stat()
	if err != nil {
		return http.StatusInternalServerError, "Couldn't read the photo."
	}
	if info.Size() > maxUploadBytes {
		return http.StatusRequestEntityTooLarge, photoTooLargeMessage
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
	return withGitHub(store, publishTimeout, "Couldn't read ALLPHOTOS.json, ALLALBUMS.json and ALLTAGS.json.",
		func(ctx context.Context, r *http.Request, cfg settings.GitHub) (any, error) {
			if err := refreshIfAsked(ctx, r, gh, cfg); err != nil {
				return nil, err
			}
			return gh.Combined(ctx, cfg)
		})
}
