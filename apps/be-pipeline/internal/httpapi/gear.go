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

// gearUploadFunc puts an original gear picture in R2;
// storage.UploadGearOriginal in production.
type gearUploadFunc func(ctx context.Context, cfg settings.R2, name string, body io.Reader) (storage.GearOriginal, error)

// gearCropFunc cuts a crop out of an original gear picture and puts it in R2;
// storage.CropGearImage in production.
type gearCropFunc func(ctx context.Context, cfg settings.R2, original string, crop storage.GearCrop) (storage.Uploaded, error)

// handleSaveGear saves the body as the path's gear picture file, new or
// replacing the one there, as a change waiting for Commit.
func handleSaveGear(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHubBody(store, publishTimeout, "gear picture", "could not save the gear picture",
		func(ctx context.Context, r *http.Request, cfg settings.GitHub, gear github.Gear) (any, error) {
			gear.ID = r.PathValue("id")
			return gh.SaveGear(ctx, cfg, gear)
		})
}

// handleDeleteGear removes the path's gear picture file as a change waiting
// for Commit. The picture itself stays in R2.
func handleDeleteGear(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHub(store, publishTimeout, "could not remove the gear picture", func(ctx context.Context, r *http.Request, cfg settings.GitHub) (any, error) {
		return gh.DeleteGear(ctx, cfg, r.PathValue("id"))
	})
}

// handleUploadGearImage puts the JPEG, PNG, WEBP, AVIF, GIF, BMP or TIFF in the "image" field of a
// multipart form in R2 right away, unchanged, responding with its key, URL and
// size, for a crop to be cut from.
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

// gearCropRequest is the body of POST /gear/crop: the original picture's URL
// and the part of it to keep.
type gearCropRequest struct {
	Original string           `json:"original"`
	Crop     storage.GearCrop `json:"crop"`
}

// handleCropGearImage cuts the body's crop out of its original gear picture and
// puts it in R2 right away, responding with the crop's key and URL for the gear
// file to point at.
func handleCropGearImage(loadR2 func() (settings.R2, error), crop gearCropFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req gearCropRequest
		if !decodeEntry(w, r, &req, "crop") {
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
		res, err := crop(ctx, cfg, req.Original, req.Crop)
		writeGearUpload(w, res, err)
	}
}

// writeGearUpload answers with where the picture went, or why it didn't.
func writeGearUpload[T any](w http.ResponseWriter, res T, err error) {
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
// its file name and a reader of it, after checking it's a picture a gear
// picture can be (storage.GearPictureType).
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
		if storage.GearPictureType(head) == "" {
			writeError(w, http.StatusUnsupportedMediaType, "the picture must be a JPEG, PNG, WEBP, AVIF, GIF, BMP or TIFF")
			return "", nil, false
		}
		return part.FileName(), body, true
	}
}
