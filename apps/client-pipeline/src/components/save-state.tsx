/** Whether a page's last change is saved for Commit, being saved, or failed to save and why. */
export function SaveState({ saving, error }: { saving: boolean; error: Error | null }) {
  if (error) return <span className="text-destructive text-xs">{error.message}</span>;
  return (
    <span className="text-muted-foreground text-xs" aria-live="polite">
      {saving ? "Saving…" : "Saved for Commit"}
    </span>
  );
}
