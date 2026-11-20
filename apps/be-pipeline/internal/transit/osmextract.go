package transit

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"strings"
	"time"
)

// A country's OpenStreetMap rail map and bus map are both read from its
// extract on Geofabrik (see osmrail_index.go), which is hundreds of megabytes,
// so it's downloaded once for both: whichever is asked first downloads it and
// reads every map of that country not yet on this computer, then deletes it.

// osmDownloadTimeout is how long downloading and reading a country's extract
// may take: hundreds of megabytes, once.
const osmDownloadTimeout = time.Hour

// maxOSMExtractBytes is the largest extract downloaded, so a leg in a large
// country, such as across the US, doesn't fill the disk.
const maxOSMExtractBytes = 2 << 30

// errExtractTooBig is an extract larger than maxOSMExtractBytes.
var errExtractTooBig = fmt.Errorf("its OpenStreetMap extract is over %d GB, too large to download", maxOSMExtractBytes>>30)

// readyOSMRegion makes sure region's rail map and bus map are on this
// computer: when either is missing it downloads region's extract, reads each
// missing map from it, and removes the extract, telling p how far it's got.
func (c *Client) readyOSMRegion(region osmRegion, p *progress) error {
	if !c.osmExtractMu.TryLock() {
		p.setStep(StepWaiting, "Waiting for another OpenStreetMap extract to finish downloading; one downloads at a time")
		c.osmExtractMu.Lock()
	}
	defer c.osmExtractMu.Unlock()
	railDir, busDir := osmRailMapDir(region), osmBusMapDir(region)
	needRail, needBus := !haveMLIT(railDir), !haveBusMap(busDir)
	if !needRail && !needBus {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), osmDownloadTimeout)
	defer cancel()
	extract, err := c.downloadExtract(ctx, region, p)
	if err != nil {
		return err
	}
	defer os.Remove(extract) //nolint:errcheck // a leftover download
	open := extractPasses(extract, p, needRail, needBus)
	if needRail {
		if err := writeOSMRail(ctx, region, open, railDir, p); err != nil {
			return fmt.Errorf("reading the railways from %s's extract failed: %w", region.name, err)
		}
	}
	if needBus {
		if err := writeOSMBus(ctx, region, open, busDir, p); err != nil {
			return fmt.Errorf("reading the bus routes from %s's extract failed: %w", region.name, err)
		}
	}
	return nil
}

// extractPasses opens the extract at path afresh for each pass the rail and
// bus readers make over it, in their order (readOSMRail's two, then
// readOSMBus's three), telling p which pass it is and counting what each reads.
func extractPasses(path string, p *progress, rail, bus bool) func() (io.ReadCloser, error) {
	var passes []string
	if rail {
		passes = append(passes, "the railways", "the railways' points and the stations")
	}
	if bus {
		passes = append(passes, "the bus routes", "the roads the bus routes run along", "the roads' points and the bus stops")
	}
	next := 0
	return func() (io.ReadCloser, error) {
		f, err := os.Open(path) //nolint:gosec // the download just made
		if err != nil {
			return nil, err
		}
		var size int64
		if info, err := f.Stat(); err == nil {
			size = info.Size()
		}
		if next < len(passes) {
			p.reading(fmt.Sprintf("Reading %s (pass %d of %d over the %s extract)", passes[next], next+1, len(passes), sizeText(size)), size)
		}
		next++
		return countingFile{f, p}, nil
	}
}

// countingFile is a file whose reads are counted in a progress.
type countingFile struct {
	*os.File
	p *progress
}

// Read reads from the file, counting what it reads.
func (f countingFile) Read(b []byte) (int, error) {
	n, err := f.File.Read(b)
	_, _ = f.p.Write(b[:n])
	return n, err
}

// downloadExtract downloads region's extract into the rail maps' folder and
// says where it put it.
func (c *Client) downloadExtract(ctx context.Context, region osmRegion, p *progress) (string, error) {
	if err := os.MkdirAll(osmRailDir(), 0o750); err != nil {
		return "", err
	}
	// A region inside a country has a path for an ID, such as
	// "us/massachusetts", and a temporary file's pattern can't hold a "/".
	tmp, err := os.CreateTemp(osmRailDir(), strings.ReplaceAll(region.id, "/", "-")+"-*.osm.pbf")
	if err != nil {
		return "", err
	}
	start := time.Now()
	size, err := fetchTo(ctx, c.HTTP, region.pbf, &limitedWriter{w: tmp, left: maxOSMExtractBytes}, p)
	slog.Info("osm extract download", "region", region.id, "bytes", size, "took", time.Since(start).Round(time.Second), "err", err)
	if cerr := tmp.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		_ = os.Remove(tmp.Name())
		return "", fmt.Errorf("downloading %s's extract failed: %w", region.name, err)
	}
	return tmp.Name(), nil
}
