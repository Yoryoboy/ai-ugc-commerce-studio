# Copy: write lines that sound like a person and can be defended

Use this before showing any script, hook, headline, `primaryText` or caption to the user. It
applies to the Spanish the buyer hears or reads (Rioplatense, voseo); these instructions stay in
English. Adapted from `copywriting` and `copy-editing` (see `README.md`).

Two things always win over style: the allowed/forbidden lists in the product's `ficha.md`
(`claims-rules.md`), and the studio's own mechanics (pronounceable words, short lines, ~2.5 words
per second). A line that passes this file but breaks either one is rejected.

## 1. The gate: three questions for every line

1. **Can the buyer picture it?** A concrete object, scene or gesture beats an abstraction.
   "Las patas quedan firmes" is abstract; "la cama ya no se mueve cuando te sentás" is a scene.
2. **Can it be proven with an allowed claim?** Every product statement must be traceable to the
   `ficha.md` allowed list (attribute, description sentence or photo). If the line cannot point at
   a source, it fails. "Revolucionario" and "el mejor" are decoration and also forbidden.
3. **Would it still be true for another brand?** (swap test) If the same sentence could run
   unchanged on a competitor's product, rewrite it from this product's real attributes.

Three yes: keep. Two: sharpen the weak one. One or none: rewrite from the facts, or flag the gap
with `[NEED: …]`.

## 2. Never invent proof: `[NEED: …]`

Replacing a vague line with a made-up number, review, customer story or result is worse than the
vague line. Write the gap instead:

- `[NEED: cuántos kilos soporta, no figura en la publicación]`
- `[NEED: reseña real que se pueda citar]`
- `[NEED: diferencia concreta frente a otras opciones]`

Rules:

- Hard data exists only if the listing, the client or real data gave it: statistics, sales or
  customer counts ("miles de clientes"), awards, quoted reviews, and product specs (capacity,
  duration, measurements).
- The actor is an actor, like one hired for a UGC ad: it may tell its experience naturally in
  first person ("hace meses que las uso", "me encanta cómo quedó", "ahora la cama no se mueve").
  That is acted experience, not hard data. What it says *about the product* must still be an
  allowed claim: no results, numbers or transformations the product cannot back ("bajé 5 kilos",
  "me curó la espalda", "duran 10 años"), and nothing from the forbidden list.
- A script with an open `[NEED]` is not final. Tell the user what is missing in one line and give
  the closest supportable version (the softer wording from `claims-rules.md`), or cut the line.
- When a requested claim is declined, name it, say why, offer the supportable alternative and say
  what evidence would unlock it (a spec sheet line, a real review).

## 3. Structural AI tells, in Spanish

A draft can avoid every cliché word and still sound generated because of its shape. These
patterns are the common ones. Fix by going back to the fact; swapping words creates a new tell.
Do not reuse one rewrite as a template for all the others.

| Pattern | Tell (✗) | Rewrite (✓) |
|---|---|---|
| **Contrast reveal** ("no es X, es Y", "no solo X sino Y", "más que X, es Y"). Ban when it denies something nobody said | "No es una pata más. Es la base de tu descanso." | "Cada pata se gira hasta que queda firme y la cama deja de moverse." |
| **Negation list** ("sin X, sin Y, sin Z", "cero…") | "Sin vueltas, sin herramientas, sin dolores de cabeza." | "Las girás con la mano y listo." (a real single absence is fine once: "no necesitás herramientas", if the listing says so) |
| **Trailing pile-on**: finished claim + comma + gerund or extra benefits ("…, asegurando / permitiendo / garantizando…") | "Se ajusta en segundos, garantizando estabilidad, comodidad y tranquilidad." | "Se ajusta en segundos." (add a new fact only if it is one) |
| **Self-answered question** ("¿El resultado? …", "¿La mejor parte? …", "¿Por qué importa? Porque…") | "¿El resultado? Una cama que no se mueve." | "Ahora la cama no se mueve." |
| **Colon reveal** | "Lo mejor: no hace ruido." | "No hace ruido." (if the listing supports it) |
| **Fake-profound kicker** and tidy closers | "Porque tu descanso no puede esperar." / "Y eso lo cambia todo." | End on the last concrete sentence or the call to action. |
| **Reflexive triplets** ("rápido, simple y seguro") | "Práctico, resistente y elegante." | One strong concrete claim: "Son de metal, mirá el grosor." (only if the listing says metal) |
| **Wisdom-shaped sentences** | "Los detalles hacen la diferencia." | The specific detail it gestures at, or cut. |
| **Throat-clearing and self-narration** | "Te voy a contar algo que nadie te dice." / "Y ahora viene lo importante." | Say the thing. If it needs a drumroll, it needs evidence. |
| **"Imaginá…" openers and era openers** | "Imaginá dormir sin preocupaciones." / "En un mundo donde todo va rápido…" | Open on the buyer's real situation (see `hooks.md`). |
| **Abstract subjects** (nobody does anything) | "Este producto te permite descansar mejor." | Make the buyer or the object the subject: "Mirá, la cama ya no se mueve." |
| **Em dash overuse** | "No es una pata — es una solución." | Period, comma or colon. In spoken lines and short copy use none: the model does not pronounce it. |

Also cap, do not ban: sentence fragments in a row ("Simple. Rápido. Listo."), identical rhythm in
every line, filler transitions ("además", "cabe destacar"), and stock phrases ("llevá tu X al
siguiente nivel", "decile adiós a…", "lo que estabas esperando", "no te lo pierdas"). Two caps in
one paragraph: rewrite the paragraph. Casual speech markers that real creators use ("mirá",
"ojo", "bueno") are fine when they carry a reaction; they are a tell when they announce the next
line ("y acá viene lo mejor").

**Exclamation marks and voice.** Allowed sparingly in the Rioplatense UGC voice: one natural
"¡qué bien queda!" at a real payoff is speech, not a tell. A line of them, or "¡Descubrí…!" /
"¡No te lo pierdas!", is hype. Prefer none in `headline` and `primaryText`.

**Do not copy an English or Spanish word blacklist.** Replace the word with the fact it stood
in for ("resistente" becomes the listing's material or measure), and keep the client's own
vocabulary and `marca.json` voice.

## 4. Spoken lines (video)

- Short everyday words the model can pronounce; no uncommon conjugations. One idea per line.
- No stage directions, hashtags, emojis or phonetic spellings inside the dialogue.
- Vary rhythm by thought: a long line, then a short one. Do not plan "short, short, long".
- Keep the dialogue about what is seen on screen; do not read the listing aloud.

## 5. Self-check before showing copy

1. Does every product statement exist in the `ficha.md` allowed list? Anything forbidden: fix first.
2. Search the draft for "no es", "sin ", "¿", ":", "—" and ", " followed by a gerund
   (-ando/-iendo); check each hit against section 3.
3. Count fragments, triplets and stock phrases per paragraph.
4. Read it aloud: does it sound like a press release or like someone showing a thing?
5. Run the swap test on the first line and the last line.
6. Any statistic, customer count, award, quoted review, spec or product result you did not get
   from a source? Replace with `[NEED: …]`. The actor's own acted experience is fine (section 2).
7. Did you change a line only because it was different? Revert it unless you can say why it is better.
