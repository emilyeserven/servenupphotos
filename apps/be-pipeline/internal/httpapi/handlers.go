// Package httpapi wires the be-pipeline HTTP routes.
package httpapi

import (
	"bufio"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/exif"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// maxUploadBytes caps the size of an uploaded photo.
const maxUploadBytes = 50 << 20

// NewRouter returns the HTTP handler for all be-pipeline routes. extractor may be
// nil, in which case POST /exif responds 503.
func NewRouter(extractor exif.Extractor, store *settings.Store) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handleHealth)
	mux.HandleFunc("GET /hello", handleHello)
	mux.HandleFunc("POST /exif", handleExif(extractor))
	mux.HandleFunc("GET /settings", handleGetSettings(store))
	mux.HandleFunc("PUT /settings/r2", handleUpdateSettings(store.UpdateR2))
	mux.HandleFunc("PUT /settings/github", handleUpdateSettings(store.UpdateGitHub))
	return mux
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func handleHello(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"message": "Hello from be-pipeline (Go)"})
}

type exifResponse struct {
	File     string         `json:"file"`
	Metadata map[string]any `json:"metadata"`
}

// handleExif reads the JPEG in the "photo" field of a multipart form and
// responds with its EXIF metadata.
func handleExif(extractor exif.Extractor) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if extractor == nil {
			writeError(w, http.StatusServiceUnavailable, "exiftool is not available")
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, maxUploadBytes)
		mr, err := r.MultipartReader()
		if err != nil {
			writeError(w, http.StatusBadRequest, "expected a multipart/form-data body")
			return
		}

		// Stream parts until the photo, so the upload is never held in memory whole.
		for {
			part, err := mr.NextPart()
			if err != nil {
				var tooBig *http.MaxBytesError
				if errors.As(err, &tooBig) {
					writeError(w, http.StatusRequestEntityTooLarge, "photo is too large")
					return
				}
				writeError(w, http.StatusBadRequest, `missing "photo" field`)
				return
			}
			if part.FormName() != "photo" {
				continue
			}

			body := bufio.NewReader(part)
			head, _ := body.Peek(512)
			if http.DetectContentType(head) != "image/jpeg" {
				writeError(w, http.StatusUnsupportedMediaType, "photo must be a JPEG")
				return
			}

			fields, err := extractor.Extract(body)
			if err != nil {
				var tooBig *http.MaxBytesError
				if errors.As(err, &tooBig) {
					writeError(w, http.StatusRequestEntityTooLarge, "photo is too large")
					return
				}
				slog.Error("exif extraction failed", "err", err)
				writeError(w, http.StatusInternalServerError, "could not read photo metadata")
				return
			}

			writeJSON(w, http.StatusOK, exifResponse{File: part.FileName(), Metadata: fields})
			return
		}
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"message": message})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
