# Shared files

Many pull requests are open at once, and two that add a line at the same spot of one file can't both merge. So add a file, not a line:

- A convention is a new file in `.claude/rules/`, with a `paths:` list at its top when it only matters for some folders. `CLAUDE.md` holds only what rarely changes.
- A lint rule is a new file in `scripts/lint/rules/` (`.claude/rules/lint-rules.md`).
- A check is a new file in `scripts/checks/`, which `pnpm check` and CI run on their own.
- A doc is a new file in `docs/`, with no line anywhere listing it.
- No markdown tables in `CLAUDE.md` or `.claude/rules/`: the formatter re-pads every row when one cell changes. Write a list, one entry per line. `pnpm check instructions` fails on one, and on a `CLAUDE.md` over 90 lines.
- Don't wrap paragraphs by hand in markdown. One paragraph or list item is one line, so changing a sentence changes one line; `pnpm fmt` joins a wrapped one (`proseWrap` in `.oxfmtrc.json`).
- When a list in a shared file has to grow, put the new line where it belongs in the list's order, not at the end.
