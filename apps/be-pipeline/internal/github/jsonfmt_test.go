package github

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// TestFormatJSONArrayMatchesOxfmt formats each file's entries again and
// expects the bytes oxfmt wrote after jq combined them, as the "Combine photo
// data" workflow does: ALLPHOTOS.json as the portfolio has it, and arrays.json
// formatted that way for the edge cases.
func TestFormatJSONArrayMatchesOxfmt(t *testing.T) {
	for _, tt := range []struct{ in, want string }{
		{"testdata/combined/ALLPHOTOS.json", "testdata/combined/ALLPHOTOS.json"},
		{"testdata/combined/arrays.json", "testdata/combined/arrays.want.json"},
	} {
		t.Run(tt.in, func(t *testing.T) {
			in, err := os.ReadFile(tt.in)
			if err != nil {
				t.Fatal(err)
			}
			want, err := os.ReadFile(tt.want)
			if err != nil {
				t.Fatal(err)
			}
			var entries []json.RawMessage
			if err := json.Unmarshal(in, &entries); err != nil {
				t.Fatal(err)
			}
			got, err := formatJSONArray(entries)
			if err != nil {
				t.Fatalf("formatJSONArray() error = %v", err)
			}
			if string(got) != string(want) {
				t.Errorf("formatJSONArray() =\n%s\nwant\n%s", got, want)
			}
		})
	}
}

func TestFormatJSONArrayEmpty(t *testing.T) {
	got, err := formatJSONArray(nil)
	if err != nil || string(got) != "[]\n" {
		t.Errorf("formatJSONArray(nil) = %q, %v; want []", got, err)
	}
	if _, err := formatJSONArray([]json.RawMessage{json.RawMessage(`{"a":`)}); err == nil {
		t.Error("formatJSONArray() of broken JSON: want an error")
	}
}

func TestBlobSHA(t *testing.T) {
	content, err := os.ReadFile("testdata/combined/arrays.want.json")
	if err != nil {
		t.Fatal(err)
	}
	// git hash-object testdata/combined/arrays.want.json
	const want = "31d9d10263ce2a1e452ffc769e5fa8ec1fc84fb3"
	if got := blobSHA(content); got != want {
		t.Errorf("blobSHA() = %s, want %s", got, want)
	}
}

// TestFormatJSONFileMatchesCommittedData formats every committed photo,
// album, tag, place and localization file again and expects it unchanged,
// since CI checks them all with oxfmt.
func TestFormatJSONFileMatchesCommittedData(t *testing.T) {
	paths, err := filepath.Glob("../../../portfolio/src/data/*/*.json")
	if err != nil || len(paths) == 0 {
		t.Fatalf("no data files found: %v", err)
	}
	for _, p := range paths {
		want, err := os.ReadFile(p) //nolint:gosec // A path from the Glob above.
		if err != nil {
			t.Fatal(err)
		}
		if got := formatJSONFile(want); string(got) != string(want) {
			t.Errorf("formatJSONFile(%s) =\n%s\nwant\n%s", p, got, want)
		}
	}
}

func TestFormatJSONFileCollapsesShortLists(t *testing.T) {
	in := "{\n  \"tags\": [\n    \"a\"\n  ],\n  \"places\": [\n    {\n      \"id\": \"x\"\n    }\n  ]\n}"
	want := "{\n  \"tags\": [\"a\"],\n  \"places\": [\n    {\n      \"id\": \"x\"\n    }\n  ]\n}\n"
	if got := formatJSONFile([]byte(in)); string(got) != want {
		t.Errorf("formatJSONFile() =\n%s\nwant\n%s", got, want)
	}
	if got := formatJSONFile([]byte(`{"a":`)); string(got) != `{"a":` {
		t.Errorf("formatJSONFile() of broken JSON = %q, want it unchanged", got)
	}
}
