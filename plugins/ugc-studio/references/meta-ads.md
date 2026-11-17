# Meta Ads rules for creatives

Used by `crear-creativos`. These are working rules, not legal advice: Meta can change them.

## Diversity (Andromeda)

Meta groups near-identical creatives and shows them as one. The same image with another color,
button or font counts as one creative. So variety is of **concept**, not of micro-variants:

- Every concept has its own angle, awareness stage, persona and visual format.
- Every pair of concepts differs in at least two of angle, persona and visual; no two share
  angle + visual.
- Angles: dolor, deseo/aspiración, precio/oferta, prueba social, comparación, cómo se usa,
  objeción, regalo/ocasión.
- Awareness: no sabe del problema, conoce el problema, conoce soluciones, conoce el producto,
  listo para comprar.
- Visuals: product alone on a clean background, person using it, detail/texture, customer-photo
  (UGC) style, flat lay, review-screenshot style; before/after only when it is not health or body.
- Default 6–10 concepts per batch (8). More is not better if they start looking alike.

## Sizes and placements

| Use | Ratio | Size | Notes |
|---|---|---|---|
| Feed (static) | 4:5 | 1080×1350 | main placement |
| Stories / Reels | 9:16 | 1080×1920 | keep the top 14 % and bottom 35 % free of text, logo and product (platform UI covers them) |
| Carousel card | 4:5 (or 1:1) | 1080×1350 | 2–10 cards, same ratio for all |
| Square | 1:1 | 1080×1080 | only if asked |

Each static is made in 4:5 and 9:16; the 9:16 is the same scene made taller, not a crop.

## Carousel

- 2–10 cards, all the same ratio. Card 1 must stop the scroll on its own.
- Every card makes sense alone (people see cards out of order) and the set looks like one family
  (same light, palette, wardrobe).
- One idea per card (benefit, step, use, detail, offer); the last card can carry the offer or CTA.

## Text

- Little text on the image performs better; the old 20 % rule no longer applies, but keep it short
  (≤ 7 words per text element, a title and at most one support line).
- Ad copy limits: `primaryText` ≤ 125 characters (what shows before "Ver más"), `headline` ≤ 40,
  `description` ≤ 30.
- `cta` must be one of Meta's buttons: Comprar, Más información, Ver más, Enviar mensaje,
  Registrarte, Obtener oferta… (default Comprar for stores).
- Rioplatense Spanish (voseo), natural, no all caps, no emoji spam.

## Policy (never ship)

- Wording that points at personal attributes: "¿Tenés acné?", "¿Estás gordo?", "¿Sufrís de…?".
  Talk about the situation or the product, not about the reader.
- Before/after of body, weight, health or cosmetic results.
- Fake interface: play buttons, fake notifications, fake "like" bars, fake system dialogs.
- Misleading prices or offers, or prices that will change (the ad handles current prices).
- Health or medical promises, absolute claims, named competitors (`claims-rules.md`). Every
  product statement comes from the product's `ficha.md` allowed list.
- Logos or brands that are not the client's; celebrity likenesses.

## Naming

`adName` follows `workspace.md`: `<productId>_<angle>_<actor or producto>_<estatica|carrusel>`,
lowercase except the `productId`, `_` between parts, no spaces
(`MLA1234567890_dolor_martin_estatica`). Use it as the ad name in Meta so results trace back to
the concept.

## Upload

The studio never uploads to Meta: another MCP does. Deliver, for each approved creative, the
files in order (4:5 and 9:16, or the cards 1…N), the `adName` and the copy.
