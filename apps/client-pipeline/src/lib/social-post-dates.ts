import { type PostedPhotoFile, postsByDay } from "@/lib/social-post-days";
import { PUBLISH_DATE } from "@/lib/photo-fields";

/** Each day other photos post on, as YYYY-MM-DD, with those photos' names. */
export type UsedPostDays = Map<string, string[]>;

function addName(used: UsedPostDays, day: string, name: string) {
  const names = used.get(day) ?? [];
  if (!names.includes(name)) used.set(day, [...names, name]);
}

/** The Instagram calendar's day for each photo that has one (`socialMediaPublishDate`). */
function addCalendarDays(used: UsedPostDays, files: PostedPhotoFile[]) {
  for (const file of files) {
    const day = file.data[PUBLISH_DATE];
    if (typeof day === "string" && day) addName(used, day, file.name);
  }
}

/**
 * The days photos other than the one at exceptPath already post on platform, from their
 * `socialPosts`. For Instagram, their days on the Instagram calendar count too.
 */
export function usedPostDays(
  files: PostedPhotoFile[],
  platform: string,
  exceptPath: string,
): UsedPostDays {
  const others = files.filter((file) => file.path !== exceptPath);
  const used: UsedPostDays = new Map();
  for (const [day, posts] of postsByDay(others, platform)) {
    for (const post of posts) addName(used, day, post.photo.name);
  }
  if (platform === "instagram") addCalendarDays(used, others);
  return used;
}
