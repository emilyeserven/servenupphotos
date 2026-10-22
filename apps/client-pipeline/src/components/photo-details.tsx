import Markdown from "react-markdown";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

export interface PhotoDetails {
  title: string;
  comment: string;
}

interface PhotoDetailsCardProps {
  value: PhotoDetails;
  onChange: (value: PhotoDetails) => void;
  /** What the portfolio calls the photo without a title: its file name without the extension. */
  fallbackTitle: string;
  /** The JSON has been saved with these, so changing them would no longer change the file. */
  saved: boolean;
}

/** The photo's optional title on the portfolio and Markdown comment, saved as the JSON's "title" and "comment". */
export function PhotoDetailsCard({ value, onChange, fallbackTitle, saved }: PhotoDetailsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Title and comment</CardTitle>
        <CardDescription>
          {saved
            ? "Saved with the photo's JSON."
            : "Both optional, and saved in the JSON when you save to GitHub."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label htmlFor="photo-title" className="text-sm font-medium">
            Title
          </label>
          <Input
            id="photo-title"
            placeholder={fallbackTitle}
            value={value.title}
            disabled={saved}
            aria-describedby="photo-title-hint"
            onChange={(event) => onChange({ ...value, title: event.target.value })}
          />
          <p id="photo-title-hint" className="text-muted-foreground text-sm">
            What the portfolio calls the photo. Without one, it uses the file name,{" "}
            <code>{fallbackTitle}</code>.
          </p>
        </div>
        <CommentField
          value={value.comment}
          disabled={saved}
          onChange={(comment) => onChange({ ...value, comment })}
        />
      </CardContent>
    </Card>
  );
}

interface CommentFieldProps {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

/** A Markdown note about the photo, with a tab to preview it rendered. */
function CommentField({ value, disabled, onChange }: CommentFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <span id="photo-comment-label" className="text-sm font-medium">
        Comment
      </span>
      <Tabs defaultValue="write">
        <TabsList>
          <TabsTrigger value="write">Write</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        <TabsContent value="write">
          <Textarea
            aria-labelledby="photo-comment-label"
            aria-describedby="photo-comment-hint"
            placeholder="What's the story behind this photo? **Markdown** works here."
            className="max-h-96 min-h-28"
            value={value}
            disabled={disabled}
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
      <p id="photo-comment-hint" className="text-muted-foreground text-sm">
        Written in Markdown.
      </p>
    </div>
  );
}
