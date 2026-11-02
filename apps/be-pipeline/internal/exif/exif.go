// Package exif reads photo metadata with exiftool, via go-exiftool.
//
// go-exiftool keeps one long-running exiftool process and reads files by path,
// so callers pass the path of a file, typically an upload saved to a temp file.
package exif

import (
	"errors"
	"fmt"
	"log/slog"
	"sync"

	"github.com/barasher/go-exiftool"
)

// maxOutputSize is the largest metadata exiftool may return for one photo.
// go-exiftool allows 64 KB by default, which a Lightroom edit with brush masks
// can pass on its own.
const maxOutputSize = 64 << 20

// maxValueLength is the longest a field's value can be, in characters, before
// Extract leaves the field out. No field the pipeline uses comes close; the
// ones that pass it are blobs such as a Lightroom brush mask's strokes, which
// would only bloat the photo's EXIF in the browser.
const maxValueLength = 2000

// Fields that describe the (temporary) file rather than the photo.
var tempFileFields = []string{
	"SourceFile",
	"Directory",
	"FileName",
	"FilePermissions",
	"FileAccessDate",
	"FileInodeChangeDate",
	"FileModifyDate",
}

// Extractor returns the metadata of the image at path.
type Extractor interface {
	Extract(path string) (map[string]any, error)
}

// Exiftool is an Extractor backed by a running exiftool process. When reading
// a photo fails partway, it starts a new process, so one photo it can't read
// doesn't stop it reading the next.
type Exiftool struct {
	mu sync.Mutex
	et *exiftool.Exiftool
}

// NewExiftool starts exiftool. It fails when the exiftool binary is not on PATH.
func NewExiftool() (*Exiftool, error) {
	et, err := startExiftool()
	if err != nil {
		return nil, err
	}
	return &Exiftool{et: et}, nil
}

func startExiftool() (*exiftool.Exiftool, error) {
	et, err := exiftool.NewExiftool(exiftool.Buffer(make([]byte, 128<<10), maxOutputSize))
	if err != nil {
		return nil, fmt.Errorf("start exiftool: %w", err)
	}
	return et, nil
}

// Close stops the exiftool process.
func (e *Exiftool) Close() error {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.et.Close()
}

// Extract returns exiftool's fields for the image at path.
func (e *Exiftool) Extract(path string) (map[string]any, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	results := e.et.ExtractMetadata(path)

	if len(results) != 1 {
		return nil, fmt.Errorf("exiftool returned %d results", len(results))
	}
	if err := results[0].Err; err != nil {
		e.restartAfter(err)
		return nil, fmt.Errorf("read metadata: %w", err)
	}

	fields := results[0].Fields
	for _, k := range tempFileFields {
		delete(fields, k)
	}
	dropLongValues(fields)
	return fields, nil
}

// restartAfter starts a new exiftool process after a read that failed while
// talking to the running one. go-exiftool can't read anything more from a
// process once a read fails partway, so without a restart every later photo
// would fail too. A missing file or a folder leaves the process as it was.
func (e *Exiftool) restartAfter(err error) {
	if errors.Is(err, exiftool.ErrNotExist) || errors.Is(err, exiftool.ErrNotFile) {
		return
	}
	_ = e.et.Close() //nolint:errcheck // the old process is being replaced
	et, startErr := startExiftool()
	if startErr != nil {
		slog.Error("could not restart exiftool", "err", startErr)
		return
	}
	e.et = et
}

// dropLongValues removes the fields whose value is longer than maxValueLength.
func dropLongValues(fields map[string]any) {
	for k, v := range fields {
		if valueLength(v) > maxValueLength {
			delete(fields, k)
		}
	}
}

// valueLength is the length of v as text: a string's length, or a list's
// items added up. Numbers and other short values count as 0.
func valueLength(v any) int {
	switch v := v.(type) {
	case string:
		return len(v)
	case []any:
		n := 0
		for _, item := range v {
			n += valueLength(item)
		}
		return n
	default:
		return 0
	}
}
