import { Link, getRouteApi } from "@tanstack/react-router";
import type { ViewerLikes } from "@/api/viewer-likes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { clampAtLeast } from "@/lib/shared-likes";
import { count } from "@portfolio/lib/words";

const route = getRouteApi("/shared-likes");

interface ListsCardProps {
  /** Every Like list on User Likes. */
  viewers: ViewerLikes[];
  /** The lists still ticked. */
  chosen: ViewerLikes[];
  /** How many photos are in enough of the chosen lists. */
  shared: number;
}

/**
 * The Like lists to compare, each with a checkbox, and how many of them a photo has to be in: every
 * one by default, or fewer for "liked in most lists". Both are kept in the page's URL.
 */
export function ListsCard({ viewers, chosen, shared }: ListsCardProps) {
  const navigate = route.useNavigate();
  const search = route.useSearch();
  const skip = new Set(search.skip ?? []);
  const atLeast = clampAtLeast(search.atLeast, chosen.length);
  const toggle = (id: string) => {
    const next = skip.has(id) ? [...skip].filter((s) => s !== id) : [...skip, id];
    void navigate({
      search: (s) => ({ ...s, skip: next.length > 0 ? next : undefined }),
      replace: true,
    });
  };
  const setAtLeast = (n: number) =>
    void navigate({
      search: (s) => ({ ...s, atLeast: n >= chosen.length ? undefined : n }),
      replace: true,
    });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Like lists</CardTitle>
        <CardDescription>
          Each person&apos;s list from{" "}
          <Link to="/viewer-likes" className="text-foreground underline underline-offset-4">
            User Likes
          </Link>
          . Untick a list to leave it out, or let a photo count when most lists have it.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <ul className="flex flex-wrap gap-x-5 gap-y-2">
          {viewers.map((viewer) => (
            <li key={viewer.id}>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={!skip.has(viewer.id)}
                  onChange={() => toggle(viewer.id)}
                />
                {viewer.name}
                <span className="text-muted-foreground text-xs">
                  {count(viewer.photos.length, "photo")}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <AtLeastPicker lists={chosen.length} atLeast={atLeast} onChange={setAtLeast} />
        <p className="text-muted-foreground">
          {count(shared, "photo")} {shared === 1 ? "is" : "are"} in{" "}
          {atLeast === chosen.length ? "every chosen list" : `at least ${atLeast} of them`}.
        </p>
      </CardContent>
    </Card>
  );
}

interface AtLeastPickerProps {
  lists: number;
  atLeast: number;
  onChange: (atLeast: number) => void;
}

/** "Liked in [every list / at least N] of the M lists". */
function AtLeastPicker({ lists, atLeast, onChange }: AtLeastPickerProps) {
  if (lists < 2) return null;
  const options = Array.from({ length: lists }, (_, i) => lists - i);
  return (
    <label className="flex flex-wrap items-center gap-1.5">
      Liked in
      <select
        className="bg-background rounded-md border px-2 py-1"
        value={atLeast}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {options.map((n) => (
          <option key={n} value={n}>
            {n === lists ? `all ${lists}` : `at least ${n}`}
          </option>
        ))}
      </select>
      of the {lists} chosen lists
    </label>
  );
}
