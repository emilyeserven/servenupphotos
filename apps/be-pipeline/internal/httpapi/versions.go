package httpapi

import (
	"log/slog"
	"net/http"
	"os"
	"strconv"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/versions"
)

// handleVersionPreview makes the version named in the path of the JPEG in
// the "photo" field of a multipart form and responds with it as a WEBP, the
// same image an upload puts in R2, so its quality can be checked first. The
// X-Jpeg-Bytes header says how big the same version would be as a JPEG.
func handleVersionPreview(w http.ResponseWriter, r *http.Request) {
	v, ok := versions.Find(r.PathValue("version"))
	if !ok {
		writeError(w, http.StatusNotFound, "no such version")
		return
	}
	photo, ok := receivePhoto(w, r)
	if !ok {
		return
	}
	defer os.Remove(photo.path) //nolint:errcheck // best-effort cleanup

	f, err := os.Open(photo.path)
	if err != nil {
		slog.Error("open upload failed", "err", err)
		writeError(w, http.StatusInternalServerError, "could not read photo")
		return
	}
	defer f.Close() //nolint:errcheck // read-only

	img, err := versions.Decode(f)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "Couldn't read this JPEG to make its resized versions.")
		return
	}
	resized := versions.Resize(img, v)
	data, err := versions.EncodeWEBP(resized)
	if err != nil {
		slog.Error("encode version failed", "version", v.Name, "err", err)
		writeError(w, http.StatusInternalServerError, "could not make the "+v.Name+" version")
		return
	}
	if jpegBytes, err := versions.JPEGSize(resized); err == nil {
		w.Header().Set("X-Jpeg-Bytes", strconv.Itoa(jpegBytes))
	}
	w.Header().Set("Content-Type", "image/webp")
	w.Header().Set("Content-Length", strconv.Itoa(len(data)))
	_, _ = w.Write(data)
}
