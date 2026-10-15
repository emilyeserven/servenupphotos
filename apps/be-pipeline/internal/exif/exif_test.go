package exif

import (
	"os/exec"
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
