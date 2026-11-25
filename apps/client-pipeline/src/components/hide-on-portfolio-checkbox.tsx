import { useId } from "react";

interface HideOnPortfolioCheckboxProps {
  /** Whether the new albums start hidden on the portfolio. */
  checked: boolean;
  disabled?: boolean;
  /** What's being saved, such as "the album" or "the new albums". */
  what: string;
  onChange: (checked: boolean) => void;
}

/**
 * The checkbox that saves new albums hidden on the portfolio from the start, for working albums
 * that shouldn't be on the website. An album's **On the portfolio** card shows it later.
 */
export function HideOnPortfolioCheckbox({
  checked,
  disabled,
  what,
  onChange,
}: HideOnPortfolioCheckboxProps) {
  const id = useId();
  return (
    <div className="flex items-start gap-2 text-sm">
      <input
        id={id}
        type="checkbox"
        className="accent-primary mt-0.5 size-4"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <label htmlFor={id}>
        Hide {what} on the portfolio
        <span className="text-muted-foreground block">
          A hidden album isn&apos;t on the portfolio&apos;s Albums page, album filter or its own
          page until you show it on its album page. Its photos still show everywhere else.
        </span>
      </label>
    </div>
  );
}
