import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  BracesIcon,
  CameraIcon,
  FileTextIcon,
  ImageIcon,
  type LucideIcon,
  Share2Icon,
  TagsIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import type { EditedFields } from "@/components/edit-in-flight/photo-json";
import type { Edit } from "@/components/edit-in-flight/use-edit";
import { cn } from "@/lib/utils";

/** The Photo page's sections, in the order the subnavigation lists them. */
const PHOTO_SECTIONS = ["details", "groups", "image", "camera", "sharing", "json"] as const;

/** One of the Photo page's sections, kept in the URL as `?section=`. */
export type PhotoSection = (typeof PHOTO_SECTIONS)[number];

interface SectionInfo {
  label: string;
  icon: LucideIcon;
  /** The edited fields saved from this section, which mark it as having unsaved changes. */
  fields: (keyof EditedFields)[];
}

const SECTIONS: Record<PhotoSection, SectionInfo> = {
  details: { label: "Details", icon: FileTextIcon, fields: ["details", "reEdit"] },
  groups: { label: "Albums & tags", icon: TagsIcon, fields: ["groups"] },
  image: { label: "Image", icon: ImageIcon, fields: [] },
  camera: { label: "Camera & lens", icon: CameraIcon, fields: ["overrides"] },
  sharing: { label: "Posts & related", icon: Share2Icon, fields: ["socialPosts", "pickedSimilar"] },
  json: { label: "JSON", icon: BracesIcon, fields: [] },
};

/** The Photo page's `?section=`, when it names one of its sections; Details shows without it. */
export function photoSectionSearch(search: Record<string, unknown>): { section?: PhotoSection } {
  const section = PHOTO_SECTIONS.find((name) => name === search.section);
  return section && section !== "details" ? { section } : {};
}

/** The section the Photo page shows, and a way to switch it that keeps the rest of the URL. */
function usePhotoSection(): [PhotoSection, (section: PhotoSection) => void] {
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();
  const current = photoSectionSearch(search).section ?? "details";
  const show = (section: PhotoSection) =>
    void navigate({
      to: ".",
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        section: section === "details" ? undefined : section,
      }),
      replace: true,
    });
  return [current, show];
}

/** The sections with changes that Save changes would write. */
function unsavedSections(edit: Edit): Set<PhotoSection> {
  const unsaved = new Set<PhotoSection>(
    PHOTO_SECTIONS.filter((name) =>
      SECTIONS[name].fields.some((field) => edit.changedFields.includes(field)),
    ),
  );
  if (edit.cropMoved) unsaved.add("image");
  if (edit.next) unsaved.add("json");
  return unsaved;
}

interface PhotoSectionsProps {
  edit: Edit;
  /** The cards of each section. */
  children: Record<PhotoSection, ReactNode>;
}

/**
 * The Photo page's cards grouped into sections, with a subnavigation to switch between them: a
 * column on the left on a wide window, wrapping rows along the top on a narrow one. Every section stays
 * mounted, hidden when it isn't shown, so switching keeps anything typed or drawn but not saved.
 */
export function PhotoSections({ edit, children }: PhotoSectionsProps) {
  const [current, show] = usePhotoSection();
  const unsaved = unsavedSections(edit);
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[12rem_minmax(0,1fr)]">
      <SectionNav current={current} unsaved={unsaved} onShow={show} />
      {PHOTO_SECTIONS.map((name) => (
        <section
          key={name}
          id={`photo-section-${name}`}
          role="tabpanel"
          aria-labelledby={`photo-tab-${name}`}
          hidden={name !== current}
          className="flex min-w-0 flex-col gap-6 lg:col-start-2 lg:row-start-1"
        >
          {children[name]}
        </section>
      ))}
    </div>
  );
}

interface SectionNavProps {
  current: PhotoSection;
  unsaved: Set<PhotoSection>;
  onShow: (section: PhotoSection) => void;
}

/** The list of sections, each with a dot while it has unsaved changes. */
function SectionNav({ current, unsaved, onShow }: SectionNavProps) {
  return (
    <nav aria-label="Photo sections" className="lg:sticky lg:top-6">
      <div role="tablist" className="flex flex-wrap gap-1 lg:flex-col">
        {PHOTO_SECTIONS.map((name) => (
          <SectionTab
            key={name}
            name={name}
            active={name === current}
            unsaved={unsaved.has(name)}
            onShow={() => onShow(name)}
          />
        ))}
      </div>
    </nav>
  );
}

interface SectionTabProps {
  name: PhotoSection;
  active: boolean;
  unsaved: boolean;
  onShow: () => void;
}

function SectionTab({ name, active, unsaved, onShow }: SectionTabProps) {
  const { label, icon: Icon } = SECTIONS[name];
  return (
    <button
      type="button"
      role="tab"
      id={`photo-tab-${name}`}
      aria-selected={active}
      aria-controls={`photo-section-${name}`}
      onClick={onShow}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm whitespace-nowrap transition-colors",
        active
          ? "bg-secondary text-secondary-foreground font-medium"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="flex-1">{label}</span>
      {unsaved && (
        <span className="bg-primary size-2 shrink-0 rounded-full" title="Unsaved changes">
          <span className="sr-only">Unsaved changes</span>
        </span>
      )}
    </button>
  );
}
