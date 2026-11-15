package github

import (
	"encoding/json"
	"slices"
)

// entriesWithoutPhotoFile is each bio and photo book file that names the
// photo file at file by its path, with it taken out: off the bio, and out of
// a photo book's places, which are left empty.
func entriesWithoutPhotoFile(w *workspace, file string) []ScanChange {
	return slices.Concat(
		cleanEntries(w, BioKind, func(bio *Bio) bool {
			n := len(bio.Photos)
			bio.Photos = slices.DeleteFunc(bio.Photos, func(p BioPhoto) bool { return p.Photo == file })
			return len(bio.Photos) != n
		}),
		cleanEntries(w, PhotoBooks, func(book *PhotoBook) bool { return emptySlots(book, file) }),
	)
}

// entriesWithoutPhotoID is each viewer likes and trip line file that names the
// photo with id, with it taken out.
func entriesWithoutPhotoID(w *workspace, id int) []ScanChange {
	return slices.Concat(
		cleanEntries(w, ViewerLikesKind, func(likes *ViewerLikes) bool {
			var changed bool
			likes.Photos, changed = withoutID(likes.Photos, id)
			return changed
		}),
		cleanEntries(w, TripLines, func(line *TripLine) bool { return tripLineWithout(line, id) }),
	)
}

// cleanEntries is each readable file of kind that clean changes, read as a T
// and written back as saving one does.
func cleanEntries[T any](w *workspace, kind EntryKind, clean func(*T) bool) []ScanChange {
	var changes []ScanChange
	for _, e := range w.entries(kind) {
		var entry T
		if e.Error != "" || json.Unmarshal(e.Data, &entry) != nil || !clean(&entry) {
			continue
		}
		b, err := json.MarshalIndent(entry, "", "  ")
		if err != nil {
			continue
		}
		changes = append(changes, ScanChange{Path: e.Path, Before: e.Data, After: formatJSONFile(append(b, '\n'))})
	}
	return changes
}

// emptySlots empties each of book's places that holds the photo file at file,
// with its caption, and reports whether any did.
func emptySlots(book *PhotoBook, file string) bool {
	changed := false
	for _, page := range book.Pages {
		for i := range page.Slots {
			if page.Slots[i].Photo == file {
				page.Slots[i] = PhotoBookSlot{}
				changed = true
			}
		}
	}
	return changed
}

// withoutID is ids without id, and whether it was there.
func withoutID(ids []int, id int) ([]int, bool) {
	if !slices.Contains(ids, id) {
		return ids, false
	}
	return withoutPhotos(ids, map[int]bool{id: true}), true
}

// tripLineWithout takes the photo with id off line: out of its segments
// (dropping one left with fewer than two points), its hand-made order, its
// trip stops and its areas (dropping one left empty). A spot or stop that came
// after the photo comes after the photo before it instead. It reports whether
// anything changed.
func tripLineWithout(line *TripLine, id int) bool {
	before := photoBefore(line.Segments, id)
	changed := false
	for i := range line.Segments {
		changed = segmentWithout(&line.Segments[i], id) || changed
	}
	n := len(line.Segments)
	line.Segments = slices.DeleteFunc(line.Segments, func(s TripSegment) bool { return pointCount(s) < 2 })
	var orderChanged bool
	line.Order, orderChanged = withoutID(line.Order, id)
	changed = changed || orderChanged || len(line.Segments) != n
	for i := range line.Visits {
		changed = visitWithout(&line.Visits[i], id, before) || changed
	}
	return fencesWithout(line, id) || changed
}

// photoBefore is the photo right before id on the day's segments, or nil when
// it's the first or isn't on them.
func photoBefore(segments []TripSegment, id int) *int {
	var prev *int
	for _, seg := range segments {
		for _, p := range seg.Photos {
			if p == id {
				return prev
			}
			prev = &p
		}
	}
	return nil
}

// segmentWithout takes id out of seg's photos, moving a spot that came after
// it to after the segment's photo before it, and reports whether it was there.
func segmentWithout(seg *TripSegment, id int) bool {
	i := slices.Index(seg.Photos, id)
	if i == -1 {
		return false
	}
	var before *int
	if i > 0 {
		before = &seg.Photos[i-1]
	}
	for j := range seg.Via {
		if after := seg.Via[j].After; after != nil && *after == id {
			seg.Via[j].After = copyID(before)
		}
	}
	seg.Photos, _ = withoutID(seg.Photos, id)
	return true
}

// visitWithout takes id out of visit's casual photos and, when the stop came
// after it, puts it after before instead, or first in the day when the photo
// was the first. It reports whether anything changed.
func visitWithout(visit *TripVisit, id int, before *int) bool {
	var changed bool
	visit.Photos, changed = withoutID(visit.Photos, id)
	if visit.After == nil || *visit.After != id {
		return changed
	}
	visit.After = copyID(before)
	visit.First = visit.First || before == nil
	return true
}

// fencesWithout takes id out of line's areas, dropping one left with no
// photos, and reports whether anything changed.
func fencesWithout(line *TripLine, id int) bool {
	changed := false
	for i := range line.Fences {
		var c bool
		line.Fences[i].Photos, c = withoutID(line.Fences[i].Photos, id)
		changed = changed || c
	}
	n := len(line.Fences)
	line.Fences = slices.DeleteFunc(line.Fences, func(f TripFence) bool { return len(f.Photos) == 0 })
	return changed || len(line.Fences) != n
}

// copyID is a copy of id, so it doesn't change with the slice it points into.
func copyID(id *int) *int {
	if id == nil {
		return nil
	}
	v := *id
	return &v
}
