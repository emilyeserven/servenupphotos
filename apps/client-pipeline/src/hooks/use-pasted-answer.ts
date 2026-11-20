import { useRef, useState } from "react";
import { settleAnswer } from "@/lib/pasted-json";

/** An answer box's state, from `usePastedAnswer`, for `PasteAnswer` and the review under it. */
export interface PastedAnswer<T> {
  /** The text in the box. */
  typed: string;
  setTyped: (typed: string) => void;
  /** The answer read from the box at the last review, or null before one or when it failed. */
  answer: T | null;
  /** Why the last review couldn't read the answer, or null. */
  error: Error | null;
  /** True while a review that asks the backend is waiting for it. */
  pending: boolean;
  /** How many reviews there have been: key the review with it so each one starts fresh. */
  reviews: number;
  /** Reads the box's text with `read`. */
  review: () => void;
  /** Empties the box and drops the answer, such as once it's been used. */
  clear: () => void;
}

/**
 * The box an LLM's answer is pasted into, and the answer read from it with `read` when it's
 * reviewed, or the error saying why it couldn't be. `read` either reads the text in the browser
 * (with `readPastedObject`) or asks the backend for a preview, such as a mutation's `mutateAsync`.
 * Every answer box holds its answer with this and shows it with `PasteAnswer`.
 */
export function usePastedAnswer<T>(read: (typed: string) => T | Promise<T>): PastedAnswer<T> {
  const [typed, setTyped] = useState("");
  const [answer, setAnswer] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [pending, setPending] = useState(false);
  const [reviews, setReviews] = useState(0);
  // Only the latest review's answer is kept, when an earlier one asking the backend comes back late.
  const latest = useRef(0);
  const review = () => {
    const asked = ++latest.current;
    setPending(true);
    void settleAnswer(read, typed).then((outcome) => {
      if (asked !== latest.current) return;
      setPending(false);
      setAnswer(outcome.answer);
      setError(outcome.error);
      if (outcome.answer !== null) setReviews((n) => n + 1);
    });
  };
  const clear = () => {
    latest.current += 1;
    setTyped("");
    setAnswer(null);
    setError(null);
    setPending(false);
  };
  return { typed, setTyped, answer, error, pending, reviews, review, clear };
}
