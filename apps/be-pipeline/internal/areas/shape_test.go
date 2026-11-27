package areas

import "testing"

func TestPoints(t *testing.T) {
	shape := Shape{{{{1, 2}, {2, 2}, {1, 2}}}, {{{3, 4}, {4, 4}, {3, 4}}, {{3, 4}, {3, 4}}}}
	if got := Points(shape); got != 8 {
		t.Errorf("Points = %d, want 8", got)
	}
}
