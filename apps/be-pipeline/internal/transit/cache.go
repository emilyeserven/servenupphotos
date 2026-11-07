package transit

import "time"

// cacheFor is how long an Overpass answer is kept: the lines OpenStreetMap
// maps change rarely, and a trip line's hops are often looked up again.
const cacheFor = 24 * time.Hour

// cacheSize is the most answers kept; a track can be a few hundred kilobytes.
const cacheSize = 200
