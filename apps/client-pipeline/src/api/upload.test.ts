import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { UploadError, uploadMutation } from "@/api/upload";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Answers /api/upload with response, keeping the form it was sent. */
function answerWith(response: Response): { form?: FormData } {
  const sent: { form?: FormData } = {};
  globalThis.fetch = (async (_url: string, init: RequestInit) => {
    sent.form = init.body as FormData;
    return response;
  }) as typeof fetch;
  return sent;
}

/** Uploads the request as the Upload button does. */
function upload(request: Parameters<NonNullable<typeof uploadMutation.mutationFn>>[0]) {
  return uploadMutation.mutationFn!(request, undefined as never);
}

const photo = new File(["jpeg"], "DSCF1.jpg", { type: "image/jpeg" });

test("an upload sends keep-same-name and the rounded crop before the photo", async () => {
  const sent = answerWith(Response.json({ key: "DSCF1.jpg", url: "u", versions: {} }));
  const result = await upload({
    photo,
    keepSameName: true,
    crop: { x: 10.4, y: 20.6, size: 300.2 },
  });
  assert.equal(result.key, "DSCF1.jpg");
  assert.deepEqual([...sent.form!.keys()], ["sameName", "cropX", "cropY", "cropSize", "photo"]);
  assert.deepEqual(
    [sent.form!.get("cropX"), sent.form!.get("cropY"), sent.form!.get("cropSize")],
    ["10", "21", "300"],
  );
});

test("an upload without a crop or keep-same-name sends only the photo", async () => {
  const sent = answerWith(Response.json({ key: "DSCF1.jpg", url: "u", versions: {} }));
  await upload({ photo });
  assert.deepEqual([...sent.form!.keys()], ["photo"]);
});

test("a failed upload keeps the photos already under that name, Cloudflare's answer and the free name", async () => {
  const sameName = [{ key: "DSCF1.jpg" }];
  const cloudflare = { error: "AccessDenied" };
  answerWith(
    Response.json(
      { message: "Taken", sameName, cloudflare, suggestedName: "DSCF1-2" },
      { status: 409 },
    ),
  );
  const error = await upload({ photo }).catch((e: unknown) => e);
  assert.ok(error instanceof UploadError);
  assert.equal(error.message, "Taken");
  assert.deepEqual(error.sameName, sameName);
  assert.deepEqual(error.cloudflare, cloudflare);
  assert.equal(error.suggestedName, "DSCF1-2");
});

test("a failed upload without a JSON answer says the status", async () => {
  answerWith(new Response("Bad gateway", { status: 502 }));
  const error = await upload({ photo }).catch((e: unknown) => e);
  assert.ok(error instanceof UploadError);
  assert.equal(error.message, "/api/upload responded 502");
  assert.deepEqual(error.sameName, []);
});
