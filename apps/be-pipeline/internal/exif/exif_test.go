package exif

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestExiftoolExtract(t *testing.T) {
	if _, err := exec.LookPath("exiftool"); err != nil {
		t.Skip("exiftool not installed")
	}
	et, err := NewExiftool()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = et.Close() })

	fields, err := et.Extract("testdata/sample.jpg")
	if err != nil {
		t.Fatal(err)
	}
	if fields["Make"] != "Servenup" || fields["Model"] != "Test Camera" {
		t.Errorf("Make/Model = %v/%v, want Servenup/Test Camera", fields["Make"], fields["Model"])
	}
	for _, k := range tempFileFields {
		if _, ok := fields[k]; ok {
			t.Errorf("field %s should be removed", k)
		}
	}
}

// TestExiftoolExtractLargeMetadata reads a photo whose metadata is larger than
// go-exiftool's default 64 KB, like a Lightroom edit with brush masks, and then
// a normal photo with the same process.
func TestExiftoolExtractLargeMetadata(t *testing.T) {
	if _, err := exec.LookPath("exiftool"); err != nil {
		t.Skip("exiftool not installed")
	}
	dir := t.TempDir()
	big := filepath.Join(dir, "big.jpg")
	desc := strings.Repeat("x", 200_000)
	descFile := filepath.Join(dir, "desc.txt")
	if err := os.WriteFile(descFile, []byte(desc), 0o600); err != nil {
		t.Fatal(err)
	}
	//nolint:gosec // test-only exiftool call on temp files
	if out, err := exec.CommandContext(t.Context(), "exiftool", "-q", "-o", big, "-XMP-dc:Description<="+descFile, "testdata/sample.jpg").CombinedOutput(); err != nil {
		t.Fatalf("write metadata: %v: %s", err, out)
	}

	et, err := NewExiftool()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = et.Close() })

	fields, err := et.Extract(big)
	if err != nil {
		t.Fatalf("large metadata: %v", err)
	}
	if _, ok := fields["Description"]; ok {
		t.Error("Description is longer than maxValueLength and should be left out")
	}
	if fields["Make"] != "Servenup" {
		t.Errorf("Make = %v, want Servenup", fields["Make"])
	}
	if _, err := et.Extract("testdata/sample.jpg"); err != nil {
		t.Fatalf("photo after large metadata: %v", err)
	}
}

// TestExiftoolRestartsAfterFailedRead checks that a read that breaks the
// exiftool process doesn't make the next photo fail too.
func TestExiftoolRestartsAfterFailedRead(t *testing.T) {
	if _, err := exec.LookPath("exiftool"); err != nil {
		t.Skip("exiftool not installed")
	}
	et, err := NewExiftool()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = et.Close() })

	_ = et.et.Close() // as if the process had died
	if _, err := et.Extract("testdata/sample.jpg"); err == nil {
		t.Fatal("want an error from a stopped exiftool")
	}
	if _, err := et.Extract("testdata/sample.jpg"); err != nil {
		t.Fatalf("after restart: %v", err)
	}
}

func TestDropLongValues(t *testing.T) {
	long := strings.Repeat("x", maxValueLength+1)
	fields := map[string]any{
		"Make":     "Fujifilm",
		"ISO":      float64(400),
		"Mask":     long,
		"Strokes":  []any{long[:maxValueLength], "xx"},
		"Keywords": []any{"autumn", "leaves"},
	}
	dropLongValues(fields)
	for _, k := range []string{"Mask", "Strokes"} {
		if _, ok := fields[k]; ok {
			t.Errorf("%s should be left out", k)
		}
	}
	for _, k := range []string{"Make", "ISO", "Keywords"} {
		if _, ok := fields[k]; !ok {
			t.Errorf("%s should be kept", k)
		}
	}
}
