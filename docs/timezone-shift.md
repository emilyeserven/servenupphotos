# Times across timezones

A camera keeps one clock, so on a day you cross timezones (a flight, a border) the photos taken after the change carry
the old time: a photo taken at 7 PM in Tokyo says 6 PM because the camera still thinks it's in Shanghai. The Photo
page fixes a day of them at once.

> **Frontend analogy:** the camera stores a naive `Date` string with no offset, like `"2026-10-01T18:15"` with no `Z`.
> The fix reads each string in the timezone the clock was set to, turns it into a real instant, and formats that
> instant again in the timezone the photo was actually taken in: `Temporal.PlainDateTime` → `ZonedDateTime` →
> `withTimeZone()` → back to a plain date-time.

## Using it

When a photo is open for editing (`/exif?edit=…`), the **Times across timezones** card, right under the card with the title and **Date taken**, has
**Fix times across timezones…**, which opens a dialog:

1. **Day, by the camera's clock** starts on the open photo's day. It lists every photo from Photos in Flight and the
   Gallery (with their [local edits](combined-data-store.md#local-edits)) whose camera time or current time is on that
   day, in the order the camera took them, so a photo already fixed onto the next day still shows.
2. Each photo is **Before** (the default), **After** or **Leave out**. **After from here** marks that photo and every
   later one as after, which is usually all it takes; photos left out keep their choice.
3. **Start timezone** and **End timezone** are IANA timezones (type a city, such as Tokyo), each shown with its offset
   on that day, daylight saving included. The start one begins as the browser's own.
4. **The camera's clock was set to** is the start timezone unless you set the camera to the new time before leaving.
   Photos taken in the clock's own timezone keep their time.
5. The preview lists each photo's time **Now** and **After the fix**, how far it moves, and **Moves to …** when it
   lands on another day. Under it are the [knock-on effects](#knock-on-effects).
6. **Fix N photos' times** keeps the new times and closes the dialog.

## What it writes

Each fixed time goes into the photo's `customCreateDate` (see [Date taken](data-model.md#date-taken)); the EXIF
`createDate` is kept as it is. A photo whose fixed time is its EXIF time gets `null`, so a wrong earlier fix is undone.
The times are worked out from the EXIF date (or from `customCreateDate` when the EXIF has none), never from an earlier
fix, so running it again with other timezones replaces the last fix rather than adding to it. No offset is stored: the
portfolio treats every time as the local time where the photo was taken.

They're kept as [local edits](combined-data-store.md#local-edits), counted by the sync button, until **Commit** saves
them. When the open photo is one of them, its **Date taken → Custom date** field takes the new time too, so saving
the page keeps it.

## Knock-on effects

Changing a time can move a photo to another day or change the order of a day's photos, so the preview says:

- How many photos move to another day: the portfolio's Timeline and the Grid's date sort put them on the new day, and
  [Trip Lines](trip-lines.md) lists them under it.
- Automatic trip lines are redrawn in the new order at the next Commit, so they need nothing.
- Each day with a trip line marked by hand that the fix touches, with a link to it on Trip Lines:
  - photos it goes through move off that day: the Dashboard's
    [Needs Attention](dashboard.md) lists it as out of date until it's redone;
  - other photos move onto that day: any with an exact spot aren't on the line, so Needs Attention lists it too;
  - only the order of its photos changes: Needs Attention doesn't catch that, so check the line by hand.

The work is in `lib/timezone-shift.ts` (timezone arithmetic with `Intl.DateTimeFormat`) and
`lib/timezone-shift-plan.ts` (which photos are on the day, what each becomes, and the trip line effects); the dialog is
in `components/timezone-shift/`.
