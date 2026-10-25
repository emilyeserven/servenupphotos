# Theme

The pipeline (`apps/client-pipeline`) uses shadcn/ui's **Mira** style, and can show light or dark colors. The
portfolio has its own look and isn't affected.

## Mira style

Mira is one of the component styles shadcn/ui added with `shadcn create`, described as "compact, made for dense
interfaces": smaller controls (buttons and inputs are 28px tall), tighter spacing, small corner radii, and
ring-based outlines on popovers instead of borders and shadows. It fits a control panel full of tables and forms.
([shadcn create changelog](https://ui.shadcn.com/docs/changelog/2025-12-shadcn-create),
[style source](https://github.com/shadcn-ui/ui/blob/main/apps/v4/registry/styles/style-mira.css))

- `components.json` names the style `radix-mira` (Radix primitives, Mira style), so `shadcn add` gives new
  components the same look. Icons stay Lucide and the font stays Manrope, rather than the preset's Hugeicons and
  Inter.
- The files in `components/ui` are shadcn's Radix components with Mira's classes. `combobox.tsx` and
  `single-combobox.tsx` are the pipeline's own, sized to match Mira's inputs and lists.
- `styles.css` imports `shadcn/tailwind.css`, which adds the `data-open:`, `data-closed:` and similar variants the
  Mira components use, plus the `scroll-fade-*` utilities.
- Corners are tighter than shadcn's default: `--radius` in `styles.css` is `0.25rem` (4px) instead of `0.625rem`, and
  every `rounded-sm` to `rounded-xl` is worked out from it.
- Text sizes are smaller than Tailwind's because Manrope runs large, but `text-xs` (12px) and `text-sm` (13px) stay
  readable, since Mira sets every button and input in `text-xs`.
- Tooltips share one `TooltipProvider` around the whole app (`routes/__root.tsx`).

> **Frontend analogy:** a shadcn style isn't a theme file you swap; it's a different set of Tailwind classes baked
> into each component's source, like two design systems that share the same component API.

## Light and dark

**Theme** at the bottom of the sidebar, above **Collapse sidebar**, switches the colors one click at a time:
**System** → **Light** → **Dark** → **System**. System follows the computer's setting and changes with it. Collapsed,
it's an icon whose tooltip names the current and next mode.

The choice is kept in the browser's `localStorage` under `pipeline-theme` (`stores/theme.ts`). Dark mode is the
`dark` class on `<html>`, which the colors in `styles.css` and every `dark:` class key off. A small script in
`index.html` reads the same key and sets the class before the app loads, so a dark page doesn't flash light on
reload.

> **Frontend analogy:** it's the same Zustand `persist` store as the sidebar's, plus a `matchMedia` listener for
> `prefers-color-scheme` while in System mode.
