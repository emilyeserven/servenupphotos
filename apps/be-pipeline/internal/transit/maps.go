package transit

import (
	"context"
	"sync"
)

// mapLoads loads each map once, by key, keeping it for every look-up after:
// the rail maps (railNet) and the bus maps (busNet).
type mapLoads[T any] struct {
	mu    sync.Mutex
	loads map[string]*mapLoad[T]
}

// mapLoad is one map: loaded, or loading until busy closes, or failed.
type mapLoad[T any] struct {
	net   T
	ready bool
	busy  chan struct{}
	err   error
}

// get is the map named name, kept as key, loading it with load first when
// needed and listing it in prog while it loads. A look-up waits for the load
// as long as ctx allows; the load goes on without it. A failed load is tried
// again on the next look-up.
func (r *mapLoads[T]) get(ctx context.Context, prog *mapProgress, key, name string, load func(*progress) (T, error)) (T, error) {
	var zero T
	r.mu.Lock()
	if r.loads == nil {
		r.loads = map[string]*mapLoad[T]{}
	}
	l := r.loads[key]
	if l == nil {
		l = &mapLoad[T]{}
		r.loads[key] = l
	}
	if l.ready {
		defer r.mu.Unlock()
		return l.net, nil
	}
	if l.busy == nil {
		l.busy = make(chan struct{})
		go r.load(l, l.busy, func() (T, error) {
			net, err := load(prog.begin(key, name))
			prog.end(key, err)
			return net, err
		})
	}
	busy := l.busy
	r.mu.Unlock()
	select {
	case <-busy:
	case <-ctx.Done():
		return zero, &RailMapError{Map: name, Err: ErrMapLoading}
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if !l.ready {
		return zero, &RailMapError{Map: name, Err: l.err}
	}
	return l.net, nil
}

// load runs load for l and closes done, keeping the map or why it couldn't
// be loaded.
func (r *mapLoads[T]) load(l *mapLoad[T], done chan struct{}, load func() (T, error)) {
	net, err := load()
	r.mu.Lock()
	l.net, l.err, l.ready, l.busy = net, err, err == nil, nil
	r.mu.Unlock()
	close(done)
}

// peek is the map kept as key when it's loaded, without loading it.
func (r *mapLoads[T]) peek(key string) (T, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if l := r.loads[key]; l != nil && l.ready {
		return l.net, true
	}
	var zero T
	return zero, false
}
