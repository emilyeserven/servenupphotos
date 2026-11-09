// Lets `node --test` run the apps' TypeScript files that import with the `@/` and `@portfolio/`
// path aliases (Vite and tsc resolve them; Node doesn't). Loaded with `--import` from each app's
// `test` script, which runs in the app's folder. `@/` is the app's own `src`; `@portfolio/` is the
// portfolio's `src`, whichever app is testing.
import { register } from "node:module";

register("./test-aliases-hooks.mjs", import.meta.url, { data: { cwd: process.cwd() } });
