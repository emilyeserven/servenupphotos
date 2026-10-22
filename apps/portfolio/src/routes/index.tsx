import { createFileRoute, Link } from "@tanstack/react-router";
import { PhotoBackdrop } from "@/components/photo-backdrop";
import { homepagePhotos } from "@/lib/homepage-photos";
import { enabledViews } from "@/lib/portfolio-views";

export const Route = createFileRoute("/")({
  component: Homepage,
});

// Worked out once: the photos only change with a new build.
const backdropPhotos = homepagePhotos();

/** The portfolio's front door: each way to explore the photos, over photos fading in and out. */
function Homepage() {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center px-4 py-20 text-white">
      <PhotoBackdrop photos={backdropPhotos} />
      <div className="relative z-10 w-full max-w-5xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
          Serven Up Photos
        </h1>
        <p className="mt-3 text-lg text-white/80">Choose a way to explore the photos.</p>
        <nav aria-label="Ways to explore" className="mt-8">
          <ul className="flex flex-wrap justify-center gap-2 sm:gap-3">
            {enabledViews.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <Link
                  to={to}
                  className="flex w-20 flex-col items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-2 py-3 shadow-lg backdrop-blur-sm transition-colors outline-none hover:border-white/40 hover:bg-white/20 focus-visible:ring-[3px] focus-visible:ring-white/60 sm:w-28"
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
