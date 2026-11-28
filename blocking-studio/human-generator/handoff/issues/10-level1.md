title: Hands: level 1 defects (the readable thumb's re-entry, the budget wrist gap)
labels: bug
order: 10
area: Geometry
files: hands/mesh1.js
after: 2
---
Part of TRACKING.

Two known defects of level 1 (`hands/mesh1.js`), found by the geometry review and not yet fixed:

1. **`readable`: a thumb edge re-enters the palm.** On some bodies an edge of the thumb leaves the palm and comes
   back in further along. It is shallow, but it shows as a crease. `hands/shells.js` reports this kind of re-entry
   (an edge from the base ring that is inside, then outside, then inside the palm), so a test can count it.
2. **`budget`: a gap at the wrist** of about 0.29 of the forearm ring's thickness between the hand's base and the
   forearm's end ring.

## What to do

For each one, measure it over the test bodies and the 24 poses (how many hands, how deep or wide), fix it in
`mesh1.js` without changing level 1's triangle counts (40 and 70), and add a test with the new bound.

## Done when

Both are measured, fixed or bounded by a test, and the sheets of level 1 still read (see TRACKING's sheets issue).
