import { ChevronRightIcon } from "lucide-react";
import { type CustomLens } from "@/api/lenses";
import { CustomLensFields, MetadataGroupsNote } from "@/components/custom-lens-card";
import { type LensChoice } from "@/lib/custom-lens";

interface LensSectionProps {
  value: LensChoice;
  onChange: (value: LensChoice) => void;
  lenses: CustomLens[];
  /** Whether it starts open, as it does when the saved photo has a custom lens or a manual aperture. */
  defaultOpen: boolean;
  disabled: boolean;
}

/**
 * The saved photo's custom lens and manual aperture, under a Lens heading that collapses them,
 * inside the Camera overrides card.
 */
export function LensSection({ value, onChange, lenses, defaultOpen, disabled }: LensSectionProps) {
  return (
    <details open={defaultOpen} className="group/lens flex flex-col">
      <summary className="hover:bg-muted/50 -mx-2 flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-1 [&::-webkit-details-marker]:hidden">
        <ChevronRightIcon
          className="text-muted-foreground size-4 transition-transform group-open/lens:rotate-90"
          aria-hidden
        />
        <span className="text-sm font-medium">Lens</span>
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <p className="text-muted-foreground text-sm">
          Saving changes writes it, with the camera overrides, over the JSON. <MetadataGroupsNote />
        </p>
        <CustomLensFields value={value} onChange={onChange} lenses={lenses} disabled={disabled} />
      </div>
    </details>
  );
}
