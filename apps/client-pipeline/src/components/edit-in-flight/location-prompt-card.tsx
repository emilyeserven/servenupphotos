import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapPinIcon } from "lucide-react";
import { useState } from "react";
import {
  type Place,
  cacheSavedEntry,
  placesQuery,
  readEntries,
  savePlaceMutation,
} from "@/api/places";
import { CopyPromptButton } from "@/components/edit-in-flight/copy-prompt-button";
import type { ExifPlace, PhotoDetails } from "@/components/photo-details";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  type LocationClues,
  type LocationField,
  type LocationSuggestion,
  type PastedLocation,
  findPlace,
  locationPrompt,
  locationSuggestions,
  newPlace,
  parseLocationAnswer,
  withLocation,
} from "@/lib/location-prompt";

interface LocationPromptCardProps {
  /** The public URL of the photo's version the prompt links to. */
  imageUrl: string;
  /** The photo's details being edited, whose location the answer fills in. */
  details: PhotoDetails;
  exif: ExifPlace;
  onChange: (details: PhotoDetails) => void;
  /** Saving is under way, so changing the details now would not change the file. */
  disabled: boolean;
}

/**
 * Copies a prompt that asks an LLM where the photo was taken, with everything already known of its
 * location, then reads the JSON it answers with and offers to fill in the photo's place, city,
 * state, country and GPS position from it. Save changes then saves them like any other edit.
 */
export function LocationPromptCard(props: LocationPromptCardProps) {
  const read = useQuery(placesQuery);
  const [copied, setCopied] = useState(false);
  const clues: LocationClues = {
    details: props.details,
    exif: props.exif,
    places: readEntries(read.data?.places),
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>Suggest a location</CardTitle>
        <CardDescription>
          Copies a prompt for a chat with an LLM, with a link to the photo&apos;s Small version,
          what&apos;s already known of where it was taken, and every place to reuse. Paste its
          answer to fill in the location.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <CopyPromptButton
          label="Copy location prompt"
          disabled={!read.data}
          prompt={() => locationPrompt(props.imageUrl, clues)}
          onCopied={() => setCopied(true)}
        />
        {copied && <PasteLocation {...props} clues={clues} />}
      </CardContent>
    </Card>
  );
}

type PasteLocationProps = LocationPromptCardProps & { clues: LocationClues };

/** The field to paste the LLM's answer into, and what it suggests. */
function PasteLocation({ clues, onChange, disabled }: PasteLocationProps) {
  const [text, setText] = useState("");
  const [pasted, setPasted] = useState<PastedLocation | null | undefined>(undefined);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="location-prompt-answer" className="text-sm font-medium">
        The LLM&apos;s answer
      </label>
      <Textarea
        id="location-prompt-answer"
        value={text}
        placeholder='{"place": "Gyeongbokgung Palace", "city": "Seoul", …}'
        disabled={disabled}
        onChange={(event) => setText(event.target.value)}
      />
      <Button
        type="button"
        className="self-start"
        disabled={disabled || !text.trim()}
        onClick={() => setPasted(parseLocationAnswer(text))}
      >
        <MapPinIcon />
        Read answer
      </Button>
      {pasted === null && (
        <p className="text-destructive text-sm">
          There&apos;s no JSON object in that answer. Paste all of it, from {"{"} to {"}"}.
        </p>
      )}
      {pasted && (
        <PastedAnswer
          // A new answer starts with its own suggestions ticked.
          key={JSON.stringify(pasted)}
          pasted={pasted}
          clues={clues}
          onChange={onChange}
          disabled={disabled}
        />
      )}
    </div>
  );
}

interface PastedAnswerProps {
  pasted: PastedLocation;
  clues: LocationClues;
  onChange: (details: PhotoDetails) => void;
  disabled: boolean;
}

/** How sure the LLM is and why, then the changes it suggests. */
function PastedAnswer(props: PastedAnswerProps) {
  const [suggestions] = useState(() => locationSuggestions(props.pasted, props.clues));
  return (
    <div className="flex flex-col gap-3 rounded-md border p-3 text-sm">
      <Reasoning pasted={props.pasted} />
      {suggestions.length === 0 ? (
        <p className="text-muted-foreground">The photo already has everything it suggests.</p>
      ) : (
        <FillForm {...props} suggestions={suggestions} />
      )}
    </div>
  );
}

/** Which suggestions are ticked, starting from the ones for fields the photo has nothing in. */
function useTicked(suggestions: LocationSuggestion[]) {
  const [ticked, setTicked] = useState(
    () => new Set(suggestions.filter((s) => s.ticked).map((s) => s.field)),
  );
  const toggle = (field: LocationField) => {
    const next = new Set(ticked);
    if (!next.delete(field)) next.add(field);
    setTicked(next);
  };
  return { ticked, toggle };
}

/** Each suggested change with a checkbox, and a button that fills in the ticked ones. */
function FillForm({
  pasted,
  clues,
  onChange,
  disabled,
  suggestions,
}: PastedAnswerProps & { suggestions: LocationSuggestion[] }) {
  const { ticked, toggle } = useTicked(suggestions);
  const fill = useFill(pasted, clues, onChange);
  const busy = disabled || fill.isPending;
  return (
    <>
      <SuggestionList
        suggestions={suggestions}
        ticked={ticked}
        disabled={busy || fill.isSuccess}
        onToggle={toggle}
      />
      <FillButton
        count={ticked.size}
        disabled={busy}
        filled={fill.isSuccess}
        onClick={() => fill.mutate(ticked)}
      />
      {fill.isError && <p className="text-destructive">{fill.error.message}</p>}
    </>
  );
}

/** The LLM's confidence and reasoning, when it gave them. */
function Reasoning({ pasted }: { pasted: PastedLocation }) {
  const confidence = pasted.confidence && `${pasted.confidence} confidence`;
  const parts = [confidence, pasted.reasoning].filter(Boolean);
  if (parts.length === 0) return null;
  return <p className="text-muted-foreground">{parts.join(": ")}</p>;
}

interface SuggestionListProps {
  suggestions: LocationSuggestion[];
  ticked: Set<LocationField>;
  disabled: boolean;
  onToggle: (field: LocationField) => void;
}

/** Each suggested change, with what the photo has there now. */
function SuggestionList({ suggestions, ticked, disabled, onToggle }: SuggestionListProps) {
  return (
    <ul className="flex flex-col gap-2">
      {suggestions.map((suggestion) => (
        <li key={suggestion.field}>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="accent-primary mt-0.5 size-4"
              checked={ticked.has(suggestion.field)}
              disabled={disabled}
              onChange={() => onToggle(suggestion.field)}
            />
            <SuggestionText suggestion={suggestion} />
          </label>
        </li>
      ))}
    </ul>
  );
}

function SuggestionText({ suggestion }: { suggestion: LocationSuggestion }) {
  const { label, current, suggested, note } = suggestion;
  return (
    <span className="flex flex-col gap-0.5">
      <span>
        <span className="font-medium">{label}:</span> {suggested}
      </span>
      <span className="text-muted-foreground">
        {current ? `Now ${current}.` : "Nothing yet."} {note}
      </span>
    </span>
  );
}

interface FillButtonProps {
  count: number;
  disabled: boolean;
  /** Whether they've been filled in already. */
  filled: boolean;
  onClick: () => void;
}

/** Fills in the ticked suggestions, and says so once it has. */
function FillButton({ count, disabled, filled, onClick }: FillButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="self-start"
      disabled={disabled || filled || count === 0}
      onClick={onClick}
    >
      {filled ? "Filled in; Save changes saves them" : `Fill in ${count} ticked`}
    </Button>
  );
}

/**
 * Fills the ticked suggestions into the details, first making the pasted place as a change waiting
 * for Commit when it's ticked and isn't a place yet.
 */
function useFill(
  pasted: PastedLocation,
  clues: LocationClues,
  onChange: (details: PhotoDetails) => void,
) {
  const queryClient = useQueryClient();
  const savePlace = useMutation(savePlaceMutation);
  return useMutation({
    mutationFn: async (ticked: Set<LocationField>) => {
      const place = ticked.has("place") ? await placeFile(pasted, clues.places) : undefined;
      onChange(withLocation(clues, pasted, ticked, place));
    },
  });

  /** The pasted place's file, made now when there's none yet. */
  async function placeFile(answer: PastedLocation, places: Place[]): Promise<Place> {
    const found = findPlace(answer.place, places);
    if (found) return found;
    const result = await savePlace.mutateAsync(newPlace(answer));
    cacheSavedEntry(queryClient, "places", result);
    return result.data;
  }
}
