import { PenLine } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Names the line a hop rode by hand, for one no source has, such as a local bus: a name field and a
 * button that uses it.
 */
export function NamedLine({ onName }: { onName: (name: string) => void }) {
  const [name, setName] = useState("");
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) onName(name);
  };
  return (
    <form className="flex flex-wrap items-center gap-2 text-sm" onSubmit={submit}>
      <span className="text-muted-foreground">Or name it yourself:</span>
      <Input
        value={name}
        placeholder="Super HAGI"
        aria-label="The line's name"
        className="h-8 w-48"
        onChange={(e) => setName(e.target.value)}
      />
      <Button type="submit" variant="outline" size="sm" disabled={!name.trim()}>
        <PenLine aria-hidden />
        Use this name
      </Button>
    </form>
  );
}
