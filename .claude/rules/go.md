---
paths:
  - "apps/be-pipeline/**"
---

# Go

Stdlib `net/http`, errors as `writeError(w, status, message)` with messages a user can read; GitHub errors the user should see come back as `*github.PublishError`. A handler that reads or changes photo data on GitHub is `withGitHub` (or `withGitHubBody`, which decodes the body first) in `httpapi/respond.go`, which reads the settings, opens the timeout context and answers with `writeResult`. One that needs other settings, such as R2's, is `withSettings(store.R2, timeout, …)` and usually answers with `writeR2Result`; one with a JSON body wraps it in `withBody`. Request bodies are read only in `respond.go` (golangci-lint's `forbidigo` refuses `json.NewDecoder` elsewhere in `httpapi`), with unknown fields refused. Every message a user reads is a sentence with a capital and a full stop that says what to do next where there is something to do ("Couldn't save the tags.", "Pick the images to delete first."); `messages_test.go` checks the ones passed to these helpers. A name in the URL path that doesn't exist is a 404, a bad value in the body or query a 400.
