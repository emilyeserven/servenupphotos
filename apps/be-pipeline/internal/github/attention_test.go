package github

import (
	"encoding/json"
	"testing"
)

func TestAttentionData(t *testing.T) {
	tests := []struct {
		name, in, want string
	}{
		{
			name: "drops what Needs attention doesn't read and keeps colors' peakChroma",
			in:   `{"title":"Bee","tags":["a"],"images":{"small":"x"},"notes":"n","exifOriginals":{},"colors":{"buckets":[1,2],"peakChroma":42.5}}`,
			want: `{"colors":{"peakChroma":42.5},"tags":["a"],"title":"Bee"}`,
		},
		{
			name: "drops colors read before peakChroma",
			in:   `{"noGps":true,"colors":{"buckets":[1]}}`,
			want: `{"noGps":true}`,
		},
		{
			name: "drops null colors",
			in:   `{"colors":null}`,
			want: `{}`,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := attentionData([]byte(tt.in))
			if err != nil || string(got) != tt.want {
				t.Errorf("attentionData() = %s, %v; want %s", got, err, tt.want)
			}
		})
	}
}

func TestAttention(t *testing.T) {
	repo := &baseURLRepo{pull: true, files: map[string]string{"B.json": photoB, "C.json": photoC}}
	got, err := repo.start(t).Attention(t.Context(), baseURLSettings)
	if err != nil {
		t.Fatalf("Attention() error = %v", err)
	}
	if len(got.Photos) != 2 {
		t.Fatalf("photos = %+v, want B and C", got.Photos)
	}
	b := got.Photos[0]
	var data map[string]json.RawMessage
	if err := json.Unmarshal(b.Data, &data); err != nil {
		t.Fatal(err)
	}
	if _, ok := data["images"]; ok || string(data["title"]) != `"Bee"` {
		t.Errorf("B's data = %s, want it without images", b.Data)
	}
	if b.Image == nil || *b.Image != "https://cdn.example.com/B-small.webp" || *b.SocialMediaPublishDate != "2026-10-22" {
		t.Errorf("B = %+v, want its image and publish date read from the whole file", b)
	}
}
