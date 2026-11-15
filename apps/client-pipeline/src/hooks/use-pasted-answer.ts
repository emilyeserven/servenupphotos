import { useState } from "react";

/**
 * The box an LLM's answer is pasted into, and the answer read from it with `read` when it's
 * reviewed, or the error saying why it couldn't be. `reviews` counts the reviews, to key the
 * review so each one starts fresh.
 */
export function usePastedAnswer<T>(read: (typed: string) => T) {
  const [typed, setTyped] = useState("");
  const [answer, setAnswer] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviews, setReviews] = useState(0);
  const review = () => {
    try {
      setAnswer(read(typed));
      setReviews((n) => n + 1);
      setError(null);
    } catch (problem) {
      setAnswer(null);
      setError(problem instanceof Error ? problem.message : String(problem));
    }
  };
  return { typed, setTyped, answer, error, reviews, review };
}
