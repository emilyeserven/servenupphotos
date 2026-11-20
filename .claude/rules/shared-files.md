# Shared files

Many pull requests are open at once, and two that add a line at the same spot of one file can't both merge. So add a file, not a line:

- A convention is a new file in `.claude/rules/`, with a `paths:` list at its top when it only matters for some folders. `CLAUDE.md` holds only what rarely changes.
- No markdown tables in `CLAUDE.md` or `.claude/rules/`: the formatter re-pads every row when one cell changes. Write a list, one entry per line.
- Don't wrap paragraphs by hand in these files. One paragraph or list item is one line, so changing a sentence changes one line.
- When a list in a shared file has to grow, put the new line where it belongs in the list's order, not at the end.
