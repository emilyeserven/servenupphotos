import { Link } from "@tanstack/react-router";
import { CalendarIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { type ReactNode } from "react";
import { FieldLabel } from "@/components/field-label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  type SocialPostDraft,
  type SocialPostStatus,
  newSocialPost,
  parseHashtags,
  platformLabel,
  socialPlatforms,
} from "@/lib/social-posts";

interface SocialPostsCardProps {
  value: SocialPostDraft[];
  onChange: (value: SocialPostDraft[]) => void;
  /** The day the Instagram calendar has the photo scheduled for, as YYYY-MM-DD, or null. */
  calendarDate: string | null;
  /** Saving is underway, so changing them now would not change the file. */
  disabled: boolean;
}

/**
 * The photo's posts on social media, each with its platform, whether it's scheduled or posted, its
 * day, link, caption and hashtags, saved as the JSON's "socialPosts".
 */
export function SocialPostsCard({ value, onChange, calendarDate, disabled }: SocialPostsCardProps) {
  const update = (id: string, next: Partial<SocialPostDraft>) =>
    onChange(value.map((post) => (post.id === id ? { ...post, ...next } : post)));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Social media posts</CardTitle>
        <CardDescription>
          Where the photo is posted or scheduled to post. Saving changes writes them over the
          JSON&apos;s <code>socialPosts</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <CalendarNote date={calendarDate} />
        {value.length === 0 && <p className="text-muted-foreground text-sm">No posts yet.</p>}
        {value.map((post, index) => (
          <SocialPostFields
            key={post.id}
            post={post}
            number={index + 1}
            disabled={disabled}
            onChange={(next) => update(post.id, next)}
            onRemove={() => onChange(value.filter((p) => p.id !== post.id))}
          />
        ))}
        <Button
          variant="outline"
          className="self-start"
          disabled={disabled}
          onClick={() => onChange([...value, newSocialPost()])}
        >
          <PlusIcon />
          Add post
        </Button>
      </CardContent>
    </Card>
  );
}

/** The day the Instagram calendar has the photo on, which is set there rather than here. */
function CalendarNote({ date }: { date: string | null }) {
  if (!date) return null;
  return (
    <p className="text-muted-foreground flex items-center gap-2 text-sm">
      <CalendarIcon className="size-4 shrink-0" />
      <span>
        On the{" "}
        <Link to="/instagram" className="underline underline-offset-4">
          Instagram calendar
        </Link>{" "}
        for {date}.
      </span>
    </p>
  );
}

interface SocialPostFieldsProps {
  post: SocialPostDraft;
  /** The post's place in the list, counted from 1, for its heading. */
  number: number;
  disabled: boolean;
  onChange: (next: Partial<SocialPostDraft>) => void;
  onRemove: () => void;
}

/** One post's fields, with a button to take it out of the list. */
function SocialPostFields({ post, number, disabled, onChange, onRemove }: SocialPostFieldsProps) {
  const id = (field: string) => `${post.id}-${field}`;
  const input = (field: "url" | "hashtags") => ({
    id: id(field),
    value: post[field],
    disabled,
    onChange: (event: { target: { value: string } }) => onChange({ [field]: event.target.value }),
  });
  return (
    <div
      role="group"
      aria-labelledby={id("heading")}
      className="flex flex-col gap-4 rounded-md border p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <p id={id("heading")} className="text-sm font-medium">
          Post {number} · {platformLabel(post.platform)}
        </p>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={`Remove post ${number}`}
          disabled={disabled}
          onClick={onRemove}
        >
          <Trash2Icon />
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={id("platform")} label="Platform" help="Where it's posted.">
          <PlatformSelect
            id={id("platform")}
            value={post.platform}
            disabled={disabled}
            onChange={(platform) => onChange({ platform })}
          />
        </Field>
        <Field id={id("status")} label="Status" help="Scheduled until it's up, then posted.">
          <StatusSelect
            id={id("status")}
            value={post.status}
            disabled={disabled}
            onChange={(status) => onChange({ status })}
          />
        </Field>
        <Field
          id={id("date")}
          label="Date"
          help="The day it's posted, or scheduled to post. Saved as YYYY-MM-DD."
        >
          <Input
            id={id("date")}
            type="date"
            value={post.date}
            disabled={disabled}
            onChange={(event) => onChange({ date: event.target.value })}
          />
        </Field>
      </div>
      <Field id={id("url")} label="Link" help="The post's address, once it's up.">
        <Input type="url" placeholder="https://…" {...input("url")} />
      </Field>
      <Field id={id("caption")} label="Caption" help="The post's text, without its hashtags.">
        <Textarea
          id={id("caption")}
          rows={3}
          value={post.caption}
          disabled={disabled}
          onChange={(event) => onChange({ caption: event.target.value })}
        />
      </Field>
      <Field
        id={id("hashtags")}
        label="Hashtags"
        help="Separated by spaces or commas, with or without the #. Saved without it, such as streetphotography."
      >
        <Input placeholder="#streetphotography #nyc" {...input("hashtags")} />
        <HashtagCount typed={post.hashtags} />
      </Field>
    </div>
  );
}

/** How many hashtags the field holds, once it holds any. */
function HashtagCount({ typed }: { typed: string }) {
  const count = parseHashtags(typed).length;
  if (count === 0) return null;
  return (
    <p className="text-muted-foreground text-xs">
      {count} {count === 1 ? "hashtag" : "hashtags"}
    </p>
  );
}

interface FieldProps {
  id: string;
  label: string;
  help: string;
  children: ReactNode;
}

function Field({ id, label, help, children }: FieldProps) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <FieldLabel htmlFor={id} help={help}>
        {label}
      </FieldLabel>
      {children}
    </div>
  );
}

const SELECT_CLASSES = cn(
  "border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs",
  "focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px] disabled:opacity-50",
);

interface SelectProps<T extends string> {
  id: string;
  value: T;
  disabled: boolean;
  onChange: (value: T) => void;
}

/** The listed platforms, and the post's own when it's one that isn't listed, such as one typed in the JSON. */
function platformOptions(current: string) {
  const listed = socialPlatforms.some((platform) => platform.id === current);
  return listed ? socialPlatforms : [...socialPlatforms, { id: current, label: current }];
}

function PlatformSelect({ id, value, disabled, onChange }: SelectProps<string>) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className={SELECT_CLASSES}
    >
      {platformOptions(value).map((platform) => (
        <option key={platform.id} value={platform.id}>
          {platform.label}
        </option>
      ))}
    </select>
  );
}

function StatusSelect({ id, value, disabled, onChange }: SelectProps<SocialPostStatus>) {
  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value as SocialPostStatus)}
      className={SELECT_CLASSES}
    >
      <option value="scheduled">Scheduled</option>
      <option value="posted">Posted</option>
    </select>
  );
}
