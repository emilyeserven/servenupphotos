package exif

import (
	"encoding/json"
	"math"
	"strconv"
	"strings"
)

// Sanitized is the small, publishable subset of a photo's metadata.
// A field is nil when the photo does not carry it.
type Sanitized struct {
	// Title is the photo's name on the portfolio. Sanitize leaves it nil; it
	// is written on the Photo page before saving, and the portfolio falls back
	// to the file name without one.
	Title *string `json:"title"`
	// Comment is the photographer's note about the photo, in Markdown.
	// Sanitize leaves it nil; it is written on the Photo page before saving.
	Comment *string `json:"comment"`
	Camera  *string `json:"camera"`
	Lens    *string `json:"lens"`
	// Aperture is the f-number, such as 5.6 for f/5.6.
	Aperture *float64 `json:"aperture"`
	// Exposure is the exposure time in seconds as exiftool writes it, such
	// as "1/60" or "2".
	Exposure *string `json:"exposure"`
	ISO      *int    `json:"iso"`
	// FocalLength is the lens's focal length in millimeters, such as 18 or
	// 4.2, as the lens set it rather than its 35 mm equivalent.
	FocalLength *float64 `json:"focalLength"`
	GPSPosition *string  `json:"gpsPosition"`
	// CustomGPSPosition is a GPS position written on the Photo page, as
	// "latitude, longitude" in decimal degrees, which the portfolio uses
	// instead of GPSPosition. It leaves the EXIF one as it is. Sanitize
	// leaves it nil.
	CustomGPSPosition *string `json:"customGpsPosition"`
	CreateDate        *string `json:"createDate"`
	// PlaceName is the name of the place the photo was taken, such as a
	// park or a building, which the portfolio shows before the city.
	// Sanitize leaves it nil; it is written on the Photo page before saving.
	PlaceName *string `json:"placeName"`
	// CustomCity, CustomState and CustomCountry are a city, state (or
	// province, prefecture, …) and country written on the Photo page, which
	// the portfolio shows instead of City, State and Country. They leave the
	// EXIF ones as they are. Sanitize leaves them nil.
	CustomCity    *string `json:"customCity"`
	CustomState   *string `json:"customState"`
	CustomCountry *string `json:"customCountry"`
	Country       *string `json:"country"`
	// State is the state, province, prefecture or other region between the
	// city and the country, from the EXIF's State or Province-State.
	State *string `json:"state"`
	City  *string `json:"city"`
	// Width and Height are the original photo's size in pixels, as it is
	// shown: swapped from the stored size when EXIF says to turn it 90°.
	Width  *int   `json:"width"`
	Height *int   `json:"height"`
	Images Images `json:"images"`

	// IsSocialMediaEligible marks a photo that may be posted to social media,
	// such as Instagram. Sanitize leaves it false.
	IsSocialMediaEligible bool `json:"isSocialMediaEligible"`
	// WebsiteSpotlight is the photo's place among the photos spotlighted on
	// the site, or nil when it isn't spotlighted. Sanitize leaves it nil.
	WebsiteSpotlight *int `json:"websiteSpotlight"`
	// SocialMediaPublishDate is the day the photo is scheduled to be posted
	// to social media, as YYYY-MM-DD, or nil when it isn't scheduled. It's
	// set on the Instagram page; Sanitize leaves it nil.
	SocialMediaPublishDate *string `json:"socialMediaPublishDate"`
	// ExifOriginals are the EXIF values of the fields a camera override
	// changed, by field, such as {"lens": "21.0 mm"}, so the overrides can be
	// applied again after they change. Sanitize leaves it nil.
	ExifOriginals map[string]json.RawMessage `json:"exifOriginals"`
	// ManualAperture marks a photo taken at an aperture EXIF doesn't know,
	// such as with a manual lens, which the portfolio shows as manual rather
	// than leaving out. Its Aperture is nil. Sanitize leaves it false.
	ManualAperture bool `json:"manualAperture"`
	// CustomLens is the ID of the custom lens picked for the photo on the
	// Photo page, from LENSES.json, whose name, focal length and aperture
	// are written over its EXIF; nil for none. Sanitize leaves it nil.
	CustomLens *string `json:"customLens"`
}

// Images are the links to a photo's published copies. Sanitize leaves them
// nil; they are filled in once the photo is uploaded.
type Images struct {
	// Full is the public URL of the original photo in R2.
	Full *string `json:"full"`
	// Key is the original photo's object key in the R2 bucket.
	Key *string `json:"key"`
	// XLarge, Large, Medium, Small and XSmall are the public URLs of the
	// photo's resized WEBP versions in R2, at most 2500, 1800, 1200, 500 and
	// 250 pixels on the longest edge.
	XLarge *string `json:"xlarge"`
	Large  *string `json:"large"`
	Medium *string `json:"medium"`
	Small  *string `json:"small"`
	XSmall *string `json:"xsmall"`
	// Preview is the public URL of a tiny, low-quality WEBP of at most 40
	// pixels on the longest edge, to show blurred while a version loads.
	Preview *string `json:"preview"`
	// Thumbnail is the public URL of a 500×500 WEBP cut from a square of
	// the photo picked before uploading, for square tiles like the Grid's.
	Thumbnail *string `json:"thumbnail"`
	// ThumbnailPreview is the public URL of a tiny, low-quality 40×40 WEBP
	// cut from the same square as Thumbnail, to show blurred while it loads.
	ThumbnailPreview *string `json:"thumbnailpreview"`
	// ThumbnailCrop is the square of the photo Thumbnail and
	// ThumbnailPreview are cut from, and the size Thumbnail is scaled to.
	ThumbnailCrop *ThumbnailCrop `json:"thumbnailcrop"`
}

// ThumbnailCrop is where a photo's Square Thumbnail is cut from, in pixels
// of the photo turned upright from its EXIF orientation: "500 × 500 px from
// a 4220 × 4220 px square at 1710, 0" is {1710, 0, 4220, 500}.
type ThumbnailCrop struct {
	// X and Y are the square's top-left corner.
	X int `json:"x"`
	Y int `json:"y"`
	// Size is the square's width and height on the photo.
	Size int `json:"size"`
	// OutputSize is the Thumbnail's width and height, whatever Size is.
	OutputSize int `json:"outputSize"`
}

// SanitizeFields are the JSON fields of Sanitized that Sanitize fills from a
// photo's EXIF. Backfill reads a photo's EXIF only for these.
var SanitizeFields = []string{
	"camera", "lens", "aperture", "exposure", "iso", "focalLength",
	"gpsPosition", "createDate", "country", "state", "city", "width", "height",
}

// Sanitize picks the publishable fields out of exiftool's output, taking the
// first non-empty field from each list of candidates. Values are kept as
// exiftool formats them.
func Sanitize(fields map[string]any) Sanitized {
	width, height := size(fields)
	return Sanitized{
		Camera: first(fields, "CameraProfilesUniqueCameraModel", "Model"),
		// Only Lightroom-processed files carry CameraProfilesLens.
		Lens:        first(fields, "CameraProfilesLens", "LensModel", "Lens"),
		Aperture:    aperture(fields),
		Exposure:    exposure(fields),
		ISO:         iso(fields),
		FocalLength: focalLength(fields),
		GPSPosition: first(fields, "GPSPosition"),
		CreateDate:  first(fields, "CreateDate"),
		Country:     first(fields, "Country"),
		State:       first(fields, "State", "Province-State"),
		City:        first(fields, "City"),
		Width:       width,
		Height:      height,
	}
}

// aperture returns the f-number from FNumber, or from the composite Aperture
// when the photo lacks it. Lenses without electronic contacts report 0, which
// counts as unknown.
func aperture(fields map[string]any) *float64 {
	for _, k := range []string{"FNumber", "Aperture"} {
		if n, ok := number(fields[k]); ok && n > 0 {
			return &n
		}
	}
	return nil
}

// exposure returns the exposure time from ExposureTime, or from the composite
// ShutterSpeed. exiftool writes fractions of a second as strings like "1/60"
// and whole or decimal seconds as JSON numbers, which are kept as strings.
func exposure(fields map[string]any) *string {
	for _, k := range []string{"ExposureTime", "ShutterSpeed"} {
		switch v := fields[k].(type) {
		case string:
			if v != "" {
				return &v
			}
		case float64:
			if v > 0 {
				s := strconv.FormatFloat(v, 'f', -1, 64)
				return &s
			}
		}
	}
	return nil
}

// iso returns the ISO speed. Some cameras write it as a string, such as
// "100" or a list like "100 0", so the first whole number in it is used.
func iso(fields map[string]any) *int {
	switch v := fields["ISO"].(type) {
	case float64:
		if n, ok := pixels(v); ok {
			return &n
		}
	case string:
		if f := strings.Fields(v); len(f) > 0 {
			if n, err := strconv.Atoi(f[0]); err == nil && n > 0 {
				return &n
			}
		}
	}
	return nil
}

// focalLength returns the focal length in millimeters from FocalLength,
// which exiftool writes as a string like "18.0 mm".
func focalLength(fields map[string]any) *float64 {
	v := fields["FocalLength"]
	if s, ok := v.(string); ok {
		v = strings.TrimSuffix(strings.TrimSpace(s), "mm")
	}
	if n, ok := number(v); ok && n > 0 {
		return &n
	}
	return nil
}

// number reads a value exiftool reported as a JSON number, or as a string
// holding one.
func number(v any) (float64, bool) {
	switch n := v.(type) {
	case float64:
		return n, true
	case string:
		f, err := strconv.ParseFloat(strings.TrimSpace(n), 64)
		return f, err == nil
	}
	return 0, false
}

// size returns the photo's width and height as it is shown, or nil when
// exiftool didn't report them. Orientations 5 to 8, which exiftool writes as
// "Rotate 90 CW", "Mirror horizontal and rotate 270 CW" and so on, turn the
// photo on its side, so its stored width becomes its height.
func size(fields map[string]any) (width, height *int) {
	w, wok := pixels(fields["ImageWidth"])
	h, hok := pixels(fields["ImageHeight"])
	if !wok || !hok {
		return nil, nil
	}
	if o, _ := fields["Orientation"].(string); strings.Contains(o, "90") || strings.Contains(o, "270") {
		w, h = h, w
	}
	return &w, &h
}

// pixels reads a pixel count, or another positive whole number, that
// exiftool reported as a JSON number.
func pixels(v any) (int, bool) {
	n, ok := v.(float64)
	if !ok || n <= 0 || n != math.Trunc(n) || n > math.MaxInt32 {
		return 0, false
	}
	return int(n), true
}

func first(fields map[string]any, keys ...string) *string {
	for _, k := range keys {
		if s, ok := fields[k].(string); ok && s != "" {
			return &s
		}
	}
	return nil
}
