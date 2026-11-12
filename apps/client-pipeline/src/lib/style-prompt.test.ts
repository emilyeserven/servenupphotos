import assert from "node:assert/strict";
import { test } from "node:test";
import {
  defaultStyleCount,
  samplePhotos,
  styleCount,
  stylePhotoSection,
  stylePrompt,
  takenDay,
} from "@/lib/style-prompt";

const canal = {
  path: "photos/canal.json",
  data: {
    title: "Amsterdam Canal",
    createDate: "2016:12:16 09:27:41",
    customCity: "Amsterdam",
    customCountry: "Netherlands",
    camera: "X-T5",
    lens: "XF35mmF1.4 R",
    focalLength: 35,
    aperture: 1.4,
    exposure: "1/125",
    iso: 200,
    genres: ["street"],
    tags: ["canal", "bicycles"],
    images: { full: "https://cdn/canal.jpg", small: "https://cdn/canal-small.webp" },
  },
};

const temple = {
  path: "photos/temple.json",
  data: {
    customCreateDate: "2026-09-25T10:00",
    createDate: "2026:09:24 10:00:00",
    country: "Japan",
    images: { full: "https://cdn/temple.jpg" },
  },
};

test("the typed count is a whole number up to 100, or the default", () => {
  assert.equal(styleCount("12.4"), 12);
  assert.equal(styleCount("500"), 100);
  assert.equal(styleCount("0"), defaultStyleCount);
  assert.equal(styleCount("lots"), defaultStyleCount);
});

test("the day taken prefers the custom date and reads the EXIF one too", () => {
  assert.equal(takenDay(canal.data), "2016-12-16");
  assert.equal(takenDay(temple.data), "2026-09-25");
  assert.equal(takenDay({}), "");
});

test("a photo's section links its Small version and lists what's known of it", () => {
  assert.equal(
    stylePhotoSection(canal, 1),
    `1. https://cdn/canal-small.webp
  - Title: Amsterdam Canal
  - Taken: 2016-12-16
  - Where: Amsterdam, Netherlands
  - Gear: X-T5 with XF35mmF1.4 R
  - Settings: 35mm, f/1.4, 1/125s, ISO 200
  - Genres: street
  - Tags: canal, bicycles`,
  );
  assert.equal(
    stylePhotoSection(temple, 2),
    `2. https://cdn/temple.jpg
  - Taken: 2026-09-25
  - Where: Japan`,
  );
});

test("photos are spread evenly from first to last, or picked at random with a seed", () => {
  const photos = Array.from({ length: 10 }, (_, i) => i);
  assert.deepEqual(samplePhotos(photos, 5), [0, 2, 4, 6, 8]);
  assert.deepEqual(samplePhotos(photos, 20), photos);
  const shuffled = samplePhotos(photos, 4, 7);
  assert.equal(shuffled.length, 4);
  assert.deepEqual(shuffled, samplePhotos(photos, 4, 7));
  assert.deepEqual(
    shuffled,
    shuffled.toSorted((a, b) => a - b),
  );
});

test("the prompt says where the photos came from, their span, and the focus", () => {
  const prompt = stylePrompt({
    photos: [canal, temple],
    matching: 40,
    filtered: true,
    focus: "How has my street photography changed?",
  });
  assert.match(prompt, /2 of the 40 photos that match the filters I chose/);
  assert.match(prompt, /- Taken from 2016-12-16 to 2026-09-25\n- In Netherlands, Japan/);
  assert.match(prompt, /Most of all, I'd like to know: How has my street photography changed\?/);
  assert.match(prompt, /1\. https:\/\/cdn\/canal-small\.webp[\s\S]*2\. https:\/\/cdn\/temple\.jpg/);
  const all = stylePrompt({ photos: [canal], matching: 1, filtered: false, focus: " " });
  assert.match(all, /all 1 photos in my portfolio/);
  assert.doesNotMatch(all, /Most of all/);
});
