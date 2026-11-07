import { ImageIcon } from "lucide-react";
import type { GearKind } from "@portfolio/lib/gear-pictures";
import type { GearRow } from "@/api/gear";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** The two lists, with their tab names. */
const KINDS: [GearKind, string][] = [
  ["camera", "Cameras"],
  ["lens", "Lenses"],
];

function plural(count: number, one: string): string {
  return `${count} ${one}${count === 1 ? "" : "s"}`;
}

interface GearListProps {
  kind: GearKind;
  onKind: (kind: GearKind) => void;
  rows: GearRow[];
  chosen?: string;
  onChoose: (name: string) => void;
}

/**
 * Tabs for the cameras and the lenses, and every one the photos name, as the photo files name it,
 * with how many photos have it and a mark when it has a picture.
 */
export function GearList({ kind, onKind, rows, chosen, onChoose }: GearListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gear</CardTitle>
        <CardDescription>As the photo files name them, after the camera overrides.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <KindTabs kind={kind} onKind={onKind} />
        {rows.map((row) => (
          <button
            key={row.name}
            type="button"
            onClick={() => onChoose(row.name)}
            aria-current={row.name === chosen}
            className={cn(
              "hover:bg-muted flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm",
              row.name === chosen && "bg-muted font-medium",
            )}
          >
            <span className="min-w-0 truncate">{row.name}</span>
            <RowNote row={row} />
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

/** How many photos have it, and a picture mark when it has a picture. */
function RowNote({ row }: { row: GearRow }) {
  return (
    <span className="text-muted-foreground flex shrink-0 items-center gap-1.5 text-xs">
      {row.file?.image && (
        <ImageIcon aria-label="Has a picture" className="text-foreground size-3.5" />
      )}
      {plural(row.photos, "photo")}
    </span>
  );
}

function KindTabs({ kind, onKind }: { kind: GearKind; onKind: (kind: GearKind) => void }) {
  return (
    <div role="tablist" aria-label="Gear" className="bg-muted mb-2 flex gap-1 rounded-md p-0.5">
      {KINDS.map(([value, label]) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={kind === value}
          onClick={() => onKind(value)}
          className={cn(
            "text-muted-foreground flex-1 rounded-sm px-2 py-1 text-sm font-medium",
            kind === value && "bg-background text-foreground shadow-xs",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
