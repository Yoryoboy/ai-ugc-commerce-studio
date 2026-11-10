# Actor master portrait — prompt template

Model: Higgsfield `gpt_image_2_6`, `aspect_ratio` `4:5`, `quality` `high`, `resolution` `2k`, text only
(no references). Generate 3 candidates (`count: 3`) so the user can choose.

Fill every `{{variable}}` from the user's choices. Write the variables in English. Keep the
constant parts exactly as written: they are what made the Luna portrait look like a real person.

```txt
Create a photorealistic portrait of a fictional {{nationality}} {{gender_noun}} named {{name}}, approximately {{age}} years old.

{{name}} has {{attractiveness_line}}. {{pronoun_cap}} has {{face_shape}}, {{eyes}}, {{eyebrows}}, {{nose}}, {{lips}}, {{cheekbones}}, and {{jawline}}.

{{pronoun_poss_cap}} skin is {{skin_tone}} with {{skin_undertone}}. Preserve realistic skin texture, natural pores, {{skin_details}}, small imperfections, and subtle tonal variation. {{pronoun_cap}} should look naturally attractive rather than digitally perfected.

{{pronoun_poss_cap}} hair is {{hair}}.

{{makeup_or_grooming}}

{{name}} should feel like {{creator_role}}: {{personality}}. {{pronoun_poss_cap}} appearance should be aspirational enough for advertising while still feeling like a real person someone could encounter in everyday life.

{{pronoun_cap}} is wearing {{outfit}} with no logos, text, jewelry, or visible brands.

{{pronoun_cap}} looks directly at the camera with relaxed confidence and a soft, genuine smile. {{pronoun_poss_cap}} posture and expression communicate warmth, credibility, and natural charisma.

Use soft natural daylight, realistic neutral color grading, and a simple unobtrusive background that keeps all attention on {{pronoun_obj}} identity.

The final result must resemble an authentic photograph of a real person—not a fashion campaign, stock photo, beauty-filter selfie, or obviously AI-generated face.

Prioritize a distinctive, memorable, and reproducible identity.

Avoid: plastic skin, excessive retouching, extreme facial symmetry, exaggerated features, heavy contouring, dramatic makeup, influencer posing, luxury styling, jewelry, logos, props, national symbols, celebrity resemblance, or stylized illustration.
```

## Reference values (Luna v1)

| Variable | Luna |
|---|---|
| nationality / gender_noun / age | Argentine / woman / 27 |
| attractiveness_line | a conventionally attractive, contemporary appearance with harmonious facial proportions and a polished but believable beauty |
| face_shape | a softly defined oval face |
| eyes | expressive almond-shaped light blue-green eyes |
| eyebrows / nose / lips | naturally full eyebrows / a straight refined nose / balanced full lips |
| cheekbones / jawline | subtle cheekbones / a defined but feminine jawline |
| skin_tone / skin_undertone / skin_details | fair to light-medium / a neutral-warm undertone / faint freckles |
| hair | long, thick, and naturally blonde with dimensional honey and dark-blonde tones, softly wavy, with a relaxed middle part and a few loose strands framing her face |
| makeup_or_grooming | She wears refined natural makeup: even but realistic skin, subtle mascara, softly defined eyebrows, light neutral blush, and natural rose-colored lips. |
| creator_role | an attractive, modern Argentine lifestyle creator |
| personality | confident, warm, charismatic, approachable, and effortlessly stylish |
| outfit | a simple, well-fitted cream-colored cotton top |

For men, replace the makeup line with grooming (for example "He is well groomed, with a short
natural beard trimmed close to the jaw and clean, natural skin.").
