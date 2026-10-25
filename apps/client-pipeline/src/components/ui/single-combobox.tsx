import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";
import { type KeyboardEvent, useId, useRef, useState } from "react";
import {
  CREATE_VALUE,
  type ComboboxOption,
  filterOptions,
  withCreate,
} from "@/components/ui/combobox";
import { cn } from "@/lib/utils";

interface SingleComboboxProps {
  id?: string;
  options: ComboboxOption[];
  /** The chosen option's value, or "" for none. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Shown in the list when nothing matches what's typed. */
  emptyText?: string;
  disabled?: boolean;
  "aria-labelledby"?: string;
  /**
   * Offers what's typed as a new option, last in the list, when no option has it as its label; the
   * function says what the offer reads. Choosing it calls `onCreate` with the text.
   */
  createLabel?: (text: string) => string;
  onCreate?: (text: string) => void;
}

/**
 * A text box that shows the one chosen option and, while typing, filters a list to choose another
 * from. Arrow keys move through the list, Enter chooses, Escape puts back the chosen one, and the
 * clear button chooses none. A value that isn't one of the options shows in red.
 */
export function SingleCombobox({
  id,
  options,
  value,
  onChange,
  placeholder,
  emptyText = "Nothing matches.",
  disabled = false,
  createLabel,
  onCreate,
  ...aria
}: SingleComboboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listId = `${inputId}-list`;
  const input = useRef<HTMLInputElement>(null);
  // What's typed while choosing; null until something is, so the box shows the chosen option.
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const chosen = options.find((option) => option.value === value);
  const shownText = query ?? chosen?.label ?? value;
  const shown = withCreate(filterOptions(options, query ?? ""), options, query ?? "", createLabel);
  const activeIndex = Math.min(active, shown.length - 1);
  const optionId = (index: number) => `${inputId}-option-${index}`;

  const close = () => {
    setOpen(false);
    setQuery(null);
  };
  const choose = (option: ComboboxOption) => {
    if (option.value === CREATE_VALUE) onCreate?.((query ?? "").trim());
    else onChange(option.value);
    close();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const keys: Record<string, () => void> = {
      ArrowDown: () => move(1),
      ArrowUp: () => move(-1),
      Enter: () => shown[activeIndex] && choose(shown[activeIndex]),
      Escape: close,
    };
    const action = open || event.key.startsWith("Arrow") ? keys[event.key] : undefined;
    if (!action) return;
    event.preventDefault();
    action();
  };
  const move = (by: number) => {
    if (!open) return setOpen(true);
    if (shown.length > 0) setActive((activeIndex + by + shown.length) % shown.length);
  };

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close();
      }}
    >
      <input
        ref={input}
        id={inputId}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && shown[activeIndex] ? optionId(activeIndex) : undefined}
        aria-labelledby={aria["aria-labelledby"]}
        aria-invalid={Boolean(value && !chosen) || undefined}
        autoComplete="off"
        disabled={disabled}
        value={shownText}
        placeholder={placeholder}
        className={cn(
          "bg-input/20 dark:bg-input/30 border-input placeholder:text-muted-foreground h-7 w-full min-w-0 rounded-md border py-0.5 pr-12 pl-2 text-sm transition-colors outline-none md:text-xs/relaxed",
          "focus-visible:border-ring focus-visible:ring-ring/30 focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
          value && !chosen && "text-destructive",
        )}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActive(0);
        }}
        // Typing starts from the chosen option's text, selected so it's replaced; the list shows all.
        onFocus={(event) => event.currentTarget.select()}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
      />
      <div className="absolute top-0 right-0 flex h-7 items-center gap-0.5 pr-2">
        {value && !disabled && (
          <button
            type="button"
            aria-label={`Clear ${chosen?.label ?? value}`}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/30 rounded-sm p-0.5 outline-none focus-visible:ring-2"
            onClick={() => {
              onChange("");
              input.current?.focus();
            }}
          >
            <XIcon className="size-3.5" aria-hidden />
          </button>
        )}
        <ChevronDownIcon
          className="text-muted-foreground pointer-events-none size-3.5"
          aria-hidden
        />
      </div>
      <ul
        id={listId}
        role="listbox"
        hidden={!open}
        className="bg-popover text-popover-foreground ring-foreground/10 absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-lg p-1 shadow-md ring-1"
      >
        {shown.length === 0 ? (
          <li className="text-muted-foreground px-2 py-1 text-xs/relaxed">{emptyText}</li>
        ) : (
          shown.map((option, index) => (
            <li
              key={option.value}
              id={optionId(index)}
              role="option"
              aria-selected={option.value === value}
              className={cn(
                "flex min-h-7 cursor-pointer items-start gap-2 rounded-md px-2 py-1 text-xs/relaxed",
                index === activeIndex && "bg-accent text-accent-foreground",
              )}
              // Keeps focus in the text box until the choice is made.
              onMouseDown={(event) => event.preventDefault()}
              onMouseMove={() => setActive(index)}
              onClick={() => choose(option)}
            >
              <CheckIcon
                className={cn("mt-1 size-3.5 shrink-0", option.value !== value && "invisible")}
                aria-hidden
              />
              <span className="min-w-0">
                <span className="block truncate">{option.label}</span>
                {option.detail && (
                  <span className="text-muted-foreground block truncate text-xs">
                    {option.detail}
                  </span>
                )}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
