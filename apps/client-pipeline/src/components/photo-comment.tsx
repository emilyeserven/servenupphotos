import Markdown from "react-markdown";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

/** Spacing and list, link, code and quote styles for rendered Markdown, which Tailwind's reset strips. */
const MARKDOWN_CLASSES = [
  "text-sm break-words [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
  "[&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
  "[&_h1]:my-2 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:my-2 [&_h2]:font-semibold [&_h3]:my-2 [&_h3]:font-medium",
  "[&_a]:underline [&_a]:underline-offset-4 [&_hr]:my-3",
  "[&_code]:bg-muted [&_code]:rounded [&_code]:px-1 [&_code]:font-mono [&_pre]:bg-muted [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:p-3",
  "[&_blockquote]:text-muted-foreground [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:pl-3",
].join(" ");

interface PhotoCommentCardProps {
  value: string;
  onChange: (value: string) => void;
  /** The JSON has been saved with this comment, so changing it would no longer change the file. */
  saved: boolean;
}

/** An optional Markdown note about the photo, saved as the JSON's "comment". */
export function PhotoCommentCard({ value, onChange, saved }: PhotoCommentCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Comment</CardTitle>
        <CardDescription>
          {saved
            ? "Saved with the photo's JSON."
            : "Optional. Written in Markdown and saved as the JSON's comment when you save to GitHub."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="write">
          <TabsList>
            <TabsTrigger value="write">Write</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
          </TabsList>
          <TabsContent value="write">
            <Textarea
              aria-label="Comment, in Markdown"
              placeholder="What's the story behind this photo? **Markdown** works here."
              className="max-h-96 min-h-28"
              value={value}
              disabled={saved}
              onChange={(event) => onChange(event.target.value)}
            />
          </TabsContent>
          <TabsContent value="preview">
            <div className="min-h-28 rounded-md border px-3 py-2">
              {value.trim() ? (
                <div className={MARKDOWN_CLASSES}>
                  <Markdown
                    components={{
                      a: ({ node: _node, ...props }) => (
                        <a {...props} target="_blank" rel="noreferrer" />
                      ),
                    }}
                  >
                    {value}
                  </Markdown>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Nothing to preview yet.</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
