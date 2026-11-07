package httpapi

import (
	"errors"
	"strings"
	"testing"
)

// fakeExifFile is an Extractor and Writer over one photo's EXIF fields, held
// in memory; written tags are kept unless they're in ignore, as exiftool
// does when it can't write a tag.
type fakeExifFile struct {
	fields  map[string]any
	ignore  map[string]bool
	written map[string]string
	fail    bool
}

func (f *fakeExifFile) Extract(string) (map[string]any, error) {
	out := map[string]any{}
	for k, v := range f.fields {
		out[k] = v
	}
	return out, nil
}

func (f *fakeExifFile) Write(_ string, tags map[string]string) error {
	if f.fail {
		return errors.New("exiftool failed")
	}
	f.written = tags
	for k, v := range tags {
		if !f.ignore[k] {
			f.fields[k] = v
		}
	}
	return nil
}

func TestR2ExifWriteChecked(t *testing.T) {
	file := &fakeExifFile{fields: map[string]any{"CreateDate": "2016:12:23 22:07:39"}}
	edit := r2ExifEdit{extractor: file, writer: file}
	fields := []r2ExifFieldValue{{Field: "createDate", Value: "2016:12:24 06:07:39", Lightroom: true}, {Field: "city", Value: "Seoul", Lightroom: true}}
	tags, msg := r2ExifTags(fields)
	if msg != "" {
		t.Fatalf("r2ExifTags() = %q", msg)
	}
	edits, after, perr := edit.writeChecked("photo.jpg", fields, tags)
	if perr != nil {
		t.Fatalf("writeChecked() = %v", perr)
	}
	if file.written["DateTimeOriginal"] != "2016:12:24 06:07:39" || file.written["City"] != "Seoul" {
		t.Errorf("wrote %v, want the date and city tags", file.written)
	}
	if len(edits) != 2 || edits[0].From == nil || *edits[0].From != "2016:12:23 22:07:39" || edits[1].From != nil {
		t.Errorf("edits = %+v, want each field's value before", edits)
	}
	if after.City == nil || *after.City != "Seoul" {
		t.Errorf("after = %+v, want the new city", after)
	}
}

func TestR2ExifWriteCheckedRefusesUnwrittenFields(t *testing.T) {
	tests := []struct {
		name string
		file *fakeExifFile
		want string
	}{
		{"exiftool fails", &fakeExifFile{fields: map[string]any{}, fail: true}, "couldn't write"},
		{"field reads the old value", &fakeExifFile{fields: map[string]any{}, ignore: map[string]bool{"City": true}}, "still reads differently"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fields := []r2ExifFieldValue{{Field: "city", Value: "Seoul", Lightroom: true}}
			tags, _ := r2ExifTags(fields)
			_, _, perr := r2ExifEdit{extractor: tt.file, writer: tt.file}.writeChecked("photo.jpg", fields, tags)
			if perr == nil || !strings.Contains(perr.Message, tt.want) || !strings.Contains(perr.Message, "wasn't changed") {
				t.Errorf("writeChecked() = %v, want an error saying %q", perr, tt.want)
			}
		})
	}
}

func TestR2ExifTagsProblems(t *testing.T) {
	tests := []struct {
		name   string
		fields []r2ExifFieldValue
		want   string
	}{
		{"none", nil, "at least one"},
		{"twice", []r2ExifFieldValue{{Field: "city", Value: "a", Lightroom: true}, {Field: "city", Value: "b", Lightroom: true}}, "listed twice"},
		{"not editable", []r2ExifFieldValue{{Field: "title", Value: "a", Lightroom: true}}, "can't be written"},
		{"not in Lightroom yet", []r2ExifFieldValue{{Field: "city", Value: "a"}}, "in Lightroom first"},
		{"bad value", []r2ExifFieldValue{{Field: "createDate", Value: "yesterday", Lightroom: true}}, "Couldn't write createDate"},
	}
	for _, tt := range tests {
		if _, msg := r2ExifTags(tt.fields); !strings.Contains(msg, tt.want) {
			t.Errorf("%s: r2ExifTags() = %q, want %q", tt.name, msg, tt.want)
		}
	}
}
