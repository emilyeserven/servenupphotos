import { Link } from "@tanstack/react-router";
import { CircleCheckIcon, ClockIcon, ExternalLinkIcon, ImageIcon } from "lucide-react";
import { parseIsoDate } from "@/lib/calendar";
import { offlineImageUrl } from "@/lib/offline-thumbnails";
import type { DayPost } from "@/lib/social-post-days";
import { statusLabels } from "@/lib/social-posts";
import { type DatedPost, type PostTab, postsByTab } from "@/lib/social-post-tabs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const dayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
});

const BADGE = "rounded px-1 text-[10px] font-medium whitespace-nowrap";

/** Whether every post is on Instagram, so a day's mark shows a check rather than a clock. */
function allScheduled(posts: DayPost[]): boolean {
  return posts.every((post) => post.status === "scheduled");
}

/** "Planned" or "Scheduled", for a post's status. */
function statusLabel(post: DayPost): string {
  return statusLabels[post.status];
}

/**
 * The corner mark of a calendar day with Instagram posts from the photos' Social media posts: a
 * check when they're all on Instagram, a clock while any is still planned, and how many when there's more than one.
 */
export function DayPostMark({ posts }: { posts: DayPost[] | undefined }) {
  if (!posts?.length) return null;
  return <PostMark posts={posts} />;
}

/** A day's posts as "Name (scheduled), Name (planned)". */
function postNames(posts: DayPost[]): string {
  return posts.map((post) => `${post.photo.name} (${statusLabel(post).toLowerCase()})`).join(", ");
}

function PostMark({ posts }: { posts: DayPost[] }) {
  const done = allScheduled(posts);
  const Icon = done ? CircleCheckIcon : ClockIcon;
  const names = postNames(posts);
  return (
    <span
      className={cn(
        BADGE,
        "pointer-events-none absolute bottom-1 left-1 z-10 flex items-center gap-0.5",
        done ? "bg-emerald-600 text-white" : "bg-background/85 text-foreground",
      )}
      title={`Instagram: ${names}`}
    >
      <Icon className="size-3" aria-hidden />
      {posts.length > 1 && posts.length}
      <span className="sr-only">Instagram posts: {names}</span>
    </span>
  );
}

/** The photo of a day's first post, faded behind an empty day's pick button. */
export function DayPostBackdrop({ posts }: { posts: DayPost[] | undefined }) {
  const image = posts?.[0]?.photo.image;
  if (!image) return null;
  return (
    <img
      src={offlineImageUrl(image)}
      alt=""
      draggable={false}
      loading="lazy"
      className="pointer-events-none absolute inset-0 size-full object-cover opacity-35"
    />
  );
}

interface InstagramPostsProps {
  postsByDay: Map<string, DayPost[]>;
  /** Today, as YYYY-MM-DD, which tells posts on Instagram already from ones still to come. */
  today: string;
}

/** Each tab's name, and what it says when it has no posts. */
const TABS: { value: PostTab; label: string; empty: string }[] = [
  { value: "posted", label: "Posted", empty: "Nothing posted on Instagram yet." },
  { value: "scheduled", label: "Scheduled", empty: "Nothing scheduled on Instagram after today." },
  { value: "unposted", label: "Unposted", empty: "No planned posts waiting to go on Instagram." },
];

/**
 * Every Instagram post from the Social media posts of every photo (the Gallery's and the ones in
 * flight, as the app has them now) in three tabs: Posted (on Instagram by today, newest first),
 * Scheduled (on Instagram to post after today) and Unposted (still planned), both soonest first.
 */
export function InstagramPosts({ postsByDay, today }: InstagramPostsProps) {
  const tabs = postsByTab(postsByDay, today);
  return (
    <section className="flex flex-col gap-2" aria-labelledby="instagram-posts">
      <h2 id="instagram-posts" className="text-lg font-medium">
        Instagram posts
      </h2>
      <p className="text-muted-foreground text-sm">
        Posts saved on each photo&apos;s page under <strong>Social media posts</strong>, from the
        Gallery and from photos in flight, including changes not committed yet.
      </p>
      <Tabs defaultValue="scheduled">
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label} ({tabs[tab.value].length})
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((tab) => (
          <TabsContent key={tab.value} value={tab.value}>
            <PostList posts={tabs[tab.value]} empty={tab.empty} label={tab.label} />
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}

interface PostListProps {
  posts: DatedPost[];
  /** What the tab says when it has no posts. */
  empty: string;
  /** The tab's name, which each post's badge shows, such as "Posted". */
  label: string;
}

/** One tab's posts, or what it says when there are none. */
function PostList({ posts, empty, label }: PostListProps) {
  if (posts.length === 0) {
    return (
      <p className="text-muted-foreground rounded-md border border-dashed p-4 text-center text-sm">
        {empty}
      </p>
    );
  }
  return (
    <ul className="divide-y rounded-md border">
      {posts.map(({ day, post }) => (
        <PostRow key={`${day}-${post.photo.path}`} day={day} post={post} label={label} />
      ))}
    </ul>
  );
}

function PostRow({ day, post, label }: { day: string; post: DayPost; label: string }) {
  const { photo } = post;
  return (
    <li className="flex items-center gap-3 p-2 text-sm">
      <span className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center overflow-hidden rounded">
        {photo.image ? (
          <img src={offlineImageUrl(photo.image)} alt="" className="size-full object-cover" />
        ) : (
          <ImageIcon className="size-4" />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Link
          to="/exif"
          search={{ edit: photo.path }}
          className="truncate font-medium underline-offset-4 hover:underline"
        >
          {photo.name}
        </Link>
        <span className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs">
          {dayFormat.format(parseIsoDate(day))}
          <PostBadges post={post} label={label} />
        </span>
      </span>
      <PostLink url={post.url} />
    </li>
  );
}

/** Whether the post is on Instagram yet, and whether its photo is in flight or as the Gallery shows it. */
function PostBadges({ post, label }: { post: DayPost; label: string }) {
  return (
    <>
      <span
        className={cn(
          BADGE,
          post.status === "scheduled" ? "bg-emerald-600 text-white" : "bg-muted text-foreground",
        )}
      >
        {label}
      </span>
      <span className={cn(BADGE, "border")}>{post.photo.inFlight ? "In flight" : "Gallery"}</span>
    </>
  );
}

function PostLink({ url }: { url: string }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="text-muted-foreground hover:text-foreground flex shrink-0 items-center gap-1 text-xs underline underline-offset-4"
    >
      View post
      <ExternalLinkIcon className="size-3" aria-hidden />
    </a>
  );
}
