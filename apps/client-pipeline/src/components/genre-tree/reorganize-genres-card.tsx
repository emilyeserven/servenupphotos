import { type UseMutationResult, useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  type GenreTreeEntry,
  type GenreTreeResult,
  type Group,
  organizeQuery,
  setGenreTreeMutation,
} from "@/api/organize";
import { Busy } from "@/components/entry-buttons";
import { ErrorNote } from "@/components/error-note";
import { GenreTreeRow } from "@/components/genre-tree/genre-tree-row";
import { QueryResult } from "@/components/query-result";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SavedInApp } from "@/components/waiting-for-commit";
import { usePhotoCounts } from "@/hooks/use-photo-counts";
import { genreDraft, genreTreeChanged, genreTreeProblem, genreTreeRows } from "@/lib/genre-tree";
import { EmptyNote } from "@portfolio/components/empty-note";

/**
 * Reorganize Genres: every genre as a tree to rename, reorder and nest as subgenres, saved at once
 * as changes waiting for Commit. A genre keeps its ID, so the photos that list it keep it.
 */
export function ReorganizeGenresCard() {
  const organize = useQuery(organizeQuery);
  // Kept here so the note after a save stays when the editor starts again from the saved genres.
  const save = useMutation({
    ...setGenreTreeMutation,
    onSuccess: () => void organize.refetch(),
  });
  return (
    <Card>
      <CardHeader>
        <CardTitle>Genres and subgenres</CardTitle>
        <CardDescription>
          Rename a genre, move it up or down, or put it under a broader genre as a subgenre, such as
          Traditional architecture under Architecture. Filtering by a genre on the portfolio shows
          its subgenres' photos too. Nothing changes until you save, and IDs stay the same, so every
          photo keeps its genres. To have an LLM suggest new subgenres and move photos into them,
          use{" "}
          <Link to="/genre-suggestions" className="text-foreground underline underline-offset-4">
            Genre Suggestions
          </Link>{" "}
          with <span className="text-foreground">Photos with genres</span>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <QueryResult query={organize} pendingLabel="Reading genres…">
          {(data) =>
            data.genres.length === 0 ? (
              <EmptyNote>No genres yet. Add one on the Genres page first.</EmptyNote>
            ) : (
              <GenreTreeEditor
                // A fresh draft whenever the saved genres change.
                key={savedKey(data.genres)}
                genres={data.genres}
                save={save}
                pullRequestUrl={data.pullRequest?.url}
              />
            )
          }
        </QueryResult>
      </CardContent>
    </Card>
  );
}

/** A key that changes whenever a genre's place, parent or name does. */
function savedKey(genres: Group[]): string {
  return genres.map((g) => `${g.id}>${g.parent ?? ""}>${g.name}`).join("|");
}

type GenreTreeSave = UseMutationResult<GenreTreeResult, Error, GenreTreeEntry[]>;

interface GenreTreeEditorProps {
  genres: Group[];
  save: GenreTreeSave;
  pullRequestUrl?: string;
}

function GenreTreeEditor({ genres, save, pullRequestUrl }: GenreTreeEditorProps) {
  const [saved] = useState(() => genreDraft(genres));
  const [draft, setDraft] = useState<GenreTreeEntry[]>(saved);
  const changed = genreTreeChanged(saved, draft);
  return (
    <div className="flex flex-col gap-4">
      <GenreTreeTable
        draft={draft}
        disabled={save.isPending}
        onChange={(next) => {
          save.reset();
          setDraft(next);
        }}
      />
      <UnreadableGenres genres={genres} />
      <SaveBar
        save={save}
        changed={changed}
        problem={changed ? genreTreeProblem(draft) : ""}
        onSave={() => save.mutate(draft.map((e) => ({ ...e, name: e.name.trim() })))}
        onUndo={() => setDraft(saved)}
        pullRequestUrl={pullRequestUrl}
      />
    </div>
  );
}

interface GenreTreeTableProps {
  draft: GenreTreeEntry[];
  disabled: boolean;
  onChange: (draft: GenreTreeEntry[]) => void;
}

/** Every genre in the draft, each subgenre indented under its genre. */
function GenreTreeTable({ draft, disabled, onChange }: GenreTreeTableProps) {
  const countOf = usePhotoCounts("genres");
  return (
    <Table aria-label="Genres and subgenres">
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead id="genre-tree-under">Under</TableHead>
          <TableHead className="text-right">Photos</TableHead>
          <TableHead className="text-right">Move</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {genreTreeRows(draft).map(({ entry, depth }) => (
          <GenreTreeRow
            key={entry.id}
            entry={entry}
            depth={depth}
            draft={draft}
            count={countOf?.(entry.id)}
            disabled={disabled}
            onChange={onChange}
          />
        ))}
      </TableBody>
    </Table>
  );
}

/** The genres whose files couldn't be read, which the save leaves as they are. */
function UnreadableGenres({ genres }: { genres: Group[] }) {
  return genres
    .filter((genre) => genre.error)
    .map((genre) => (
      <ErrorNote
        key={genre.id}
        error={`${genre.path} couldn't be read, so it stays as it is: ${genre.error}`}
      />
    ));
}

interface SaveBarProps {
  save: GenreTreeSave;
  /** Whether the draft differs from the saved genres. */
  changed: boolean;
  /** Why the draft can't be saved yet, or "". */
  problem: string;
  onSave: () => void;
  onUndo: () => void;
  pullRequestUrl?: string;
}

/** Save and Undo, then why it can't be saved, why the save failed, or that it waits for Commit. */
function SaveBar({ save, changed, problem, onSave, onUndo, pullRequestUrl }: SaveBarProps) {
  const blocked = !changed || problem !== "";
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={blocked || save.isPending} onClick={onSave}>
          <Busy busy={save.isPending} />
          Save genres
        </Button>
        <UndoButton changed={changed} disabled={save.isPending} onUndo={onUndo} />
      </div>
      <ErrorNote error={problem || save.error} />
      <SavedNote save={save} pullRequestUrl={pullRequestUrl} />
    </>
  );
}

/** Puts the draft back to the saved genres; nothing while there's no change. */
function UndoButton({
  changed,
  disabled,
  onUndo,
}: {
  changed: boolean;
  disabled: boolean;
  onUndo: () => void;
}) {
  if (!changed) return null;
  return (
    <Button variant="outline" disabled={disabled} onClick={onUndo}>
      Undo changes
    </Button>
  );
}

/** That the genres were saved and wait for Commit, once they are. */
function SavedNote({ save, pullRequestUrl }: { save: GenreTreeSave; pullRequestUrl?: string }) {
  if (!save.isSuccess) return null;
  return (
    <SavedInApp what="the genres" pullRequestUrl={save.data.pullRequestUrl ?? pullRequestUrl} />
  );
}
