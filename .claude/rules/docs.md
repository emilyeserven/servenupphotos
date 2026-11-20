# Docs

A change in behavior updates its `docs/<feature>.md`. A new feature gets a new `docs/<feature>.md` that starts with its title, a blank line, then a sentence saying what the feature is and where it lives (`pnpm check docs` fails without it). No list names the docs, so nothing else changes. Only touch the README itself for setup, commands or deployment. Docs explain backend ideas with a short "> **Frontend analogy:**" note, since the owner is a frontend engineer.
