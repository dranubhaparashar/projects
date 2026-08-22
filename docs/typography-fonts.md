# Portfolio typography fonts

## Current implementation

- Body and interface typography uses the local `Raleway Variable` upright Latin WOFF2 supplied by `@fontsource-variable/raleway` under the SIL Open Font License 1.1. The site uses weights 400, 500, and 600.
- Technical snippets retain the existing IBM Plex Mono stack.
- Display typography requests `The Seasons` first and uses the site's existing licensed Fraunces webfont, followed by Georgia, as the development fallback.

## The Seasons handoff

The repository does not currently contain a licensed The Seasons webfont or its license. Do not add an unverified copy.

To activate The Seasons, supply licensed web-use assets for these weights:

- Semibold WOFF2
- Bold WOFF2
- The applicable license or proof of web embedding rights

Once supplied, place the approved assets and license in `src/assets/fonts/`, add matching `@font-face` declarations to `src/styles/fonts.css`, and preload only the display weight used for the initial hero. The existing `--font-display` token will pick up the family automatically.
