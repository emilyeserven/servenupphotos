import assert from "node:assert/strict";
import { test } from "node:test";
import {
  type PhotoFacts,
  albumFor,
  groupByLocation,
  groupByTheme,
  idAsName,
  oneAlbum,
  sharedAlbumsToSave,
  sharedLikes,
} from "@/lib/shared-likes";

const lists = [
  { id: "jane", name: "Jane", photos: [1, 2, 3, 4] },
  { id: "sam", name: "Sam", photos: [2, 3, 5] },
  { id: "kim", name: "Kim", photos: [3, 2, 6] },
];

test("the overlap is the photos in every list, unless fewer are asked for", () => {
  assert.deepEqual(sharedLikes(lists), [
    { id: 2, people: ["Jane", "Sam", "Kim"] },
    { id: 3, people: ["Jane", "Sam", "Kim"] },
  ]);
  assert.deepEqual(
    sharedLikes(lists, 1).map((like) => like.id),
    [2, 3, 1, 4, 5, 6],
  );
  assert.equal(sharedLikes(lists, 9).length, 2);
  assert.deepEqual(sharedLikes([]), []);
});

test("a photo listed twice in one list counts once", () => {
  assert.deepEqual(sharedLikes([{ id: "a", name: "A", photos: [7, 7] }, lists[0]!], 2), []);
});

function photo(id: number, facts: Partial<PhotoFacts> = {}): PhotoFacts {
  return { id, city: "", country: "", tags: [], genres: [], ...facts };
}

test("location groups cities with two photos, the rest by country, then No location", () => {
  const groups = groupByLocation([
    photo(1, { city: "Kyoto", country: "Japan" }),
    photo(2, { city: "Kyoto", country: "Japan" }),
    photo(3, { city: "Nara", country: "Japan" }),
    photo(4, { country: "Japan" }),
    photo(5, { city: "Paris", country: "France" }),
    photo(6),
  ]);
  assert.deepEqual(
    groups.map((g) => [g.name, g.source, g.photos]),
    [
      ["Japan", "country", [3, 4]],
      ["Kyoto", "city", [1, 2]],
      ["France", "country", [5]],
      ["No location", "none", [6]],
    ],
  );
});

test("theme takes the most shared tag first, then genres, each photo once", () => {
  const groups = groupByTheme(
    [
      photo(1, { tags: ["canal", "bicycles"] }),
      photo(2, { tags: ["canal"] }),
      photo(3, { tags: ["canal"] }),
      photo(4, { tags: ["bicycles"], genres: ["street"] }),
      photo(5, { genres: ["street"] }),
      photo(6, { genres: ["landscape"] }),
    ],
    (source, id) => (source === "genre" ? id.toUpperCase() : idAsName(id)),
  );
  assert.deepEqual(
    groups.map((g) => [g.name, g.photos]),
    [
      ["Canal", [1, 2, 3]],
      ["STREET", [4, 5]],
      ["Other themes", [6]],
    ],
  );
});

test("a suggested name is an existing album by ID or name, or a new one", () => {
  const albums = [
    { id: "kyoto", name: "Kyoto" },
    { id: "jp", name: "Japan" },
  ];
  assert.deepEqual(albumFor("kyoto", albums), { id: "kyoto", existing: true });
  assert.deepEqual(albumFor("japan", albums), { id: "jp", existing: true });
  assert.deepEqual(albumFor("Nara Deer", albums), { id: "nara-deer", existing: false });
});

test("the save makes new albums and puts each photo file in its albums", () => {
  const paths = new Map([
    [1, "photos/a.json"],
    [2, "photos/b.json"],
  ]);
  const save = sharedAlbumsToSave(
    [
      { name: "Kyoto", photos: [1] },
      { name: " Our Favorites ", photos: [1, 2, 9] },
      { name: "東京", photos: [2] },
      { name: "Empty", photos: [] },
    ],
    paths,
    [{ id: "kyoto", name: "Kyoto" }],
    { description: "Liked by Jane and Sam.", hidden: true },
  );
  assert.deepEqual(save, {
    newAlbums: [
      {
        id: "our-favorites",
        name: "Our Favorites",
        description: "Liked by Jane and Sam.",
        hidden: true,
      },
    ],
    photos: [
      { path: "photos/a.json", albums: ["kyoto", "our-favorites"] },
      { path: "photos/b.json", albums: ["our-favorites"] },
    ],
  });
});

test("one album holds every chosen photo, lowest ID first", () => {
  assert.deepEqual(oneAlbum([5, 2, 9]), [
    { key: "all", name: "Shared Likes", source: "all", photos: [2, 5, 9] },
  ]);
  assert.deepEqual(oneAlbum([]), []);
});
