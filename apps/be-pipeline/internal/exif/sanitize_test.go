package exif

import (
	"encoding/json"
	"os"
	"reflect"
	"testing"
)

func TestSanitize(t *testing.T) {
	tests := []struct {
		file string
		want map[string]any
	}{
		{"fujifilm-x-t5.json", map[string]any{
			"camera":      "Fujifilm X-T5",
			"lens":        "XF18-135mmF3.5-5.6R LM OIS WR",
			"gpsPosition": `37 deg 31' 21.06" N, 126 deg 58' 46.24" E`,
			"createDate":  "2026:05:16 15:24:10",
			"country":     "South Korea",
			"city":        nil,
			"width":       7503.0,
			"height":      4220.0,
		}},
		{"samsung-s7.json", map[string]any{
			"camera":      "SM-G930V",
			"lens":        "Samsung Galaxy S7 Rear Camera",
			"gpsPosition": `42 deg 21' 3.46" N, 71 deg 3' 34.65" W`,
			"createDate":  "2018:01:27 16:36:03",
			"country":     "United States of America",
			"city":        "Boston",
			"width":       2560.0,
			"height":      1440.0,
		}},
		{"sony-a65.json", map[string]any{
			"camera":      "SLT-A65V",
			"lens":        "DT 18-55mm F3.5-5.6 SAM",
			"gpsPosition": `40 deg 45' 17.56" N, 73 deg 59' 18.34" W`,
			"createDate":  "2017:01:07 13:51:40",
			"country":     "United States of America",
			"city":        "New York City",
			"width":       6000.0,
			"height":      3376.0,
		}},
		{"canon-80d.json", map[string]any{
			"camera":      "Canon EOS 80D",
			"lens":        "EF-S55-250mm f/4-5.6 IS STM",
			"gpsPosition": `41 deg 18' 41.67" N, 72 deg 55' 46.53" W`,
			"createDate":  "2019:01:12 17:21:33",
			"country":     "United States of America",
			"city":        "New Haven",
			"width":       4467.0,
			"height":      2701.0,
		}},
		{"canon-t6i.json", map[string]any{
			"camera":      "Canon EOS Rebel T6i",
			"lens":        "EF-S18-135mm f/3.5-5.6 IS STM",
			"gpsPosition": `40 deg 42' 51.52" N, 73 deg 59' 35.22" W`,
			"createDate":  "2018:02:25 14:42:12",
			"country":     "United States of America",
			"city":        "New York City",
			"width":       5999.0,
			"height":      3396.0,
		}},
	}

	for _, tt := range tests {
		t.Run(tt.file, func(t *testing.T) {
			raw, err := os.ReadFile("testdata/sanitize/" + tt.file)
			if err != nil {
				t.Fatal(err)
			}
			var fields map[string]any
			if err := json.Unmarshal(raw, &fields); err != nil {
				t.Fatal(err)
			}

			got := roundTrip(t, Sanitize(fields))
			checkNoImages(t, got)
			delete(got, "images")
			if len(got) != len(tt.want) {
				t.Errorf("got %d keys, want %d: %v", len(got), len(tt.want), got)
			}
			for k, want := range tt.want {
				if v, ok := got[k]; !ok || v != want {
					t.Errorf("%s = %#v, want %#v", k, v, want)
				}
			}
		})
	}
}

func TestSanitizeSize(t *testing.T) {
	tests := []struct {
		name          string
		fields        map[string]any
		width, height any
	}{
		{"upright", map[string]any{"ImageWidth": 6000.0, "ImageHeight": 4000.0, "Orientation": "Horizontal (normal)"}, 6000.0, 4000.0},
		{"turned", map[string]any{"ImageWidth": 6000.0, "ImageHeight": 4000.0, "Orientation": "Rotate 90 CW"}, 4000.0, 6000.0},
		{"mirrored and turned", map[string]any{"ImageWidth": 6000.0, "ImageHeight": 4000.0, "Orientation": "Mirror horizontal and rotate 270 CW"}, 4000.0, 6000.0},
		{"missing height", map[string]any{"ImageWidth": 6000.0}, nil, nil},
		{"not a number", map[string]any{"ImageWidth": "6000", "ImageHeight": 4000.0}, nil, nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := roundTrip(t, Sanitize(tt.fields))
			if got["width"] != tt.width || got["height"] != tt.height {
				t.Errorf("width, height = %v, %v; want %v, %v", got["width"], got["height"], tt.width, tt.height)
			}
		})
	}
}

func TestSanitizeEmpty(t *testing.T) {
	got := roundTrip(t, Sanitize(map[string]any{"Model": "", "City": 42}))
	checkNoImages(t, got)
	delete(got, "images")
	for k, v := range got {
		if v != nil {
			t.Errorf("%s = %#v, want null", k, v)
		}
	}
}

// checkNoImages checks that got has an images object whose links are all null,
// since Sanitize runs before the photo is uploaded anywhere.
func checkNoImages(t *testing.T, got map[string]any) {
	t.Helper()
	images, ok := got["images"].(map[string]any)
	if !ok {
		t.Fatalf("images = %#v, want an object", got["images"])
	}
	want := map[string]any{"full": nil, "key": nil, "xlarge": nil, "large": nil, "medium": nil, "small": nil, "xsmall": nil, "preview": nil}
	if !reflect.DeepEqual(images, want) {
		t.Errorf("images = %#v, want %#v", images, want)
	}
}

// roundTrip encodes s as JSON and decodes it into a map, as a client sees it.
func roundTrip(t *testing.T, s Sanitized) map[string]any {
	t.Helper()
	raw, err := json.Marshal(s)
	if err != nil {
		t.Fatal(err)
	}
	var m map[string]any
	if err := json.Unmarshal(raw, &m); err != nil {
		t.Fatal(err)
	}
	return m
}
