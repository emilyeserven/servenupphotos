// Package exif reads photo metadata with exiftool, via go-exiftool.
//
// go-exiftool keeps one long-running exiftool process and reads files by path,
// so uploads are written to a temporary file, read, and removed.
package exif

import (
	"fmt"
	"io"
	"os"

	"github.com/barasher/go-exiftool"
)

// Fields that describe the temporary file rather than the photo.
var tempFileFields = []string{
	"SourceFile",
	"Directory",
	"FileName",
	"FilePermissions",
	"FileAccessDate",
	"FileInodeChangeDate",
	"FileModifyDate",
}

// Extractor returns the metadata of a single image.
type Extractor interface {
	Extract(r io.Reader) (map[string]any, error)
}

// Exiftool is an Extractor backed by a running exiftool process.
type Exiftool struct {
	et *exiftool.Exiftool
}

// NewExiftool starts exiftool. It fails when the exiftool binary is not on PATH.
func NewExiftool() (*Exiftool, error) {
	et, err := exiftool.NewExiftool()
	if err != nil {
		return nil, fmt.Errorf("start exiftool: %w", err)
	}
	return &Exiftool{et: et}, nil
}

// Close stops the exiftool process.
func (e *Exiftool) Close() error {
	return e.et.Close()
}

// Extract buffers r to a temporary file and returns exiftool's fields for it.
func (e *Exiftool) Extract(r io.Reader) (map[string]any, error) {
	tmp, err := os.CreateTemp("", "upload-*.jpg")
	if err != nil {
		return nil, fmt.Errorf("create temp file: %w", err)
	}
	defer os.Remove(tmp.Name()) //nolint:errcheck // best-effort cleanup

	_, copyErr := io.Copy(tmp, r)
	closeErr := tmp.Close()
	if copyErr != nil {
		return nil, fmt.Errorf("buffer upload: %w", copyErr)
	}
	if closeErr != nil {
		return nil, fmt.Errorf("buffer upload: %w", closeErr)
	}

	results := e.et.ExtractMetadata(tmp.Name()) // go-exiftool serialises calls itself

	if len(results) != 1 {
		return nil, fmt.Errorf("exiftool returned %d results", len(results))
	}
	if results[0].Err != nil {
		return nil, fmt.Errorf("read metadata: %w", results[0].Err)
	}

	fields := results[0].Fields
	for _, k := range tempFileFields {
		delete(fields, k)
	}
	return fields, nil
}
