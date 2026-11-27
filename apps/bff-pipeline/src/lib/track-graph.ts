import type { Spot } from "./transit-types.js";

/**
 * A line's ways as a graph, each mapped point a node joined to the points next to it along a way,
 * for following a line's track between two spots. The Go backend keeps the same graph for its bus
 * maps (`internal/transit/track.go`).
 */
class TrackGraph {
  readonly #points: Spot[] = [];
  readonly #index = new Map<string, number>();
  readonly #edges: number[][] = [];

  /** The graph of lines, each point a node joined to the points next to it along its line. */
  constructor(lines: Spot[][]) {
    for (const line of lines) {
      let prev = -1;
      for (const p of line) {
        const n = this.#node(p);
        if (prev >= 0 && prev !== n) {
          this.#edges[prev]!.push(n);
          this.#edges[n]!.push(prev);
        }
        prev = n;
      }
    }
  }

  /** p's node, added when it's new. */
  #node(p: Spot): number {
    const key = `${p[0]},${p[1]}`;
    const known = this.#index.get(key);
    if (known !== undefined) return known;
    this.#index.set(key, this.#points.length);
    this.#points.push(p);
    this.#edges.push([]);
    return this.#points.length - 1;
  }

  /** The node closest to p, the first of equals; -1 with no nodes. */
  #nearest(p: Spot): number {
    let best = -1;
    let bestD = Infinity;
    this.#points.forEach((q, n) => {
      const d = meters(p, q);
      if (d < bestD) [best, bestD] = [n, d];
    });
    return best;
  }

  /**
   * The shortest way along the track from the node nearest from to the node nearest to; empty when
   * they aren't joined.
   */
  between(from: Spot, to: Spot): Spot[] {
    const a = this.#nearest(from);
    const b = this.#nearest(to);
    if (a < 0) return [];
    const prev = this.#shortest(a, b);
    if (!prev) return [];
    const out: Spot[] = [];
    for (let n = b; n !== a; n = prev[n]!) out.push(this.#points[n]!);
    out.push(this.#points[a]!);
    return out.reverse();
  }

  /** Runs Dijkstra from a: each node's previous node on its shortest way, or undefined when b can't be reached. */
  #shortest(a: number, b: number): number[] | undefined {
    const dist = this.#points.map(() => Infinity);
    const prev = this.#points.map(() => -1);
    dist[a] = 0;
    const queue = new MinQueue();
    queue.push({ node: a, dist: 0 });
    while (queue.size > 0) {
      const item = queue.pop();
      if (item.dist > dist[item.node]!) continue;
      if (item.node === b) return prev;
      for (const n of this.#edges[item.node]!) {
        const d = item.dist + meters(this.#points[item.node]!, this.#points[n]!);
        if (d < dist[n]!) {
          dist[n] = d;
          prev[n] = item.node;
          queue.push({ node: n, dist: d });
        }
      }
    }
    return undefined;
  }
}

/** A node waiting in the queue, with its distance so far. */
interface Item {
  node: number;
  dist: number;
}

/**
 * A min-heap of items by distance, ordered exactly as Go's `container/heap` orders one, so two ways
 * of equal length are chosen between as the Go backend chose.
 */
class MinQueue {
  readonly #items: Item[] = [];

  /** How many items wait. */
  get size(): number {
    return this.#items.length;
  }

  /** Adds an item. */
  push(item: Item): void {
    this.#items.push(item);
    this.#up(this.#items.length - 1);
  }

  /** Takes out the item with the least distance. */
  pop(): Item {
    const n = this.#items.length - 1;
    this.#swap(0, n);
    this.#down(0, n);
    return this.#items.pop()!;
  }

  #less(i: number, j: number): boolean {
    return this.#items[i]!.dist < this.#items[j]!.dist;
  }

  #swap(i: number, j: number): void {
    [this.#items[i], this.#items[j]] = [this.#items[j]!, this.#items[i]!];
  }

  #up(j: number): void {
    while (j > 0) {
      const parent = Math.floor((j - 1) / 2);
      if (!this.#less(j, parent)) break;
      this.#swap(parent, j);
      j = parent;
    }
  }

  #down(i: number, n: number): void {
    for (;;) {
      const left = 2 * i + 1;
      if (left >= n) break;
      const right = left + 1;
      const j = right < n && this.#less(right, left) ? right : left;
      if (!this.#less(j, i)) break;
      this.#swap(i, j);
      i = j;
    }
  }
}

/**
 * The distance between a and b, in meters, on a flat map scaled to their latitude: close enough
 * along a line's track.
 */
export function meters(a: Spot, b: Spot): number {
  const scale = Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
  return Math.hypot((a[0] - b[0]) * scale, a[1] - b[1]) * 111_320;
}

/** The track between from and to along lines, with from and to added at its ends; undefined when it can't be followed. */
export function trackBetween(lines: Spot[][], from: Spot, to: Spot): Spot[] | undefined {
  const path = new TrackGraph(lines).between(from, to);
  return path.length < 2 ? undefined : [from, ...path, to];
}
