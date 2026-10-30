import { Link } from "@tanstack/react-router";
import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import type { Place } from "@/api/places";
import { bulkTagCount, PickCount } from "@/components/bulk-tagging/pick-count";
import { useLocalizationRows } from "@/components/localization-drafts";
import { LocalizationFillReview } from "@/components/localization-fill/localization-fill-review";
import { count } from "@/components/update-data-shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { type LocalizationAnswer, readLocalizationAnswer } from "@/lib/localization-answer";
import { localizationPrompt, rowsToFill } from "@/lib/localization-prompt";
import type { LocalizationRow } from "@/lib/place-seeds";

/** How many names a prompt asks about until another number is chosen. */
const defaultNameCount = 25;

/**
 * Localizations: copies one prompt asking an LLM how up to 50 countries, states, cities and places
 * without a romanization or local script are written and said where they are, and reads its JSON
 * answer back into rows to check and save, waiting for Commit.
 */
export function LocalizationFillCard() {
  const { rows, places, pending, error } = useLocalizationRows();
  const [typed, setTyped] = useState(String(defaultNameCount));
  // The names the last copied prompt asked about, by localization ID.
  const [asked, setAsked] = useState<string[]>([]);
  const toFill = rowsToFill(rows);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Localizations</CardTitle>
        <CardDescription>
          Asks an LLM how each country, state, city and place without a romanization or local script
          is written and said where it is, the ones the most photos show first. Copy one prompt into
          a chat with an LLM, paste its JSON answer back, and check each name before it&apos;s
          saved, waiting for Commit. Fields already saved are kept. Each one can be changed later on
          the{" "}
          <Link to="/localizations" className="text-foreground underline underline-offset-4">
            Localizations
          </Link>{" "}
          page.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {error && <p className="text-destructive text-sm">{error.message}</p>}
        {pending ? (
          <p className="text-sm">Reading photos, places and localizations from GitHub…</p>
        ) : (
          <>
            <FillStatus toFill={toFill.length} total={rows.length} />
            <div className="flex flex-wrap items-center gap-3">
              <PickCount
                label="Names to ask about"
                fallback={defaultNameCount}
                value={typed}
                disabled={false}
                onChange={setTyped}
              />
              <CopyPromptButton
                rows={toFill.slice(0, bulkTagCount(typed, defaultNameCount))}
                places={places}
                onCopied={setAsked}
              />
            </div>
            {asked.length > 0 && <PasteAnswer key={asked.join()} asked={askedRows(rows, asked)} />}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** The rows asked about, in the order the prompt listed them. */
function askedRows(rows: LocalizationRow[], asked: string[]): LocalizationRow[] {
  return asked.flatMap((id) => rows.filter((row) => row.id === id));
}

/** How many names still need filling in, of every one. */
function FillStatus({ toFill, total }: { toFill: number; total: number }) {
  if (toFill === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        All {count(total, "name")} have a romanization and local script.
      </p>
    );
  }
  return (
    <p className="text-muted-foreground text-sm">
      {toFill} of {count(total, "name")} (countries, states, cities and places) have no romanization
      or local script yet.
    </p>
  );
}

interface CopyPromptButtonProps {
  rows: LocalizationRow[];
  places: Place[];
  /** Called with the IDs the copied prompt asks about. */
  onCopied: (ids: string[]) => void;
}

/** Copies the prompt for the next names to fill in. */
function CopyPromptButton({ rows, places, onCopied }: CopyPromptButtonProps) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(localizationPrompt(rows, places)).then(() => {
      onCopied(rows.map((row) => row.id));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <Button type="button" variant="outline" disabled={rows.length === 0} onClick={copy}>
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? "Copied" : `Copy the prompt for ${count(rows.length, "name")}`}
    </Button>
  );
}

/** The box to paste the LLM's answer into, and the names it gives to check and save. */
function PasteAnswer({ asked }: { asked: LocalizationRow[] }) {
  const [answer, setAnswer] = useState("");
  const [read, setRead] = useState<{ answer?: LocalizationAnswer; error?: string }>({});
  const review = () => {
    try {
      setRead({
        answer: readLocalizationAnswer(
          answer,
          asked.map((row) => row.id),
        ),
      });
    } catch (error) {
      setRead({ error: (error as Error).message });
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        The prompt asks about {asked.map((row) => row.name).join(", ")}.
      </p>
      <Textarea
        aria-label="The LLM's answer"
        placeholder="Paste the LLM's JSON answer here"
        className="max-h-64 min-h-32 font-mono text-xs"
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
      />
      <Button type="button" className="self-start" disabled={!answer.trim()} onClick={review}>
        Review the names
      </Button>
      {read.error && <p className="text-destructive text-sm">{read.error}</p>}
      {read.answer && <LocalizationFillReview key={answer} rows={asked} answer={read.answer} />}
    </div>
  );
}
