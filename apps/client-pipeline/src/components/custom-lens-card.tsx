import { Link } from "@tanstack/react-router";
import { type CustomLens } from "@/api/lenses";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type LensChoice, lensFields, savedLensChoice } from "@/lib/custom-lens";
import type { CombinedPhoto } from "@/lib/group-photos";

const NO_LENS = "";

interface CustomLensCardProps {
  value: LensChoice;
  onChange: (value: LensChoice) => void;
  lenses: CustomLens[];
  /** What saving does with the choice, such as "Saved in the JSON when you save." */
  description: string;
  disabled: boolean;
}

/**
 * The photo's custom lens, for a lens its EXIF doesn't name well, such as a manual one, and whether
 * its aperture is manual or unknown.
 */
export function CustomLensCard({
  value,
  onChange,
  lenses,
  description,
  disabled,
}: CustomLensCardProps) {
  const lens = lenses.find((l) => l.id === value.customLens);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lens</CardTitle>
        <CardDescription>
          {description}{" "}
          <Link to="/metadata-groups" className="text-foreground underline underline-offset-4">
            Metadata Groups
          </Link>{" "}
          lists the custom lenses to pick from, on its Lenses tab.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <select
          aria-label="Custom lens"
          className="border-input bg-background h-9 min-w-0 rounded-md border px-3 text-sm"
          value={value.customLens ?? NO_LENS}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, customLens: e.target.value || null })}
        >
          <option value={NO_LENS}>As the EXIF and camera overrides say</option>
          {lenses.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
          <MissingLens id={value.customLens} known={lens !== undefined} />
        </select>
        <LensWrites lens={lens} />
        <ManualAperture
          checked={value.manualAperture}
          byLens={lens?.manualAperture === true}
          disabled={disabled}
          onChange={(manualAperture) => onChange({ ...value, manualAperture })}
        />
      </CardContent>
    </Card>
  );
}

interface ManualApertureProps {
  checked: boolean;
  /** Whether the chosen lens has a manual aperture, which sets it whatever the box says. */
  byLens: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}

/** Whether the photo's aperture is manual or unknown, written straight into its JSON. */
function ManualAperture({ checked, byLens, disabled, onChange }: ManualApertureProps) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        className="accent-primary size-4"
        checked={checked || byLens}
        disabled={disabled || byLens}
        onChange={(e) => onChange(e.target.checked)}
      />
      Manual/unknown aperture: the photo has no aperture, and the portfolio says so
      {byLens && <span className="text-muted-foreground">(set by the lens)</span>}
    </label>
  );
}

/** An option for a lens the photo has that's no longer a custom lens, so the choice still shows. */
function MissingLens({ id, known }: { id: string | null; known: boolean }) {
  if (id === null || known) return null;
  return <option value={id}>{id} (removed)</option>;
}

/** The fields the chosen lens writes over the photo's. */
function LensWrites({ lens }: { lens?: CustomLens }) {
  if (!lens) return null;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      {Object.entries(lensFields(lens)).map(([field, to]) => (
        <div key={field} className="contents">
          <dt className="font-medium">{field}</dt>
          <dd className="font-mono text-xs break-all">{JSON.stringify(to)}</dd>
        </div>
      ))}
    </dl>
  );
}

interface NewPhotoLensProps {
  /** The new photo's JSON, with the lens chosen. */
  photo: CombinedPhoto;
  lenses: CustomLens[];
  onChange: (value: LensChoice) => void;
  /** The JSON has been saved to GitHub. */
  saved: boolean;
}

/** The new photo's custom lens and manual aperture, saved in its JSON with Save. */
export function NewPhotoLens({ photo, lenses, onChange, saved }: NewPhotoLensProps) {
  return (
    <CustomLensCard
      value={savedLensChoice(photo)}
      onChange={onChange}
      lenses={lenses}
      description={
        saved ? "Saved with the photo's JSON." : "Optional, and saved in the JSON when you save."
      }
      disabled={saved}
    />
  );
}
