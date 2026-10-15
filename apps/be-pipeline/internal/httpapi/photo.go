package httpapi

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
)

// maxUploadBytes caps the size of an uploaded photo.
const maxUploadBytes = 50 << 20

// receivedPhoto is an uploaded JPEG saved to a temp file the caller removes.
type receivedPhoto struct {
	name string
	path string
}

// receivePhoto saves the JPEG in the "photo" field of a multipart form to a
// temp file. On failure it writes the error response and returns false.
func receivePhoto(w http.ResponseWriter, r *http.Request) (receivedPhoto, bool) {
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadBytes)
	mr, err := r.MultipartReader()
	if err != nil {
		writeError(w, http.StatusBadRequest, "expected a multipart/form-data body")
		return receivedPhoto{}, false
	}

	// Stream parts until the photo, so the upload is never held in memory whole.
	for {
		part, err := mr.NextPart()
		if err != nil {
			if isTooBig(err) {
				writeError(w, http.StatusRequestEntityTooLarge, "photo is too large")
				return receivedPhoto{}, false
			}
			writeError(w, http.StatusBadRequest, `missing "photo" field`)
			return receivedPhoto{}, false
		}
		if part.FormName() != "photo" {
			continue
		}

		body := bufio.NewReader(part)
		head, _ := body.Peek(512)
		if http.DetectContentType(head) != "image/jpeg" {
			writeError(w, http.StatusUnsupportedMediaType, "photo must be a JPEG")
			return receivedPhoto{}, false
		}

		// exiftool and the R2 upload read by path, and the color pass reads the
		// pixels, so the upload is saved once to a temp file.
		path, err := saveTemp(body)
		if err != nil {
			if isTooBig(err) {
				writeError(w, http.StatusRequestEntityTooLarge, "photo is too large")
				return receivedPhoto{}, false
			}
			slog.Error("saving upload failed", "err", err)
			writeError(w, http.StatusInternalServerError, "could not save photo")
			return receivedPhoto{}, false
		}
		return receivedPhoto{name: part.FileName(), path: path}, true
	}
}

func isTooBig(err error) bool {
	var tooBig *http.MaxBytesError
	return errors.As(err, &tooBig)
}

// saveTemp writes r to a new temporary file and returns its path.
func saveTemp(r io.Reader) (string, error) {
	tmp, err := os.CreateTemp("", "upload-*.jpg")
	if err != nil {
		return "", fmt.Errorf("create temp file: %w", err)
	}
	_, copyErr := io.Copy(tmp, r)
	closeErr := tmp.Close()
	if err := errors.Join(copyErr, closeErr); err != nil {
		_ = os.Remove(tmp.Name())
		return "", fmt.Errorf("buffer upload: %w", err)
	}
	return tmp.Name(), nil
}
