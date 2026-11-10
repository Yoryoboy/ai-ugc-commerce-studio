# Actor character sheet — prompt template

The character sheet gives the video model the actor's body and proportions. It is the most
important reference for UGC video, together with the portrait.

Model: Higgsfield `gpt_image_2_6`, `aspect_ratio` `16:9`, `quality` `high`, `resolution` `2k`.
Reference: the chosen portrait as the only `medias` entry (`role: image_references`).

```txt
Using the supplied portrait as the single authoritative facial identity reference, create a photorealistic character reference sheet of {{name}}.

{{name}} must remain exactly the same fictional person shown in the reference portrait. Preserve {{pronoun_poss}} facial structure, apparent age, skin tone, eye color, eyebrows, nose, lips, cheekbones, jawline, hair color, hairline, hair texture, and distinctive facial characteristics.

Create four clearly separated views:

1. A high-detail chest-up frontal portrait.
2. A natural full-body front view.
3. A natural full-body side view.
4. A natural full-body back view.

{{name}} has {{body}}. {{pronoun_poss_cap}} body should look believable and consistent across all views, without exaggerated proportions or fashion-model proportions.

{{pronoun_cap}} wears the same simple neutral outfit in every view: {{full_outfit}}. No logos, text, jewelry, accessories, or visible brands.

Keep {{pronoun_poss}} hairstyle identical in every view. Use a relaxed neutral posture, arms resting naturally, and no expressive posing.

Use a plain neutral gray background, soft even lighting, consistent scale, and consistent color calibration across all views.

This is a production reference asset for preserving {{name}}'s identity and body proportions in future image and video generations. Prioritize anatomical clarity, identity fidelity, and consistency over aesthetics.

Do not reinterpret or beautify {{pronoun_obj}}. Do not change {{pronoun_poss}} face, body type, hairstyle, makeup, clothing, apparent age, or ethnicity.

Avoid: alternative faces, duplicated limbs, malformed hands, exaggerated anatomy, fashion poses, crossed limbs, props, environmental backgrounds, dramatic lighting, text, labels, or decorative layout.
```

Luna v1 values: body = "realistic, healthy, naturally feminine body proportions";
full_outfit = "a fitted cream-colored cotton top, straight medium-blue jeans, and clean white sneakers".
