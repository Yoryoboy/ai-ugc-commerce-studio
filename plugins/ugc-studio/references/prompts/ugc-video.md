# UGC video — prompt template (Seedance 2.5)

Derived from the Derma Biosa prompt that worked (15 s, actor + product, 2026-11-10).

Model: `seedance_2_5`, `mode: omni_reference`, `aspect_ratio: 9:16`, `generate_audio: true`.
References (`medias`, all `role: image_references`), in this order:

1. Actor portrait (job/media id from the actor's record).
2. Actor character sheet.
3–5. Up to three product photos: the product alone, the product in use, and a detail
   (label, thread, texture). Prefer photos without text overlays.

Seedance 2.5 ignores Higgsfield Elements: always pass the images.

Fill `{{…}}`. Keep the constant sections. Write the prompt in English and the dialogue in the
language and accent the user chose (Rioplatense Spanish by default). Budget about 2.5 spoken
words per second (15 s ≈ 35–40 words). One shot per 3–5 seconds.

```txt
Create a photorealistic vertical UGC video featuring the exact person shown in reference images 1 and 2 and the exact product shown in reference images {{product_ref_numbers}}.

The final result must feel like authentic social media content filmed by a real Argentine creator on their phone. This is NOT a traditional commercial. It should feel casual, spontaneous and believable.

GLOBAL FORMAT
Vertical 9:16 smartphone UGC video. Total duration: {{duration}} seconds.
Style: {{style_line}}, TikTok / Instagram Reels aesthetic, realistic smartphone footage, natural social-media pacing.
The camera is the phone's front-facing camera held by the creator, or a phone on a small tripod; the phone itself is never visible in frame and this is not a mirror selfie.
No subtitles. No on-screen text. No graphic overlays. No added logos.

CHARACTER REFERENCE — {{actor_name_upper}}
Reference image 1 is the single authoritative facial identity reference. Reference image 2 is the body and proportion reference for the same person.
{{actor_identity_paragraph}}
Preserve the exact facial identity throughout the entire video. Do not beautify, reinterpret or change facial proportions, hair or apparent age.
WARDROBE: {{wardrobe}}. No logos, no text, no jewelry, no visible brands.

PRODUCT REFERENCE — {{product_name_upper}}
Reference images {{product_ref_numbers}} are authoritative visual references for the exact product: {{product_name}}.
Preserve the exact physical product in every shot: {{product_visual_description}}.
Do not redesign the product, change its shape, color, material, size or proportions, invent parts, duplicate it, or morph it between shots.

PRODUCT INFORMATION FOR DIALOGUE
{{allowed_claims_summary}}
Communicate these ideas naturally. Do not invent features. {{forbidden_claims_line}}

LOCATION
{{location}} Daytime, soft natural window light. Clean but lived-in, believable and personal, not a studio set.

PERFORMANCE
{{actor_name}} behaves like a real creator casually sharing something useful. Relaxed and conversational; occasionally looks at the phone screen. Natural blinking, small hand movements, slight pauses and spontaneous expressions. Not a commercial actor: no exaggerated enthusiasm, no sales-presenter gestures.

VOICE AND LANGUAGE
{{actor_name}} speaks all dialogue in Spanish with a native Argentine Buenos Aires / Rioplatense accent, genuinely Argentine but not exaggerated. Do NOT use neutral, Mexican, Caribbean or European Spanish. Voice: {{voice_line}}. No announcer voice. Accurate natural lip synchronization for all visible dialogue.

{{shots}}

CAMERA
Realistic modern smartphone camera, vertical handheld footage, natural focal length, subtle handheld movement, minor framing imperfections, realistic autofocus. No dolly, crane, dramatic zooms or orbiting camera.

LIGHTING
Soft natural daylight from a nearby window, realistic indoor fill, flattering but imperfect. No beauty, fashion or colored cinematic lighting.

AUDIO
Synchronized native audio, natural room tone, very subtle ambience. No background music. During B-roll the speech may continue as voice-over.

REALISM AND CONTINUITY
Priorities: 1) exact identity, 2) exact product, 3) realistic human movement, 4) correct hands and fingers, 5) realistic interaction with the product, 6) accurate lip sync, 7) consistent room, lighting, wardrobe and hair.

AVOID
AI-looking or plastic skin, face morphing, identity drift, a different person, changing hair or clothes, extra or merged fingers, deformed hands, floating objects, product morphing, invented parts, duplicated products, random additional products, perfect studio framing, commercial acting, salesperson delivery, subtitles, captions, overlays, added logos, watermarks, visible phone, mirror selfie.

FINAL INTENT
It should look like {{actor_name}} genuinely filmed this at home on their phone. UGC first, advertising second.
```

## Storyboard numbering

With a storyboard, frame 1 goes as `start_image` and Higgsfield lists it as reference image 1.
Number the rest in the order passed: 2 portrait, 3 character sheet, 4…(n+2) frames 2…n, then
the product photo. Adjust the CHARACTER and PRODUCT REFERENCE lines to those numbers.

Put this block before the shots:

```txt
STORYBOARD (authoritative staging)
Reference image 1 (the start frame) and reference images {{frame_ref_numbers}} are the storyboard. Reproduce each shot's composition, staging, props, product orientation and positions exactly as shown. Do not improvise the physical action.
```

## Shot format

```txt
SHOT 1 — HOOK (0:00–0:04) — matches reference image 1 (start frame)
<framing and action, as in the frame>
{{actor_name}} says: "<line>"
<delivery note>
```

Shot 1 must hook in the first 3 seconds (a problem, a surprise or a before/after). Close with a
soft recommendation, never an aggressive call to action.
