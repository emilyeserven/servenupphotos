import type { AnyRouter, ParsedLocation } from "@tanstack/react-router";

/** What Umami sends with a page view or event. */
type UmamiPayload = Record<string, unknown>;

/** The part of Umami's tracker the portfolio calls, once its script has loaded. */
interface Umami {
  /** Sends a page view with the payload the function returns from Umami's own. */
  track(payload: (props: UmamiPayload) => UmamiPayload): void;
  /** Sends a custom event with its properties, which Umami shows under Events. */
  track(event: string, data: Record<string, string>): void;
}

declare global {
  interface Window {
    /** Umami's tracker, set by its script in index.html. */
    umami?: Umami;
  }
}

/** The name of the custom event sent when a page's query changes. */
const QUERY_EVENT = "query";
/** How long the query has to stay the same before its event is sent, so a drag sends one. */
const QUERY_SETTLE_MS = 2000;

/** The page last counted, so a change to only the URL's query doesn't count again. */
let lastPath: string | undefined;
/** Sends that wait for Umami's script to finish loading. */
let waiting: ((umami: Umami) => void)[] = [];
/** The timer for the query event waiting for the query to settle. */
let settling: ReturnType<typeof setTimeout> | undefined;
/** The location whose query event is waiting to be sent. */
let unsentQuery: ParsedLocation | undefined;

/** Runs the send now, or once Umami's script has loaded. */
function withUmami(sendTo: (umami: Umami) => void) {
  if (window.umami) sendTo(window.umami);
  else waiting.push(sendTo);
}

/** Runs the sends that came before Umami's script finished loading. */
function sendWaiting() {
  for (const sendTo of waiting) withUmami(sendTo);
  waiting = [];
}

/** The query as event properties: each value as text, plus the page it's on. */
function queryProperties(location: ParsedLocation): Record<string, string> {
  const entries = Object.entries(location.search as Record<string, unknown>).map(([key, value]) => [
    key,
    typeof value === "string" ? value : JSON.stringify(value),
  ]);
  return { page: location.pathname, ...Object.fromEntries(entries) };
}

/** Sends the waiting query event now, if there is one. */
function flushQuery() {
  clearTimeout(settling);
  const location = unsentQuery;
  unsentQuery = undefined;
  if (location) withUmami((umami) => umami.track(QUERY_EVENT, queryProperties(location)));
}

/** Sends the page view, with its query, for a page the visitor just moved to. */
function sendPageView(location: ParsedLocation) {
  flushQuery();
  withUmami((umami) => umami.track((props) => ({ ...props, url: location.href })));
}

/** Sends a `query` event once the query on the same page has stopped changing. */
function sendQuery(location: ParsedLocation) {
  clearTimeout(settling);
  unsentQuery = location;
  settling = setTimeout(flushQuery, QUERY_SETTLE_MS);
}

/**
 * Counts one Umami page view each time the app moves to a different page (path), such as from
 * `/grid` to `/map`, with the query it opened with. A change to the query alone (filters, sorting,
 * the photo open in the lightbox, the map's position) isn't a page view: it's sent as a `query`
 * event with each query value as a property, once the query has stayed the same for two seconds
 * (or right away when the visitor moves to another page).
 */
export function trackPageViews(router: AnyRouter) {
  document.getElementById("umami")?.addEventListener("load", sendWaiting);
  router.subscribe("onResolved", ({ toLocation }) => {
    if (toLocation.pathname === lastPath) return sendQuery(toLocation);
    lastPath = toLocation.pathname;
    sendPageView(toLocation);
  });
}
