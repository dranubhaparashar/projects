# Performance audit

## Baseline captured before this change

The existing `dist` build was dated 2026-08-22 06:44:18 +05:30.

| Local build property | Baseline |
| --- | ---: |
| Files | 231 |
| Total bytes | 90,284,134 |
| JavaScript bytes | 2,870,022 |
| CSS bytes | 414,701 |
| Image bytes | 31,784,072 |
| Homepage HTML bytes | 452,847 |

The baseline homepage HTML contained both `theme-image-light` and `theme-image-dark`, referenced both hero variants, and contained no canonical link or Open Graph image.

Source hero assets are large: `hero-light.png` is 2,322,184 bytes and the inspected dark source is 5,340,577 bytes. The updated theme-aware image component emits one semantic image and assigns only the active optimized hero URL before paint; the alternate URL remains available for theme switching but is not eagerly fetched.

## Structural changes

- One active hero image instead of simultaneous light/dark image elements.
- High fetch priority and eager loading remain limited to the LCP hero.
- Below-fold project and article images retain lazy loading and async decoding.
- Project demo videos use `preload="none"` and poster frames.
- The homepage Impact Domain preview is static HTML/CSS and does not hydrate the full graph.
- GoatCounter loads only in production and only when configured.
- No duplicate project-card content tree was found; the existing single-card semantic structure was preserved.

## Validated production output

The final production build completed on 2026-08-22 with the following local output:

| Local build property | Final build |
| --- | ---: |
| Files | 249 |
| Total bytes | 116,086,629 |
| JavaScript bytes | 2,870,546 |
| CSS bytes | 423,174 |
| Image bytes | 59,091,465 |
| Homepage HTML bytes | 476,134 |

The final homepage contains one semantic `data-theme-image` hero element. Its alternate-theme URL is held in a data attribute and is not an image `src` until the theme becomes active. Six verified project metrics are rendered once each, and project pages without evidence contain no empty metric block.

The baseline directory was a pre-existing/stale build rather than an output regenerated from the same source revision, so aggregate byte totals are recorded but are not treated as a controlled before/after comparison. The larger final directory includes a complete regenerated asset graph, Pagefind output, and the new social asset. No Lighthouse or external PageSpeed run was available, so no score is claimed.
