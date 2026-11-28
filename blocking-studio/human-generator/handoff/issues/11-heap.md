title: Hands: the heap test keeps 8.3 MB after 4000 characters
labels: bug
order: 11
area: Tests
files: hands/index.js, hands/rig.js, hands/mesh0.js, hands/mesh1.js, tests/test_generator.mjs
after: 
---
Part of TRACKING.

`tests/test_generator.mjs`, test "memory: generating thousands of characters keeps nothing", generates 4000
characters from the 200 bodies of `tests/fixtures/dna_adult_grid_200.json` and allows less than 8 MB of heap growth.
On the branch it fails:

```text
AssertionError [ERR_ASSERTION]: 8.3 MB kept
```

(run with `node --expose-gc --test tests/test_generator.mjs`, measured once on a laptop at the handoff). Runs recorded
before the hands were built per body measured 0.02 to 1.02 MB.

The likely cause, not checked yet: the hands are now built for each body, and their caches (`CTX` and `MESH0` in
`hands/index.js`, the solve cache in `hands/rig.js`, the piece cache in `hands/mesh0.js`, the palm cache in
`hands/mesh1.js`; all cleared by `clearHandCaches()`) keep one entry per body, so 200 bodies keep about 40 KB each.
That would be a bound, not a leak, but nothing caps it: a session that generates many different bodies keeps
growing.

## What to do

1. Measure what each cache holds after the test (entries and bytes), and confirm or refute the cause above.
2. If the caches are the cause, give them a bound (for example a small least-recently-used cache per kind) and
   measure the cost of a new character and of a cached one again (the handoff README has the numbers before:
   about 14 to 16 ms new, about 0.9 ms cached). Do not loosen the test's 8 MB limit to make it pass.
3. If it is a real leak, fix it.

## Done when

The memory test passes with `--expose-gc`, the cache bound (if any) is said in a comment with its measured cost,
and the other tests in `test_generator.mjs` still pass.
