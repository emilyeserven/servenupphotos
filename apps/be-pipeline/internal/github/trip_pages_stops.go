package github

import "encoding/json"

// tripStop is a trip stop on a day of a Trip page, with the casual
// photos taken there, such as the food at a restaurant.
type tripStop struct {
	Name string `json:"name"`
	Kind string `json:"kind"`
	Note string `json:"note,omitempty"`
	Link string `json:"link,omitempty"`
	// Photos are the place's casual photos, baked here since they're never in
	// AllPhotosFile: the portfolio has no other way to show them.
	Photos []casualPhoto `json:"photos"`
}

// casualPhoto is what the portfolio needs to show a casual photo: its
// images in R2 and its size.
type casualPhoto struct {
	ID     int             `json:"id"`
	Title  string          `json:"title,omitempty"`
	Width  int             `json:"width,omitempty"`
	Height int             `json:"height,omitempty"`
	Images json.RawMessage `json:"images,omitempty"`
}

// casualPhotos are w's casual photos (see isCasual), by ID.
func (w *workspace) casualPhotos() map[int]casualPhoto {
	out := map[int]casualPhoto{}
	for _, p := range w.paths(w.root+"/"+PhotosFolder, AllPhotosFile) {
		data, msg := w.json(p)
		if msg != "" || !isCasual(data) {
			continue
		}
		if photo, ok := casualPhotoOf(data); ok {
			out[photo.ID] = photo
		}
	}
	return out
}

// casualPhotoOf reads a casual photo's file data, and false when it has no ID.
func casualPhotoOf(data json.RawMessage) (casualPhoto, bool) {
	var photo struct {
		ID     *int            `json:"id"`
		Title  any             `json:"title"`
		Width  int             `json:"width"`
		Height int             `json:"height"`
		Images json.RawMessage `json:"images"`
	}
	if json.Unmarshal(data, &photo) != nil || photo.ID == nil {
		return casualPhoto{}, false
	}
	title, _ := photo.Title.(string)
	return casualPhoto{ID: *photo.ID, Title: title, Width: photo.Width, Height: photo.Height, Images: photo.Images}, true
}

// pageStops are each day's trip stops with casual photos, from lines,
// by day: only the photos that are casual photos, and only the places with
// one or more left.
func pageStops(lines []TripLine, photos map[int]casualPhoto) map[string][]tripStop {
	out := map[string][]tripStop{}
	for _, line := range lines {
		for _, v := range line.Visits {
			if place, ok := pageStopOf(v, photos); ok {
				out[line.Day] = append(out[line.Day], place)
			}
		}
	}
	return out
}

// pageStopOf is a trip stop as its Trip page shows it, and false when
// none of its photos are casual photos.
func pageStopOf(v TripVisit, photos map[int]casualPhoto) (tripStop, bool) {
	place := tripStop{Name: v.Name, Kind: v.Kind, Note: v.Note, Link: v.Link, Photos: []casualPhoto{}}
	for _, id := range v.Photos {
		if photo, ok := photos[id]; ok {
			place.Photos = append(place.Photos, photo)
		}
	}
	return place, len(place.Photos) > 0
}
