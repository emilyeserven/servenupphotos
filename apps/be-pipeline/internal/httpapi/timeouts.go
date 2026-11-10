package httpapi

import (
	"net/http"
	"time"
)

// photoBodyAllowance is how long receiving a photo the browser sends may
// take, which no context bounds: the work after it gets its own timeout.
const photoBodyAllowance = 30 * time.Second

// photoReadAllowance is how long reading a photo's EXIF and colors may take,
// which no context bounds either.
const photoReadAllowance = 25 * time.Second

// relayTimeouts is how long the backend may spend answering each path that
// can take longer than defaultRelayTimeout, built from the timeouts its
// handlers use. The BFF reads it from GET /timeouts at start-up and waits a
// little longer than each; the longest matching prefix wins. A new endpoint
// that gives its work more than defaultRelayTimeout adds a line here.
var relayTimeouts = map[string]time.Duration{
	"/exif":                       photoBodyAllowance + overridesTimeout + photoReadAllowance,
	"/upload":                     photoBodyAllowance + uploadTimeout,
	"/photos/versions/":           photoBodyAllowance + photoReadAllowance,
	"/photos/github":              publishColorsTimeout + publishHashTimeout + publishTimeout,
	"/photos/in-flight":           publishTimeout + findPhotosTimeout,
	"/photos/groups":              baseURLTimeout,
	"/photos/published":           publishTimeout + findPhotosTimeout,
	"/photos/combined":            commitCombinedTimeout,
	"/photos/original":            originalTimeout,
	"/photos/bucket/exif":         getPhotoTimeout + overridesTimeout + photoReadAllowance,
	"/photos/bucket/versions":     uploadTimeout,
	"/photos/bucket/faces/detect": detectFacesTimeout,
	"/data/":                      baseURLTimeout,
	// Answers from memory while a Missing fields or Colors read runs.
	"/data/progress/":       0,
	"/data/missing-fields":  backfillTimeout,
	"/data/image-names":     imageNamesTimeout,
	"/data/colors":          colorsTimeout,
	"/data/r2-exif":         r2ExifTimeout,
	"/data/near-duplicates": nearDuplicatesTimeout,
	"/publish/":             baseURLTimeout,
	"/transit/":             transitTimeout,
}

// defaultRelayTimeout is how long the backend may spend on every other path:
// GitHub gets publishTimeout for most reads and saves.
const defaultRelayTimeout = publishTimeout

// relayTimeoutsBody is the answer of GET /timeouts.
type relayTimeoutsBody struct {
	// DefaultSeconds is how long the backend may spend on a path no prefix
	// matches, in seconds.
	DefaultSeconds int `json:"defaultSeconds"`
	// Prefixes is how long the backend may spend on the paths starting with
	// each prefix, in seconds.
	Prefixes map[string]int `json:"prefixes"`
}

// handleTimeouts answers how long the backend may spend on each path, from
// prefixes and fallback, the time for every other path, so the BFF can wait a
// little longer than each instead of keeping its own table.
func handleTimeouts(prefixes map[string]time.Duration, fallback time.Duration) http.HandlerFunc {
	body := relayTimeoutsBody{DefaultSeconds: wholeSeconds(fallback), Prefixes: make(map[string]int, len(prefixes))}
	for prefix, d := range prefixes {
		body.Prefixes[prefix] = wholeSeconds(d)
	}
	return func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, body)
	}
}

// wholeSeconds is d in whole seconds, rounded up.
func wholeSeconds(d time.Duration) int {
	return int((d + time.Second - 1) / time.Second)
}
