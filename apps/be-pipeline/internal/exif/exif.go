// Package exif reads photo metadata with exiftool, via go-exiftool.
//
// go-exiftool keeps one long-running exiftool process and reads files by path,
// so callers pass the path of a file, typically an upload saved to a temp file.
package exif

import (
	"fmt"

	"github.com/barasher/go-exiftool"
)

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

// Extract returns exiftool's fields for the image at path.
func (e *Exiftool) Extract(path string) (map[string]any, error) {
	results := e.et.ExtractMetadata(path) // go-exiftool serialises calls itself

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
