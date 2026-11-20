package transit

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// SourceOSMRail is the Line.Source of a line found on an OpenStreetMap rail
// map: a country's railways, downloaded once from Geofabrik.
const SourceOSMRail = "osmrail"

// osmLineBits is how many bits of a route's ID on an OpenStreetMap rail map
// hold its lines, up to 3; the bits above hold its region's place in
// Geofabrik's index. The whole ID stays under 2^53, the largest whole number
// the page's JavaScript holds exactly: with 4 lines, a region far down the
// index, such as us/massachusetts, made IDs the page rounded off, losing the
// line.
const osmLineBits = 3 * routeBits

// osmRailVersion is the folder of the rail maps read as this version reads
// them: v2 keeps which railways are high-speed, and v3 names lines by the
// route relations their track is in, with their colors. A map read by an
// older version is downloaded and read again the first time it's used.
const osmRailVersion = "v3"

// osmRailOldVersions are the folders of maps read by older versions, deleted
// once the map is read again ("" is the first version's, with none).
var osmRailOldVersions = []string{"", "v2"}

// osmRailDir is OSM_RAIL_DIR, or else a folder beside the settings file, as
// Japan's rail map's is (see mlitDir).
func osmRailDir() string {
	if dir := strings.TrimSpace(os.Getenv("OSM_RAIL_DIR")); dir != "" {
		return dir
	}
	return filepath.Join(filepath.Dir(mlitDir()), "osm-rail")
}

// osmRail is the rail map of the region of Geofabrik's index holding both a
// and b, downloading and reading it first when needed.
func (c *Client) osmRail(ctx context.Context, a, b [2]float64) (*railNet, error) {
	regions, err := c.osmRegions(ctx)
	if err != nil {
		return nil, err
	}
	i, err := regionFor(regions, a, b)
	if err != nil {
		return nil, &RailMapError{Map: "OpenStreetMap's rail map", Err: err}
	}
	return c.osmRegionRail(ctx, regions, i)
}

// osmRegionRail is the rail map of the ith region.
func (c *Client) osmRegionRail(ctx context.Context, regions []osmRegion, i int) (*railNet, error) {
	region := regions[i]
	name := "OpenStreetMap's rail map of " + region.name
	return c.Rails.get(ctx, &c.progress, SourceOSMRail+"/"+region.id, name, func(p *progress) (*railNet, error) {
		net, err := c.readOSMRegion(region, p)
		if err != nil {
			return nil, err
		}
		net.source, net.lineBits, net.idBase = SourceOSMRail, osmLineBits, int64(i+1)<<osmLineBits
		return net, nil
	})
}

// osmRailByID is the rail map whose region route id names.
func (c *Client) osmRailByID(ctx context.Context, id int64) (*railNet, error) {
	regions, err := c.osmRegions(ctx)
	if err != nil {
		return nil, err
	}
	i := int(id>>osmLineBits) - 1
	if i < 0 || i >= len(regions) {
		return nil, ErrNoTrack
	}
	return c.osmRegionRail(ctx, regions, i)
}

// readOSMRegion is region's rail network from its folder, downloaded and
// read from its extract first when it isn't there yet, telling p how far it's
// got.
func (c *Client) readOSMRegion(region osmRegion, p *progress) (*railNet, error) {
	dir := osmRailMapDir(region)
	if !haveMLIT(dir) {
		if err := c.readyOSMRegion(region, p); err != nil {
			return nil, err
		}
	}
	p.setStep(StepReading, "Reading the rail map saved in "+dir)
	sections, stations, err := readMLIT(dir)
	if err != nil {
		return nil, err
	}
	return newRailNet(sections, stations), nil
}

// osmRailMapDir is the folder of region's rail map.
func osmRailMapDir(region osmRegion) string {
	return filepath.Join(osmRailDir(), osmRailVersion, region.id)
}

// writeOSMRail reads the railways and stations of the extract open opens and
// keeps them in dir as GeoJSON.
func writeOSMRail(ctx context.Context, region osmRegion, open func() (io.ReadCloser, error), dir string, p *progress) error {
	start := time.Now()
	sections, stations, err := readOSMRail(ctx, open)
	slog.Info("osm rail extract read", "region", region.id, "sections", len(sections), "stations", len(stations), "took", time.Since(start).Round(time.Second), "err", err)
	if err != nil {
		return err
	}
	p.setStep(StepSaving, fmt.Sprintf("Saving %d stretches of railway and %d stations to %s", len(sections), len(stations), dir))
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return err
	}
	// The stations go first, so a folder with its sections file is complete.
	if err := writeFeatures(filepath.Join(dir, mlitStationsFile), stations); err != nil {
		return err
	}
	if err := writeFeatures(filepath.Join(dir, mlitSectionsFile), sections); err != nil {
		return err
	}
	// The maps read by older versions, which are read again for what they lacked.
	for _, old := range osmRailOldVersions {
		if err := os.RemoveAll(filepath.Join(osmRailDir(), old, region.id)); err != nil {
			return err
		}
	}
	return nil
}

// limitedWriter writes to w until left bytes are written, then fails.
type limitedWriter struct {
	w    io.Writer
	left int64
}

// Write writes p, failing once the limit is passed.
func (l *limitedWriter) Write(p []byte) (int, error) {
	if int64(len(p)) > l.left {
		return 0, errExtractTooBig
	}
	l.left -= int64(len(p))
	return l.w.Write(p)
}

// writeFeatures writes features to path as a GeoJSON feature collection,
// through a temporary file so a half-written one is never read.
func writeFeatures(path string, features []mlitFeature) error {
	f, err := os.Create(path + ".part") //nolint:gosec // the rail map's own folder
	if err != nil {
		return err
	}
	if features == nil {
		features = []mlitFeature{}
	}
	w := bufio.NewWriter(f)
	err = json.NewEncoder(w).Encode(map[string]any{"type": "FeatureCollection", "features": features})
	err = errors.Join(err, w.Flush(), f.Close())
	if err != nil {
		return err
	}
	return os.Rename(path+".part", path)
}

// OSMRailLines are, from the OpenStreetMap rail map of the country holding
// from and to, each [longitude, latitude], the route along its lines between
// them, changing lines where it has to, and then each line passing within
// nearM of both ends.
func (c *Client) OSMRailLines(ctx context.Context, mode string, from, to [2]float64) ([]Line, error) {
	if !railModes[mode] {
		return nil, ErrNoKind
	}
	net, err := c.osmRail(ctx, from, to)
	if err != nil {
		return nil, err
	}
	return railLines(net, from, to), nil
}

// OSMRailTrack is route id's track on its OpenStreetMap rail map from the point
// on its lines nearest from to the point nearest to, with from and to added at
// its ends, as Track is.
func (c *Client) OSMRailTrack(ctx context.Context, id int64, from, to [2]float64) ([][2]float64, error) {
	net, err := c.osmRailByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return railTrack(net, id, from, to)
}

// OSMRailStops are route id's stations on its OpenStreetMap rail map, in the
// order its track runs, each name once.
func (c *Client) OSMRailStops(ctx context.Context, id int64) ([]Stop, error) {
	net, err := c.osmRailByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return railStops(net, id)
}
