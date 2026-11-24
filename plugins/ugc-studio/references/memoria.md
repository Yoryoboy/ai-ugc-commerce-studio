# Memory (Engram) in the studio skills

The studio skills use Engram, the persistent memory `setup` installs, so the next batch starts
from what the user already decided instead of asking again. The skills call it at fixed moments;
do not leave it to the end of the conversation, because a long flow forgets it.

If the Engram tools (`mem_search`, `mem_save`, `mem_get_observation`) are not available in this
session, skip every memory step without comment and go on. Memory never blocks a flow, and a
failed memory call is never a reason to stop or retry.

## Topic keys

One stable `topic_key` per subject, so a new save updates the subject instead of duplicating it:

| Subject | topic_key |
| --- | --- |
| A product of a client (concepts, angles, ideas, what worked) | `ugc/<profileId>/<productId>` |
| A client's brand kit and taste | `ugc/<profileId>/marca` |
| An actor (how it looks, where it worked or failed) | `ugc/actores/<actorId>` |

## 1. At the start: search

Right after the product (or, in `crear-actor`, the reason) is known, run `mem_search` with the
client and the product (or the niche), 1 or 2 words each. Open the hits that matter with
`mem_get_observation`. Use what you find to recommend: repeat what worked, avoid what the user
rejected, and say it in one line ("La otra vez descartaste el ángulo precio para este producto;
lo dejo afuera."). If memory contradicts what the user asks now, point it out and ask. If there
is nothing, say nothing about it. Never invent a memory.

## 2. At each decision: save

Call `mem_save` right after each of these, not at the end:

- The user approves, removes or edits ideas or concepts: what was chosen and what was rejected,
  with the reason when they gave one.
- The user confirms or changes a brand kit, or states a taste ("nada de rosa", "siempre con
  precio").
- The user approves, asks to change or discards a result: what failed (identity, product,
  hands, text, tone) and what fixed it.
- A generation needed a workaround that the next one should reuse (a prompt detail, a reference
  order, a model setting).

## 3. At the close: save the batch

Save one summary of the batch: what was made, total credits, what was approved, what was
discarded and why, and what to try next time. Use the product's topic key.

## Format

- `title`: verb + what, short and searchable ("Aprueba 3 conceptos de dolor para patas de cama").
- `type`: `decision`, `preference`, `discovery` or `pattern`.
- `topic_key`: from the table above.
- `content`: **Qué** (one sentence), **Por qué** (the user's reason or the evidence),
  **Contexto** (client, product, actor, credits), **A revisar** (what would change it).

Save conclusions, not dumps: no prompts, no JSON, no file lists. Never save passwords, tokens,
payment data or personal data. Tell the user at most one line ("Lo guardé en la memoria.").
