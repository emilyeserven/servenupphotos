import { useEffect, useMemo } from "react";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import {
  type CombinedCommit,
  type CombinedData,
  type CombinedStatus,
  commitCombined,
  type InFlightPullRequest,
  readCombinedData,
} from "@/api/photos";
import { type FileChange, withChanges } from "@/lib/optimistic";

/**
 * ALLPHOTOS.json, ALLALBUMS.json and ALLTAGS.json, read once and kept for every page. They're only
 * rebuilt when committed by hand (see `commit`), so pushes to the photo data pull request don't
 * change them: the store keeps each push's changes instead, and pages see the lists with them made
 * (see `useCombinedData`), marked as not synced, until a commit that has them. The lists are read
 * again only then, when the app starts, when Photos in Flight sees another pull request than the
 * one they were read for, or on its Refresh.
 */
interface CombinedDataState {
  /** `idle` until a page asks for the lists. */
  status: "idle" | "loading" | "ready" | "error";
  /** The lists as read from GitHub, without the changes since. */
  data?: CombinedData;
  error?: Error;
  /** True while a read is going, including a refresh that keeps the last data showing. */
  fetching: boolean;
  /** The files pushes changed since the last commit, oldest first, made over `data` for pages. */
  changes: FileChange[];
  /** How many pushes since the last commit changed files the store can't make over `data`. */
  unknownChanges: number;
  /**
   * Whether the lists at the pull request's head have its latest changes, as last known: checked
   * when the app starts, `synced` after a commit, `stale` after a push.
   */
  headState?: CombinedStatus["state"];
  /** True while the lists are being committed. */
  committing: boolean;
  /** What the last commit did, or why it failed. */
  lastCommit?: CombinedCommit;
  commitError?: Error;
  /** The pull request number a read was last asked for, so a mismatch is only acted on once. */
  syncedPull?: number | null;
  /** Reads the lists, unless they've been read or are being read. */
  load: () => Promise<void>;
  /** Reads the lists again, keeping the ones there are until the new ones arrive. */
  refresh: () => Promise<void>;
  /**
   * Notes a push to the photo data pull request and the files it changed, when known; until the
   * lists are committed with them, pages see them made over the lists.
   */
  afterPush: (changes?: FileChange[]) => void;
  /** Notes whether the lists at the pull request's head were synced when the app started. */
  headChecked: (status: CombinedStatus) => void;
  /**
   * Rebuilds the lists from the pull request's data files and commits them, then reads them again
   * and drops the changes the commit has.
   */
  commit: () => Promise<void>;
  /** Reads the lists again when the pull request isn't the one they were read for. */
  syncPullRequest: (pullRequest: InFlightPullRequest | null) => void;
  /** Forgets the lists, as when Settings point at another repository. */
  reset: () => void;
}

/** What a commit leaves for the next read to drop, once it has the committed lists. */
interface Rebuilt {
  changes: number;
  unknownChanges: number;
}

function pullOf(data: CombinedData | undefined): number | null | undefined {
  return data && (data.head?.pullRequest.number ?? null);
}

/** Counts reads, so one that finishes after a newer one started, or after a reset, is dropped. */
let latestRead = 0;
/** The commit the next read that finishes includes, so its changes can go. */
let rebuilt: Rebuilt | undefined;

/**
 * The changes to keep over lists just read: without the ones a commit has, or none when
 * the pull request they were pushed to is gone, as after a merge. A pull request opened since the
 * last read was opened by those pushes, so it keeps them.
 */
function keptChanges(state: CombinedDataState, data: CombinedData, done: Rebuilt | undefined) {
  const before = pullOf(state.data);
  if (before && before !== pullOf(data))
    return { changes: [], unknownChanges: 0, headState: undefined };
  return withoutRebuilt(state, done);
}

/** Whether the lists should be read again for the pull request numbered number (null for none). */
function isOtherPull(state: CombinedDataState, number: number | null): boolean {
  if (state.status !== "ready" || state.fetching) return false;
  return number !== pullOf(state.data) && number !== state.syncedPull;
}

function startedRead(state: CombinedDataState) {
  return { fetching: true, status: state.data ? state.status : ("loading" as const) };
}

/** A failed read, which keeps the lists there were. */
function failedRead(state: CombinedDataState, error: unknown) {
  return {
    status: state.data ? ("ready" as const) : ("error" as const),
    error: errorOf(error),
    fetching: false,
  };
}

function errorOf(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/** state's changes without the ones a commit has. */
function withoutRebuilt(state: CombinedDataState, done: Rebuilt | undefined) {
  if (!done) return {};
  const changes = state.changes.slice(done.changes);
  const unknownChanges = Math.max(0, state.unknownChanges - done.unknownChanges);
  const left = changes.length > 0 || unknownChanges > 0;
  return { changes, unknownChanges, headState: left ? ("stale" as const) : ("synced" as const) };
}

export const useCombinedDataStore = create<CombinedDataState>()((set, get) => {
  const gotData = (data: CombinedData, done: Rebuilt | undefined) => {
    if (rebuilt === done) rebuilt = undefined;
    set((state) => ({
      status: "ready",
      data,
      error: undefined,
      fetching: false,
      ...keptChanges(state, data, done),
    }));
  };

  const read = async () => {
    const id = ++latestRead;
    const done = rebuilt;
    set(startedRead);
    const result = await readCombinedData().then(
      (data) => ({ data }),
      (error: unknown) => ({ error }),
    );
    // A read that finished after a newer one started, or after a reset, is dropped.
    if (id !== latestRead) return;
    if ("data" in result) gotData(result.data, done);
    else set((state) => failedRead(state, result.error));
  };

  return {
    status: "idle",
    fetching: false,
    changes: [],
    unknownChanges: 0,
    committing: false,
    load: async () => {
      if (get().status === "idle") await read();
    },
    refresh: read,
    afterPush: (changes) => {
      set((state) => ({
        changes: changes ? [...state.changes, ...changes] : state.changes,
        unknownChanges: state.unknownChanges + (changes ? 0 : 1),
        headState: "stale",
      }));
      // A push with no pull request open opened one, whose lists the changes are made over.
      const { status, data } = get();
      if (status === "ready" && !data?.head) void read();
    },
    headChecked: (status) => {
      // A push or commit since the check started knows better.
      if (get().headState === undefined) set({ headState: status.state });
    },
    commit: async () => {
      const { changes, unknownChanges } = get();
      set({ committing: true, commitError: undefined });
      try {
        const lastCommit = await commitCombined();
        rebuilt = { changes: changes.length, unknownChanges };
        set({ lastCommit });
        await read();
      } catch (error) {
        set({ commitError: errorOf(error) });
      } finally {
        set({ committing: false });
      }
    },
    syncPullRequest: (pullRequest) => {
      const number = pullRequest ? pullRequest.number : null;
      if (!isOtherPull(get(), number)) return;
      set({ syncedPull: number });
      void read();
    },
    reset: () => {
      latestRead++;
      rebuilt = undefined;
      set({
        status: "idle",
        data: undefined,
        error: undefined,
        fetching: false,
        changes: [],
        unknownChanges: 0,
        headState: undefined,
        committing: false,
        lastCommit: undefined,
        commitError: undefined,
        syncedPull: undefined,
      });
    },
  };
});

/**
 * Whether ALLPHOTOS.json, ALLALBUMS.json and ALLTAGS.json at the pull request's head are missing
 * changes pushed to it: ones pushed since the last commit, or found when the app started.
 */
function isUnsynced(state: CombinedDataState): boolean {
  return state.changes.length > 0 || state.unknownChanges > 0 || state.headState === "stale";
}

/** Where the lists stand against the pull request, for the pages that note it. */
export function useCombinedSync() {
  return useCombinedDataStore(
    useShallow((state) => ({
      unsynced: isUnsynced(state),
      changes: state.changes.length,
      unknownChanges: state.unknownChanges,
      headState: state.headState,
      committing: state.committing,
      lastCommit: state.lastCommit,
      commitError: state.commitError,
      commit: state.commit,
      pullRequest: state.data?.head?.pullRequest,
    })),
  );
}

/**
 * The combined lists, read the first time a page asks for them and kept after that. `data` has the
 * changes pushed since the last commit made over the lists at the pull request's head; `synced` is
 * the lists as GitHub has them.
 */
export function useCombinedData(enabled = true) {
  const state = useCombinedDataStore(
    useShallow(({ status, data, error, fetching, changes }) => ({
      status,
      synced: data,
      error,
      fetching,
      changes,
    })),
  );
  const load = useCombinedDataStore((s) => s.load);
  useEffect(() => {
    if (enabled && state.status === "idle") void load();
  }, [enabled, state.status, load]);
  const { synced, changes } = state;
  const data = useMemo(() => synced && withChanges(synced, changes), [synced, changes]);
  return {
    ...state,
    data,
    /** True until the lists are first read, or fail to be. */
    isPending: state.status === "idle" || state.status === "loading",
  };
}
