import assert from "node:assert/strict";
import { test } from "node:test";
import {
  apiErrorOf,
  cloudflareFailureOf,
  githubFailureOf,
  isMapLoading,
  suggestedNameOf,
} from "@/api/errors";

const cloudflare = { status: 403, code: "AccessDenied", error: "operation error S3: HeadObject" };

test("a failed request's error takes the body's message, or says the address and status", () => {
  const named = apiErrorOf("/api/photos", 500, { message: "The bucket is full" });
  assert.equal(named.message, "The bucket is full");
  assert.equal(named.name, "ApiError");
  assert.equal(named.status, 500);
  assert.equal(named.url, "/api/photos");
  assert.equal(apiErrorOf("/api/photos", 502, null).message, "/api/photos responded 502");
});

test("a failed request's error carries GitHub's answer, the free name and whether a map is loading", () => {
  const github = {
    step: "saving the changed files",
    method: "POST",
    path: "/git/trees",
    status: 422,
  };
  const error = apiErrorOf("/api/commit", 502, { github, suggestedName: "b.jpg", loading: true });
  assert.deepEqual(githubFailureOf(error), github);
  assert.equal(suggestedNameOf(error), "b.jpg");
  assert.equal(isMapLoading(error), true);
  const plain = apiErrorOf("/api/commit", 500, {});
  assert.equal(githubFailureOf(plain), undefined);
  assert.equal(isMapLoading(plain), false);
  assert.equal(isMapLoading(new Error("loading")), false);
});

test("Cloudflare's answer comes with the pipeline request from a failed request's error", () => {
  const error = apiErrorOf("/api/photos/bucket", 502, { cloudflare });
  assert.deepEqual(cloudflareFailureOf(error), {
    response: cloudflare,
    pipeline: "502 from /api/photos/bucket",
  });
  assert.equal(cloudflareFailureOf(apiErrorOf("/api/photos/bucket", 500, null)), undefined);
});

test("Cloudflare's answer comes alone from another error that carries one, such as an upload's", () => {
  const upload = Object.assign(new Error("upload failed"), { cloudflare });
  assert.deepEqual(cloudflareFailureOf(upload), { response: cloudflare });
  const notCloudflare = Object.assign(new Error("upload failed"), { cloudflare: "no" });
  assert.equal(cloudflareFailureOf(notCloudflare), undefined);
  assert.equal(cloudflareFailureOf(new Error("plain")), undefined);
  assert.equal(cloudflareFailureOf("not an error"), undefined);
});
