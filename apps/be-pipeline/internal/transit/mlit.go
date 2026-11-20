package transit

import "context"

// SourceMLIT is the Line.Source of a line found on Japan's rail map.
const SourceMLIT = "mlit"

// mlitName names Japan's rail map in what it says.
const mlitName = "Japan's rail map"

// mlitLineBits is how many bits of a route's ID on Japan's rail map hold its
// lines: up to 5 of them.
const mlitLineBits = 5 * routeBits

// mlit is Japan's rail map, downloading and reading it first when needed.
func (c *Client) mlit(ctx context.Context) (*railNet, error) {
	return c.Rails.get(ctx, &c.progress, SourceMLIT, mlitName, c.readMLITNet)
}

// readMLITNet is Japan's rail map's network from its folder, downloaded there
// first when it isn't there yet, telling p how far it's got.
func (c *Client) readMLITNet(p *progress) (*railNet, error) {
	dir := mlitDir()
	if !haveMLIT(dir) {
		ctx, cancel := context.WithTimeout(context.Background(), mlitDownloadTimeout)
		defer cancel()
		if err := downloadMLIT(ctx, c.HTTP, mlitURL(), dir, p); err != nil {
			return nil, err
		}
	}
	p.setStep(StepReading, "Reading the rail map saved in "+dir)
	sections, stations, err := readMLIT(dir)
	if err != nil {
		return nil, err
	}
	net := newRailNet(sections, stations)
	net.source, net.lineBits = SourceMLIT, mlitLineBits
	return net, nil
}

// MLITLines are, from Japan's rail map, the route along its lines from from to
// to, each [longitude, latitude], changing lines where it has to, and then
// each line passing within nearM of both ends.
func (c *Client) MLITLines(ctx context.Context, mode string, from, to [2]float64) ([]Line, error) {
	if !railModes[mode] {
		return nil, ErrNoKind
	}
	net, err := c.mlit(ctx)
	if err != nil {
		return nil, err
	}
	return railLines(net, from, to), nil
}

// MLITTrack is route id's track on Japan's rail map from the point on its
// lines nearest from to the point nearest to, with from and to added at its
// ends, as Track is.
func (c *Client) MLITTrack(ctx context.Context, id int64, from, to [2]float64) ([][2]float64, error) {
	net, err := c.mlit(ctx)
	if err != nil {
		return nil, err
	}
	return railTrack(net, id, from, to)
}

// MLITStops are route id's stations on Japan's rail map, in the order its
// track runs, each name once.
func (c *Client) MLITStops(ctx context.Context, id int64) ([]Stop, error) {
	net, err := c.mlit(ctx)
	if err != nil {
		return nil, err
	}
	return railStops(net, id)
}
