package github

import (
	"context"
	"encoding/json"
	"net/http"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/emilyeserven/servenupphotos/apps/be-pipeline/internal/settings"
)

// The two kinds of graph preset file: a ready-made graph, or a group of them
// shown as one dropdown among the presets.
const (
	graphPresetKind = "preset"
	graphGroupKind  = "group"
)

// GraphPreset is a graph preset file: a ready-made graph on the portfolio's
// Graph page, such as a dot graph of Aperture, or a preset group, which shows
// its presets as one dropdown among the others.
type GraphPreset struct {
	ID string `json:"id"`
	// Kind is "preset" for a ready-made graph, or "group" for a preset group.
	Kind string `json:"kind"`
	// Name is what the Graph page shows on its button or dropdown.
	Name string `json:"name"`
	// Order is where it sits among the presets and groups, lowest first; a
	// preset in a group sits among the group's presets.
	Order int `json:"order"`
	// Group is the ID of the preset group a preset is in, or "" for none.
	// Groups leave it out.
	Group string `json:"group,omitempty"`
	// Graph is what a preset sets the graph to. Groups leave it out.
	Graph *GraphSettings `json:"graph,omitempty"`
}

// GraphSettings is what a graph preset sets the Graph page's graph to, named
// as the page names them. The page's filters stay as they are.
type GraphSettings struct {
	// Type is "bar", "line", "dot", "pie" or "scatter".
	Type string `json:"type"`
	// X is the stat along the x axis, or a pie's slices, such as "aperture".
	X string `json:"x"`
	// Measure is "count" for how many photos, or "percent" for their share.
	Measure string `json:"measure"`
	// Y is the stat along a scatterplot's y axis.
	Y string `json:"y"`
	// Split is the stat that splits each bar or line, or "" for none.
	Split string `json:"split"`
	// Stacked is whether a split bar's parts are stacked, or side by side.
	Stacked bool `json:"stacked"`
	// Sort is "group" (as on Numbers), "reverse" or "count" (most photos first).
	Sort string `json:"sort"`
	// Limit is how many of the x axis's values show; 0 for all.
	Limit int `json:"limit"`
	// XMin and XMax are the lowest and highest x values shown, such as 2 and
	// 8 for f/2 to f/8, for a stat whose values go in order; nil for no
	// limit.
	XMin *float64 `json:"xMin,omitempty"`
	XMax *float64 `json:"xMax,omitempty"`
	// YMin and YMax are the lowest and highest y values shown: a
	// scatterplot's y stat's values, or for the rest how many photos (or what
	// share) an x value needs to show; nil for no limit.
	YMin *float64 `json:"yMin,omitempty"`
	YMax *float64 `json:"yMax,omitempty"`
}

// The values a preset's graph can take for each of its choices.
var (
	graphTypes    = []string{"bar", "line", "dot", "pie", "scatter"}
	graphMeasures = []string{"count", "percent"}
	graphSorts    = []string{"group", "reverse", "count"}
)

// SaveGraphPreset saves preset as <folder>/graphs/<id>.json, new or replacing
// the one there, in the pending changes. A preset's group has to be a saved
// preset group, and a group can't be put in another.
func (c *Client) SaveGraphPreset(ctx context.Context, gh settings.GitHub, preset GraphPreset) (EntryResult, error) {
	preset, perr := validGraphPreset(preset)
	if perr != nil {
		return EntryResult{}, perr
	}
	return c.saveEntry(ctx, gh, GraphPresets, preset.ID, preset, func(others []Entry) *PublishError {
		return graphGroupCheck(parseGraphPresets(others), preset)
	})
}

// DeleteGraphPreset removes the graph preset or preset group file named id in
// the pending changes. A group that still has presets in it can't be
// removed.
func (c *Client) DeleteGraphPreset(ctx context.Context, gh settings.GitHub, id string) (EntryResult, error) {
	return c.deleteEntry(ctx, gh, GraphPresets, id, func(others []Entry) *PublishError {
		return groupStillUsed(parseGraphPresets(others), id)
	})
}

// parseGraphPresets is the graph presets and groups in entries that can be
// read.
func parseGraphPresets(entries []Entry) []GraphPreset {
	var out []GraphPreset
	for _, e := range entries {
		var p GraphPreset
		if json.Unmarshal(e.Data, &p) == nil && p.ID != "" {
			out = append(out, p)
		}
	}
	return out
}

// graphGroupCheck fails when preset is in a group that isn't a saved preset
// group, or is a group with presets in it being made a preset.
func graphGroupCheck(others []GraphPreset, preset GraphPreset) *PublishError {
	if preset.Kind == graphGroupKind {
		return nil
	}
	if perr := groupStillUsed(others, preset.ID); perr != nil {
		return perr
	}
	if preset.Group == "" || slices.ContainsFunc(others, func(o GraphPreset) bool {
		return o.ID == preset.Group && o.Kind == graphGroupKind
	}) {
		return nil
	}
	return publishErr(http.StatusBadRequest, "There's no preset group with the ID %q. Save the group first.", preset.Group)
}

// groupStillUsed fails when a preset in others is in the group id.
func groupStillUsed(others []GraphPreset, id string) *PublishError {
	for _, o := range others {
		if o.Group == id {
			return publishErr(http.StatusConflict, "%q is still in this group. Move its presets out of it, or remove them, first.", o.Name)
		}
	}
	return nil
}

// validGraphPreset checks p and returns it trimmed, as it will be saved.
func validGraphPreset(p GraphPreset) (GraphPreset, *PublishError) {
	p.ID, p.Name, p.Group = strings.TrimSpace(p.ID), strings.TrimSpace(p.Name), strings.TrimSpace(p.Group)
	if perr := validEntryID(GraphPresets.Name, p.ID); perr != nil {
		return p, perr
	}
	if p.Name == "" {
		return p, publishErr(http.StatusBadRequest, "Give it a name.")
	}
	if utf8.RuneCountInString(p.Name) > maxEntryTextLength {
		return p, publishErr(http.StatusBadRequest, "Keep the name to %d characters.", maxEntryTextLength)
	}
	switch p.Kind {
	case graphGroupKind:
		p.Group, p.Graph = "", nil
		return p, nil
	case graphPresetKind:
		return p, validPresetGraph(p)
	}
	return p, publishErr(http.StatusBadRequest, `Make it a "preset" or a "group".`)
}

// validPresetGraph fails when a preset has no graph, is in a group with an ID
// that can't be one, or picks a choice the Graph page doesn't have.
func validPresetGraph(p GraphPreset) *PublishError {
	if p.Group == p.ID {
		return publishErr(http.StatusBadRequest, "A preset can't be its own group.")
	}
	if p.Graph == nil || strings.TrimSpace(p.Graph.X) == "" {
		return publishErr(http.StatusBadRequest, "Pick what goes along the graph's x axis.")
	}
	g := p.Graph
	if !slices.Contains(graphTypes, g.Type) || !slices.Contains(graphMeasures, g.Measure) || !slices.Contains(graphSorts, g.Sort) {
		return publishErr(http.StatusBadRequest, "Pick a graph type, what it measures and an order the Graph page has.")
	}
	if g.Limit < 0 {
		return publishErr(http.StatusBadRequest, "Show all of the x axis's values, or a number of them above 0.")
	}
	return validThresholds(g)
}

// validThresholds fails when an axis's lowest value is above its highest.
func validThresholds(g *GraphSettings) *PublishError {
	for _, r := range [][2]*float64{{g.XMin, g.XMax}, {g.YMin, g.YMax}} {
		if r[0] != nil && r[1] != nil && *r[0] > *r[1] {
			return publishErr(http.StatusBadRequest, "An axis's lowest value is above its highest.")
		}
	}
	return nil
}
