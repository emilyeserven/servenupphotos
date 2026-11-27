package transit

import "fmt"

// Searched says, in a sentence for the page, what a lines look-up of source
// (a Line.Source such as "osmbus") between from and to looked through: which
// downloaded map and how big it is, and for a bus map how many routes pass near each end, so "no line
// found" can be told apart from a map that has none nearby.
func (c *Client) Searched(source string, from, to [2]float64) string {
	switch source {
	case SourceMLIT:
		if net, ok := c.Rails.peek(SourceMLIT); ok {
			return fmt.Sprintf("%s (MLIT's 2024 railway data, %d lines)", mlitName, len(net.lines))
		}
		return mlitName
	case SourceOSMRail:
		region, ok := c.loadedRegion(from, to)
		if !ok {
			return "OpenStreetMap's rail map"
		}
		if net, ok := c.Rails.peek(SourceOSMRail + "/" + region.id); ok {
			return fmt.Sprintf("OpenStreetMap's rail map of %s (%d lines, saved in %s)", region.name, len(net.lines), osmRailMapDir(region))
		}
		return "OpenStreetMap's rail map of " + region.name
	case SourceOSMBus:
		return c.busSearched(from, to)
	}
	return ""
}

// busSearched says which bus map a look-up between from and to searched, how
// many routes it has, and how many pass near each end.
func (c *Client) busSearched(from, to [2]float64) string {
	region, ok := c.loadedRegion(from, to)
	if !ok {
		return "OpenStreetMap's bus map"
	}
	net, ok := c.Buses.peek(SourceOSMBus + "/" + region.id)
	if !ok {
		return "OpenStreetMap's bus map of " + region.name
	}
	return fmt.Sprintf("OpenStreetMap's bus map of %s (%d bus routes, saved in %s): %d pass within %d m of the first end and %d within %d m of the last",
		region.name, len(net.Routes), osmBusMapDir(region), net.nearCount(from), nearM, net.nearCount(to), nearM)
}

// loadedRegion is the region of Geofabrik's index, once it's been read,
// holding both from and to.
func (c *Client) loadedRegion(from, to [2]float64) (osmRegion, bool) {
	c.osmIndexMu.Lock()
	regions := c.osmIndex
	c.osmIndexMu.Unlock()
	i, err := regionFor(regions, from, to)
	if err != nil {
		return osmRegion{}, false
	}
	return regions[i], true
}
