# Docs

A change in behavior updates its `docs/<feature>.md`. A new feature gets a new `docs/` file and one line in the README's **Features** list (`pnpm check` fails on a doc missing from it or a link to a missing doc). Only touch the README itself for setup, commands or deployment. Docs explain backend ideas with a short "> **Frontend analogy:**" note, since the owner is a frontend engineer.
