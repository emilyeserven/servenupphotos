package github

import (
	"net/http"
	"strings"
)

// PhotoBookCameraName is a camera a book's captions call by another name,
// such as "X-T5" for "Fujifilm X-T5", set on the book's Info tab.
type PhotoBookCameraName struct {
	// Camera is the camera's name as the photo's data has it, after camera
	// overrides.
	Camera string `json:"camera"`
	// Name is what the book's captions call it instead.
	Name string `json:"name"`
}

// maxPhotoBookCameraNames is the most cameras a book can rename.
const maxPhotoBookCameraNames = 100

// validCameraNames returns a book's camera names trimmed, without ones that
// rename nothing, each camera once; or why they can't be saved.
func validCameraNames(names []PhotoBookCameraName) ([]PhotoBookCameraName, *PublishError) {
	var out []PhotoBookCameraName
	seen := map[string]bool{}
	for _, n := range names {
		n.Camera, n.Name = strings.TrimSpace(n.Camera), strings.TrimSpace(n.Name)
		switch {
		case n.Camera == "" || n.Name == "" || n.Name == n.Camera:
			continue
		case tooLongEntryText(n.Camera) || tooLongEntryText(n.Name):
			return nil, publishErr(http.StatusBadRequest, "Keep each camera and its name in the book to %d characters.", maxEntryTextLength)
		case seen[n.Camera]:
			return nil, publishErr(http.StatusBadRequest, "The camera %q has more than one name in the book. Keep one.", n.Camera)
		}
		seen[n.Camera] = true
		out = append(out, n)
	}
	if len(out) > maxPhotoBookCameraNames {
		return nil, publishErr(http.StatusBadRequest, "A photo book can rename up to %d cameras.", maxPhotoBookCameraNames)
	}
	return out, nil
}
