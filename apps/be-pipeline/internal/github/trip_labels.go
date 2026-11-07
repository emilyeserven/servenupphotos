package github

import (
	"net/http"
	"strings"
	"unicode/utf8"
)

// maxTripLabels is the most timeline labels a Trip can have.
const maxTripLabels = 50

// validLabels checks the Trip's timeline labels, trimming their names: each
// is named, on days within the Trip, and no two share a day.
func validLabels(trip Trip) *PublishError {
	if len(trip.Labels) > maxTripLabels {
		return publishErr(http.StatusBadRequest, "Keep a Trip to %d timeline labels.", maxTripLabels)
	}
	for i := range trip.Labels {
		if perr := validLabel(trip, &trip.Labels[i]); perr != nil {
			return perr
		}
	}
	return labelsOverlap(trip.Labels)
}

// validLabel checks one of the Trip's timeline labels, trimming its name.
func validLabel(trip Trip, l *TripLabel) *PublishError {
	l.Name = strings.TrimSpace(l.Name)
	if l.Name == "" || utf8.RuneCountInString(l.Name) > maxEntryTextLength {
		return publishErr(http.StatusBadRequest, "Give each timeline label a name of up to %d characters.", maxEntryTextLength)
	}
	if !inTrip(trip, l.Start) || !inTrip(trip, l.End) || l.End < l.Start {
		return publishErr(http.StatusBadRequest, "Pick the days of %q within the Trip, the first one first.", l.Name)
	}
	return nil
}

// labelsOverlap fails when two of the labels share a day, so each day of a
// Trip shows one name.
func labelsOverlap(labels []TripLabel) *PublishError {
	for i, a := range labels {
		for _, b := range labels[i+1:] {
			if a.Start <= b.End && b.Start <= a.End {
				return publishErr(http.StatusBadRequest, "%q and %q share some days. Give each day one label.", a.Name, b.Name)
			}
		}
	}
	return nil
}
