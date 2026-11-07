package httpapi

import (
	"bufio"
	"context"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

// gearUploadTimeout bounds how long resizing a gear picture and putting it in
// R2 may take, inside the BFF's default wait.
const gearUploadTimeout = 25 * time.Second

// maxGearImageBytes caps the size of an uploaded gear picture.
const maxGearImageBytes = 20 << 20

// gearImageTypes are the kinds of picture a camera or lens can be given.
var gearImageTypes = map[string]bool{"image/jpeg": true, "image/png": true, "image/webp": true}

// gearUploadFunc puts a gear picture in R2; storage.UploadGearImage in
// production.
type gearUploadFunc func(ctx context.Context, cfg settings.R2, name string, body io.Reader) (storage.Uploaded, error)

// handleSaveGear saves the body as the path's gear picture file, new or
// replacing the one there, as a change waiting for Commit.
func handleSaveGear(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var gear github.Gear
		if !decodeEntry(w, r, &gear, "gear picture") {
			return
		}
		gear.ID = r.PathValue("id")
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.SaveGear(ctx, cfg, gear)
		writeSocialResult(w, result, err, "could not save the gear picture")
	}
}

// handleDeleteGear removes the path's gear picture file as a change waiting
// for Commit. The picture itself stays in R2.
func handleDeleteGear(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg, ok := githubSettings(w, store)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), publishTimeout)
		defer cancel()
		result, err := gh.DeleteGear(ctx, cfg, r.PathValue("id"))
		writeSocialResult(w, result, err, "could not remove the gear picture")
	}
}

// handleUploadGearImage resizes the JPEG, PNG or WEBP in the "image" field of
// a multipart form and puts it in R2 right away, like a photo, responding with
// its key and URL for the gear file to point at.
func handleUploadGearImage(loadR2 func() (settings.R2, error), upload gearUploadFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		name, body, ok := receiveGearImage(w, r)
		if !ok {
			return
		}
		cfg, err := loadR2()
		if err != nil {
			slog.Error("read settings failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not read settings")
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), gearUploadTimeout)
		defer cancel()
		res, err := upload(ctx, cfg, name, body)
		writeGearUpload(w, res, err)
	}
}

// writeGearUpload answers with where the picture went, or why it didn't.
func writeGearUpload(w http.ResponseWriter, res storage.Uploaded, err error) {
	var uploadErr *storage.UploadError
	switch {
	case errors.As(err, &uploadErr):
		writeJSON(w, uploadErrorStatus(uploadErr), uploadErrorResponse{Message: uploadErr.Message, Cloudflare: uploadErr.Cloudflare})
	case err != nil:
		slog.Error("gear upload failed", "err", err)
		writeError(w, http.StatusInternalServerError, "could not upload the picture")
	default:
		writeJSON(w, http.StatusOK, res)
	}
}

// receiveGearImage finds the "image" part of the multipart body and returns
// its file name and a reader of it, after checking it's a JPEG, PNG or WEBP.
func receiveGearImage(w http.ResponseWriter, r *http.Request) (string, io.Reader, bool) {
	r.Body = http.MaxBytesReader(w, r.Body, maxGearImageBytes)
	mr, err := r.MultipartReader()
	if err != nil {
		writeError(w, http.StatusBadRequest, "expected a multipart/form-data body")
		return "", nil, false
	}
	for {
		part, err := mr.NextPart()
		if err != nil {
			writeError(w, http.StatusBadRequest, `missing "image" field`)
			return "", nil, false
		}
		if part.FormName() != "image" {
			continue
		}
		body := bufio.NewReader(part)
		head, _ := body.Peek(512)
		if !gearImageTypes[http.DetectContentType(head)] {
			writeError(w, http.StatusUnsupportedMediaType, "the picture must be a JPEG, PNG or WEBP")
			return "", nil, false
		}
		return part.FileName(), body, true
	}
}
