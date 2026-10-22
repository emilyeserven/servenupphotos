import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ScriptDisplayProvider } from "@/components/script-display-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { routeTree } from "./routeTree.gen";
import "./styles.css";

const queryClient = new QueryClient();

const router = createRouter({
  routeTree,
  basepath: import.meta.env.BASE_URL,
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
    <ThemeProvider>
      <ScriptDisplayProvider>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </ScriptDisplayProvider>
    </ThemeProvider>
  </StrictMode>,
);
