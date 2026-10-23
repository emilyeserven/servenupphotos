import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { META_FIELDS, type MetaFieldInfo, type MetaGroup, metaGroups } from "@/api/metainfo";
import { MetaGroupEditor } from "@/components/metadata-group-editor";
import { MetaMoveButtons } from "@/components/metadata-move-buttons";
import { GitHubGate } from "@/components/organize-page";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { shownPhotos } from "@/lib/place-seeds";
import { groupPhotoCount, groupTree } from "@/lib/meta-groups";
import { fieldValues, type MetaValueCount, showRange } from "@/lib/meta-values";
import { cn } from "@/lib/utils";
import type { CombinedPhoto } from "@/lib/group-photos";
import { useCombinedData } from "@/stores/combined-data";

/** The Metadata Groups page: named groups of camera, lens, focal length and other EXIF values. */
export function MetadataGroupsPage() {
  return (
    <Page
      wide
      title="Metadata Groups"
      description="Named groups of the photos' metadata values, such as the wide-angle focal lengths, or every way EXIF spells one lens. Each group is its own JSON file, combined into METAINFO.json. The portfolio doesn't use them yet."
    >
      <GitHubGate>{() => <MetaGroupTabs />}</GitHubGate>
    </Page>
  );
}

function MetaGroupTabs() {
  const combined = useCombinedData();
  if (combined.isPending) return <p>Reading the photos and metadata groups from GitHub…</p>;
  if (!combined.data) return <p className="text-destructive text-sm">{combined.error?.message}</p>;
  const photos = shownPhotos(combined.data);
  const groups = metaGroups(combined.data);
  return (
    <Tabs defaultValue="camera">
      <TabsList className="h-auto flex-wrap">
        {META_FIELDS.map(({ field, title }) => (
          <TabsTrigger key={field} value={field}>
            {title} ({groups.filter((group) => group.field === field).length})
          </TabsTrigger>
        ))}
      </TabsList>
      {META_FIELDS.map((info) => (
        <TabsContent key={info.field} value={info.field}>
          <FieldGroups info={info} photos={photos} groups={groups} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

interface FieldGroupsProps {
  info: MetaFieldInfo;
  photos: CombinedPhoto[];
  /** Every field's groups. */
  groups: MetaGroup[];
}

/** One field's groups listed on the left, and the chosen one, or a new one, edited on the right. */
function FieldGroups({ info, photos, groups }: FieldGroupsProps) {
  const [chosen, setChosen] = useState<string | null>(null);
  const own = groups.filter((group) => group.field === info.field);
  const values = fieldValues(photos, own, info.field);
  const group = own.find((g) => g.id === chosen);
  return (
    <div className="grid items-start gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <GroupList info={info} groups={own} values={values} chosen={group?.id} onChoose={setChosen} />
      <MetaGroupEditor
        key={group?.id ?? "new"}
        info={info}
        group={group}
        values={values}
        groups={own}
        onSaved={setChosen}
        onRemoved={() => setChosen(null)}
      />
    </div>
  );
}

interface GroupListProps {
  info: MetaFieldInfo;
  groups: MetaGroup[];
  values: MetaValueCount[];
  chosen?: string;
  /** Chooses a group by ID, or null for a new one. */
  onChoose: (id: string | null) => void;
}

function GroupList({ info, groups, values, chosen, onChoose }: GroupListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{info.title}</CardTitle>
        <CardDescription>
          {values.filter((v) => v.count > 0).length} {info.one} values in the photos.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        {groups.length === 0 && (
          <p className="text-muted-foreground text-sm">No {info.one} groups yet.</p>
        )}
        {groupTree(groups).map(({ group, depth }) => (
          <GroupRow
            key={group.id}
            info={info}
            group={group}
            groups={groups}
            depth={depth}
            subgroups={groups.filter((g) => g.parent === group.id).length}
            photos={groupPhotoCount(values, groups, group)}
            chosen={group.id === chosen}
            onChoose={() => onChoose(group.id)}
          />
        ))}
        <Button variant="outline" className="mt-2 self-start" onClick={() => onChoose(null)}>
          <PlusIcon aria-hidden />
          New group
        </Button>
      </CardContent>
    </Card>
  );
}

interface GroupRowProps {
  info: MetaFieldInfo;
  group: MetaGroup;
  /** The field's groups, to move the group among its siblings. */
  groups: MetaGroup[];
  /** How far it's nested, to indent it. */
  depth: number;
  /** How many groups are directly in it. */
  subgroups: number;
  photos: number;
  chosen: boolean;
  onChoose: () => void;
}

function plural(count: number, one: string): string {
  return `${count} ${one}${count === 1 ? "" : "s"}`;
}

/** How many values the group lists, or how many groups are in it when it lists none. */
function listed(group: MetaGroup, subgroups: number): string {
  const values = group.values.length;
  return values === 0 && subgroups > 0 ? plural(subgroups, "group") : plural(values, "value");
}

/** What the group covers: its range, such as "10–24 mm", or how many values or groups it has. */
function coverage(info: MetaFieldInfo, group: MetaGroup, subgroups: number): string {
  return group.range ? showRange(info.field, group.range) : listed(group, subgroups);
}

function GroupRow(props: GroupRowProps) {
  const { group, groups, depth, chosen } = props;
  return (
    <div style={{ paddingLeft: `${depth * 1.25}rem` }} className="flex items-center gap-1">
      <button
        type="button"
        onClick={props.onChoose}
        aria-current={chosen}
        className={cn(
          "hover:bg-muted flex min-w-0 flex-1 items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm",
          chosen && "bg-muted font-medium",
        )}
      >
        <GroupName name={group.name} nested={depth > 0} />
        <span className="text-muted-foreground shrink-0 text-xs">
          {coverage(props.info, group, props.subgroups)}, {plural(props.photos, "photo")}
        </span>
      </button>
      <MetaMoveButtons group={group} groups={groups} />
    </div>
  );
}

function GroupName({ name, nested }: { name: string; nested: boolean }) {
  return (
    <span className="min-w-0 truncate">
      {nested && (
        <span className="text-muted-foreground" aria-hidden>
          ↳{" "}
        </span>
      )}
      {name}
    </span>
  );
}
