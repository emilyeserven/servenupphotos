import type { ComponentProps } from "react";
import Markdown, { type ExtraProps } from "react-markdown";
import remarkBreaks from "remark-breaks";
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

/** The photo's title, place name and Markdown comment as typed; empty when there's none. */
export interface PhotoDetails {
  title: string;
  placeName: string;
  comment: string;
}

/** No title, place name or comment, which a new photo starts with. */
export const NO_DETAILS: PhotoDetails = { title: "", placeName: "", comment: "" };

/** A file name without its extension, which the portfolio uses as the title of a photo without one. */
export function fileStem(file: string): string {
  return file.replace(/\.[^.]*$/, "");
}

/** The title, place name and comment saved in a photo's JSON, to start editing from. */
export function savedDetails(data: Record<string, unknown>): PhotoDetails {
  return {
    title: text(data.title),
    placeName: text(data.placeName),
    comment: text(data.comment),
  };
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * data with the title and comment, or null for ones left empty, as its first fields, and the place
 * name where data has it (before the country, as new photo files list it), or else last.
 */
export function withDetails<T extends object>(data: T, details: PhotoDetails) {
  const {
    title: _title,
    comment: _comment,
    ...rest
  } = data as T & {
    title?: unknown;
    comment?: unknown;
  };
  return {
    title: details.title.trim() || null,
    comment: details.comment.trim() || null,
    ...rest,
    // Setting a key the spread already added keeps it where it was.
    placeName: details.placeName.trim() || null,
  };
}

/** A link in the comment's preview, opened in a new tab so the page and its work stay put. */
function NewTabLink({ node: _node, ...props }: ComponentProps<"a"> & ExtraProps) {
  return <a {...props} target="_blank" rel="noreferrer" />;
}

interface PhotoDetailsCardProps {
  value: PhotoDetails;
  onChange: (value: PhotoDetails) => void;
  /** What the portfolio calls the photo without a title: its file name without the extension. */
  fallbackTitle: string;
  description: string;
  /** Saving is underway or done, so changing them now would not change the file. */
  disabled: boolean;
}

/**
 * The photo's optional title on the portfolio, place name and Markdown comment, saved as the JSON's
 * "title", "placeName" and "comment".
 */
export function PhotoDetailsCard({
  value,
  onChange,
  fallbackTitle,
  description,
  disabled,
}: PhotoDetailsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Title, place and comment</CardTitle>
        <CardDescription>{description}</CardDescription>
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
            disabled={disabled}
            aria-describedby="photo-title-hint"
            onChange={(event) => onChange({ ...value, title: event.target.value })}
          />
          <p id="photo-title-hint" className="text-muted-foreground text-sm">
            What the portfolio calls the photo. Without one, it uses the file name,{" "}
            <code>{fallbackTitle}</code>. Its JSON file is named after it too.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="photo-place-name" className="text-sm font-medium">
            Place name
          </label>
          <Input
            id="photo-place-name"
            placeholder="Such as Gyeongbokgung Palace"
            value={value.placeName}
            disabled={disabled}
            aria-describedby="photo-place-name-hint"
            onChange={(event) => onChange({ ...value, placeName: event.target.value })}
          />
          <p id="photo-place-name-hint" className="text-muted-foreground text-sm">
            Where the photo was taken, more exactly than its city. The portfolio shows it before the
            city, with the country under the GPS position on hover.
          </p>
        </div>
        <CommentField
          value={value.comment}
          disabled={disabled}
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
                <Markdown components={{ a: NewTabLink }} remarkPlugins={[remarkBreaks]}>
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
