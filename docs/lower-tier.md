# Lower Tier photos

A **Lower Tier** photo is one you like and may put in an album or a [trip line](trip-lines.md), but that shouldn't be
shown unless you choose to show it. The mark is only set and read in the pipeline for now: the portfolio doesn't hide
Lower Tier photos yet.

## The field

The mark is the photo JSON's `lowerTier: true`. A photo that isn't Lower Tier leaves it out, and taking the mark off
sets it to `null`, so the field is never `false`. Like `undecided`, it isn't one of the fields every photo has
(`newPhotoJSON`), so **Update Data → Missing fields** doesn't add it. Commit doesn't leave Lower Tier photos out of
`ALLPHOTOS.json`, since albums and trip lines can still use them.

The mark is a [local edit](combined-data-store.md#local-edits): it's kept in the browser as a change waiting for
**Commit** the moment it's set, with no **Save changes** to press, and Commit writes it into the photo file.

> **Frontend analogy:** it's an optimistic update kept in a persisted Zustand store, which a later "Save all" request
> sends to the server.

## Setting it

- **Photo page:** the **Lower Tier** card under **Re-edit** in the Details section has a **Lower Tier photo** switch.
- **Gallery:** with **Select** on, the **Lower Tier** card under **Add albums, tags and genres** marks every chosen
  photo (**Mark N photos Lower Tier**) or takes the mark off. The selection stays, so the same photos can be given
  albums and tags too.
- **Compare:** each photo of an open [compare group](compare-groups.md#the-compare-page) has a **Lower Tier** button
  beside **Pick as winner**, so a frame that won't be posted but is still worth keeping can be marked while the group's
  photos are side by side. It stays in the group, and clicking it again takes the mark off.

## Seeing it

- The Gallery hides Lower Tier photos until **Show → Lower Tier** is on (`?lowerTier=true`); turning **Published** off
  too leaves only them. **Clear filters** resets it with the other filters. A Lower Tier photo that's also a draft or
  Undecided is shown with those instead (see [Gallery](gallery.md#which-photos-show)).
- Gallery tiles, Photos in Flight and the Compare page's photos mark a Lower Tier photo **Lower Tier**, with what it means in the tooltip.

The code is `lib/lower-tier.ts` (`isLowerTier`, `lowerTierPaths`), `components/lower-tier.tsx` (the card, the mark and
`useSetLowerTier`), `lib/gallery-show.ts` and `components/gallery/bulk-lower-tier.tsx` in the Gallery, and
`components/compare/lower-tier-button.tsx` on the Compare page.
