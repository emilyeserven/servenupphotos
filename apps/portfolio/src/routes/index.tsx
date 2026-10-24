import { createFileRoute, Link } from "@tanstack/react-router";
import { FROSTED } from "@/components/backdrop-caption";
import { PhotoBackdrop } from "@/components/photo-backdrop";
import { homepagePhotos } from "@/lib/homepage-photos";
import { enabledViews } from "@/lib/portfolio-views";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: Homepage,
});

// Worked out once: the photos only change with a new build.
const backdropPhotos = homepagePhotos();
const phoneBackdropPhotos = homepagePhotos(undefined, true);

/** A phone held upright, which shows portrait photos first. */
const PHONE_QUERY = "(max-width: 767px) and (orientation: portrait)";

/** The portfolio's front door: each way to explore the photos, over photos fading in and out. */
function Homepage() {
  const phone = useMediaQuery(PHONE_QUERY);
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center px-4 py-20 text-white">
      <PhotoBackdrop photos={phone ? phoneBackdropPhotos : backdropPhotos} />
      <div className="relative z-10 w-full max-w-5xl text-center">
        <h1
          className={cn(
            FROSTED,
            "inline-block rounded-xl px-5 py-3 text-4xl font-semibold tracking-tight text-balance sm:px-8 sm:py-4 sm:text-6xl",
          )}
        >
          Serven Up Photos
        </h1>
        <nav aria-label="Ways to explore" className="mt-8">
          <ul className="flex flex-wrap justify-center gap-2 sm:gap-3">
            {enabledViews.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <Link
                  to={to}
                  className={cn(
                    FROSTED,
                    "flex w-20 flex-col items-center gap-1.5 rounded-lg px-2 py-3 transition-colors outline-none hover:border-white/40 hover:bg-white/20 focus-visible:ring-[3px] focus-visible:ring-white/60 sm:w-28",
                  )}
                >
                  <Icon className="size-6" aria-hidden />
                  <span className="text-sm font-medium">{label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
