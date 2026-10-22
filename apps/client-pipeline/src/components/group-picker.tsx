import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";
import {
  type Group,
  type GroupKind,
  type OrganizeResponse,
  type PhotoGroups,
  albumAncestry,
  groupLabel,
  organizeQuery,
} from "@/api/organize";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";

/** Where an album sits, such as “In Asia › Korea”, or undefined for a top-level one. */
function albumPlace(albums: Group[], album: Group): string | undefined {
  const parents = albumAncestry(albums, album.id).slice(0, -1);
  return parents.length > 0 ? `In ${parents.map(groupLabel).join(" › ")}` : undefined;
}

/** groups as options to choose from, leaving out ones that couldn't be read or are in `exclude`. */
function groupOptions(
  kind: GroupKind,
  groups: Group[],
  exclude: ReadonlySet<string> = new Set(),
): ComboboxOption[] {
  return groups
    .filter((group) => !group.error && !exclude.has(group.id))
    .map((group) => ({
      value: group.id,
      label: groupLabel(group),
      detail: kind === "albums" ? albumPlace(groups, group) : undefined,
    }));
}

interface GroupComboboxProps {
  id: string;
  kind: GroupKind;
  value: string[];
  onChange: (value: string[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  /** Albums or tags that can't be chosen, such as an album's own sub-albums for its parent. */
  exclude?: ReadonlySet<string>;
  placeholder?: string;
  "aria-describedby"?: string;
}

/** A combobox of every album or tag on GitHub, read once with the Organize pages' query. */
export function GroupCombobox({
  kind,
  exclude,
  disabled,
  placeholder,
  multiple = true,
  ...props
}: GroupComboboxProps) {
  const organize = useQuery(organizeQuery);
  return (
    <Combobox
      {...props}
      multiple={multiple}
      options={organize.data ? groupOptions(kind, organize.data[kind], exclude) : []}
      disabled={disabled || !organize.data}
      placeholder={groupPlaceholder(kind, organize.isPending, multiple, placeholder)}
      emptyText={emptyText(organize.data, kind)}
      unknownLabel={(id) => `${id}, which isn't ${ONE[kind]} on GitHub`}
    />
  );
}

/** One album or tag, as a placeholder or message says it. */
const ONE: Record<GroupKind, string> = { albums: "an album", tags: "a tag" };

function groupPlaceholder(
  kind: GroupKind,
  pending: boolean,
  multiple: boolean,
  placeholder?: string,
): string {
  if (pending) return `Reading ${kind} from GitHub…`;
  if (placeholder) return placeholder;
  return `Choose ${multiple ? kind : ONE[kind]}`;
}

function emptyText(data: OrganizeResponse | undefined, kind: GroupKind): string {
  return data?.[kind].length === 0 ? `There are no ${kind} yet.` : "Nothing matches.";
}

interface PhotoGroupFieldsProps {
  /** Keeps the fields' ids apart when a page shows more than one set. */
  idPrefix: string;
  value: PhotoGroups;
  onChange: (value: PhotoGroups) => void;
  disabled?: boolean;
  /** An extra warning about albums, such as photos already being in one. */
  albumWarning?: ReactNode;
}

/** The album and tag comboboxes, warning when a photo would be in more than one album. */
export function PhotoGroupFields({
  idPrefix,
  value,
  onChange,
  disabled,
  albumWarning,
}: PhotoGroupFieldsProps) {
  const organize = useQuery(organizeQuery);
  const albumsId = `${idPrefix}-albums`;
  const tagsId = `${idPrefix}-tags`;
  return (
    <div className="flex flex-col gap-4">
      {organize.isError && <p className="text-destructive text-sm">{organize.error.message}</p>}
      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor={albumsId} kind="albums" />
        <GroupCombobox
          id={albumsId}
          kind="albums"
          value={value.albums}
          disabled={disabled}
          aria-describedby={`${albumsId}-hint`}
          onChange={(albums) => onChange({ ...value, albums })}
        />
        <AlbumHint id={`${albumsId}-hint`} count={value.albums.length} warning={albumWarning} />
      </div>
      <div className="flex flex-col gap-2">
        <FieldLabel htmlFor={tagsId} kind="tags" />
        <GroupCombobox
          id={tagsId}
          kind="tags"
          value={value.tags}
          disabled={disabled}
          onChange={(tags) => onChange({ ...value, tags })}
        />
      </div>
    </div>
  );
}

/** How many albums to choose, or warnings when a photo would be in more than one. */
function AlbumHint({ id, count, warning }: { id: string; count: number; warning?: ReactNode }) {
  return (
    <div id={id} className="flex flex-col gap-1 text-sm">
      {count > 1 && (
        <Warning>
          Photos are best kept in one album. To group albums together, give them a parent album
          instead.
        </Warning>
      )}
      {warning}
      {count <= 1 && !warning && (
        <p className="text-muted-foreground">Usually one: the most specific album that fits.</p>
      )}
    </div>
  );
}

function FieldLabel({ htmlFor, kind }: { htmlFor: string; kind: GroupKind }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {kind === "albums" ? "Albums" : "Tags"}
      </label>
      <Link
        to={kind === "albums" ? "/albums" : "/tags"}
        className="text-muted-foreground text-xs underline-offset-4 hover:underline"
      >
        Manage {kind}
      </Link>
    </div>
  );
}

/** An amber line with a warning icon, for a choice that's allowed but discouraged. */
export function Warning({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
      <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

interface PhotoGroupsCardProps {
  value: PhotoGroups;
  onChange: (value: PhotoGroups) => void;
  /** What happens to the albums and tags when they're saved. */
  description: string;
  disabled: boolean;
}

/** The photo's albums and tags, saved as the IDs in its JSON's "albums" and "tags". */
export function PhotoGroupsCard({ value, onChange, description, disabled }: PhotoGroupsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Albums and tags</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <PhotoGroupFields idPrefix="photo" value={value} onChange={onChange} disabled={disabled} />
      </CardContent>
    </Card>
  );
}
