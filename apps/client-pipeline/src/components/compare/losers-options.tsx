import type { ReactNode } from "react";
import { Textarea } from "@/components/ui/textarea";
import { type ComparePhoto, photoNames } from "@/lib/compare-groups";
import type { UnselectedImages } from "@/lib/unselected";

/** What Finish comparing does with the photos that didn't win, as its form has it. */
export interface LosersForm {
  /** Leave them as they are, or move them to Unselected Photos. */
  kind: "leave" | "unselect";
  /** When leaving them: set the untitled ones aside as Undecided. */
  setAside: boolean;
  /** When moving them: why they weren't chosen. */
  reason: string;
  /** When moving them: what's left of each in R2. */
  keep: UnselectedImages;
}

/** The choices of what's left in R2, in the order they're offered. */
const KEEP_CHOICES: { value: UnselectedImages; label: string; detail: string }[] = [
  {
    value: "small",
    label: "Keep only their Small versions and thumbnails",
    detail: "Deletes the original and the XLarge, Large and Medium versions.",
  },
  {
    value: "deleted",
    label: "Delete them from R2",
    detail: "Deletes the original, every version and the thumbnails.",
  },
  { value: "kept", label: "Keep them in R2", detail: "Deletes nothing." },
];

interface LosersOptionsProps {
  form: LosersForm;
  onChange: (form: LosersForm) => void;
  /** The photos that didn't win. */
  losers: ComparePhoto[];
  /** How many winners are picked. */
  winners: number;
  /** How many of the losers have no title. */
  untitled: number;
  disabled: boolean;
}

/**
 * What to do with the photos that didn't win: leave them as they are, or move them to Unselected
 * Photos with a reason, keeping all, some or none of their images in R2. Nothing to choose without
 * winners or without losers.
 */
export function LosersOptions(props: LosersOptionsProps) {
  const { form, onChange, losers } = props;
  if (!offersChoice(props)) return null;
  const set = (change: Partial<LosersForm>) => onChange({ ...form, ...change });
  return (
    <fieldset disabled={props.disabled} className="flex flex-col gap-3 text-sm">
      <LosersLegend losers={losers} />
      <Choice
        checked={form.kind === "unselect"}
        onSelect={() => set({ kind: "unselect" })}
        label="Move to Unselected Photos"
        detail="Kept with why they weren't chosen and which photos won. Commit leaves them off the portfolio."
      >
        <UnselectOptions form={form} set={set} />
      </Choice>
      <Choice
        checked={form.kind === "leave"}
        onSelect={() => set({ kind: "leave" })}
        label="Leave them as they are"
        detail="Photos with a title stay on the portfolio or in flight."
      >
        <SetAside form={form} set={set} untitled={props.untitled} />
      </Choice>
    </fieldset>
  );
}

/** Whether there's anything to choose: some photos won and some didn't. */
function offersChoice({ winners, losers }: LosersOptionsProps): boolean {
  return winners > 0 && losers.length > 0;
}

function LosersLegend({ losers }: { losers: ComparePhoto[] }) {
  return (
    <legend className="mb-2 font-medium">
      The {losers.length === 1 ? "photo" : `${losers.length} photos`} that didn&apos;t win:{" "}
      <span className="text-muted-foreground font-normal">{photoNames(losers)}</span>
    </legend>
  );
}

/** One radio choice, with what it does under it and its own options, children, under that while chosen. */
function Choice({
  checked,
  onSelect,
  label,
  detail,
  children,
}: {
  checked: boolean;
  onSelect: () => void;
  label: string;
  detail: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-start gap-2">
        <input
          type="radio"
          className="accent-primary mt-0.5 size-4"
          checked={checked}
          onChange={onSelect}
        />
        <span className="flex flex-col">
          <span>{label}</span>
          <span className="text-muted-foreground text-xs">{detail}</span>
        </span>
      </label>
      {checked && children && <div className="ml-6 flex flex-col gap-3">{children}</div>}
    </div>
  );
}

type SetForm = (change: Partial<LosersForm>) => void;

/** Why they weren't chosen, and what's left of them in R2. */
function UnselectOptions({ form, set }: { form: LosersForm; set: SetForm }) {
  return (
    <>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium">Why they weren&apos;t chosen (optional)</span>
        <Textarea
          value={form.reason}
          onChange={(e) => set({ reason: e.target.value })}
          placeholder="Such as: softer focus, and the winner's framing is cleaner"
          rows={2}
        />
      </label>
      <div className="flex flex-col gap-2">
        {KEEP_CHOICES.map((choice) => (
          <Choice
            key={choice.value}
            checked={form.keep === choice.value}
            onSelect={() => set({ keep: choice.value })}
            label={choice.label}
            detail={choice.detail}
          />
        ))}
      </div>
    </>
  );
}

/** Sets the untitled losers aside as Undecided; nothing when every loser has a title. */
function SetAside({ form, set, untitled }: { form: LosersForm; set: SetForm; untitled: number }) {
  if (untitled === 0) return null;
  return (
    <label className="flex items-start gap-2">
      <input
        type="checkbox"
        className="accent-primary mt-0.5 size-4"
        checked={form.setAside}
        onChange={(e) => set({ setAside: e.target.checked })}
      />
      <span>
        Set the {untitled === 1 ? "untitled photo" : `${untitled} untitled photos`} aside as
        Undecided
      </span>
    </label>
  );
}
