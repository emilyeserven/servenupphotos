/**
 * `servenup/json-request`: the pipeline's client sends JSON through `post`, `put` and `del` in
 * `apps/client-pipeline/src/api/request.ts`, so a `content-type` key written anywhere else in the
 * client is a request built by hand. The BFF and the portfolio are left alone.
 */
import { fileOf } from "../helpers.mjs";

/** How loudly oxlint reports this rule. */
export const severity = "error";

const PIPELINE_CLIENT = /apps[\\/]client-pipeline[\\/]src[\\/]/;
const REQUEST_FILE = /api[\\/]request\.ts$/;

export default {
  meta: {
    type: "suggestion",
    docs: { description: "Send JSON with post, put or del from @/api/request." },
    messages: {
      header:
        "Send JSON with post, put or del from @/api/request instead of writing a content-type header.",
    },
  },
  create(context) {
    const file = fileOf(context);
    if (!PIPELINE_CLIENT.test(file) || REQUEST_FILE.test(file)) return {};
    return {
      Property(node) {
        const key = node.key;
        const name = key.type === "Identifier" ? key.name : key.value;
        if (typeof name === "string" && name.toLowerCase() === "content-type")
          context.report({ node: key, messageId: "header" });
      },
    };
  },
};
