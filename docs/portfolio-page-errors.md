# Portfolio page errors

When a portfolio page fails to draw, it shows the site's own card instead of TanStack Router's bare **Something went
wrong!** line. The card says **This page didn't load**, gives the error's message, and has **Try again** (which reloads
the page's data and draws it again) and the site's name linking home.

The card doesn't show straight away. An error first waits 400ms and then quietly draws the page once more. Most errors
seen while switching pages only last while one page hands over to the next (for example, the page being left
re-drawing for a moment after its route has gone), so the retry draws the new page and nothing flashes up. If the
page fails again, or another error came within the last 5 seconds, the card shows. Each error is also written to the
browser console as `Page error:`, so the message can be found later even if it didn't stay on screen.

It lives in `apps/portfolio/src/components/page-error.tsx` and is set once as the router's `defaultErrorComponent` in
`src/main.tsx`, so every page, and the root layout, uses it. A page that needs its own error screen can still set
`errorComponent` on its route.

> **Frontend analogy:** it's a React error boundary fallback with a short "debounce": like delaying a loading spinner
> so fast requests never show one, the fallback waits a moment before it renders anything.
