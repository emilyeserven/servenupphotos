import type * as React from "react";
import type { Bin, ColorAnalysis, RawColorData as RawData } from "@/api/exif";
import { CodeBlock } from "@/components/ui/code-block";

export function ColorData({ colors }: { colors: ColorAnalysis }) {
  return (
    <div className="flex flex-col gap-6">
      <Section title="Average">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="size-10 shrink-0 rounded-md border"
            style={{ backgroundColor: colors.average.hex }}
          />
          <dl className="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-3 text-sm">
            <dt>Hex</dt>
            <dd className="font-mono">{colors.average.hex}</dd>
            <dt>Mean lightness</dt>
            <dd>{colors.lightness}</dd>
            <dt>Mean chroma</dt>
            <dd>{colors.chroma}</dd>
          </dl>
        </div>
      </Section>

      <Section title="Color buckets">
        <BarChart
          label="Share of the photo per hue bucket"
          bars={colors.buckets.map((b) => ({
            key: b.name,
            label: b.name,
            color: b.hex,
            share: b.share,
          }))}
          showValues
        />
      </Section>

      <Section
        title={`Blacks, grays and whites (${formatShare(colors.neutrals.share)} of the photo)`}
      >
        <BarChart
          label="Share of the photo per lightness bin, for neutral pixels"
          bars={binBars(colors.neutrals.histogram)}
          axis={["Black", "White"]}
        />
      </Section>
    </div>
  );
}

const STAT_COLUMNS = ["min", "p5", "median", "mean", "p95", "max", "stdDev"] as const;

export function RawColorData({ raw, samples }: { raw: RawData; samples: number }) {
  const { hue, lightness, chroma, saturation } = raw.histograms;
  return (
    <div className="flex flex-col gap-6">
      <p className="text-muted-foreground text-sm">
        Computed with go-colorful over {samples.toLocaleString()} sampled pixels, in its native
        scales (mostly 0–1). Hue channels are left out of the tables because hue is circular; see
        the hue histogram instead.
      </p>

      <Section title="Hue (HSV, 10° bins, excluding neutrals)">
        <BarChart label="Hue histogram" bars={binBars(hue)} axis={["0°", "360°"]} />
      </Section>
      <Section title="Lightness (CIELAB L*)">
        <BarChart label="Lightness histogram" bars={binBars(lightness)} axis={["0", "100"]} />
      </Section>
      <Section title="Chroma (CIELAB)">
        <BarChart label="Chroma histogram" bars={binBars(chroma)} axis={["0", "100+"]} />
      </Section>
      <Section title="Saturation (HSV)">
        <BarChart label="Saturation histogram" bars={binBars(saturation)} axis={["0", "1"]} />
      </Section>

      <Section title="Channel statistics">
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-right font-mono text-xs tabular-nums">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-2 py-1 text-left font-medium">Channel</th>
                {STAT_COLUMNS.map((c) => (
                  <th key={c} className="px-2 py-1 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {raw.spaces.flatMap((space) =>
                space.channels.map((ch) => (
                  <tr key={`${space.name}.${ch.name}`} className="border-t">
                    <td className="px-2 py-1 text-left">
                      {space.name}.{ch.name}
                    </td>
                    {STAT_COLUMNS.map((c) => (
                      <td key={c} className="px-2 py-1">
                        {ch[c]}
                      </td>
                    ))}
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="JSON">
        <CodeBlock language="json" code={JSON.stringify(raw, null, 2)} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
  );
}

interface Bar {
  key: string;
  /** Shown under the bar. */
  label?: string;
  /** Any CSS color. */
  color: string;
  share: number;
}

function binBars(bins: Bin[]): Bar[] {
  return bins.map((b) => ({
    key: `${b.from}–${b.to}`,
    color: b.hex ?? "var(--primary)",
    share: b.share,
  }));
}

interface BarChartProps {
  label: string;
  bars: Bar[];
  /** Labels for the left and right ends of the x-axis. */
  axis?: [string, string];
  /** Print each bar's share above it. */
  showValues?: boolean;
}

function BarChart({ label, bars, axis, showValues = false }: BarChartProps) {
  // Scale to the largest bar so small shares stay visible.
  const maxShare = Math.max(...bars.map((b) => b.share), 0.01);
  return (
    <div className="flex flex-col gap-1">
      <ul
        className="grid gap-px"
        style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}
        aria-label={label}
      >
        {bars.map((bar) => (
          <BarColumn key={bar.key} bar={bar} maxShare={maxShare} showValue={showValues} />
        ))}
      </ul>
      {axis && (
        <div className="text-muted-foreground flex justify-between text-xs">
          <span>{axis[0]}</span>
          <span>{axis[1]}</span>
        </div>
      )}
    </div>
  );
}

function BarColumn({
  bar,
  maxShare,
  showValue,
}: {
  bar: Bar;
  maxShare: number;
  showValue: boolean;
}) {
  return (
    <li
      className="flex flex-col items-center gap-1"
      title={`${bar.key}: ${formatShare(bar.share)}`}
    >
      {showValue && (
        <span className="text-muted-foreground text-[10px] tabular-nums">
          {formatShare(bar.share)}
        </span>
      )}
      <div className="flex h-32 w-full items-end">
        <div
          className="w-full rounded-t-sm border"
          style={{ height: `${(bar.share / maxShare) * 100}%`, backgroundColor: bar.color }}
        />
      </div>
      {bar.label && (
        <span className="rotate-180 text-xs whitespace-nowrap [writing-mode:vertical-rl]">
          {bar.label}
        </span>
      )}
    </li>
  );
}

function formatShare(share: number): string {
  return share.toLocaleString(undefined, { style: "percent", maximumFractionDigits: 1 });
}
