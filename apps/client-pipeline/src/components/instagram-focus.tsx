import { ChevronRightIcon, CrosshairIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import type { SocialPhoto } from "@/api/publish";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dayFormat, parseIsoDate } from "@/lib/calendar";
import { type SocialFocus, isFocused, knownValues, parseList } from "@/lib/social-focus";
import { useSocialFocusStore } from "@/stores/social-focus";
import { DatePicker } from "@/components/date-picker";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}

interface ListFieldProps {
  label: string;
  field: "tags" | "genres";
  photos: SocialPhoto[];
}

/** Tags or genres typed with commas between them, offering the ones the photos have. */
function ListField({ label, field, photos }: ListFieldProps) {
  const saved = useSocialFocusStore((state) => state.focus[field]);
  const setFocus = useSocialFocusStore((state) => state.setFocus);
  // The text as typed, so a trailing comma or space isn't lost while typing.
  const [typed, setTyped] = useState(saved.join(", "));
  const shown = parseList(typed).join() === saved.join() ? typed : saved.join(", ");
  const listId = `instagram-focus-${field}`;
  return (
    <Field label={label}>
      <Input
        value={shown}
        list={listId}
        placeholder="Any, or several with commas"
        onChange={(event) => {
          setTyped(event.target.value);
          setFocus({ [field]: parseList(event.target.value) });
        }}
      />
      <datalist id={listId}>
        {knownValues(photos, field).map((value) => (
          <option key={value} value={value} />
        ))}
      </datalist>
    </Field>
  );
}

function DateFields() {
  const { takenFrom, takenTo } = useSocialFocusStore((state) => state.focus);
  const setFocus = useSocialFocusStore((state) => state.setFocus);
  return (
    <>
      <Field label="Taken from">
        <DatePicker
          value={takenFrom}
          max={takenTo}
          placeholder="Any day"
          onChange={(day) => setFocus({ takenFrom: day })}
        />
      </Field>
      <Field label="Taken to">
        <DatePicker
          value={takenTo}
          min={takenFrom}
          placeholder="Any day"
          onChange={(day) => setFocus({ takenTo: day })}
        />
      </Field>
    </>
  );
}

function PlaceField() {
  const place = useSocialFocusStore((state) => state.focus.place);
  const setFocus = useSocialFocusStore((state) => state.setFocus);
  return (
    <Field label="Place">
      <Input
        value={place}
        placeholder="City, state or country"
        onChange={(event) => setFocus({ place: event.target.value })}
      />
    </Field>
  );
}

function EligibleField() {
  const eligibleOnly = useSocialFocusStore((state) => state.focus.eligibleOnly);
  const setFocus = useSocialFocusStore((state) => state.setFocus);
  return (
    <label className="flex items-center gap-2 text-sm sm:col-span-2">
      <input
        type="checkbox"
        className="accent-primary size-4"
        checked={eligibleOnly}
        onChange={(event) => setFocus({ eligibleOnly: event.target.checked })}
      />
      Only photos eligible for social media
    </label>
  );
}

function day(value: string): string {
  return dayFormat.format(parseIsoDate(value));
}

/** "until Dec 31", or "" with no end day. */
function untilDay(takenTo: string): string {
  return takenTo ? `until ${day(takenTo)}` : "";
}

/** "taken from Dec 1 until Dec 31", "taken from Dec 1", "taken until Dec 31"; null with no dates. */
function dateSummary({ takenFrom, takenTo }: SocialFocus): string | null {
  const from = takenFrom ? `from ${day(takenFrom)}` : "";
  const parts = [from, untilDay(takenTo)].filter(Boolean);
  return parts.length === 0 ? null : `taken ${parts.join(" ")}`;
}

function listSummary(word: string, items: string[]): string | null {
  return items.length === 0 ? null : `${word} ${items.join(" or ")}`;
}

/** The Focus's filters in a line, such as "eligible · taken Dec 1 – Dec 31 · in Japan". */
export function focusSummary(focus: SocialFocus): string {
  return [
    focus.eligibleOnly ? "eligible" : null,
    dateSummary(focus),
    focus.place.trim() ? `in ${focus.place.trim()}` : null,
    listSummary("tagged", focus.tags),
    listSummary("genre", focus.genres),
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * The Focus above the Instagram calendar, folded to a line saying what it filters: the filters its photo picker starts with, kept in
 * this browser.
 */
export function InstagramFocus({ photos }: { photos: SocialPhoto[] }) {
  const focus = useSocialFocusStore((state) => state.focus);
  const clearFocus = useSocialFocusStore((state) => state.clearFocus);
  const focused = isFocused(focus);
  return (
    <details className="group rounded-lg border">
      <summary className="hover:bg-accent/50 flex cursor-pointer list-none items-center gap-2 rounded-lg px-4 py-3 text-sm">
        <ChevronRightIcon className="size-4 transition-transform group-open:rotate-90" />
        <CrosshairIcon className="size-4" />
        <span className="font-medium">Focus</span>
        <span className="text-muted-foreground truncate">
          {focused ? focusSummary(focus) : "none: the picker offers every photo"}
        </span>
      </summary>
      <div className="flex flex-col gap-3 border-t px-4 py-3">
        <p className="text-muted-foreground text-sm">
          The filters the photo picker starts with when you add a photo to a day, for both its
          suggestions and the full list. Kept in this browser.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <DateFields />
          <PlaceField />
          <ListField label="Tags" field="tags" photos={photos} />
          <ListField label="Genres" field="genres" photos={photos} />
          <EligibleField />
        </div>
        {focused && (
          <Button variant="outline" size="sm" className="self-start" onClick={clearFocus}>
            Clear Focus
          </Button>
        )}
      </div>
    </details>
  );
}
