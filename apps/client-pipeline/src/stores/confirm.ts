import { create } from "zustand";

/** What the confirm dialog asks before something is lost or replaced. */
export interface ConfirmAsk {
  /** The dialog's title, a question such as "Remove the photo book “Seoul”?". */
  question: string;
  /** Under the question: what happens to what goes with it, or how to keep it, in a sentence or two. */
  note?: string;
  /** The button that goes ahead, such as "Remove book". */
  action: string;
  /** Shows the button in red, for something that can't be had back. Defaults to true. */
  destructive?: boolean;
}

interface ConfirmState {
  /** The question the dialog shows now, with how to answer it; null when none is open. */
  open: (ConfirmAsk & { answer: (yes: boolean) => void }) | null;
}

/** The one question the confirm dialog shows, shared so any page or handler can ask it. */
export const useConfirmStore = create<ConfirmState>()(() => ({ open: null }));

/**
 * Opens the confirm dialog and resolves true when its button is pressed, or false when it's
 * cancelled or closed. Asking again while a question is open answers that one with false. Use it
 * in place of the browser's `window.confirm`.
 */
export function askFirst(ask: ConfirmAsk): Promise<boolean> {
  useConfirmStore.getState().open?.answer(false);
  return new Promise((resolve) => {
    const answer = (yes: boolean) => {
      useConfirmStore.setState({ open: null });
      resolve(yes);
    };
    useConfirmStore.setState({ open: { ...ask, answer } });
  });
}
