package transit

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
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
	c.osmExtractMu.Lock()
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
	p.setStep(StepReading)
	open := func() (io.ReadCloser, error) { return os.Open(extract) } //nolint:gosec // the download just made
	if needRail {
		if err := writeOSMRail(ctx, region, open, railDir); err != nil {
			return err
		}
	}
	if needBus {
		return writeOSMBus(ctx, region, open, busDir)
	}
	return nil
}

// downloadExtract downloads region's extract into the rail maps' folder and
// says where it put it.
func (c *Client) downloadExtract(ctx context.Context, region osmRegion, p *progress) (string, error) {
	if err := os.MkdirAll(osmRailDir(), 0o750); err != nil {
		return "", err
	}
	tmp, err := os.CreateTemp(osmRailDir(), region.id+"-*.osm.pbf")
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
		return "", err
	}
	return tmp.Name(), nil
}
