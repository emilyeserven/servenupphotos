import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { META_FIELDS, type MetaFieldInfo, type MetaGroup, metaGroups } from "@/api/metainfo";
import { MetaGroupEditor } from "@/components/metadata-group-editor";
import { GitHubGate } from "@/components/organize-page";
import { Page } from "@/components/page";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { shownPhotos } from "@/lib/place-seeds";
import { fieldValues, groupPhotoCount, type MetaValueCount } from "@/lib/meta-values";
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
        {groups.map((group) => (
          <GroupRow
            key={group.id}
            group={group}
            photos={groupPhotoCount(values, group)}
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
  group: MetaGroup;
  photos: number;
  chosen: boolean;
  onChoose: () => void;
}

function GroupRow({ group, photos, chosen, onChoose }: GroupRowProps) {
  const count = group.values.length;
  return (
    <button
      type="button"
      onClick={onChoose}
      aria-current={chosen}
      className={cn(
        "hover:bg-muted flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm",
        chosen && "bg-muted font-medium",
      )}
    >
      <span className="min-w-0 truncate">{group.name}</span>
      <span className="text-muted-foreground shrink-0 text-xs">
        {count} {count === 1 ? "value" : "values"}, {photos} {photos === 1 ? "photo" : "photos"}
      </span>
    </button>
  );
}
