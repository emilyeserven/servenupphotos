package bookpdf

import (
	"strings"
	"testing"
)

func TestSetPageSize(t *testing.T) {
	pdf := []byte("1 0 obj\n<</Type /Page /MediaBox [0 0 1921.9199 836.88] /Parent 2 0 R>>\nendobj\n3 0 obj\n<</Type /Page /MediaBox [0 0 1921.9199 836.88]>>\nendobj\nxref")
	got := SetPageSize(pdf, 26.681*72, 11.625*72)
	if len(got) != len(pdf) {
		t.Fatalf("SetPageSize() changed the PDF's length from %d to %d", len(pdf), len(got))
	}
	if n := strings.Count(string(got), "/MediaBox [0 0 1921.032 837    ]"); n != 2 {
		t.Errorf("SetPageSize() = %s, want both pages 1921.032 × 837", got)
	}
	// A size with too few bytes for the new numbers is left as it was.
	short := []byte("/MediaBox [0 0 1 2]")
	if got := SetPageSize(short, 1921.032, 837); string(got) != string(short) {
		t.Errorf("SetPageSize(short) = %s, want it unchanged", got)
	}
}
