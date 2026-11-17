# Creative image — prompt templates (GPT Image 2.6)

Model: `gpt_image_2_6`, quality high, 2k, `aspect_ratio` `4:5` or `9:16`, 2.75 credits per image.
Write prompts in English; text that must appear in the image stays in the user's language,
in double quotes.

## Reference numbering

Number the references in the order they are passed in `medias` (all images) and say what each one
is in the prompt. Never write "the reference" without a number. Order:

1. Product photo A (alone, clean). 2. Product photo B (in use or detail), optional.
3. Actor portrait. 4. Actor character sheet (only when the concept has an actor; use the
   `portraitJobId` and `characterSheetJobId` of `actor.json`).
5. Previous image of the same creative (4:5 for the 9:16, card 1 for the other cards), when it
   applies. It is always the last reference.

Renumber when something is missing (product only: products come first, then the previous image).
Fill `{{…}}`; keep the constant sections.

## Common blocks

```txt
PRODUCT (reference image(s) {{product_refs}})
The exact product shown in reference image(s) {{product_refs}}: {{product_visual_description}}.
Keep its exact shape, color, material, proportions, label and printed text. Do not redesign it,
add parts, duplicate it or change its label.
```

```txt
PERSON (reference images {{actor_refs}})
The exact person from reference image {{portrait_ref}} (face and identity) and reference image
{{sheet_ref}} (body and proportions). Keep face, hair, apparent age and build. Wardrobe:
{{wardrobe}}, no logos or text. Natural hands with five fingers, holding the product the way it
is really used.
```

```txt
AVOID
Any text, letters, numbers, logos or watermarks (unless a text block above asks for them), fake
buttons or interface, plastic skin, face drift, extra or merged fingers, deformed hands, floating
objects, product morphing, invented parts, duplicated products, collage look.
```

## A. Template mode — image without text

```txt
Create a photorealistic {{aspect_ratio}} advertising image for Meta Ads.
Concept: {{concept_one_line}}. Visual: {{visual_format}}. Setting: {{setting}}. Light: {{light}}.
{{PRODUCT block}}
{{PERSON block, only with an actor}}
COMPOSITION
{{subject_and_framing}}. Leave the {{zona_words}} part of the frame calm and uncluttered ({{calm_surface}}: a wall, sky or floor
with soft light and no detail): text will be laid over it later. The product and the person stay
out of that area.
NO TEXT: no words, letters, numbers, logos, watermarks or UI anywhere in the image.
{{AVOID block}}
```

`zona_words`: `lower 40 %` for `abajo`, `upper 40 %` for `arriba`. For 9:16 also keep the top 14 %
and bottom 35 % free of the subject.

## B. Integrated mode — exact text

```txt
Create a photorealistic {{aspect_ratio}} advertising image for Meta Ads.
Concept: {{concept_one_line}}. Visual: {{visual_format}}. Setting: {{setting}}. Light: {{light}}.
{{PRODUCT block}}
{{PERSON block, only with an actor}}
COMPOSITION
{{subject_and_framing}}.
TEXT (render exactly, letter by letter, same spelling, accents and punctuation)
- Headline: "{{headline_text}}" — {{placement}}, {{font_style}}, high contrast against its background.
- {{Second element if any}}: "{{text_2}}" — {{placement_2}}.
No other text anywhere. Each text element at most 7 words. Keep text inside the safe area.
{{AVOID block, without the "Any text" part}}
```

After generating, read the image and compare each element letter by letter (accents, ñ, prices,
punctuation). On a mismatch regenerate that slot (2.75 more); never ship it.

## C. Carousel card N (N ≥ 2)

Pass card 1 as the last reference.

```txt
Create card {{n}} of {{total}} of a Meta Ads carousel, {{aspect_ratio}} (4:5), photorealistic.
Reference image {{prev_ref}} is card 1 of the same carousel: keep exactly its light, color palette,
wardrobe, setting style, camera look and (if any) text style, so the cards look like one family.
This card shows a different idea: {{card_idea}}. It must make sense on its own.
{{PRODUCT block}}
{{PERSON block, only with an actor}}
COMPOSITION
{{subject_and_framing}}. {{Template mode: leave the calm zone as in A. | Integrated mode: TEXT block as in B.}}
{{AVOID block}}
```

Card 1 uses template A or B as a normal 4:5 image, with the card idea as the concept.

## D. 9:16 from the 4:5

Pass the finished 4:5 as the last reference.

```txt
Create the vertical 9:16 version of the advertising image in reference image {{prev_ref}}: the
same scene, person, product, light and palette, shown taller (more environment above and below, not
a crop or a zoom). Keep the subject in the middle band: nothing important in the top 14 % or the
bottom 35 %.
{{PRODUCT block}}
{{PERSON block, only with an actor}}
{{Template mode: calm {{zona_words}} area as in A, NO TEXT. | Integrated mode: TEXT block as in B, inside the middle band.}}
{{AVOID block}}
```

## E. Variants by persona

- **Product only:** use the product block and no PERSON block; describe the surface, props and
  light. Props never hide the label.
- **With actor:** both blocks; say what the hands do and where the product is. Candid
  customer-photo look unless the concept asks for a studio look.
