---
type: "query"
date: "2026-08-09T12:18:26.701636+00:00"
question: "Fix Project Intelligence suggested questions after the drawer was portaled to document.body."
contributor: "graphify"
source_nodes: ["ProjectIntelligenceController", "mountProjectIntelligence"]
---

# Q: Fix Project Intelligence suggested questions after the drawer was portaled to document.body.

## Answer

Expanded from original query via graph vocabulary: project, intelligence, controller, click, button, layer, body, root, swup, question, interaction, event. The delegated suggestion/query click listener was attached to the custom-element root, so clicks stopped reaching it after the layer moved to document.body. The listener is now attached to the portaled layer, while suggestion clicks and form submits share the controller-owned ask flow. AbortController cleanup and one active controller prevent duplicates after Swup.

## Source Nodes

- ProjectIntelligenceController
- mountProjectIntelligence