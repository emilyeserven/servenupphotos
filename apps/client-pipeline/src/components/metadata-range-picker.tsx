import { useState } from "react";
import type { MetaFieldInfo, MetaRange } from "@/api/metainfo";
import { FieldLabel } from "@/components/field-label";
import { STANDARD_STOPS } from "@/lib/meta-stops";
import { Input } from "@/components/ui/input";
import { type MetaValueCount, metaNumber, showRange, showValue, valuesIn } from "@/lib/meta-values";

interface MetaRangePickerProps {
  info: MetaFieldInfo;
  /** Every value of the field, with how many photos have it. */
  values: MetaValueCount[];
  range: MetaRange;
  onChange: (range: MetaRange) => void;
}

/** The numbers the slider stops at: each value the photos have, and the range's ends, sorted. */
export function rangeStops(values: MetaValueCount[], range?: MetaRange): number[] {
  const numbers = values.filter((v) => v.count > 0).map((v) => metaNumber(v.value));
  const ends = range ? [range.min, range.max] : [];
  const finite = [...numbers, ...ends].filter(Number.isFinite);
  return [...new Set(finite)].toSorted((a, b) => a - b);
}

/** The slider's stops: the photos' values and the range's ends, with the field's common values. */
function sliderStops(field: MetaFieldInfo["field"], values: MetaValueCount[], range: MetaRange) {
  const stops = new Set([...rangeStops(values, range), ...(STANDARD_STOPS[field] ?? [])]);
  return [...stops].toSorted((a, b) => a - b);
}

/**
 * A focal length, aperture, exposure or ISO group's range: a slider with a handle for each end that
 * stops at each value the photos have (marked under it) and the field's common values beyond them,
 * boxes to type either end, and the values the photos have in it.
 */
export function MetaRangePicker({ info, values, range, onChange }: MetaRangePickerProps) {
  const stops = sliderStops(info.field, values, range);
  const marks = rangeStops(values);
  const inside = valuesIn(values, range);
  const photos = inside.reduce((sum, v) => sum + v.count, 0);
  return (
    <div className="flex flex-col gap-3">
      <FieldLabel
        id="meta-group-range"
        help={`Drag either end, or type it, to choose every ${info.one} from one to the other. The slider goes past the photos' values (the marks under it) to the common ones, and a typed end can be anything. A ${info.one} a photo takes later is in the group when it's in the range.`}
      >
        Range: {showRange(info.field, range)} · {photos} {photos === 1 ? "photo" : "photos"}
      </FieldLabel>
      <RangeSlider stops={stops} marks={marks} range={range} onChange={onChange} />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <EndInput
          label="From"
          info={info}
          value={range.min}
          onChange={(min) => onChange({ ...range, min })}
        />
        <span>to</span>
        <EndInput
          label="To"
          info={info}
          value={range.max}
          onChange={(max) => onChange({ ...range, max })}
        />
      </div>
      <InRange info={info} inside={inside} />
    </div>
  );
}

interface RangeSliderProps {
  stops: number[];
  /** The stops the photos have a value at, marked under the track. */
  marks: number[];
  range: MetaRange;
  onChange: (range: MetaRange) => void;
}

/** Where a number is along the stops, as a percentage of the slider's width. */
function percent(stops: number[], at: number): number {
  return stops.length > 1 ? (stops.indexOf(at) / (stops.length - 1)) * 100 : 0;
}

/** Two handles on one track, one for each end of the range, each stopping at the stops. */
/** A spot along the track, lined up with the handles' centers, which stay 8px inside its ends. */
function along(p: number): string {
  return `calc(8px + (100% - 16px) * ${p / 100})`;
}

/** Ticks under the track where the photos have values. */
function Marks({ stops, marks }: { stops: number[]; marks: number[] }) {
  return (
    <div className="relative h-1.5" aria-hidden>
      {marks.map((mark) => (
        <span
          key={mark}
          className="bg-muted-foreground/60 absolute top-0 h-1.5 w-px"
          style={{ left: along(percent(stops, mark)) }}
        />
      ))}
    </div>
  );
}

function RangeSlider({ stops, marks, range, onChange }: RangeSliderProps) {
  if (stops.length < 2) return null;
  const last = stops.length - 1;
  const [low, high] = [stops.indexOf(range.min), stops.indexOf(range.max)];
  const left = percent(stops, range.min);
  const right = percent(stops, range.max);
  return (
    <div className="flex flex-col gap-0.5">
      <div className="relative h-5">
        <div className="bg-muted absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full" />
        <div
          className="bg-primary absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
          style={{ left: along(left), width: `calc((100% - 16px) * ${(right - left) / 100})` }}
        />
        <Handle
          label="Lowest"
          index={low}
          last={last}
          onChange={(i) => onChange({ ...range, min: stops[Math.min(i, high)] ?? range.min })}
        />
        <Handle
          label="Highest"
          index={high}
          last={last}
          onChange={(i) => onChange({ ...range, max: stops[Math.max(i, low)] ?? range.max })}
        />
      </div>
      <Marks stops={stops} marks={marks} />
    </div>
  );
}

interface HandleProps {
  label: string;
  index: number;
  last: number;
  onChange: (index: number) => void;
}

const HANDLE =
  "pointer-events-none absolute inset-0 h-5 w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-background [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:bg-background";

function Handle({ label, index, last, onChange }: HandleProps) {
  return (
    <input
      type="range"
      aria-label={label}
      className={HANDLE}
      min={0}
      max={last}
      step={1}
      value={index}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  );
}

interface EndInputProps {
  label: string;
  info: MetaFieldInfo;
  value: number;
  onChange: (value: number) => void;
}

/** One end of the range, typed as a number (or an exposure such as "1/250"), set when it reads as one. */
function EndInput({ label, info, value, onChange }: EndInputProps) {
  const shown = showValue(info.field, value).replace(/^(f\/|ISO )|( mm| s)$/g, "");
  const [text, setText] = useState(shown);
  const [was, setWas] = useState(shown);
  // The slider moved this end: show where it is now.
  if (was !== shown) {
    setWas(shown);
    setText(shown);
  }
  const commit = () => {
    const n = metaNumber(text);
    if (Number.isFinite(n)) onChange(n);
  };
  return (
    <Input
      aria-label={label}
      className="h-8 w-24"
      value={text}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
      }}
    />
  );
}

/** The values the photos have in the range, each with how many photos have it. */
function InRange({ info, inside }: { info: MetaFieldInfo; inside: MetaValueCount[] }) {
  if (inside.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No photo has a {info.one} in this range yet.</p>
    );
  }
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="In the range">
      {inside.map(({ value, count }) => (
        <li key={String(value)} className="bg-muted rounded-full px-2 py-0.5 text-xs">
          {showValue(info.field, value)} <span className="text-muted-foreground">{count}</span>
        </li>
      ))}
    </ul>
  );
}
