# Portfolio Back to top button

Every portfolio page except the Map (`/map`) and Color (`/color`) has a round **Back to top** button (an up arrow) at
the bottom left of the screen. It stays hidden until the visitor has scrolled about 400 pixels down, then fades in.
Clicking it scrolls smoothly back to the top of the page. The Map and Color pages fill the screen and don't scroll, and
the Color page's minimap already sits at the bottom left, so they leave it out.

The button lives in `apps/portfolio/src/components/back-to-top-button.tsx` and is placed once in `routes/__root.tsx`,
so a new page gets it without doing anything. To leave it off another page, add the page's path to `PAGES_WITHOUT`.

> **Frontend analogy:** the scroll position is read with `useSyncExternalStore`, the same way the portfolio's
> `useMediaQuery` reads the screen size, so the button re-renders only when "scrolled far enough" flips.
