package offline

import (
	"encoding/json"
	"path"
	"strings"
)

// savedThumbnails is the part of a photo's JSON that names its small images.
type savedThumbnails struct {
	Images struct {
		Thumbnail        string `json:"thumbnail"`
		ThumbnailPreview string `json:"thumbnailpreview"`
		Small            string `json:"small"`
	} `json:"images"`
}

// ThumbnailURLs are the Square Thumbnail, Thumbnail Preview and Small version
// the pages preview a photo with: the ones saved in its JSON data, or else the
// ones next to its image at imageURL, as the Gallery and Photos in Flight pick
// them. Without either it has none.
func ThumbnailURLs(data json.RawMessage, imageURL string) []string {
	var saved savedThumbnails
	_ = json.Unmarshal(data, &saved) // a file that can't be read just has none saved
	var urls []string
	for _, pick := range []struct{ saved, name string }{
		{saved.Images.Thumbnail, "thumbnail"},
		{saved.Images.ThumbnailPreview, "thumbnailpreview"},
		{saved.Images.Small, "small"},
	} {
		if url := thumbnailURL(pick.saved, imageURL, pick.name); url != "" {
			urls = append(urls, url)
		}
	}
	return urls
}

// thumbnailURL is saved, or else the version called name next to imageURL.
func thumbnailURL(saved, imageURL, name string) string {
	if saved != "" {
		return saved
	}
	if imageURL == "" {
		return ""
	}
	return strings.TrimSuffix(imageURL, path.Ext(imageURL)) + "-" + name + ".webp"
}
