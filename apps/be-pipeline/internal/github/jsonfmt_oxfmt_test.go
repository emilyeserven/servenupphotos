package github

import (
	"bytes"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// oxfmtCases are data shapes the pipeline commits, each checked against the
// real oxfmt: lists of lists (trip line points, GeoJSON coordinates), short
// and long lists, long lists of numbers (a trip line's photos), nested
// objects, and text that isn't ASCII.
var oxfmtCases = []string{
	`{"path":[[32.658169,25.719],[32.658163,25.719003],[32.65815,25.71901]]}`,
	`{"geometry":{"type":"LineString","coordinates":[[32.60537222222222,25.723936111111108],[32.601583,25.740389]]}}`,
	`{"one":[[1,2]],"uneven":[[1,2],[3]],"singles":[[1],[2]],"deep":[[[1,2],[3,4]],[[5,6],[7,8]]]}`,
	`{"empty":[],"emptyObject":{},"nested":[[]],"objs":[{"a":1},{"b":[1,2]}],"mixed":[[1,2],{"a":1}]}`,
	`{"tags":["aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","ccccc"]}`,
	`{"edge":["xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"]}`,
	`{"n":[1,2.5,-3e2],"html":"<b>&amp;</b> \"q\" é 東京","x":null,"y":true}`,
	`{"a":{"b":{"c":{"photos":[419,420,421,422,423,424,425,426,427,428,429,430,431,432,433,434,435,436,437,438]}}}}`,
	`{"kkkkkkkkkkkkkkkkkk":{"x":[2621907,8,337,8354629,60289,-8.5,8,213,9966910,8070272,7,53118,983,274,848,4,1,7]}}`,
	`{"kkkkkkkkkkkkkkkkkk":{"x":[2621907,8,337,8354629,60289,-8.5,8,213,9966910,8070272,7,53118,983,274,848,4,1]}}`,
	`[{"day":"2025-01-20","lines":[{"mode":"walk","photos":[358,359],"path":[[32.6,25.7],[32.7,25.8]]}]}]`,
}

// TestFormatJSONFileAgreesWithOxfmt runs the repository's own oxfmt on each
// case and expects formatJSONFile to print the same bytes, so a file the
// pipeline commits always passes CI's formatting check. Locally it's skipped
// when node_modules hasn't been installed; CI sets REQUIRE_OXFMT so it can't be
// skipped there.
func TestFormatJSONFileAgreesWithOxfmt(t *testing.T) {
	oxfmt, config := findOxfmt(t)
	for _, c := range oxfmtCases {
		// jq's indented output, as the files are before oxfmt sees them.
		var indented bytes.Buffer
		if err := json.Indent(&indented, []byte(c), "", "  "); err != nil {
			t.Fatal(err)
		}
		cmd := exec.CommandContext(t.Context(), oxfmt, "--stdin-filepath", "case.json", "-c", config) //nolint:gosec // The repository's own oxfmt.
		cmd.Stdin = &indented
		want, err := cmd.Output()
		if err != nil {
			t.Fatalf("oxfmt on %s: %v", c, err)
		}
		if got := formatJSONFile([]byte(c)); string(got) != string(want) {
			t.Errorf("formatJSONFile(%s) =\n%s\noxfmt prints\n%s", c, got, want)
		}
	}
}

// findOxfmt finds the oxfmt binary and .oxfmtrc.json at the repository root.
func findOxfmt(t *testing.T) (binary, config string) {
	t.Helper()
	root, err := filepath.Abs("../../../..")
	if err != nil {
		t.Fatal(err)
	}
	binary = filepath.Join(root, "node_modules", ".bin", "oxfmt")
	if _, err := os.Stat(binary); err != nil {
		if strings.TrimSpace(os.Getenv("REQUIRE_OXFMT")) != "" {
			t.Fatalf("oxfmt not found at %s; run pnpm install", binary)
		}
		t.Skip("oxfmt isn't installed; run pnpm install to check against it")
	}
	return binary, filepath.Join(root, ".oxfmtrc.json")
}
