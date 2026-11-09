# Page fade

Switching pages, on the portfolio or in the pipeline, fades the old page out and the new one in: about 120ms out, then
180ms in. It only runs when the path changes, so changing a filter, a sort or anything else kept in the URL's search
or hash swaps at once, and so does the first page drawn when the site opens.

- **Portfolio:** the whole screen fades, except the site menu at the top right, which stays where it is.
- **Pipeline:** only the page area fades; the sidebar and breadcrumbs stay put and update straight away.

A viewer whose system asks for reduced motion (`prefers-reduced-motion: reduce`) sees the new page at once, and so
does a browser without view transitions or their types.

## How it works

Both routers set `defaultViewTransition: pageFade` (`apps/portfolio/src/lib/page-fade.ts`), so TanStack Router runs
each page switch inside the browser's
[View Transitions API](https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API) with the type `page`,
and skips it for anything else. `apps/portfolio/src/page-fade.css`, imported by both apps' `styles.css`, turns every
view transition's animation off by default and fades `root` (the portfolio's whole screen) and `page` (the
pipeline's page area) for the `page` type. The portfolio's menu has its own `view-transition-name`, so it isn't part
of the fading screen; the pipeline sets `view-transition-name: none` on `:root` and names its page area `page`.

The pipeline imports the same `page-fade.ts` and `page-fade.css` from the portfolio, so the timing is the same in both.

Page errors (`docs/portfolio-page-errors.md`) still wait before showing: an error that clears itself during the switch
simply fades in as the new page.

> **Frontend analogy:** the browser takes a screenshot of the old page, swaps in the new DOM behind it, then
> animates the screenshot out and the live page in, like a CSS `opacity` transition on two stacked layers that you
> don't have to keep mounted yourself.
