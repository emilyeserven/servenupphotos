import { FloatingAction } from "@/components/floating-actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface FloatingSaveButtonProps {
  /** The ID of the form it submits. */
  form: string;
  disabled: boolean;
  busy: boolean;
}

/** Save, floated at the top right as the rightmost button, submitting the form on the page. */
export function FloatingSaveButton({ form, disabled, busy }: FloatingSaveButtonProps) {
  return (
    <FloatingAction>
      <Button type="submit" form={form} className="h-9 rounded-full shadow-md" disabled={disabled}>
        {busy && <Spinner />}
        Save
      </Button>
    </FloatingAction>
  );
}
