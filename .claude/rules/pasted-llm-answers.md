---
paths:
  - "apps/client-pipeline/src/**"
  - "apps/be-pipeline/**"
---

# Pasted LLM answers

Every box that takes an LLM's answer is `PasteAnswer` (`components/paste-answer.tsx`) with its state from `usePastedAnswer`, and its review is keyed by `pasted.reviews`. Read the answer with `readPastedObject` / `readPastedList` (`lib/pasted-json.ts`) or Go's `parseLLMAnswer`, never `JSON.parse` (lint bans `parsePastedJson` elsewhere); match names in it with `matchName` (same rule in TS and Go); list names that match no photo with `UnknownPhotos` ([Pasting the answer](../../docs/copy-prompts.md#pasting-the-answer)).
