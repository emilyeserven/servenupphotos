# When

A **When** button after **Groups**, on every view with filters (on the Map, under **More filters**), opens one picker for when the photos were taken (`components/when-filter.tsx`, `components/when-picker-parts.tsx`, `lib/when-filters.ts`), by the clock and calendar where each was taken, as a photo's capture time has no time zone. Like the other pickers (see [Picker layout](picker-layout.md)), its left side lists **Seasons**, **Months**, **Days**, **Hours** and **Date range**, each saying what it's set to ("Any", the one or two chosen such as "Spring, Autumn", or how many, such as "4 hours") with a dot while it's set, and **Clear when** under them while any is; the right side shows the chosen one's buttons, under a line saying what they do. It picks one way at a time, and choosing in one clears the others. The picker opens on the one that's set. Every button says how many photos it would show, given the other filters, and a choice with none is dimmed.

- **Seasons**, **Months**, **Days** and **Hours** pick across all years, and any number of one kind can be on: they show the photos in any of them. Above each kind's buttons, one picks just the one it is now, such as **This season · Autumn**, **This month · November**, **Today · Saturday** or **This hour · 2 PM–3 PM**, in every year; clicking it again clears it.
  - **Seasons** (`?season=summer&season=winter`), as the northern hemisphere has them: Spring is March to May, and Winter is December to February.
  - **Months** (`?month=june&month=july`), in four columns headed by their season.
  - **Days** of the week, Monday first (`?weekday=saturday&weekday=sunday`).
  - **Hours** (`?hour=17&hour=18`, on a 24-hour clock), a row for each part of the day: Late night (12–5 AM), Early morning, Morning, Afternoon, Evening and Night (9 PM–12 AM). A part's name turns all its hours on, or off once they all are.
- **Date range**: two fields, **From** and **To** (`?start=2024-03-01&end=2024-05-31`, both days included). Each shows its day, or "Any day" while that end is open, opens its own calendar when clicked, and has an X that clears it. The calendars keep to the months a photo was taken in, open on the field's day or the latest photo's month, and keep From on or before To. Clicking the month's name above a calendar swaps the days for every month over the years, a row of twelve for each year, newest first, to jump straight to one.

On the Timeline, the date range is the days it shows.

> **Frontend analogy:** each kind is a multi-select checkbox group kept as repeated search params, like `?tag=a&tag=b`, and the left list is a set of radio buttons over which group is in use.
