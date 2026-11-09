import { type UseMutationResult } from "@tanstack/react-query";
import { type ConnectionTestResult, type SettingsResponse } from "@/api/settings";
import { ConnectionStatus, toTestState } from "@/components/connection-status";
import { type SectionConfig } from "@/components/settings/sections";
import { type FormValues, type SettingsForm } from "@/components/settings/use-settings-form";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface SettingsActionsProps {
  form: SettingsForm;
  config: SectionConfig;
  save: UseMutationResult<SettingsResponse, Error, FormValues>;
  test: UseMutationResult<ConnectionTestResult, Error, FormValues>;
}

/** A Settings card's Save button, its Test connection button when the section has one, and what the last save did. */
export function SettingsActions({ form, config, save, test }: SettingsActionsProps) {
  return (
    <div className="flex items-center gap-3">
      <form.Subscribe selector={(state) => state.canSubmit && state.isDirty}>
        {(canSubmit) => (
          <Button type="submit" disabled={!canSubmit || save.isPending}>
            {save.isPending && <Spinner />}
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        )}
      </form.Subscribe>
      {config.test && (
        <>
          <Button
            type="button"
            variant="outline"
            disabled={test.isPending}
            onClick={() => test.mutate(form.state.values)}
          >
            Test connection
          </Button>
          <ConnectionStatus state={toTestState(test)} />
        </>
      )}
      <SaveStatus isSuccess={save.isSuccess} error={save.error} />
    </div>
  );
}

function SaveStatus({ isSuccess, error }: { isSuccess: boolean; error: Error | null }) {
  if (error) return <p className="text-destructive text-sm">{error.message}</p>;
  if (isSuccess) return <p className="text-muted-foreground text-sm">Saved.</p>;
  return null;
}
