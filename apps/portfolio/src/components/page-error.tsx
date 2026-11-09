import { type ErrorComponentProps, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHomeLink } from "@/components/site-home-link";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * How long a page error waits before it shows, in milliseconds. An error thrown while one page
 * hands over to the next clears itself within a frame or two, so it never shows.
 */
const SHOW_AFTER_MS = 400;

/** How long after one quiet retry the next error waits before retrying on its own again. */
const RETRY_EVERY_MS = 5000;

/** When the last quiet retry happened, so an error that keeps coming back shows instead of looping. */
let lastRetry = 0;

/**
 * What a portfolio page shows when it fails to draw, in place of the router's bare "Something
 * went wrong!". It waits a moment first and retries the page once on its own, so an error that
 * only lasts while one page hands over to the next never flashes up. An error that stays shows
 * the site's card with what went wrong, **Try again** and a link home.
 */
export function PageError({ error, reset }: ErrorComponentProps) {
  const shown = useShownAfterRetry(reset);
  useEffect(() => console.error("Page error:", error), [error]);
  return shown ? <PageErrorCard error={error} reset={reset} /> : null;
}

/** Whether the error has lasted long enough to show; before that, it retries the page once. */
function useShownAfterRetry(reset: () => void): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (Date.now() - lastRetry < RETRY_EVERY_MS) return setShown(true);
      lastRetry = Date.now();
      reset();
    }, SHOW_AFTER_MS);
    return () => clearTimeout(timer);
  }, [reset]);
  return shown;
}

/** The error's message, in words a visitor can pass on. */
function messageOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "Something went wrong.";
}

/** The card itself: what went wrong, **Try again**, which reloads the page's data, and home. */
function PageErrorCard({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const tryAgain = () => {
    void router.invalidate();
    reset();
  };
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center gap-3">
          <SiteHomeLink className="mx-auto" />
          <CardTitle className="text-2xl tracking-tight">This page didn't load</CardTitle>
          <CardDescription>{messageOf(error)}</CardDescription>
          <Button className="mx-auto mt-2" onClick={tryAgain}>
            Try again
          </Button>
        </CardHeader>
      </Card>
    </div>
  );
}
