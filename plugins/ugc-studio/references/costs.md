# Higgsfield costs (measured 2026-11-10)

Always confirm the exact price with `get_cost: true` before generating; prices change. These
numbers are for explaining options to the user.

## Seedance 2.5 (`seedance_2_5`, 9:16, audio on)

| Resolution | Per second | 5 s | 15 s | 22 s |
|---|---|---|---|---|
| 480p (draft) | 3 | 15 | 45 | 66 |
| 720p | 7 | 35 | 105 | ~154 |
| 1080p | 16 | 80 | ~240 | ~352 |
| Finalize a draft to 1080p | 16 | 80 | ~240 | ~352 |

A draft (`draft: true`, 480p) can be finalized to 1080p within 7 days with `draft_job_id`,
without regenerating, for the same price as a direct 1080p generation.

### Draft or direct — how to explain it

- **Iterate with drafts:** each attempt costs about a fifth. Best when the idea is new, when the
  actor handles the product, or when several corrections are likely. Downside: if the first try
  is already good, the draft is ~19 % extra and there are two waits.
- **Direct to 1080p:** best for simple ideas (talking head) or ideas already tested, when one or
  two attempts are expected. Downside: every miss costs full price.
- **Rule of thumb:** if 2 or more attempts are likely, drafts are cheaper.
  Example (22 s): 3 drafts + final ≈ 550 credits; 3 attempts at 1080p ≈ 1,056.

## GPT Image 2.6 (`gpt_image_2_6`, quality high, 2k)

2.75 credits per image (4:5, 9:16 or 16:9).

## Storyboard + video (recommended flow)

Storyboard frames (2.75 each; 4 ≈ 11) + Seedance 2.5 15 s draft (45) ≈ **56 credits** per attempt. Fixing
one frame costs 2.75 more. In the 2026-11-10 test it got the staging right on the first try,
after three plain video attempts (143 credits) had failed.

Not worth it to fix a video: `video_edit` (53 for a 15 s draft, came out identical) and
Ad Multiplier hook rewrite (15 at 480p, no visible improvement).

## Creatives (Meta Ads, `crear-creativos`)

Every image is GPT Image 2.6 at 2.75 credits. Count images, not concepts:

- Static: 2 images (4:5 and 9:16) = 5.5. A 4:5-only static is 1 image.
- Carousel: one image per card (2–10).
- Example batch of 8 concepts: 6 statics × 2 slots + 2 carousels × 4 cards = 12 + 8 = **20 images
  = 55 credits**.
- Template mode: changing text (title, price, button, layout) costs **0**: only a new
  `<slot>-diseno-vN.html` and a render with `componer.sh`.
- Integrated mode: a text error (or any change to the image) costs **one more image** per slot
  that changes (2.75).
- Asking for a change on one slot or card regenerates only that slot or card.

Confirm the total with `get_cost: true` before generating.
