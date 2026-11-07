# Graph Presets

`/graph-presets`, under **Configuration** in the sidebar, makes the ready-made graphs over the portfolio's
[Graph](portfolio-graph.md) page, such as a dot graph of **Aperture**, and **preset groups**. The Graph page's
**Presets** button opens a picker with the groups on the left, such as **When**, and the chosen group's presets, such as
**Seasons by year** and **Time of day**, on the right; presets in no group are listed together as **Other**. A
**spotlight** preset also shows as its own button above Presets and Adjust Graph.

> **Frontend analogy:** a preset is a saved `Partial<GraphConfig>` that the Graph page spreads over its state when its
> button is clicked, like a saved filter in a table. A group is only a heading the presets point to by ID, like a
> `<optgroup>` turned into a menu button.

## The file

Each preset and each group is one file, `graphs/<id>.json`, and **Commit** combines them into `graphs/GRAPHS.json` the
way it combines the timeline labels into `TIMELINE.json`:

```json
{
  "id": "time-of-day",
  "kind": "preset",
  "name": "Time of day",
  "order": 2,
  "group": "when",
  "graph": {
    "type": "pie",
    "x": "daypart",
    "measure": "count",
    "y": "",
    "split": "",
    "stacked": false,
    "sort": "group",
    "limit": 0
  }
}
```

```json
{ "id": "when", "kind": "group", "name": "When", "order": 5 }
```

- **`kind`** is `preset` or `group`. A group has no `group` or `graph`.
- **`order`** places it in the row, lowest first, ties by name. A preset in a group is ordered among that group's
  presets, and a group among the presets in no group.
- **`group`** is the ID of the group a preset is in; left out, the preset is listed under **Other**. A preset whose
  group isn't there is listed there too.
- **`spotlight`** is `true` for a preset shown as its own button above the Graph page's Presets and Adjust Graph; left
  out when it isn't. A group never has it.
- **`graph`** holds the Graph page's settings by the names in `GraphConfig` (`lib/graph-data.ts`): `type` (bar, line,
  dot, pie, scatter or heatmap), `x` and `y` (stat IDs, such as `aperture`, `year` or `daypart`), `measure` (count or percent),
  `split` (a stat ID or "" for none), `stacked`, `sort` (group, reverse or count), `limit` (0 for all), and the
  Range group's parts, each left out when it's off: `xFrom` and `xTo` (x values by name, such as `"f/2"`), `yFrom`
  and `yTo` (a scatterplot's or heatmap's y values by name), `yMin` and `yMax` (where a bar, line or dot graph's y axis starts and
  ends), `minPhotos` (how many photos an x value needs) and `hideZeros`. Saving fails when `yMin` is above `yMax`. A preset
  never sets the filters; the visitor's stay as they are.
- The ID is made from the name when it's first saved (with `-2` and so on after it when that's taken) and kept when
  it's renamed.

Saving checks that a preset's group is a saved group, and removing a group fails while presets are still in it.

## The page

The left side lists the presets and groups in the Graph page's order, each group with its presets indented under it,
and **New preset** and **New group** under them. The right side edits the chosen one:

- A **preset** has its name, its order, its **Group** (or **None, listed under Other**), **Spotlight**, and the graph it sets, picked with
  the same dropdowns as the Graph page's Adjust Graph box (imported from the portfolio, so a stat added to the Numbers
  page shows up here too).
- A **group** has its name and order, and says which presets are in it. A group with no presets isn't shown on the
  Graph page, and **Remove group** waits until its presets are moved out.

**Save** (`PUT /api/graphs/<id>` → `PUT /graphs/{id}`) and **Remove** (`DELETE /api/graphs/<id>` → `DELETE
/graphs/{id}`) keep the file as a [change waiting for Commit](pending-changes.md), counted by the sync button as a graph
preset. The page reads them from the [combined data store](combined-data-store.md)'s `GRAPHS.json` with those changes
made over it, so a saved preset shows at once. Photos in Flight lists the files under **Graph presets**.

Locally, `pnpm photos:local` also makes `GRAPHS.local.json`, which the portfolio uses in place of the committed file.
