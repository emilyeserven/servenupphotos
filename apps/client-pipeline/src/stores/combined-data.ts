import { useEffect } from "react";
import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { type CombinedData, type InFlightPullRequest, readCombinedData } from "@/api/photos";

/**
 * ALLPHOTOS.json, ALLALBUMS.json and ALLTAGS.json, read once and kept for every page. They only
 * change when CI rebuilds them after a push to the photo data pull request, or when that pull
 * request is merged, so they're read again only then: after a save that pushes, once CI's
 * "Combine photo data" run finishes (see `CombinedDataSync`), or when Photos in Flight sees the
 * pull request at a head the store didn't read it at.
 */
interface CombinedDataState {
  /** `idle` until a page asks for the lists. */
  status: "idle" | "loading" | "ready" | "error";
  data?: CombinedData;
  error?: Error;
  /** True while a read is going, including a refresh that keeps the last data showing. */
  fetching: boolean;
  /** True after a push, until CI's rebuild after it finishes and the lists are read again. */
  awaitingRebuild: boolean;
  /** How many pushes there have been, so `CombinedDataSync` can follow each one. */
  pushes: number;
  /** The pull request head a refresh was last asked for, so a mismatch is only acted on once. */
  syncedHead?: string;
  /** Reads the lists, unless they've been read or are being read. */
  load: () => Promise<void>;
  /** Reads the lists again, keeping the ones there are until the new ones arrive. */
  refresh: () => Promise<void>;
  /** Notes a push to the photo data pull request; the lists are read again once CI rebuilds them. */
  afterPush: () => void;
  /** Reads the lists again now that CI has rebuilt them. */
  rebuilt: () => void;
  /** Reads the lists again when the pull request isn't the one, at the head, they were read at. */
  syncPullRequest: (pullRequest: InFlightPullRequest | null) => void;
  /** Forgets the lists, as when Settings point at another repository. */
  reset: () => void;
}

function headOf(pullRequest: InFlightPullRequest | null | undefined): string {
  return pullRequest?.headSha ?? "none";
}

/** Whether the lists are read and nothing is about to change them. */
function isSettled(state: CombinedDataState): boolean {
  // While CI rebuilds, the head moves on its own; the lists are read once it's done.
  return state.status === "ready" && !state.fetching && !state.awaitingRebuild;
}

/** Whether the lists were read at head, or a read for it was already asked for. */
function isCurrent(state: CombinedDataState, head: string): boolean {
  return head === headOf(state.data?.head?.pullRequest) || head === state.syncedHead;
}

/**
 * The pull request head to read the lists again for, or undefined when they were read at it, it
 * was already asked for, or a read or rebuild is going.
 */
function staleHead(
  state: CombinedDataState,
  pullRequest: InFlightPullRequest | null,
): string | undefined {
  const head = headOf(pullRequest);
  return isSettled(state) && !isCurrent(state, head) ? head : undefined;
}

/** Counts reads, so one that finishes after a newer one started, or after a reset, is dropped. */
let latestRead = 0;

export const useCombinedDataStore = create<CombinedDataState>()((set, get) => {
  const read = async () => {
    const id = ++latestRead;
    set((state) => ({ fetching: true, status: state.data ? state.status : "loading" }));
    try {
      const data = await readCombinedData();
      if (id === latestRead) set({ status: "ready", data, error: undefined, fetching: false });
    } catch (error) {
      if (id !== latestRead) return;
      set((state) => ({
        // A failed refresh keeps the lists it had.
        status: state.data ? "ready" : "error",
        error: error instanceof Error ? error : new Error(String(error)),
        fetching: false,
      }));
    }
  };

  return {
    status: "idle",
    fetching: false,
    awaitingRebuild: false,
    pushes: 0,
    load: async () => {
      if (get().status === "idle") await read();
    },
    refresh: read,
    afterPush: () => set((state) => ({ awaitingRebuild: true, pushes: state.pushes + 1 })),
    rebuilt: () => {
      set({ awaitingRebuild: false });
      void read();
    },
    syncPullRequest: (pullRequest) => {
      const head = staleHead(get(), pullRequest);
      if (head === undefined) return;
      set({ syncedHead: head });
      void read();
    },
    reset: () => {
      latestRead++;
      set({ status: "idle", data: undefined, error: undefined, fetching: false });
    },
  };
});

/** The combined lists, read the first time a page asks for them and kept after that. */
export function useCombinedData(enabled = true) {
  const state = useCombinedDataStore(
    useShallow(({ status, data, error, fetching }) => ({ status, data, error, fetching })),
  );
  const load = useCombinedDataStore((s) => s.load);
  useEffect(() => {
    if (enabled && state.status === "idle") void load();
  }, [enabled, state.status, load]);
  return {
    ...state,
    /** True until the lists are first read, or fail to be. */
    isPending: state.status === "idle" || state.status === "loading",
  };
}
