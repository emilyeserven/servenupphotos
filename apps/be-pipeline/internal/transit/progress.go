package transit

import (
	"cmp"
	"slices"
	"sync"
	"time"
)

// A map that's downloaded once (Japan's rail map, OpenStreetMap's list of
// extracts, or a country's OpenStreetMap rail and bus maps) can take minutes
// to download and read, so each one being loaded is listed with how far it's
// got, for the page to show while its look-up waits (see Client.Downloads).

// The steps of loading a map, as Download.Step names them.
const (
	// StepOpening is reading a map already on this computer.
	StepOpening = "opening"
	// StepDownloading is downloading its file.
	StepDownloading = "downloading"
	// StepReading is reading the file just downloaded into the map.
	StepReading = "reading"
)

// Download is one map being loaded, as GET /api/transit/downloads lists it.
type Download struct {
	// Map names the map, such as "OpenStreetMap's bus map of South Korea".
	Map string `json:"map"`
	// Step is what it's doing: StepOpening, StepDownloading or StepReading.
	Step string `json:"step"`
	// Bytes is how much of its file has been downloaded so far.
	Bytes int64 `json:"bytes"`
	// Total is its file's size, in bytes; 0 while it isn't known.
	Total int64 `json:"total,omitempty"`
	// Seconds is how long it has been loading.
	Seconds int `json:"seconds"`
}

// mapProgress lists the maps being loaded, by key.
type mapProgress struct {
	mu      sync.Mutex
	running map[string]*progress
}

// progress is how far one map's load has got. A nil progress tracks nothing,
// so code that loads a map can report to it without checking.
type progress struct {
	mu    sync.Mutex
	name  string
	step  string
	bytes int64
	total int64
	start time.Time
}

// begin lists the map named name, kept as key, as loading, opening it from
// this computer until told otherwise.
func (m *mapProgress) begin(key, name string) *progress {
	p := &progress{name: name, step: StepOpening, start: time.Now()}
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.running == nil {
		m.running = map[string]*progress{}
	}
	m.running[key] = p
	return p
}

// end takes the map kept as key off the list, once it's loaded or failed.
func (m *mapProgress) end(key string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.running, key)
}

// list is every map being loaded, the one that started first first.
func (m *mapProgress) list() []Download {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]Download, 0, len(m.running))
	for _, p := range m.running {
		out = append(out, p.snapshot())
	}
	slices.SortFunc(out, func(a, b Download) int {
		return cmp.Or(cmp.Compare(b.Seconds, a.Seconds), cmp.Compare(a.Map, b.Map))
	})
	return out
}

// snapshot is how far p has got now.
func (p *progress) snapshot() Download {
	p.mu.Lock()
	defer p.mu.Unlock()
	return Download{Map: p.name, Step: p.step, Bytes: p.bytes, Total: p.total, Seconds: int(time.Since(p.start).Seconds())}
}

// setStep moves p on to step.
func (p *progress) setStep(step string) {
	if p == nil {
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	p.step = step
}

// downloading starts downloading a file of total bytes, 0 when not known.
func (p *progress) downloading(total int64) {
	if p == nil {
		return
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	p.step, p.bytes, p.total = StepDownloading, 0, max(total, 0)
}

// Write counts b as downloaded, so a download can be copied through p.
func (p *progress) Write(b []byte) (int, error) {
	if p == nil {
		return len(b), nil
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	p.bytes += int64(len(b))
	return len(b), nil
}

// Downloads are the maps being downloaded or read now, each with how far it
// has got, for the page to show while a look-up waits for one.
func (c *Client) Downloads() []Download {
	return c.progress.list()
}
