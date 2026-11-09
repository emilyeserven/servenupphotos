package github

import (
	"encoding/json"
	"os"
	"sort"
	"strings"
	"testing"
)

// kindNames is kinds' names, sorted and joined by spaces.
func kindNames(kinds []combinedKind) string {
	out := make([]string, 0, len(kinds))
	for _, k := range kinds {
		out = append(out, k.name)
	}
	sort.Strings(out)
	return strings.Join(out, " ")
}

// fieldNames is the keys of fields, sorted and joined by spaces.
func fieldNames[T any](fields map[string]*T) string {
	out := make([]string, 0, len(fields))
	for name := range fields {
		out = append(out, name)
	}
	sort.Strings(out)
	return strings.Join(out, " ")
}

func TestEveryKindHasItsFields(t *testing.T) {
	if got, want := fieldNames(kindFields[InFlightAllPhotos](&CombinedFiles{})), kindNames(combinedKinds()); got != want {
		t.Errorf("CombinedFiles fields = %s, want %s", got, want)
	}
	if got, want := fieldNames(kindFields[InFlightGroups](&InFlightResult{})), kindNames(groupKinds()); got != want {
		t.Errorf("InFlightResult groups = %s, want %s", got, want)
	}
}

// TestKindsMatchTheScriptsList keeps dataKinds and scripts/data-kinds.json,
// which the "Combine photo data" workflow and `pnpm photos:local` read, the
// same kinds in the same order.
func TestKindsMatchTheScriptsList(t *testing.T) {
	b, err := os.ReadFile("../../../../scripts/data-kinds.json")
	if err != nil {
		t.Fatal(err)
	}
	var listed []struct{ Folder, All string }
	if err := json.Unmarshal(b, &listed); err != nil {
		t.Fatal(err)
	}
	if len(listed) != len(dataKinds) {
		t.Fatalf("scripts/data-kinds.json has %d kinds, want %d", len(listed), len(dataKinds))
	}
	for i, k := range dataKinds {
		if listed[i].Folder != k.folder || listed[i].All != k.allFile {
			t.Errorf("scripts/data-kinds.json[%d] = %+v, want %s %s", i, listed[i], k.folder, k.allFile)
		}
	}
}

func TestSnapshotQueryReadsEveryKind(t *testing.T) {
	for _, k := range combinedKinds() {
		field := "    " + k.name + ": object(expression: $" + k.name + ") { ...files }\n"
		if !strings.Contains(snapshotQuery, field) || !strings.Contains(snapshotQuery, "$"+k.name+": String!") {
			t.Errorf("snapshotQuery doesn't read %s", k.name)
		}
	}
}
