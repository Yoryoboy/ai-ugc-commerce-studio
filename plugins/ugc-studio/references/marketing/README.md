# Marketing references: source and license

The files in this folder adapt marketing judgement from **marketingskills** by Corey Haines:

- Repository: https://github.com/coreyhaines31/marketingskills
- Commit: `8fd2fcade2fd6629026e9dfe6d133b55b36968b9`
- License: MIT

They are curated, translated into the studio's context (e-commerce, Rioplatense Spanish,
Higgsfield, the claims rules) and rewritten, not copied. The upstream plugin is deliberately not
installed beside the studio (trigger collisions, English questions to non-programmers, upstream
drift). Studio mechanics win on any conflict: Higgsfield, Seedance and GPT Image, credit
confirmation, drafts, storyboard, gallery contract, multi-client folders, allowed and forbidden
claims, Engram and the empirical lessons.

## Which studio file comes from which upstream file

Paths are relative to `skills/` in the upstream repository.

| Studio file | Upstream source | Used by |
|---|---|---|
| `marketing/copy.md` | `copywriting/` (SKILL.md, `references/ai-tells.md`), `copy-editing/` | `crear-video`, `crear-creativos` |
| `marketing/hooks.md` | `ad-creative/references/hook-system.md`, `ad-creative/references/short-form-video-specs.md` | `crear-video` |
| `marketing/formatos-meta.md` | `ad-creative/references/meta-creative-formats.md`, `static-ad-templates.md`, `awareness-headlines.md`, `ads/references/meta-andromeda-playbook.md` | `crear-creativos` |
| `marketing/psicologia.md` | `marketing-psychology/` (short extract) | `crear-creativos` |
| `producto.md`, `workspace.md` (`ficha.md` sections, `marca.json` voice and avoid fields) | `product-marketing/`, `customer-research/` | all product steps |
| `skills/leer-resultados/` | `ad-creative/` (iteration loop), `ab-testing/` | `leer-resultados` |
| `skills/leer-resultados/` section 5 (decision rules) | `ads/references/meta-decision-system.md` | `leer-resultados` |

Each writer adds or adjusts the row of the file it creates. Files not listed here are studio
originals.

## Deliberately ignored

- `ai-video-prompting.md` and `ai-image-prompting.md`: written for other models and they
  contradict the studio's tested Seedance and GPT Image lessons. The studio keeps its own prompts.
- Competitor callouts and price or urgency copy: forbidden by `claims-rules.md`.
- The English vocabulary blacklist in `ai-tells.md`: only the structural patterns are adapted.
- Review-screenshot visuals: only from real, permitted reviews.
- The single `product-marketing` context file: its fields go into `ficha.md` and `marca.json`,
  and learnings go to Engram.
- `offers`: not adopted. `marketing-psychology`: only a short extract.
- Founder, authority, VSL, street-interview and screen-recording formats: they need real people,
  credentials or other tools.

## Partially adopted

- `meta-decision-system.md` (in `leer-resultados`, read-only advice). **Taken:** the idea of one
  anchor number with every threshold derived from it (here the client's target CPA or ROAS,
  saved in memory, instead of TCPL), the data gate and kill/keep/scale multiples, fatigue signals
  (frequency, CTR and CPM trends), never editing a performing ad, +20 % every ~5 days and never
  +30 % in one move, the weekly cadence, separate testing and scaling campaigns, and ~50
  conversions a week before Advantage+. **Dropped:** TCPL and lead quality (CRM), lead forms,
  B2B benchmarks and the Q4 cut (it is the e-commerce peak), because they are lead-gen logic;
  also partnership ads, destination tests and the creative-production math, which need data or
  decisions the studio does not have. The studio only advises: it never pauses, scales or edits.

## How to update

To refresh from upstream, clone the repository, read what changed in the source files listed
above between commit `8fd2fcade2fd6629026e9dfe6d133b55b36968b9` and the new one, and port only
the changes that help this studio, checking each against `claims-rules.md` and the ignored list.
Then update the commit hash in this file, keep the license text below intact, and run the plugin
tests and `claude plugin validate plugins/ugc-studio`. Never paste whole upstream files.

## License

Copyright (c) 2025 Corey Haines

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
