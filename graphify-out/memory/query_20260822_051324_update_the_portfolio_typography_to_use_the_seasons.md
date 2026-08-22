---
type: "query"
date: "2026-08-22T05:13:24.844607+00:00"
question: "Update the portfolio typography to use The Seasons for display/headline typography, Raleway for body/UI typography, and keep the existing monospace font for code/technical snippets."
contributor: "graphify"
source_nodes: ["GlobalStyles.astro", "global.d.ts", "titleTokens"]
---

# Q: Update the portfolio typography to use The Seasons for display/headline typography, Raleway for body/UI typography, and keep the existing monospace font for code/technical snippets.

## Answer

Expanded from original query via graph vocabulary: typography, styles, global, layout, theme, title, heading, body, card, code, project, post. The shared Layout and global typography tokens supply font loading and family roles; project, post, card, publication, impact, filter, and TOC components inherit those tokens with targeted optical sizing and UI overrides. The Seasons remains a non-embedded first-choice family because no licensed webfont exists in the repository; Fraunces is the existing development fallback, local Raleway supplies body/UI, and IBM Plex Mono remains limited to code and keyboard hints.

## Source Nodes

- GlobalStyles.astro
- global.d.ts
- titleTokens