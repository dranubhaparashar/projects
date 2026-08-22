# Portfolio typography fonts

## Current implementation

- Body and interface typography uses the local `Raleway Variable` upright Latin WOFF2 supplied by `@fontsource-variable/raleway` under the SIL Open Font License 1.1. The site uses weights 400, 500, and 600.
- Technical snippets retain the existing IBM Plex Mono stack.
- Display typography uses the local `Cormorant Garamond` upright Latin WOFF2 files supplied by `@fontsource/cormorant-garamond` under the SIL Open Font License 1.1. Only weights 600 and 700 are declared.

## Display font delivery

The display face is self-hosted through the build rather than requested from Google Fonts. `src/styles/fonts.css` declares only the 600 and 700 Latin WOFF2 files, and the layout preloads the 700 weight used by the primary heading above the fold. The Google Fonts request is retained solely for IBM Plex Mono 400 and 500.
