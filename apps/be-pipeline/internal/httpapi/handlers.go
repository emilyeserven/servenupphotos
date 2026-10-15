// Package httpapi wires the be-pipeline HTTP routes.
package httpapi

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/colors"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/exif"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/githubcheck"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

// maxUploadBytes caps the size of an uploaded photo.
const maxUploadBytes = 50 << 20

// NewRouter returns the HTTP handler for all be-pipeline routes. extractor may be
// nil, in which case POST /exif responds with colors only and a null "exif".
func NewRouter(extractor exif.Extractor, store *settings.Store) http.Handler {
	return newRouter(extractor, store, githubcheck.New())
}

// newRouter is NewRouter with the GitHub checker injectable, so tests can point
// it at a fake GitHub.
func newRouter(extractor exif.Extractor, store *settings.Store, github *githubcheck.Checker) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", handleHealth)
	mux.HandleFunc("GET /hello", handleHello)
	mux.HandleFunc("POST /exif", handleExif(extractor))
	mux.HandleFunc("GET /settings", handleGetSettings(store))
	mux.HandleFunc("PUT /settings/r2", handleUpdateSettings(store.UpdateR2))
	mux.HandleFunc("POST /settings/r2/test", handleTestSettings(store.ResolveR2, storage.CheckR2))
	mux.HandleFunc("PUT /settings/github", handleUpdateSettings(store.UpdateGitHub))
	mux.HandleFunc("POST /settings/github/test", handleTestSettings(store.ResolveGitHub, github.Check))
	return mux
}

func handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func handleHello(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"message": "Hello from be-pipeline (Go)"})
}

type exifResponse struct {
	File string `json:"file"`
	// Exif is null when exiftool is not available.
	Exif map[string]any `json:"exif"`
	// Sanitized is null when exiftool is not available.
	Sanitized *exif.Sanitized `json:"sanitized"`
	Colors    colors.Analysis `json:"colors"`
}

// handleExif reads the JPEG in the "photo" field of a multipart form and
// responds with its EXIF metadata and color summary.
func handleExif(extractor exif.Extractor) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
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
				if isTooBig(err) {
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

			// exiftool reads by path, and the color pass reads the pixels, so the
			// upload is saved once to a temp file that both read.
			path, err := saveTemp(body)
			if err != nil {
				if isTooBig(err) {
					writeError(w, http.StatusRequestEntityTooLarge, "photo is too large")
					return
				}
				slog.Error("saving upload failed", "err", err)
				writeError(w, http.StatusInternalServerError, "could not save photo")
				return
			}
			defer os.Remove(path) //nolint:errcheck // best-effort cleanup

			res := exifResponse{File: part.FileName()}
			if extractor != nil {
				if res.Exif, err = extractor.Extract(path); err != nil {
					slog.Error("exif extraction failed", "err", err)
					writeError(w, http.StatusInternalServerError, "could not read photo metadata")
					return
				}
				sanitized := exif.Sanitize(res.Exif)
				res.Sanitized = &sanitized
			}

			if res.Colors, err = analyzeColors(path); err != nil {
				slog.Warn("color analysis failed", "err", err)
				writeError(w, http.StatusUnprocessableEntity, "could not decode photo")
				return
			}

			writeJSON(w, http.StatusOK, res)
			return
		}
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

func analyzeColors(path string) (colors.Analysis, error) {
	f, err := os.Open(path) //nolint:gosec // path comes from os.CreateTemp
	if err != nil {
		return colors.Analysis{}, fmt.Errorf("open upload: %w", err)
	}
	defer f.Close() //nolint:errcheck // read-only
	return colors.Analyze(f)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"message": message})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
