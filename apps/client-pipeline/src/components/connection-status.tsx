import { CheckIcon, XIcon } from "lucide-react";
import type { ConnectionTestResult } from "@/api/settings";
import { Spinner } from "@/components/ui/spinner";

/** Where a connection test stands: running, finished, or not run yet. */
export type TestState = "pending" | ConnectionTestResult | undefined;

export function toTestState({
  isPending,
  data,
  error,
}: {
  isPending: boolean;
  data: ConnectionTestResult | undefined;
  error: Error | null;
}): TestState {
  if (isPending) return "pending";
  if (error) return { ok: false, message: error.message };
  return data;
}

/** A spinner while a connection test runs, then a check or an X with the reason. */
export function ConnectionStatus({ state }: { state: TestState }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-1.5 text-sm">
      {state === "pending" ? <Spinner aria-label="Testing connection" /> : null}
      {typeof state === "object" ? <ConnectionResult result={state} /> : null}
    </div>
  );
}

function ConnectionResult({ result }: { result: ConnectionTestResult }) {
  if (!result.ok) {
    return (
      <>
        <XIcon className="text-destructive size-4 shrink-0" aria-label="Connection failed" />
        <span className="text-destructive">{result.message}</span>
      </>
    );
  }
  return (
    <>
      <CheckIcon
        className="size-4 shrink-0 text-green-600 dark:text-green-400"
        aria-label="Connected"
      />
      <span className="text-muted-foreground">{result.message}</span>
    </>
  );
}
