# Clearing filters

Every button that opens filters has a clear X while any of its filters is set (`ClearableTrigger` in `components/clearable-trigger.tsx`): pointing at the button, or reaching it with the keyboard, swaps the end of it for an X, which clears just that button's filters without opening it.

- **Groups**, **When**, **Gear & settings** and **Visuals** swap their arrows for the X, and clear their own filters: Groups the album, tag and genre, When every "when" filter, Gear & settings the camera, lens and settings (not the orientation, which is in Visuals), and Visuals the colors, vividness and orientation. **Clear when** and **Clear visuals** under their pickers' lists do the same from inside.
- **Show filters** (or **Hide filters**) swaps its count for the X, which clears every filter, the text search too.
- On the Map, **More filters** swaps its arrows for the X, which clears every filter it holds.
- **Places** keeps the X it always shows while a place is chosen, to the left of its arrows.

On a touch screen, which can't point, the X shows whenever any of the button's filters is set. The Graph page's Filters tab, which has no Show filters button, keeps a **Clear filters** button instead.

> **Frontend analogy:** the X is a sibling of the trigger button positioned over it, not a child, as a `<button>` can't hold another; the wrapper is a Tailwind `group`, so `group-hover:` shows the X and hides the arrows together.

## Picker conventions

Every picker that uses `SectionPicker`, and anything new built like one, follows these, so the pickers look and behave alike:

- **More about a section goes behind an (i).** The (i) is `InfoButton` (`components/info-button.tsx`), the last thing in the section's top row: beside `PickerPart`'s intro line (its `info` prop), or at the right of a section title such as **Cameras**. It never hides on phones. What it shows goes in `SectionPicker`'s `aside`, the panel to the right of the controls (under them on phones), never inside the controls or in a hover. Pass a wider `width` while the aside shows. The aside follows what's pointed at, and falls back to what's chosen, as the presets' settings and the cameras' details do.
- **Ways to arrange a list are small menus in the top row.** **Group by** and **Sort** are icon buttons that keep their name ("Group by", "Sort") and open a short menu of choices with the current one checked (`PickMenu` in `components/pick-menu.tsx`), left of the (i). A button is shaded while it isn't on its first choice, the default. They aren't tab rows or segmented controls, which take a row of their own.
- **Grouping is optional and starts off.** The first grouping is **None**, the list A to Z, and the others are Brand and Type. A list opens on None unless what's chosen is a group only another grouping lists.
- **Choice lists are text.** A row in a list of choices (`ChoiceRow`) has its check, name and count, and no icon or picture; pictures belong in the info pane. The exceptions are the Graph page's **Graph type** list, whose rows each have their type's icon (`ChoiceRow`'s `icon`), as the owner asked, and its **Presets**, whose choices are tiles with a small, faint drawing of each preset's graph and a caption: the drawing is the preset itself, not an icon. Headings in a list, such as **DSLR**, are plain small text, not choices.
- **A button that opens filters clears them with an X.** Build it with `FilterPickerButton` (or wrap it in `ClearableTrigger`) and pass the `onClear` that clears its filters; never add a separate Clear button beside it.
- **Defaults aren't news.** A section that's at its default says "Any" (or its default's name) in the list, and a button only stands out while it's changed.
