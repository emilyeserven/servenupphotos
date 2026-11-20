---
paths:
  - "apps/client-pipeline/src/**"
---

# Saved and asking first

After a save, say it waits for Commit, never that it's on GitHub or in the pull request: `SaveState` ("Saving…", "Saved for Commit") on a page that saves as you type, and `SavedInApp` (or a sentence ending in `WaitingForCommit`, `components/waiting-for-commit.tsx`) after a button save. Ask before losing or replacing work with `await askFirst({ question, note, action })` (`stores/confirm.ts`), or `ConfirmDeleteCard` for a delete that runs inside its dialog; never `window.confirm`, `alert` or `prompt` (oxlint `no-alert`). See [What a page says after a save](../../docs/pending-changes.md#what-a-page-says-after-a-save).
