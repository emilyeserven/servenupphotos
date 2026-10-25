import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { cachedFile, type FileChange } from "@/lib/optimistic";
import { useCombinedDataStore } from "@/stores/combined-data";
import { syncTheme } from "@/stores/theme";
import { routeTree } from "./routeTree.gen";
import "./styles.css";

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      /**
       * Whether a successful mutation saved changes waiting for Commit, so ALLPHOTOS.json,
       * ALLALBUMS.json and ALLTAGS.json are missing them until Commit rebuilds them. A function
       * decides from the result.
       */
      saves?: boolean | ((result: unknown) => boolean);
      /**
       * The files a save changed, which pages see made over the combined lists until they're
       * committed; `cached` is a file's data as pages last read it. Without it, the changes only show
       * once they are.
       */
      changes?: (
        result: unknown,
        variables: unknown,
        cached: (path: string) => unknown,
      ) => FileChange[];
    };
  }
}

/** A file's data as pages last read it. */
function cached(path: string): unknown {
  return cachedFile(queryClient, path);
}

/** Whether a mutation with this `saves` meta saved changes waiting for Commit. */
function saved(saves: boolean | ((result: unknown) => boolean) | undefined, result: unknown) {
  return typeof saves === "function" ? saves(result) : Boolean(saves);
}

const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: (result, variables, _context, { meta = {} }) => {
      if (!saved(meta.saves, result)) return;
      useCombinedDataStore.getState().afterSave(meta.changes?.(result, variables, cached));
    },
  }),
});

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

syncTheme();

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element #root not found");

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
