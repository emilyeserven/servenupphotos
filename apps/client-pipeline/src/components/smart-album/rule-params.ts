import { useNavigate, useSearch } from "@tanstack/react-router";
import { parseSmartRules, SMART_RULE_KEYS, type SmartRules } from "@portfolio/lib/smart-albums";

/** The search params with every Smart Album rule cleared. */
function withoutRules(search: Record<string, unknown>): Record<string, unknown> {
  return { ...search, ...Object.fromEntries(SMART_RULE_KEYS.map((key) => [key, undefined])) };
}

/**
 * The Smart Album rules being edited, which live in the album page's URL under the portfolio Grid's
 * own names (`?tag=night`, `?orientation=vertical`, `?label=japan-2026-09-22`), so the Grid's
 * filters set them as they would on the Gallery. `start` puts saved rules in the URL to edit them,
 * `set` changes some, and `clear` takes them all out again.
 */
export function useRuleParams() {
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const navigate = useNavigate();
  const go = (next: (prev: Record<string, unknown>) => Record<string, unknown>) =>
    void navigate({ to: ".", search: next, replace: true, resetScroll: false });
  return {
    draft: parseSmartRules(search),
    start: (saved: SmartRules = {}) => go((prev) => ({ ...withoutRules(prev), ...saved })),
    set: (rules: SmartRules) => go((prev) => ({ ...prev, ...rules })),
    clear: () => go(withoutRules),
  };
}

/** The rules being edited, and how to change them. */
export type RuleParams = ReturnType<typeof useRuleParams>;
