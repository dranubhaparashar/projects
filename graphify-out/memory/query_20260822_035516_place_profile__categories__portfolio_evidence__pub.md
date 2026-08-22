---
type: "query"
date: "2026-08-22T03:55:16.307353+00:00"
question: "Place profile, categories, portfolio evidence, publications, and tags in the Projects sidebar with mobile-first ordering"
contributor: "graphify"
source_nodes: ["Tags.astro", "WidgetLayout.astro", "@components/widget/SideBar.astro"]
---

# Q: Place profile, categories, portfolio evidence, publications, and tags in the Projects sidebar with mobile-first ordering

## Answer

Expanded from the repository graph vocabulary via profile, categories, evidence, impact, portfolio, tags, project, layout, grid, mobile, and component. The graph traced Tags.astro through WidgetLayout.astro to the shared SideBar.astro ownership boundary; the implementation therefore composes the project evidence rail in SideBar.astro and passes project posts through MainGridLayout.astro.

## Source Nodes

- Tags.astro
- WidgetLayout.astro
- @components/widget/SideBar.astro