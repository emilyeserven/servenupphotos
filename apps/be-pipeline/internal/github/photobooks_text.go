package github

import "net/http"

// textSides are the sides of a text page its text can go on, beside its
// photos; "" (absent) puts the text above them.
var textSides = []string{"", "left", "right"}

// validTextSide is page n's text side: a text page's "left", "right" or ""
// for text above its photos, and "" on any other page.
func validTextSide(page PhotoBookPage, n int) (string, *PublishError) {
	if page.Layout != "text" {
		return "", nil
	}
	for _, side := range textSides {
		if page.TextSide == side {
			return side, nil
		}
	}
	return "", publishErr(http.StatusBadRequest, "Page %d's text can go above its photos, or to their left or right, not %q.", n, page.TextSide)
}
