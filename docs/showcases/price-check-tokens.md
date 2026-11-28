# The day's prices without the model

The skill writes no price: on each day of use it makes a table of that day's free quotes. The quotes cost no credits,
but whoever makes them spends tokens. Record: [the README's measurement](../../README.md#what-a-price-check-costs-in-tokens)
of 2026-11-27, in a long Claude Code session, with the same 29 prices each way.

## The request

The day's price table: 29 free quotes from the Higgsfield connector.

## What was measured

| Who makes the 29 quotes | Model tokens | Time | At that day's API list prices |
|---|---|---|---|
| The main conversation (Claude Opus 5.5) | 5,276 written and 550,485 re-read, in two turns | — | about US$ 0.28 |
| A subagent on Claude Haiku 5.5 | 5,088 written and 250,714 read by the small model; 1,029 written and 180,280 re-read by the main conversation to send it, plus one turn to read its summary | 23.5 s | about US$ 0.11, plus that turn |
| `connector.py prices` | none for the quotes: the agent writes one command and reads a summary of about 600 characters | 43.2 s | nothing for the quotes |

## What was learned

Most of the main conversation's cost was re-reading itself: each turn re-read the whole conversation, about 275,000
tokens in that session. A subagent on a smaller model cost less than half as much in dollars, but the quotes still passed through a model.

## What changed in the skill

`higgsfield-director/scripts/connector.py` makes the day's quotes with no model at all, on the operator's own
sign-in; the agent runs one command and reads its summary. The rule behind it is in `AGENTS.md`, "Scripts before the
model", and the three ways are described in
[`references/models.md`](../../higgsfield-director/references/models.md#who-makes-the-quotes).

[All showcases](README.md)
