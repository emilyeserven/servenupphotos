import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";
import { type KeyboardEvent, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface ComboboxOption {
  value: string;
  label: string;
  /** A second line under the label, such as where an album sits. */
  detail?: string;
  /** More text to match what's typed against, not shown, such as a name in another script. */
  keywords?: string;
}

interface ComboboxProps {
  id?: string;
  options: ComboboxOption[];
  /** The chosen options' values, in the order they were chosen. */
  value: string[];
  onChange: (value: string[]) => void;
  /** Lets several options be chosen; otherwise choosing one replaces the last. */
  multiple?: boolean;
  placeholder?: string;
  /** Shown in the list when nothing matches what's typed. */
  emptyText?: string;
  disabled?: boolean;
  "aria-describedby"?: string;
  "aria-labelledby"?: string;
  /** Read out for the remove button on a chip whose value isn't one of the options. */
  unknownLabel?: (value: string) => string;
  /**
   * Offers what's typed as a new option, last in the list, when no option has it as its label; the
   * function says what the offer reads, such as `Add “Gyeongbokgung” as a place`. Choosing it calls
   * `onCreate` with the text.
   */
  createLabel?: (text: string) => string;
  onCreate?: (text: string) => void;
}

/** The value of the option that offers what's typed as a new one. */
export const CREATE_VALUE = "\u0000create";

/**
 * A text box that filters a list of options to choose from, showing each chosen one as a chip with
 * a button to remove it. A chosen value that isn't one of the options shows as a red chip, so it
 * can be seen and removed. Arrow keys move through the list, Enter chooses, Escape closes it, and
 * Backspace in an empty box removes the last chip.
 */
export function Combobox({
  id,
  options,
  value,
  onChange,
  multiple = false,
  placeholder,
  emptyText = "Nothing matches.",
  disabled = false,
  unknownLabel = (v) => `${v}, which isn't one of the options`,
  createLabel,
  onCreate,
  ...aria
}: ComboboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listId = `${inputId}-list`;
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const byValue = new Map(options.map((option) => [option.value, option]));
  const shown = withCreate(filterOptions(options, query), options, query, createLabel);
  const activeIndex = Math.min(active, shown.length - 1);
  const optionId = (index: number) => `${inputId}-option-${index}`;

  const choose = (option: ComboboxOption) => {
    if (option.value === CREATE_VALUE) {
      onCreate?.(query.trim());
    } else if (value.includes(option.value)) {
      if (multiple) onChange(value.filter((v) => v !== option.value));
    } else {
      onChange(multiple ? [...value, option.value] : [option.value]);
    }
    setQuery("");
    if (!multiple) setOpen(false);
  };
  const remove = (removed: string) => {
    onChange(value.filter((v) => v !== removed));
    input.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const move = (by: number) => {
      event.preventDefault();
      setOpen(true);
      if (open && shown.length > 0) setActive((activeIndex + by + shown.length) % shown.length);
    };
    switch (event.key) {
      case "ArrowDown":
        return move(1);
      case "ArrowUp":
        return move(-1);
      case "Enter":
        if (open && shown[activeIndex]) {
          event.preventDefault();
          choose(shown[activeIndex]);
        }
        return;
      case "Escape":
        if (open) {
          event.preventDefault();
          setOpen(false);
        }
        return;
      case "Backspace":
        if (!query && value.length > 0) remove(value[value.length - 1]!);
        return;
    }
  };

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      {/* Clicking around the chips focuses the text box, as if it filled the field. */}
      <div
        className={cn(
          "border-input dark:bg-input/30 flex min-h-9 w-full cursor-text flex-wrap items-center gap-1 rounded-md border bg-transparent py-1 pr-8 pl-1.5 shadow-xs transition-[color,box-shadow]",
          "focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
          disabled && "pointer-events-none cursor-not-allowed opacity-50",
        )}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            event.preventDefault();
            input.current?.focus();
            setOpen(true);
          }
        }}
      >
        {value.map((v) => (
          <Chip
            key={v}
            label={byValue.get(v)?.label ?? v}
            known={byValue.has(v)}
            removeLabel={
              byValue.has(v) ? `Remove ${byValue.get(v)!.label}` : `Remove ${unknownLabel(v)}`
            }
            disabled={disabled}
            onRemove={() => remove(v)}
          />
        ))}
        <input
          ref={input}
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && shown[activeIndex] ? optionId(activeIndex) : undefined}
          aria-describedby={aria["aria-describedby"]}
          aria-labelledby={aria["aria-labelledby"]}
          autoComplete="off"
          disabled={disabled}
          value={query}
          placeholder={value.length === 0 ? placeholder : undefined}
          className="placeholder:text-muted-foreground h-7 min-w-24 flex-1 bg-transparent px-1.5 text-base outline-none md:text-sm"
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
      </div>
      <ChevronDownIcon
        className="text-muted-foreground pointer-events-none absolute top-2.5 right-2.5 size-4"
        aria-hidden
      />
      <ul
        id={listId}
        role="listbox"
        aria-multiselectable={multiple || undefined}
        hidden={!open}
        className="bg-popover text-popover-foreground absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border p-1 shadow-md"
      >
        {shown.length === 0 ? (
          <li className="text-muted-foreground px-2 py-1.5 text-sm">{emptyText}</li>
        ) : (
          shown.map((option, index) => {
            const selected = value.includes(option.value);
            return (
              <li
                key={option.value}
                id={optionId(index)}
                role="option"
                aria-selected={selected}
                className={cn(
                  "flex cursor-pointer items-start gap-2 rounded-sm px-2 py-1.5 text-sm",
                  index === activeIndex && "bg-accent text-accent-foreground",
                )}
                // Keeps focus in the text box, so the list stays open for another choice.
                onMouseDown={(event) => event.preventDefault()}
                onMouseMove={() => setActive(index)}
                onClick={() => choose(option)}
              >
                <CheckIcon
                  className={cn("mt-0.5 size-4 shrink-0", !selected && "invisible")}
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
            );
          })
        )}
      </ul>
    </div>
  );
}

/** shown, with an offer to add query as a new option when it's not any option's label. */
export function withCreate(
  shown: ComboboxOption[],
  options: ComboboxOption[],
  query: string,
  createLabel: ((text: string) => string) | undefined,
): ComboboxOption[] {
  const text = query.trim();
  if (!createLabel || !text) return shown;
  const taken = options.some((option) => option.label.toLowerCase() === text.toLowerCase());
  return taken ? shown : [...shown, { value: CREATE_VALUE, label: createLabel(text) }];
}

/** The options whose label, value, detail or keywords contain every word of query, ignoring case. */
export function filterOptions(options: ComboboxOption[], query: string): ComboboxOption[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return options;
  return options.filter((option) => {
    const text =
      `${option.label} ${option.value} ${option.detail ?? ""} ${option.keywords ?? ""}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}

interface ChipProps {
  label: string;
  /** False when the value isn't one of the options. */
  known: boolean;
  removeLabel: string;
  disabled: boolean;
  onRemove: () => void;
}

function Chip({ label, known, removeLabel, disabled, onRemove }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex h-7 max-w-full items-center gap-1 rounded-md border pr-0.5 pl-2 text-xs font-medium",
        known
          ? "bg-secondary text-secondary-foreground"
          : "border-destructive/40 bg-destructive/10 text-destructive",
      )}
      title={known ? label : `${label}: not found`}
    >
      <span className="truncate">{label}</span>
      <button
        type="button"
        aria-label={removeLabel}
        disabled={disabled}
        className="hover:bg-foreground/10 focus-visible:ring-ring/50 rounded-sm p-0.5 outline-none focus-visible:ring-[3px]"
        onClick={onRemove}
      >
        <XIcon className="size-3.5" aria-hidden />
      </button>
    </span>
  );
}
