import assert from "node:assert/strict";
import { test } from "node:test";
import { keepTogether, unglued } from "@/lib/caption-keep-together";

test("a part marked Keep together loses its breaks and its marks", () => {
  assert.equal(keepTogether("f/2.8 <nobr>ISO 400</nobr>"), "f/2.8 ISO 400");
  assert.equal(keepTogether("<nobr>Seoul-si</nobr>"), "Seoul-⁠si");
});

test("a mark without its other half is left out", () => {
  assert.equal(keepTogether("a <nobr>b c"), "a b c");
});

test("a value that never breaks is kept together wherever it shows up", () => {
  assert.equal(
    keepTogether("San Francisco, CA\nSan Francisco Bay", ["San Francisco", " "]),
    "San Francisco, CA\nSan Francisco Bay",
  );
});

test("a social media post gets the kept-together text written plainly", () => {
  assert.equal(unglued(keepTogether("<nobr>Seoul-si 서울</nobr>")), "Seoul-si 서울");
});

test("a Korean, Chinese or Japanese value that never breaks has its letters joined", () => {
  assert.equal(keepTogether("서울, 대한민국", ["대한민국"]), "서울, 대\u2060한\u2060민\u2060국");
  assert.equal(keepTogether("<nobr>東京-都 Tokyo</nobr>"), "東\u2060京\u2060-\u2060都\u00a0Tokyo");
  assert.equal(unglued(keepTogether("서울, 대한민국", ["대한민국"])), "서울, 대한민국");
});
