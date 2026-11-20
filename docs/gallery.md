# Gallery

`/gallery` shows every photo in the portfolio as the next Commit will save it: the base branch's photo files (`GET /api/photos/published` → `GET /photos/published`) with the photo data pull request's files and the [changes waiting for Commit](pending-changes.md) over them (`GET /api/photos/in-flight`), and the [local edits](combined-data-store.md#local-edits) made too. A photo the pull request removes is left out, and one it adds is listed. The base branch's photos are drawn as soon as they're read, and the pull request's are laid over them once that read finishes too. The list is read from the photos folder rather than `ALLPHOTOS.json`, since editing needs each photo's file path, which `ALLPHOTOS.json` entries don't carry. **All Photos** used to be a page of its own; it's this page now, and an old `/all-photos` link opens the Gallery with the same Show group, photo and sort.

> **Frontend analogy:** it's a client-side join of two queries' caches: the base branch's list, with the pull request's copies replacing the rows they share, like spreading a patch object over the original.

The photos show as Square Thumbnail tiles (from the [offline copy](offline-mode.md)) with their title and file name, filterable by either and by the same **Title**, **Place**, **Albums**, **Tags**, **Genres** and **Re-edit mark** filters as [Photos in Flight](photos-in-flight.md#filters), kept in the URL with a `has` prefix (`?hasTitle=without`, `?hasPlace=with`) so they don't clash with the [portfolio Grid's filters](#the-portfolio-grids-filters) below them. In place of Photos in Flight's **GPS position**, the Gallery has [**On the map**](#on-the-map). Filters, sorts and counts go by each photo as it'll be saved, so a photo you've given a title or an album shows with it straight away. Photos the pull request (or a change waiting for Commit) adds or changes are marked "New in flight" or "Changes in flight", linked to Photos in Flight, and the count under the title says how many there are.

### Which photos show

**Show** picks which kinds of photo are listed, any number at once, each with how many there are:

- **Published** (on at first; `?published=false` turns it off): the photos on the portfolio.
- **Drafts** (`?drafts=true`): [drafts](drafts.md), photos without a title, which `ALLPHOTOS.json` leaves out.
- **Undecided** (`?undecided=true`): photos set aside as [Undecided](photos-in-flight.md#undecided).
- **Lower Tier** (`?lowerTier=true`): [Lower Tier](lower-tier.md) photos.

Each photo is in one of them: an Undecided photo is Undecided whatever else it is, then an untitled one is a draft, then a Lower Tier one is Lower Tier. So turning **Published** off and **Lower Tier** on lists only the Lower Tier photos. A kind with no photos is left out of **Show** unless it's on. Drafts, Undecided and Lower Tier tiles have a dashed border, a dimmed image and a **Draft** (purple), **Undecided** (amber) or **Lower Tier** (slate) badge on the image's corner, and each sits where the sort places it, so you can see where it would go on the portfolio. With **Keep untitled photos as drafts** turned off in Settings, no photo is a draft or Undecided, as Commit then treats them. Links made before the pages merged still work: `?undecided=show` turns Undecided on, and `?undecided=only` or `?lowerTier=only` turns that kind on and Published off. **Clear filters** resets **Show** too.

### Sort

**Sort** orders the photos by **Date taken** (the default), **Date added** (the [`addedDate`](data-model.md#date-added)), **Time of day** (by the clock where they were taken), **Color** (around the color wheel, then the shades) or **Vividness** (average), and **Order** runs it either way: oldest or newest first, earliest or latest, red to white or white to red, least or most vivid first. They're kept in the URL as `?sort=` (left out for date taken) and `?order=asc|desc` (left out for each sort's usual way: newest first, earliest first, red first, most vivid first); changing the sort resets the order. Photos a sort can't place (no date, no date added, or no colors saved yet) come after the rest, newest first. Color and Vividness use the portfolio's own `sortPhotos` (`apps/portfolio/src/lib/color-sort.ts`), so they match the Color page.

### Full size

Clicking a photo's thumbnail opens it full size over the page (the shared `ImageLightbox`), as the portfolio shows it, with any faces pixelated. **←** and **→** (or the arrows at the image's sides) move to the previous or next photo the Gallery shows, in its sort and going round from the last to the first, and **Esc** closes it. It steps through everything the filters and **Show** leave, including tiles below the screen that aren't drawn yet; a photo with no image in R2 is skipped. The top bar shows the photo's Draft, Undecided or Lower Tier mark and its place, such as "12 of 340", and **Edit** under the image opens it on the Photo page. Closing puts focus back on the thumbnail of the photo last shown. While **Select** is on, clicking a thumbnail chooses the photo instead.

### Jumping to a photo

A box floating at the bottom right, **Drafts and Undecided**, lists every draft and Undecided photo in the Gallery's sort, whether they're shown or not. Picking one turns its kind on in **Show**, scrolls to it and rings it. The box starts collapsed to its count with its header, so it doesn't cover the filters or the photos, and opens when clicked.

`?photo=<path>` names the photo to scroll to and ring, and that photo is shown even when its kind is hidden (the tiles are drawn at least as far as it). The **See in Gallery** button (a crosshair icon) beside a draft or Undecided photo elsewhere opens it this way, with its kind shown:

- on Photos in Flight, next to a photo's **Draft, not on the portfolio** mark, and on each tile in the **Drafts**, **Undecided** and **Can't be edited** panels.

### On the map

**On the map** (**Any**, **Yes** or **No**, `?hasMap=with` or `?hasMap=without`) keeps the photos the portfolio's map shows, or the ones it leaves off. A photo is on the map when it has its own GPS position the portfolio can read (its custom one, or else its EXIF one), or when one of its places, or a place that place is in, has one on the Places page. So a photo with no GPS position of its own still counts when it inherits one from a place, and a GPS position the portfolio can't read doesn't. It's `isOnMap` in `lib/photo-map.ts`, which reads the photo's own position with the portfolio's `photoGps` and its places with the live places (including changes waiting for Commit), the same way the [place filter's](#a-places-photos) tile marks do. Photo Sets don't change it: the map only draws photos already on it as one marker. It goes by position alone: whether Undecided and Lower Tier photos are listed is up to their own filters.

> **Frontend analogy:** it's filtering by a computed value rather than a raw field, like filtering a list by `getComputedStyle(el).display !== "none"` instead of checking the element's own `style` attribute.

### Drawing tiles as you scroll

The Gallery draws its tiles 96 at a time: the first batch shows at once, and the next is added whenever the end of the drawn tiles comes within 1,500px of the screen (`useRevealed` in `hooks/use-revealed.ts`). Filters, the count and **Select all** still work on every photo; only the tiles below the screen wait. Drawing all ~1,300 tiles at once took a second or two of the browser's time on each visit, which froze spinners and made the page hiccup as it opened, and it got slower with each photo added. The [drafts](drafts.md) list and [Photos in Flight](photos-in-flight.md) (12 photos at a time, since each one is a large card) do the same.

> **Frontend analogy:** it's infinite scroll over data that's already loaded: an `IntersectionObserver` on an empty element after the last tile bumps how many of the array get rendered.

### The portfolio Grid's filters

Under those, **Show filters** opens the same filters as the portfolio's [Grid and Table](portfolio-filters.md): **Places** (any number of countries, cities and places), the **Groups** picker (album, tag and genre), **Camera** and **Lens** (with their metadata groups), the **ISO**, **Exposure**, **Focal length**, **Aperture** sliders, the **When** picker, and the **Visuals** picker (colors and orientation), kept in the URL under the portfolio's own names (`?album=`, `?camera=`, `?color=`, …), so a filtered Grid link's search works here too. Each choice counts the photos the Gallery's other filters leave, and the Gallery's **Clear filters** clears these as well, and so does the X that pointing at **Show filters** shows. Changing any Gallery filter keeps the page where it's scrolled to: each filter's `navigate` passes `resetScroll: false`, since TanStack Router scrolls to the top on every navigation otherwise. The Grid's filters, being the same code, do too.

They're the portfolio's own code, not a copy: the Gallery imports `CameraFilterBar` and `VisualsPicker` from `apps/portfolio/src` through the `@portfolio/*` alias (in both apps' `tsconfig.json` and `vite.config.ts`), and reads each photo's JSON (with local edits) with the portfolio's `photosFromData`. The files those import each other with `@portfolio/` rather than `@/`, since `@/` means a different folder in each app; a new import in one of them must do the same. A photo with no date can't be placed in time by the portfolio, so it's hidden while any of these is set.

The choices the dropdowns and sliders list (albums, tags, cameras, setting ranges, metadata groups, places) come from the photo data in this clone when the pipeline was built, the `.local.json` files `pnpm photos:local` makes or else the committed JSON, the same way the portfolio gets them; the counts and the filtering use the Gallery's live photos. An album or camera that's only in GitHub shows up once the clone has it.

> **Frontend analogy:** it's like importing a component from a sibling package in a monorepo without publishing it: the alias points both apps at the same source files, and Vite's `resolve.dedupe` makes them share one React and one TanStack Router.

A package that a shared portfolio file imports (React, `date-fns`, `lucide-react`, …) has to be in client-pipeline's `package.json` **and** in `resolve.dedupe` in its `vite.config.ts`. The Docker build installs only the pipeline's packages, so without `dedupe` Vite looks for the package next to the portfolio's file, finds no `node_modules` there, and the build fails with "failed to resolve import". CI's **Docker (pipeline image)** check builds that image, so it catches a missing entry before it reaches the Raspberry Pi.

### A place's photos

On the [Places page](places-and-localizations.md#places), a place's photo count and **See photos in Gallery** at the top of its panel open the Gallery showing only the photos that list that place (`?placeId=<id>`). The filter bar then shows the place, with an × that shows every photo again, and a **Coordinates** filter for where each of its photos goes on the portfolio's map (`?placeGps=`):

- **Own** (`own`): the photo has its own GPS position, its custom one or its EXIF one, so it's placed exactly.
- **From a place** (`place`): it has none, so it inherits the position of its first place that has one (or a place that place is in), the way the portfolio's map picks it.
- **None** (`none`): neither it nor any of its places has a position, so it isn't on the map.

While a place is chosen, each tile says which: a green **Own GPS position**, a blue **GPS from Mill River Park** (with "(exact location)" when that place is marked as one), or an amber **Not on the map**. **Clear filters** clears the place too. The count can be lower than the Places page's, since the Gallery hides drafts, Undecided and Lower Tier photos until **Show** includes them.

> **Frontend analogy:** the tile marks are like DevTools' computed styles showing whether a value is set on the element itself or inherited from a parent: `customGpsPosition ?? gpsPosition ?? place.gps`.

Each photo with its image in R2 has an **Edit** button that opens it on the Photo page: the base branch's copy (`/exif?edit=<path>&from=gallery`) when the photo is only there, or else the pull request's (`/exif?edit=<path>`), the same editor Photos in Flight uses, and each tile lists the photo's album, tag and genre names. Saving keeps the JSON as a [change waiting for Commit](pending-changes.md), which Commit sends to the open pull request (the branch must already have the file; update it from the base branch if it was made before the photo merged), or to a new one when none is open. From then on the photo is in Photos in Flight, and edits go to that copy, whether or not a pull request is open yet. A new title doesn't rename the file, since the pull request would then delete the old file from the portfolio when it merges and the photo's file name would change under it.

A photo people liked shows a heart and how many of them liked it beside its title, summed from the lists on [User Likes](viewer-likes.md).

Each tile's **Compare** puts the photo in a [compare group](compare-groups.md), to weigh it against others on the Compare page before deciding which gets posted.

**Select** turns on choosing photos, with a checkbox on each tile (or click the tile), **Select all shown** for the filtered ones, and an **Add albums, tags and genres** card with an album, a tag and a genre combobox. **Add to N photos** (`POST /api/photos/groups` with `paths`, `albums`, `tags` and `genres`) adds them to each chosen photo's `albums`, `tags` and `genres` after the ones it has, changing nothing else in the files, as [changes waiting for Commit](pending-changes.md), the way Update Data saves. It warns when a chosen photo is already in another album. Under it, an **Undecided** card sends the chosen photos to [Undecided](photos-in-flight.md#undecided) (**Send N photos to Undecided**) or moves them back, and a **Lower Tier** card marks them [Lower Tier](lower-tier.md) or takes the mark off. Both keep the change waiting for Commit straight away, and the selection stays, so a photo sent to Undecided while **Show → Undecided** is off leaves the list but can still be moved back.

The code is in `apps/client-pipeline/src/routes/gallery.tsx` and `components/gallery/`: `gallery-files.ts` builds the list, `lib/gallery-show.ts` reads **Show** and the old links, `photo-sort.ts` sorts, `gallery-lightbox.tsx` is the viewer and `jump-box.tsx` the box. `routes/all-photos.tsx` only sends old links on to the Gallery.
