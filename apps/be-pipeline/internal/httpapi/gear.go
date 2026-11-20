package httpapi

import (
	"bufio"
	"context"
	"io"
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
	return withGitHubBody(store, publishTimeout, "gear picture", "Couldn't save the gear picture.",
		func(ctx context.Context, r *http.Request, cfg settings.GitHub, gear github.Gear) (any, error) {
			gear.ID = r.PathValue("id")
			return gh.SaveGear(ctx, cfg, gear)
		})
}

// handleDeleteGear removes the path's gear picture file as a change waiting
// for Commit. The picture itself stays in R2.
func handleDeleteGear(store *settings.Store, gh *github.Client) http.HandlerFunc {
	return withGitHub(store, publishTimeout, "Couldn't remove the gear picture.", func(ctx context.Context, r *http.Request, cfg settings.GitHub) (any, error) {
		return gh.DeleteGear(ctx, cfg, r.PathValue("id"))
	})
}

// handleUploadGearImage puts the JPEG, PNG, WEBP, AVIF, GIF, BMP or TIFF in the "image" field of a
// multipart form in R2 right away, unchanged, responding with its key, URL and
// size, for a crop to be cut from.
func handleUploadGearImage(loadR2 func() (settings.R2, error), upload gearUploadFunc) http.HandlerFunc {
	return handlePictureUpload(loadR2, maxGearImageBytes, gearUploadTimeout, upload)
}

// handlePictureUpload hands the JPEG, PNG, WEBP, AVIF, GIF, BMP or TIFF of up
// to maxBytes in the "image" field of a multipart form to upload, with
// timeout, and answers with where upload put it.
func handlePictureUpload[T any](loadR2 func() (settings.R2, error), maxBytes int64, timeout time.Duration,
	upload func(ctx context.Context, cfg settings.R2, name string, body io.Reader) (T, error),
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		name, body, ok := receivePicture(w, r, maxBytes)
		if !ok {
			return
		}
		withSettings(loadR2, timeout, func(ctx context.Context, w http.ResponseWriter, _ *http.Request, cfg settings.R2) {
			res, err := upload(ctx, cfg, name, body)
			writeR2Result(w, res, err, pictureUploadMessage)
		})(w, r)
	}
}

// pictureUploadMessage is the answer when a gear picture or self-portrait
// couldn't be put in R2 for a reason R2 didn't give.
const pictureUploadMessage = "Couldn't upload the picture."

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
	return withBody("crop", maxPhotoDataBytes, func(w http.ResponseWriter, r *http.Request, req gearCropRequest) {
		withSettings(loadR2, gearUploadTimeout, func(ctx context.Context, w http.ResponseWriter, _ *http.Request, cfg settings.R2) {
			res, err := crop(ctx, cfg, req.Original, req.Crop)
			writeR2Result(w, res, err, pictureUploadMessage)
		})(w, r)
	})
}

// receivePicture finds the "image" part of a multipart body of up to
// maxBytes and returns its file name and a reader of it, after checking it's
// a picture a gear picture or self-portrait can be (storage.GearPictureType).
func receivePicture(w http.ResponseWriter, r *http.Request, maxBytes int64) (string, io.Reader, bool) {
	r.Body = http.MaxBytesReader(w, r.Body, maxBytes)
	mr, err := r.MultipartReader()
	if err != nil {
		writeError(w, http.StatusBadRequest, multipartMessage)
		return "", nil, false
	}
	for {
		part, err := mr.NextPart()
		if err != nil {
			writeError(w, http.StatusBadRequest, "Choose a picture to send: the request has none.")
			return "", nil, false
		}
		if part.FormName() != "image" {
			continue
		}
		body := bufio.NewReader(part)
		head, _ := body.Peek(512)
		if storage.GearPictureType(head) == "" {
			writeError(w, http.StatusUnsupportedMediaType, "The picture must be a JPEG, PNG, WEBP, AVIF, GIF, BMP or TIFF.")
			return "", nil, false
		}
		return part.FileName(), body, true
	}
}
