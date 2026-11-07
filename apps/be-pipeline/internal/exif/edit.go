package exif

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/barasher/go-exiftool"
)

// Writer writes metadata into the image at path, in place.
type Writer interface {
	// Write sets each exiftool tag in tags to its value.
	Write(path string, tags map[string]string) error
}

// Write sets each exiftool tag in tags, such as "DateTimeOriginal", to its
// value in the image at path, overwriting the file. A tag named without a
// group is created in exiftool's preferred group and changed in every other
// group the file already has it in, so a City in both IPTC and XMP changes in
// both.
func (e *Exiftool) Write(path string, tags map[string]string) error {
	fields := make(map[string]any, len(tags))
	for k, v := range tags {
		fields[k] = v
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	md := []exiftool.FileMetadata{{File: path, Fields: fields}}
	e.et.WriteMetadata(md)
	if err := md[0].Err; err != nil {
		e.restartAfter(err)
		return fmt.Errorf("write metadata: %w", err)
	}
	return nil
}

// EditableFields are the photo fields whose value can be written into an
// original's EXIF in R2, in the order they're listed: each is a field
// Sanitize reads, and the tags EditTags writes are the ones it reads them
// from.
var EditableFields = []string{
	"createDate", "gpsPosition", "city", "state", "country",
	"camera", "lens", "aperture", "exposure", "iso", "focalLength",
}

// maxEditLength is the longest a text value written into the EXIF can be.
const maxEditLength = 200

var (
	exifDate     = regexp.MustCompile(`^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$`)
	exposureTime = regexp.MustCompile(`^\d+(\.\d+)?(/\d+)?$`)
)

// textTags are the tags each text field is written to.
var textTags = map[string][]string{
	"city":    {"City"},
	"state":   {"State", "Province-State"},
	"country": {"Country", "Country-PrimaryLocationName"},
	// Sanitize reads Lightroom's camera and lens names first, so they're
	// written too, or the photo would still read as the old ones.
	"camera": {"Model", "CameraProfilesUniqueCameraModel"},
	"lens":   {"LensModel", "Lens", "CameraProfilesLens"},
}

// EditTags is the exiftool tags to write to set field, one of
// EditableFields, to value, written as the photo JSON writes it (a date as
// "2016:12:23 22:07:39", a GPS position as exiftool writes it or as
// "40.7795, -73.9634"). It fails with a message fit to show when value isn't
// one the field can take.
func EditTags(field, value string) (map[string]string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, fmt.Errorf("give %s a value", field)
	}
	if tags, ok := textTags[field]; ok {
		return textEditTags(field, value, tags)
	}
	return valueEditTags(field, value)
}

// textEditTags writes value to each of tags.
func textEditTags(field, value string, tags []string) (map[string]string, error) {
	if utf8.RuneCountInString(value) > maxEditLength || strings.ContainsAny(value, "\r\n") {
		return nil, fmt.Errorf("keep %s to one line of %d characters", field, maxEditLength)
	}
	out := map[string]string{}
	for _, t := range tags {
		out[t] = value
	}
	return out, nil
}

// valueEditTags is the tags of the fields that take a date, a position or a
// number.
func valueEditTags(field, value string) (map[string]string, error) {
	switch field {
	case "createDate":
		return dateTags(value)
	case "gpsPosition":
		return gpsTags(value)
	case "exposure":
		return matchTag(value, exposureTime, "ExposureTime", "write the exposure as seconds, such as 1/125 or 2")
	case "aperture", "focalLength", "iso":
		return numberTag(field, value)
	}
	return nil, fmt.Errorf("%s can't be written into the EXIF", field)
}

func dateTags(value string) (map[string]string, error) {
	if !exifDate.MatchString(value) {
		return nil, fmt.Errorf("write the date as 2016:12:23 22:07:39")
	}
	return map[string]string{"DateTimeOriginal": value, "CreateDate": value}, nil
}

func matchTag(value string, pattern *regexp.Regexp, tag, problem string) (map[string]string, error) {
	if !pattern.MatchString(value) {
		return nil, fmt.Errorf("%s", problem)
	}
	return map[string]string{tag: value}, nil
}

// numberTags are the tag each number field is written to.
var numberTags = map[string]string{"aperture": "FNumber", "focalLength": "FocalLength", "iso": "ISO"}

func numberTag(field, value string) (map[string]string, error) {
	n, err := strconv.ParseFloat(value, 64)
	if err != nil || n <= 0 || (field == "iso" && n != math.Trunc(n)) {
		return nil, fmt.Errorf("write %s as a number above 0", field)
	}
	return map[string]string{numberTags[field]: strconv.FormatFloat(n, 'f', -1, 64)}, nil
}

// gpsTags writes the position as the four GPS tags, each coordinate as a
// positive number with its hemisphere.
func gpsTags(value string) (map[string]string, error) {
	lat, lng, ok := ParseGPS(value)
	if !ok || math.Abs(lat) > 90 || math.Abs(lng) > 180 {
		return nil, fmt.Errorf("write the GPS position as latitude, longitude, such as 40.7795, -73.9634")
	}
	return map[string]string{
		"GPSLatitude": formatDegrees(lat), "GPSLatitudeRef": hemisphere(lat, "N", "S"),
		"GPSLongitude": formatDegrees(lng), "GPSLongitudeRef": hemisphere(lng, "E", "W"),
	}, nil
}

func formatDegrees(v float64) string { return strconv.FormatFloat(math.Abs(v), 'f', -1, 64) }

func hemisphere(v float64, positive, negative string) string {
	if v < 0 {
		return negative
	}
	return positive
}

// ReadValue is field's value in s, one of EditableFields, written as EditTags
// takes it; nil when s doesn't have it.
func ReadValue(field string, s Sanitized) *string {
	switch field {
	case "aperture":
		return formatFloat(s.Aperture)
	case "focalLength":
		return formatFloat(s.FocalLength)
	case "iso":
		return formatInt(s.ISO)
	}
	return textValue(field, s)
}

func textValue(field string, s Sanitized) *string {
	values := map[string]*string{
		"createDate": s.CreateDate, "gpsPosition": s.GPSPosition, "city": s.City, "state": s.State,
		"country": s.Country, "camera": s.Camera, "lens": s.Lens, "exposure": s.Exposure,
	}
	return values[field]
}

func formatFloat(n *float64) *string {
	if n == nil {
		return nil
	}
	v := strconv.FormatFloat(*n, 'f', -1, 64)
	return &v
}

func formatInt(n *int) *string {
	if n == nil {
		return nil
	}
	v := strconv.Itoa(*n)
	return &v
}

// gpsTolerance is how far apart, in degrees, two GPS positions can be and
// still count as the same: about 10 m, more than rounding to exiftool's
// hundredths of a second moves one.
const gpsTolerance = 0.0001

// SameValue reports whether have, a field's value read from the EXIF (nil
// when it has none), is want, the value the photo JSON has for it. Dates
// compare by their first 19 characters, so a fraction of a second or an
// offset on the EXIF's is ignored; GPS positions and numbers compare by
// value.
func SameValue(field, want string, have *string) bool {
	if have == nil {
		return false
	}
	a, b := strings.TrimSpace(want), strings.TrimSpace(*have)
	switch field {
	case "createDate":
		return prefix(a, 19) == prefix(b, 19)
	case "gpsPosition":
		return sameGPS(a, b)
	case "aperture", "focalLength", "iso":
		return sameNumber(a, b)
	}
	return a == b
}

func prefix(s string, n int) string {
	if len(s) > n {
		return s[:n]
	}
	return s
}

func sameGPS(a, b string) bool {
	aLat, aLng, aOK := ParseGPS(a)
	bLat, bLng, bOK := ParseGPS(b)
	return aOK && bOK && math.Abs(aLat-bLat) < gpsTolerance && math.Abs(aLng-bLng) < gpsTolerance
}

func sameNumber(a, b string) bool {
	x, errA := strconv.ParseFloat(a, 64)
	y, errB := strconv.ParseFloat(b, 64)
	return errA == nil && errB == nil && math.Abs(x-y) < 0.01
}

// exifCoordinate matches one coordinate as exiftool writes it, such as
// 51 deg 24' 46.80" N.
var exifCoordinate = regexp.MustCompile(`(\d+(?:\.\d+)?) deg (\d+(?:\.\d+)?)' (\d+(?:\.\d+)?)" ([NSEW])`)

// ParseGPS reads a GPS position as exiftool writes it
// (51 deg 24' 46.80" N, 0 deg 7' 1.20" W), or as a custom one is written on
// the Photo page ("40.7795, -73.9634"), as latitude and longitude in decimal
// degrees.
func ParseGPS(value string) (lat, lng float64, ok bool) {
	parts := strings.Split(value, ",")
	if len(parts) != 2 {
		return 0, 0, false
	}
	lat, latOK := parseCoordinate(parts[0])
	lng, lngOK := parseCoordinate(parts[1])
	return lat, lng, latOK && lngOK
}

// parseCoordinate reads one coordinate in decimal degrees or as exiftool
// writes it.
func parseCoordinate(s string) (float64, bool) {
	if f, err := strconv.ParseFloat(strings.TrimSpace(s), 64); err == nil {
		return f, true
	}
	m := exifCoordinate.FindStringSubmatch(s)
	if m == nil {
		return 0, false
	}
	deg, _ := strconv.ParseFloat(m[1], 64)
	minutes, _ := strconv.ParseFloat(m[2], 64)
	sec, _ := strconv.ParseFloat(m[3], 64)
	v := deg + minutes/60 + sec/3600
	if m[4] == "S" || m[4] == "W" {
		v = -v
	}
	return v, true
}
