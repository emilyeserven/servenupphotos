import { useState } from "react";
import { ErrorNote } from "@/components/error-note";
import { Input } from "@/components/ui/input";
import type { PageBudget, PhotoBook } from "@/lib/photo-book";
import { MAX_BUDGET_PAGES, budgetText, readBudget } from "@/lib/photo-book-budget";

/**
 * The book's **Page budget** on its Info tab: the Target and Max page counts, each saved as it's
 * typed; an empty box isn't set. The Book tab shows the pages placed against them.
 */
export function BudgetFields({
  book,
  onChange,
}: {
  book: PhotoBook;
  onChange: (b: PhotoBook) => void;
}) {
  const [text, setText] = useState(() => budgetText(book.budget));
  const type = (field: "target" | "max", value: string) => {
    const next = { ...text, [field]: value };
    setText(next);
    const budget = readBudget(next.target, next.max);
    if (typeof budget !== "string") onChange({ ...book, budget });
  };
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">Page budget</legend>
      <div className="flex flex-wrap items-end gap-3">
        <BudgetBox label="Target" value={text.target} onType={(v) => type("target", v)} />
        <BudgetBox label="Max" value={text.max} onType={(v) => type("max", v)} />
      </div>
      <BudgetHint read={readBudget(text.target, text.max)} />
    </fieldset>
  );
}

/** One page count box of the budget. */
function BudgetBox(props: { label: string; value: string; onType: (value: string) => void }) {
  const { label, value, onType } = props;
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span>{label}</span>
      <Input
        type="number"
        min={0}
        max={MAX_BUDGET_PAGES}
        step={1}
        inputMode="numeric"
        value={value}
        onChange={(event) => onType(event.target.value)}
        className="w-28"
      />
    </label>
  );
}

/** Under the boxes: why the budget typed can't be saved, or what it counts. */
function BudgetHint({ read }: { read: PageBudget | undefined | string }) {
  if (typeof read === "string") return <ErrorNote error={read} className="text-xs" />;
  return (
    <p className="text-muted-foreground text-xs">
      Printed pages, a spread counting as two. The Book tab shows how close the pages placed are to
      each; leave a box empty to not set it.
    </p>
  );
}
