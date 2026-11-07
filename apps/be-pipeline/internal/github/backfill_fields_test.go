package github

import (
	"os"
	"testing"
)

// oldPhotoGaps is every field Missing fields adds to oldPhoto, in the order
// findGaps finds them: the fields of newPhotoJSON it doesn't have. A field
// added to newPhotoJSON goes here on its own line, where it falls in the
// file, and in testdata/backfill/filled.json, which is oldPhoto once they're
// added; TestBackfill counts them from here.
var oldPhotoGaps = []string{
	"id",
	"title",
	"comment",
	"altText",
	"notes",
	"addedDate",
	"aperture",
	"exposure",
	"iso",
	"focalLength",
	"customGpsPosition",
	"customCreateDate",
	"placeName",
	"customCity",
	"customState",
	"customCountry",
	"state",
	"images.xlarge",
	"images.large",
	"images.small",
	"images.xsmall",
	"images.preview",
	"images.thumbnail",
	"images.thumbnailpreview",
	"images.thumbnailcrop",
	"isSocialMediaEligible",
	"websiteSpotlight",
	"socialMediaPublishDate",
	"exifOriginals",
	"manualAperture",
	"customLens",
	"albums",
	"tags",
	"genres",
	"places",
	"noGps",
	"spotlightZones",
	"spotlightFocus",
	"spotlightPlacement",
	"socialPosts",
	"reEdit",
	"pickedSimilar",
	"pickedSimilarNotes",
	"similarPhotos",
}

// filledOldPhoto is testdata/backfill/filled.json: oldPhoto with every field
// in oldPhotoGaps added.
func filledOldPhoto(t *testing.T) string {
	t.Helper()
	content, err := os.ReadFile("testdata/backfill/filled.json")
	if err != nil {
		t.Fatal(err)
	}
	return string(content)
}
