import assert from "node:assert/strict";
import { test } from "node:test";
import { formTokens } from "@/lib/place-form-tokens";

test("a form is drawn as its text and each placeholder's value, a part in brackets dropped when empty", () => {
  assert.deepEqual(
    formTokens("{city}[, {state}] - {x|country}", { city: "Seoul", country: "Korea" }),
    [
      { kind: "value", name: "city", value: "Seoul" },
      {
        kind: "section",
        dropped: true,
        tokens: [
          { kind: "text", text: ", " },
          { kind: "value", name: "state", value: "" },
        ],
      },
      { kind: "text", text: " - " },
      { kind: "value", name: "x|country", value: "Korea" },
    ],
  );
});
