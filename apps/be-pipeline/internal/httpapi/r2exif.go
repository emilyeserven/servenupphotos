package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"slices"
	"time"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/exif"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/github"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/storage"
)

// r2ExifTimeout bounds checking every original's EXIF in R2, which
// downloads each one the EXIF cache doesn't have yet.
const r2ExifTimeout = 5 * time.Minute

// r2ExifWriteTimeout bounds editing one original's EXIF: reading its photo
// file, downloading it, writing it and uploading it again.
const r2ExifWriteTimeout = 3 * time.Minute

// replaceOriginalFunc overwrites an original in R2, returning why it
// couldn't; storage.ReplaceOriginal in production.
type replaceOriginalFunc func(ctx context.Context, cfg settings.R2, key string, body *os.File, size int64) string

// r2ExifFieldValue is one field to write into an original's EXIF, and its
// new value. Lightroom must be true: the change is made in Lightroom first,
// so a lost original can be exported again with it.
type r2ExifFieldValue struct {
	Field     string `json:"field"`
	Value     string `json:"value"`
	Lightroom bool   `json:"lightroom"`
}

// r2ExifWriteRequest asks to write fields into the EXIF of the original the
// photo file at Path points at. Confirm must be true: it's the page's
// explicit "overwrite the original" step, as the original is replaced.
type r2ExifWriteRequest struct {
	Path    string             `json:"path"`
	Confirm bool               `json:"confirm"`
	Fields  []r2ExifFieldValue `json:"fields"`
}

// handlePreviewR2Exif lists the photos whose originals' EXIF in R2 doesn't
// match their photo files, and the ones edited before.
func handlePreviewR2Exif(extractor exif.Extractor, store *settings.Store, gh *github.Client, get getPhotoFunc, cache *exifCache) http.HandlerFunc {
	if extractor == nil {
		return func(w http.ResponseWriter, _ *http.Request) {
			writeError(w, http.StatusServiceUnavailable, "exiftool isn't running, so the originals' EXIF can't be read.")
		}
	}
	return withGitHub(store, r2ExifTimeout, "could not check the originals' EXIF", func(ctx context.Context, _ *http.Request, cfg settings.GitHub) (any, error) {
		return gh.PreviewR2Exif(ctx, cfg, exifReader(extractor, store.R2, get, cache))
	})
}

// handleWriteR2Exif writes the body's fields, each already changed in
// Lightroom, into the EXIF of the photo's original in R2, overwriting it,
// then notes what changed in its photo file as a change waiting for Commit.
func handleWriteR2Exif(
	extractor exif.Extractor, store *settings.Store, gh *github.Client,
	get getPhotoFunc, replace replaceOriginalFunc, cache *exifCache,
) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		writer, ok := extractor.(exif.Writer)
		if !ok {
			writeError(w, http.StatusServiceUnavailable, "exiftool isn't running, so the EXIF can't be written.")
			return
		}
		req, tags, ok := decodeR2ExifWrite(w, r)
		if !ok {
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), r2ExifWriteTimeout)
		defer cancel()
		edit := r2ExifEdit{extractor: extractor, writer: writer, get: get, replace: replace, cache: cache}
		result, err := edit.run(ctx, store, gh, req, tags)
		writeResult(w, result, err, "could not edit the original's EXIF")
	}
}

// decodeR2ExifWrite reads the request and the exiftool tags its fields
// write, or answers why it can't be done.
func decodeR2ExifWrite(w http.ResponseWriter, r *http.Request) (r2ExifWriteRequest, map[string]string, bool) {
	var req r2ExifWriteRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxPhotoDataBytes)).Decode(&req); err != nil || req.Path == "" {
		writeError(w, http.StatusBadRequest, `expected a JSON body with a "path" and "fields"`)
		return req, nil, false
	}
	if !req.Confirm {
		writeError(w, http.StatusBadRequest, "Confirm overwriting the original in R2 first.")
		return req, nil, false
	}
	tags, msg := r2ExifTags(req.Fields)
	if msg != "" {
		writeError(w, http.StatusBadRequest, msg)
		return req, nil, false
	}
	return req, tags, true
}

// r2ExifTags is every exiftool tag fields write, or why one can't be
// written.
func r2ExifTags(fields []r2ExifFieldValue) (map[string]string, string) {
	if len(fields) == 0 {
		return nil, "Pick at least one field to write."
	}
	tags := map[string]string{}
	seen := map[string]bool{}
	for _, f := range fields {
		if seen[f.Field] || !slices.Contains(exif.EditableFields, f.Field) {
			return nil, f.Field + " can't be written, or is listed twice."
		}
		if !f.Lightroom {
			return nil, "Change " + f.Field + " in Lightroom first, then tick it."
		}
		seen[f.Field] = true
		ft, err := exif.EditTags(f.Field, f.Value)
		if err != nil {
			return nil, "Couldn't write " + f.Field + ": " + err.Error() + "."
		}
		for k, v := range ft {
			tags[k] = v
		}
	}
	return tags, ""
}

// r2ExifEdit is what editing an original's EXIF needs.
type r2ExifEdit struct {
	extractor exif.Extractor
	writer    exif.Writer
	get       getPhotoFunc
	replace   replaceOriginalFunc
	cache     *exifCache
}

// run downloads the photo's original, writes tags into it, checks each field
// reads back as written, uploads it over the original and notes the edit.
// Nothing in R2 changes until the written copy has been checked.
func (e r2ExifEdit) run(ctx context.Context, store *settings.Store, gh *github.Client, req r2ExifWriteRequest, tags map[string]string) (any, error) {
	ghCfg, err := store.GitHub()
	if err != nil {
		return nil, errSettings
	}
	key, err := gh.R2ExifKey(ctx, ghCfg, req.Path)
	if err != nil {
		return nil, err
	}
	r2Cfg, err := store.R2()
	if err != nil {
		return nil, errSettings
	}
	path, status, msg := downloadPhoto(ctx, r2Cfg, e.get, key)
	if status != http.StatusOK {
		return nil, &github.PublishError{Status: status, Message: msg}
	}
	defer os.Remove(path) //nolint:errcheck // best-effort cleanup

	edits, after, perr := e.writeChecked(path, req.Fields, tags)
	if perr != nil {
		return nil, perr
	}
	if perr := e.upload(ctx, r2Cfg, key, path); perr != nil {
		return nil, perr
	}
	e.cache.put(key, after)
	result, err := gh.RecordR2ExifEdit(ctx, ghCfg, req.Path, key, edits)
	if err != nil {
		return nil, notNotedErr(err)
	}
	return result, nil
}

// errSettings is answered when the settings can't be read.
var errSettings = errors.New("could not read settings")

// writeChecked writes tags into the photo at path and reads it back, so each
// field is known to read as written. It returns each field's edit, with the
// value it had before, and the EXIF after.
func (e r2ExifEdit) writeChecked(path string, fields []r2ExifFieldValue, tags map[string]string) ([]github.R2ExifFieldEdit, exif.Sanitized, *github.PublishError) {
	before, perr := e.read(path)
	if perr != nil {
		return nil, exif.Sanitized{}, perr
	}
	if err := e.writer.Write(path, tags); err != nil {
		slog.Error("exif write failed", "err", err)
		return nil, exif.Sanitized{}, &github.PublishError{Status: http.StatusInternalServerError, Message: "exiftool couldn't write the EXIF, so the original in R2 wasn't changed."}
	}
	after, perr := e.read(path)
	if perr != nil {
		return nil, exif.Sanitized{}, perr
	}
	edits := make([]github.R2ExifFieldEdit, 0, len(fields))
	for _, f := range fields {
		if have := exif.ReadValue(f.Field, after); !exif.SameValue(f.Field, f.Value, have) {
			return nil, exif.Sanitized{}, &github.PublishError{Status: http.StatusInternalServerError,
				Message: f.Field + " still reads differently after writing it, so the original in R2 wasn't changed."}
		}
		edits = append(edits, github.R2ExifFieldEdit{Field: f.Field, From: exif.ReadValue(f.Field, before), To: f.Value})
	}
	return edits, after, nil
}

// read is the sanitized EXIF of the photo at path.
func (e r2ExifEdit) read(path string) (exif.Sanitized, *github.PublishError) {
	fields, err := e.extractor.Extract(path)
	if err != nil {
		slog.Error("exif extraction failed", "err", err)
		return exif.Sanitized{}, &github.PublishError{Status: http.StatusInternalServerError, Message: "Couldn't read the photo's EXIF, so the original in R2 wasn't changed."}
	}
	return exif.Sanitize(fields), nil
}

// upload puts the edited photo at path over the original at key.
func (e r2ExifEdit) upload(ctx context.Context, cfg settings.R2, key, path string) *github.PublishError {
	f, err := os.Open(path) //nolint:gosec // path comes from os.CreateTemp
	if err != nil {
		return &github.PublishError{Status: http.StatusInternalServerError, Message: "Couldn't read the edited photo, so the original in R2 wasn't changed."}
	}
	defer f.Close() //nolint:errcheck // read-only
	info, err := f.Stat()
	if err != nil {
		return &github.PublishError{Status: http.StatusInternalServerError, Message: "Couldn't read the edited photo, so the original in R2 wasn't changed."}
	}
	if msg := e.replace(ctx, cfg, key, f, info.Size()); msg != "" {
		return &github.PublishError{Status: http.StatusBadGateway, Message: msg + " " + reuploadHint}
	}
	return nil
}

// reuploadHint is what to do when the original in R2 may be broken: the
// change is already in Lightroom, so a new export replaces it.
const reuploadHint = "If the photo in R2 looks wrong, export it from Lightroom again and swap it in with Replace image on the Photo page."

// notNotedErr says the original was changed but noting it in the photo file
// failed, so the page can say to note it by hand.
func notNotedErr(err error) *github.PublishError {
	msg := err.Error()
	var perr *github.PublishError
	if errors.As(err, &perr) {
		msg = perr.Message
	}
	return &github.PublishError{Status: http.StatusConflict,
		Message: "The original in R2 was changed, but the edit couldn't be noted in its photo file: " + msg}
}

// replaceOriginal is storage.ReplaceOriginal as a replaceOriginalFunc.
func replaceOriginal(ctx context.Context, cfg settings.R2, key string, body *os.File, size int64) string {
	return storage.ReplaceOriginal(ctx, cfg, key, body, size)
}
