import { getRouteApi } from "@tanstack/react-router";
import { useState } from "react";
import { applyAlbumSuggestionsMutation } from "@/api/album-suggestions";
import { type OrganizeResponse, savedGroups } from "@/api/organize";
import type { ViewerLikes } from "@/api/viewer-likes";
import { PickedThumbnail } from "@/components/bulk-tagging/picked-photos";
import { SaveReviewed, useReviewedSave } from "@/components/bulk-tagging/review-parts";
import { HideOnPortfolioCheckbox } from "@/components/hide-on-portfolio-checkbox";
import { Segmented } from "@/components/lightroom-albums/segmented";
import type { SavedPhoto } from "@/components/saved-photo-picker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toggled } from "@/lib/bulk-tags";
import {
  type GroupBy,
  type PhotoFacts,
  type SuggestedGroup,
  albumFor,
  groupByLocation,
  groupByTheme,
  idAsName,
  oneAlbum,
  sharedAlbumsToSave,
} from "@/lib/shared-likes";
import { textOf } from "@portfolio/lib/values";
import { count } from "@portfolio/lib/words";

const route = getRouteApi("/shared-likes");

const GROUPINGS: { value: GroupBy; label: string }[] = [
  { value: "one", label: "One album" },
  { value: "location", label: "By location" },
  { value: "theme", label: "By theme" },
];

/** What each grouping does, under the card's title. */
const GROUPING_NOTES: Record<GroupBy, string> = {
  one: "Every chosen photo goes in one album.",
  location: "Grouped by city when two or more photos share one, else by country.",
  theme: "Grouped by the tag the most photos share, again and again, then by genre.",
};

/** The chosen photos as suggested albums, grouped the chosen way. */
function groupsFor(by: GroupBy, facts: PhotoFacts[], organize: OrganizeResponse) {
  if (by === "theme") return groupByTheme(facts, namer(organize));
  if (by === "location") return groupByLocation(facts);
  return oneAlbum(facts.map((fact) => fact.id));
}

interface SuggestedAlbumsProps {
  /** The IDs of the chosen overlapping Likes. */
  photos: number[];
  lists: ViewerLikes[];
  saved: ReadonlyMap<number, SavedPhoto>;
  organize: OrganizeResponse;
}

/**
 * The chosen photos as suggested albums: all in one album (the default), or split by location
 * (city, else country) or by theme (shared tag, else genre). Each can be renamed, unticked or have
 * photos unticked, then saved as new or existing albums, waiting for Commit.
 */
export function SuggestedAlbums({ photos, lists, saved, organize }: SuggestedAlbumsProps) {
  const navigate = route.useNavigate();
  const by: GroupBy = route.useSearch().by ?? "one";
  const facts = photos.map((id) => photoFacts(id, saved.get(id)));
  const groups = groupsFor(by, facts, organize);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Suggested albums</CardTitle>
        <CardDescription>
          {GROUPING_NOTES[by]} Rename an album to change it; a name that matches an existing album
          adds the photos to that one.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <div className="self-start">
          <Segmented
            label="Group the photos"
            options={GROUPINGS}
            value={by}
            onChange={(value) =>
              void navigate({
                search: (s) => ({ ...s, by: value === "one" ? undefined : value }),
                replace: true,
              })
            }
          />
        </div>
        <GroupReview
          key={`${by}|${photos.join(",")}`}
          groups={groups}
          lists={lists}
          saved={saved}
          organize={organize}
        />
      </CardContent>
    </Card>
  );
}

/** What grouping reads from a saved photo: its city and country, custom ones first, tags and genres. */
function photoFacts(id: number, photo: SavedPhoto | undefined): PhotoFacts {
  const data = (photo?.file.data ?? {}) as Record<string, unknown>;
  const { tags, genres } = savedGroups(data);
  return {
    id,
    city: textOf(data.customCity) || textOf(data.city),
    country: textOf(data.customCountry) || textOf(data.country),
    tags,
    genres,
  };
}

/** A tag's or genre's name for a suggested album, from its saved name or else its ID. */
function namer(organize: OrganizeResponse) {
  return (source: "tag" | "genre", id: string) => {
    const list = source === "tag" ? organize.tags : organize.genres;
    const name = list.find((group) => group.id === id)?.name ?? id;
    return idAsName(name);
  };
}

/** "Liked by Jane, Sam and Kim.", for a new album's description. */
function likedBy(lists: ViewerLikes[]): string {
  const names = new Intl.ListFormat("en", { type: "conjunction" }).format(lists.map((l) => l.name));
  return `Liked by ${names}.`;
}

interface GroupReviewProps {
  groups: SuggestedGroup[];
  lists: ViewerLikes[];
  saved: ReadonlyMap<number, SavedPhoto>;
  organize: OrganizeResponse;
}

/** The suggested albums to tick, rename and trim, and the button that saves them. */
function GroupReview({ groups, lists, saved, organize }: GroupReviewProps) {
  const [names, setNames] = useState<Record<string, string>>({});
  // When split, a group of one photo starts unticked: it's rarely an album on its own.
  const [dropped, setDropped] = useState<ReadonlySet<string>>(
    () => new Set(groups.filter(startsUnticked).map((g) => g.key)),
  );
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  // Albums of other people's likes are usually working albums, not ones for the website.
  const [hidden, setHidden] = useState(true);
  const apply = useReviewedSave(applyAlbumSuggestionsMutation);
  const busy = apply.isPending || apply.isSuccess;
  const nameOf = (group: SuggestedGroup) => names[group.key] ?? group.name;
  const reviewed = groups
    .filter((group) => !dropped.has(group.key))
    .map((group) => ({
      name: nameOf(group),
      photos: group.photos.filter((id) => !removed.has(`${group.key}|${id}`)),
    }));
  const paths = new Map([...saved].map(([id, photo]) => [id, photo.path]));
  const save = sharedAlbumsToSave(reviewed, paths, organize.albums, {
    description: likedBy(lists),
    hidden,
  });
  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col gap-3">
        {groups.map((group) => (
          <GroupRow
            key={group.key}
            group={group}
            name={nameOf(group)}
            used={!dropped.has(group.key)}
            removed={removed}
            saved={saved}
            organize={organize}
            disabled={busy}
            onRename={(name) => setNames({ ...names, [group.key]: name })}
            onToggle={() => setDropped(toggled(dropped, group.key))}
            onTogglePhoto={(id) => setRemoved(toggled(removed, `${group.key}|${id}`))}
          />
        ))}
      </ul>
      <HideOnPortfolioCheckbox
        what="the new albums"
        checked={hidden}
        disabled={busy}
        onChange={setHidden}
      />
      <SaveReviewed
        noun="albums"
        apply={apply}
        save={save}
        busy={busy}
        done={(result) =>
          `Made ${count(result.newAlbums, "new album")} and put ${count(result.photos, "photo")} in albums`
        }
      />
    </div>
  );
}

/** Whether a suggested album starts unticked: a split-off group of one photo, or the left-over photos. */
function startsUnticked(group: SuggestedGroup): boolean {
  if (group.source === "all") return false;
  return group.photos.length < 2 || group.source === "none";
}

interface GroupRowProps {
  group: SuggestedGroup;
  name: string;
  used: boolean;
  removed: ReadonlySet<string>;
  saved: ReadonlyMap<number, SavedPhoto>;
  organize: OrganizeResponse;
  disabled: boolean;
  onRename: (name: string) => void;
  onToggle: () => void;
  onTogglePhoto: (id: number) => void;
}

/** One suggested album: its checkbox, its name to edit, whether it's new, and its photos. */
function GroupRow(props: GroupRowProps) {
  const { group, name, used, removed, saved, disabled } = props;
  return (
    <li className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="checkbox"
          aria-label={`Use ${name}`}
          checked={used}
          disabled={disabled}
          onChange={props.onToggle}
        />
        <Input
          aria-label="Album name"
          className="h-8 w-56"
          value={name}
          disabled={disabled || !used}
          onChange={(e) => props.onRename(e.target.value)}
        />
        <AlbumStatus name={name} organize={props.organize} />
        <span className="text-muted-foreground text-xs">{count(group.photos.length, "photo")}</span>
      </div>
      <ul className="ml-6 flex flex-wrap gap-3">
        {group.photos.map((id) => (
          <GroupPhoto
            key={id}
            id={id}
            photo={saved.get(id)}
            ticked={!removed.has(`${group.key}|${id}`)}
            disabled={disabled || !used}
            onToggle={() => props.onTogglePhoto(id)}
          />
        ))}
      </ul>
    </li>
  );
}

interface GroupPhotoProps {
  id: number;
  photo: SavedPhoto | undefined;
  ticked: boolean;
  disabled: boolean;
  onToggle: () => void;
}

/** One photo in a suggested album, with the checkbox that keeps it in. */
function GroupPhoto({ id, photo, ticked, disabled, onToggle }: GroupPhotoProps) {
  const name = photo?.name ?? `#${id}`;
  return (
    <li>
      <label className="flex w-20 flex-col gap-1 text-xs">
        <PickedThumbnail
          data={(photo?.file.data ?? {}) as Record<string, unknown>}
          alt={name}
          className="w-full"
        />
        <span className="flex items-center gap-1">
          <input type="checkbox" checked={ticked} disabled={disabled} onChange={onToggle} />
          <span className="truncate" title={name}>
            {name}
          </span>
        </span>
      </label>
    </li>
  );
}

/** Whether the name is a new album (with the ID it gets) or one already made. */
function AlbumStatus({ name, organize }: { name: string; organize: OrganizeResponse }) {
  const { id, existing } = albumFor(name, organize.albums);
  if (!id)
    return (
      <span className="text-muted-foreground text-xs">(needs a name from a to z or 0 to 9)</span>
    );
  return (
    <span className="text-muted-foreground text-xs">
      {existing ? `(existing: ${id})` : `(new: ${id})`}
    </span>
  );
}
