/**
 * An oxlint plugin with one rule, `request-helpers/no-hand-built-json-request`: the pipeline's
 * client sends JSON through `post`, `put` and `del` in `api/request.ts`, so a `content-type`
 * header written anywhere else is a request built by hand.
 */
const noHandBuiltJsonRequest = {
  meta: {
    type: "suggestion",
    docs: {
      description:
        "Send JSON with post, put or del from @/api/request instead of building the request.",
    },
  },
  create(context) {
    return {
      Property(node) {
        const key = node.key;
        const name = key.type === "Identifier" ? key.name : key.value;
        if (typeof name !== "string" || name.toLowerCase() !== "content-type") return;
        context.report({
          node: key,
          message:
            "Send JSON with post, put or del from @/api/request instead of writing a content-type header.",
        });
      },
    };
  },
};

export default {
  meta: { name: "request-helpers" },
  rules: { "no-hand-built-json-request": noHandBuiltJsonRequest },
};
