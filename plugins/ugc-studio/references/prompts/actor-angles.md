# Actor identity validation (angles) — prompt template

Model: Higgsfield `gpt_image_2_6`, `aspect_ratio` `16:9`, `quality` `high`, `resolution` `2k`.
Reference: the chosen portrait as the only `medias` entry (`role: image_references`, `value` =
its job id or media id).

```txt
Using the supplied image as the single authoritative identity reference, create an identity validation sheet of {{name}}.

{{name}} must remain exactly the same fictional person shown in the reference image. Preserve {{pronoun_poss}} facial structure, apparent age, skin tone and texture, eye color and shape, eyebrows, nose, lips, cheekbones, jawline, hair color, hairline, hair texture, and all distinctive facial characteristics.

Show three clearly separated portraits of {{name}}:

1. Front-facing portrait, looking directly at the camera.
2. Three-quarter view, with {{pronoun_poss}} head turned approximately 45 degrees.
3. Strict side profile.

Keep the same hairstyle, clothing, expression intensity, lighting, camera distance, and neutral background in all three views.

Use a relaxed neutral expression with closed lips. Prioritize identity fidelity over attractiveness or artistic interpretation.

The result must look like three photographs of the exact same real person taken during the same session.

Do not beautify, reinterpret, stylize, age, rejuvenate, or modify {{pronoun_poss}} face. Do not change {{pronoun_poss}} eye color, hair color, facial proportions, makeup, or apparent ethnicity.

Avoid: alternative facial identities, facial morphing, exaggerated symmetry, beauty filters, plastic skin, different hairstyles, dramatic expressions, different makeup, jewelry, props, text, labels, or environmental elements.
```

Pass the result only if the three views are clearly the same person. If not, tell the user and
offer to discard the candidate and pick another.
