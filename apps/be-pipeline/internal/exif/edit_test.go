package exif

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestExiftoolWriteEditTags(t *testing.T) {
	if _, err := exec.LookPath("exiftool"); err != nil {
		t.Skip("exiftool not installed")
	}
	et, err := NewExiftool()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = et.Close() })

	data, err := os.ReadFile("testdata/sample.jpg")
	if err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(t.TempDir(), "photo.jpg")
	if err := os.WriteFile(path, data, 0o600); err != nil { //nolint:gosec // path is in t.TempDir()
		t.Fatal(err)
	}

	want := map[string]string{
		"createDate":  "2016:12:24 06:07:39",
		"gpsPosition": "37.5826, -126.977",
		"city":        "Seoul",
		"state":       "Seoul",
		"country":     "South Korea",
		"camera":      "X-T5",
		"lens":        "Color Skopar 21mm",
		"aperture":    "5.6",
		"exposure":    "1/125",
		"iso":         "400",
		"focalLength": "21",
	}
	tags := map[string]string{}
	for field, value := range want {
		ft, err := EditTags(field, value)
		if err != nil {
			t.Fatalf("EditTags(%q, %q): %v", field, value, err)
		}
		for k, v := range ft {
			tags[k] = v
		}
	}
	if err := et.Write(path, tags); err != nil {
		t.Fatalf("Write: %v", err)
	}
	fields, err := et.Extract(path)
	if err != nil {
		t.Fatal(err)
	}
	s := Sanitize(fields)
	for _, field := range EditableFields {
		if have := ReadValue(field, s); !SameValue(field, want[field], have) {
			t.Errorf("%s reads %v after writing %q", field, deref(have), want[field])
		}
	}
}

func deref(s *string) string {
	if s == nil {
		return "<nil>"
	}
	return *s
}

func TestEditTagsRefusesBadValues(t *testing.T) {
	tests := []struct{ field, value, want string }{
		{"createDate", "2016-12-24 06:07", "2016:12:23 22:07:39"},
		{"gpsPosition", "somewhere", "latitude, longitude"},
		{"gpsPosition", "100, 20", "latitude, longitude"},
		{"aperture", "-2", "number above 0"},
		{"iso", "100.5", "number above 0"},
		{"exposure", "fast", "1/125"},
		{"city", "  ", "give city a value"},
		{"city", "two\nlines", "one line"},
		{"notes", "x", "can't be written"},
	}
	for _, tt := range tests {
		if _, err := EditTags(tt.field, tt.value); err == nil || !strings.Contains(err.Error(), tt.want) {
			t.Errorf("EditTags(%q, %q) = %v, want an error saying %q", tt.field, tt.value, err, tt.want)
		}
	}
}

func TestSameValue(t *testing.T) {
	dms := `37 deg 34' 57.36" N, 126 deg 58' 37.20" E`
	tests := []struct {
		field, want string
		have        *string
		same        bool
	}{
		{"createDate", "2016:12:24 06:07:39", ptr("2016:12:24 06:07:39.123+09:00"), true},
		{"createDate", "2016:12:24 06:07:39", ptr("2016:12:23 22:07:39"), false},
		{"gpsPosition", "37.5826, 126.977", &dms, true},
		{"gpsPosition", "37.6, 126.977", &dms, false},
		{"aperture", "5.6", ptr("5.6"), true},
		{"iso", "400", ptr("400"), true},
		{"city", "Seoul", ptr("Seoul"), true},
		{"city", "Seoul", ptr("Busan"), false},
		{"city", "Seoul", nil, false},
	}
	for _, tt := range tests {
		if got := SameValue(tt.field, tt.want, tt.have); got != tt.same {
			t.Errorf("SameValue(%q, %q, %v) = %v, want %v", tt.field, tt.want, deref(tt.have), got, tt.same)
		}
	}
}

func ptr(s string) *string { return &s }
