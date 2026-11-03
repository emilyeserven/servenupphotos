import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PLACEHOLDERS } from "@/lib/caption-template";

/** The placeholders a template can use, each a button that puts it in the template. */
export function PlaceholderList({ onInsert }: { onInsert: (placeholder: string) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Placeholders</CardTitle>
        <CardDescription>
          Click one to put it in the template. Any other field of the photo JSON with text or a
          number works too, such as {"{customCity}"} or {"{createDate}"}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          {PLACEHOLDERS.map(({ names, help }) => (
            <div key={names[0]} className="contents">
              <dt className="flex flex-wrap items-start gap-1">
                {names.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="bg-muted hover:bg-accent rounded px-1.5 py-0.5 font-mono text-xs"
                    onClick={() => onInsert(`{${name}}`)}
                  >
                    {`{${name}}`}
                  </button>
                ))}
              </dt>
              <dd className="text-muted-foreground">{help}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
