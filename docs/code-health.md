# Code health

How the repo keeps functions small and tested: `fallow` checks every function's complexity and CRAP score in `pnpm check` and CI, and `pnpm fallow:coverage` gives the exact CRAP scores from the tests' coverage.

## The limits

`pnpm check` runs `fallow`, which fails on any function over cyclomatic complexity 20, cognitive complexity 15, 60 lines or a CRAP score of 30 ([fallow health](https://fallow.tools/docs/explanations/health/)). A function's CRAP score is `complexity² × (1 − coverage)³ + complexity`, so a fully tested function scores its complexity and an untested one scores far more: an untested function with complexity 5 already scores 30.

> **Frontend analogy:** CRAP is like a Lighthouse score for a function: complexity is how much can go wrong, coverage is how much of it a test has watched, and a high score means lots of branches nobody checks.

## Estimated and exact scores

Without coverage data, `fallow` guesses each function's coverage from which test files import it: 85% for a function a test calls, 40% for one only reached through such a function, 0% for one no test reaches. That guess is what `pnpm check` uses.

`pnpm fallow:coverage` runs `pnpm test` with `NODE_V8_COVERAGE` set, so Node writes which lines each test ran into `coverage/` (git-ignored), then runs `fallow health --coverage coverage`. Every file a test loads gets its exact score; components (`.tsx`), which `node --test` can't load, keep the estimate. A function the estimate passes can fail here when its file is tested but it isn't, so run it after adding logic to `src/lib/` or `src/api/` and add a test for anything it reports.
