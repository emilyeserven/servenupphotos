package transit

import (
	"archive/zip"
	"cmp"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Japan's rail map is MLIT's railway data, 国土数値情報「鉄道データ（N02）」
// (https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N02-2024.html): every
// passenger railway's track, split into sections, each with its line's name
// and operator, such as 山陰線 run by 西日本旅客鉄道, and its stations. The
// pipeline downloads it once, the first time it's asked, into MLIT_RAIL_DIR or
// else beside the settings file, and reads it from there afterwards.

// DefaultMLITURL is the zip of MLIT's 2024 railway data.
const DefaultMLITURL = "https://nlftp.mlit.go.jp/ksj/gml/data/N02/N02-24/N02-24_GML.zip"

// mlitSectionsFile and mlitStationsFile are the zip's GeoJSON files kept: the
// lines' track and their stations.
const (
	mlitSectionsFile = "N02-24_RailroadSection.geojson"
	mlitStationsFile = "N02-24_Station.geojson"
)

// mlitDownloadTimeout is how long downloading the zip may take: it's tens of
// megabytes, downloaded once.
const mlitDownloadTimeout = 10 * time.Minute

// mlitDir is MLIT_RAIL_DIR, or else a folder beside the settings file
// (SETTINGS_FILE, or else data/settings.json): the /data volume in Docker,
// where the backend has no home folder and the download survives restarts.
func mlitDir() string {
	if dir := strings.TrimSpace(os.Getenv("MLIT_RAIL_DIR")); dir != "" {
		return dir
	}
	settings := cmp.Or(strings.TrimSpace(os.Getenv("SETTINGS_FILE")), filepath.Join("data", "settings.json"))
	return filepath.Join(filepath.Dir(settings), "mlit-n02-24")
}

// mlitURL is MLIT_RAIL_URL, or else DefaultMLITURL.
func mlitURL() string {
	return cmp.Or(strings.TrimSpace(os.Getenv("MLIT_RAIL_URL")), DefaultMLITURL)
}

// mlitFeature is one feature of MLIT's GeoJSON: a section of a line's track,
// or a station, which is the stretch of track at its platforms.
type mlitFeature struct {
	Properties struct {
		// Type is the kind of railway, such as 11 for JR lines and 12 for
		// other railways.
		Type json.Number `json:"N02_001"`
		// Line is the line's name, such as "山陰線".
		Line string `json:"N02_003"`
		// Operator is who runs it, such as "西日本旅客鉄道".
		Operator string `json:"N02_004"`
		// Station is a station's name, such as "東萩"; "" on a section.
		Station string `json:"N02_005"`
		// Colour is the line's color as a hex code, such as "#da291c", from
		// OpenStreetMap's route relations; "" on Japan's rail map.
		Colour string `json:"colour,omitempty"`
		// HighSpeed is whether this section is high-speed track, which a
		// route prefers (see speedFactor), even on a line that also runs
		// along slower track, as the Gyeongbu Line KTX does.
		HighSpeed bool `json:"highspeed,omitempty"`
	} `json:"properties"`
	Geometry geoJSON `json:"geometry"`
}

// readMLIT reads the sections and stations from dir.
func readMLIT(dir string) (sections, stations []mlitFeature, err error) {
	if sections, err = readFeatures(filepath.Join(dir, mlitSectionsFile)); err != nil {
		return nil, nil, err
	}
	if stations, err = readFeatures(filepath.Join(dir, mlitStationsFile)); err != nil {
		return nil, nil, err
	}
	return sections, stations, nil
}

// readFeatures reads a GeoJSON file's features.
func readFeatures(path string) ([]mlitFeature, error) {
	f, err := os.Open(path) //nolint:gosec // the rail map's own folder
	if err != nil {
		return nil, err
	}
	defer f.Close() //nolint:errcheck // read-only
	var fc struct {
		Features []mlitFeature `json:"features"`
	}
	if err := json.NewDecoder(f).Decode(&fc); err != nil {
		return nil, fmt.Errorf("%s couldn't be read: %w", filepath.Base(path), err)
	}
	return fc.Features, nil
}

// haveMLIT reports whether dir has both files.
func haveMLIT(dir string) bool {
	for _, name := range []string{mlitSectionsFile, mlitStationsFile} {
		if _, err := os.Stat(filepath.Join(dir, name)); err != nil {
			return false
		}
	}
	return true
}

// downloadMLIT downloads the zip at url and keeps its two GeoJSON files in dir,
// telling p how much it has downloaded.
func downloadMLIT(ctx context.Context, client *http.Client, url, dir string, p *progress) error {
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(dir, "download-*.zip")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name()) //nolint:errcheck // a leftover download
	defer tmp.Close()           //nolint:errcheck // removed above
	start := time.Now()
	size, err := fetchTo(ctx, client, url, tmp, p)
	slog.Info("mlit rail map download", "url", url, "bytes", size, "took", time.Since(start).Round(time.Second), "err", err)
	if err != nil {
		return err
	}
	p.setStep(StepSaving, "Unzipping its railways and stations into "+dir)
	return unzipMLIT(tmp, size, dir)
}

// fetchTo gets url into w, failing on any status but 200 OK, and says how many
// bytes it got, telling p (when it isn't nil) how much it has got so far.
func fetchTo(ctx context.Context, client *http.Client, url string, w io.Writer, p *progress) (int64, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil) //nolint:gosec // a download address from a setting or Geofabrik's index
	if err != nil {
		return 0, err
	}
	req.Header.Set("User-Agent", "servenupphotos-pipeline")
	p.connecting(url)
	res, err := client.Do(req) //nolint:gosec // a download address from a setting or Geofabrik's index
	if err != nil {
		return 0, fmt.Errorf("couldn't reach %s: %w", hostOf(url), err)
	}
	defer res.Body.Close() //nolint:errcheck // read-only body
	if res.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("%s answered %s for %s", hostOf(url), res.Status, url)
	}
	p.downloading(res.ContentLength)
	n, err := io.Copy(io.MultiWriter(w, p), res.Body)
	if err != nil {
		return n, fmt.Errorf("the download from %s stopped after %s: %w", hostOf(url), sizeText(n), err)
	}
	return n, nil
}

// unzipMLIT keeps the zip's two GeoJSON files in dir, the UTF-8 copies when it
// has copies in more than one encoding.
func unzipMLIT(r io.ReaderAt, size int64, dir string) error {
	zr, err := zip.NewReader(r, size)
	if err != nil {
		return fmt.Errorf("the download isn't a zip: %w", err)
	}
	for _, name := range []string{mlitSectionsFile, mlitStationsFile} {
		f := zipEntry(zr, name)
		if f == nil {
			return fmt.Errorf("the download has no %s", name)
		}
		if err := extract(f, filepath.Join(dir, name)); err != nil {
			return err
		}
	}
	return nil
}

// zipEntry is the zip's file named name, preferring one in a UTF-8 folder;
// nil when there's none.
func zipEntry(zr *zip.Reader, name string) *zip.File {
	var found *zip.File
	for _, f := range zr.File {
		if filepath.Base(f.Name) != name {
			continue
		}
		if found == nil || strings.Contains(f.Name, "UTF-8") {
			found = f
		}
	}
	return found
}

// extract writes f to path, through a temporary file so a half-written one is
// never read.
func extract(f *zip.File, path string) error {
	rc, err := f.Open()
	if err != nil {
		return err
	}
	defer rc.Close()                      //nolint:errcheck // read-only
	out, err := os.Create(path + ".part") //nolint:gosec // the rail map's own folder
	if err != nil {
		return err
	}
	if _, err := io.Copy(out, rc); err != nil { //nolint:gosec // MLIT's own data, tens of megabytes
		out.Close() //nolint:errcheck,gosec // failing anyway
		return err
	}
	if err := out.Close(); err != nil {
		return err
	}
	return os.Rename(path+".part", path)
}
