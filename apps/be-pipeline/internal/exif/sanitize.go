package exif

// Sanitized is the small, publishable subset of a photo's metadata.
// A field is nil when the photo does not carry it.
type Sanitized struct {
	Camera      *string `json:"camera"`
	Lens        *string `json:"lens"`
	GPSPosition *string `json:"gpsPosition"`
	CreateDate  *string `json:"createDate"`
	Country     *string `json:"country"`
	City        *string `json:"city"`
	Images      Images  `json:"images"`
}

// Images are the links to a photo's published copies. Sanitize leaves them
// nil; they are filled in once the photo is uploaded.
type Images struct {
	// Full is the public URL of the original photo in R2.
	Full *string `json:"full"`
	// Key is the original photo's object key in the R2 bucket.
	Key *string `json:"key"`
}

// Sanitize picks the publishable fields out of exiftool's output, taking the
// first non-empty field from each list of candidates. Values are kept as
// exiftool formats them.
func Sanitize(fields map[string]any) Sanitized {
	return Sanitized{
		Camera: first(fields, "CameraProfilesUniqueCameraModel", "Model"),
		// Only Lightroom-processed files carry CameraProfilesLens.
		Lens:        first(fields, "CameraProfilesLens", "LensModel", "Lens"),
		GPSPosition: first(fields, "GPSPosition"),
		CreateDate:  first(fields, "CreateDate"),
		Country:     first(fields, "Country"),
		City:        first(fields, "City"),
	}
}

func first(fields map[string]any, keys ...string) *string {
	for _, k := range keys {
		if s, ok := fields[k].(string); ok && s != "" {
			return &s
		}
	}
	return nil
}
