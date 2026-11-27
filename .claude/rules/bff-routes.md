---
paths:
  - "apps/bff-pipeline/**"
  - "apps/be-pipeline/internal/httpapi/**"
---

# Routes the BFF answers

A route that needs none of the Go backend's state (no GitHub layer, R2, settings or image work), such as a look-up on a public server, can be answered by the BFF in its own `src/routes/<name>.ts` file with its logic and tests in `src/lib`, as `docs/bff-routes.md` says. Every other route stays in Go and goes through the relay.
