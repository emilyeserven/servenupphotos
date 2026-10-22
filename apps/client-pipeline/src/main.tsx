import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useCombinedDataStore } from "@/stores/combined-data";
import { routeTree } from "./routeTree.gen";
import "./styles.css";

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      /**
       * Whether a successful mutation pushed to the photo data pull request, so CI rebuilds
       * ALLPHOTOS.json, ALLALBUMS.json and ALLTAGS.json. A function decides from the result.
       */
      pushes?: boolean | ((result: unknown) => boolean);
    };
  }
}

const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: (result, _variables, _context, mutation) => {
      const pushes = mutation.meta?.pushes;
      if (typeof pushes === "function" ? pushes(result) : pushes) {
        useCombinedDataStore.getState().afterPush();
      }
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

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element #root not found");

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
