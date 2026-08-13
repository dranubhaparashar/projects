# AI Projects Portfolio

[![Portfolio](https://img.shields.io/badge/Portfolio-Projects-blue?style=for-the-badge)](https://dranubhaparashar.github.io/projects/)
[![Website](https://img.shields.io/badge/Website-dranubhaparashar.github.io-black?style=for-the-badge)](https://dranubhaparashar.github.io/)
[![Built with Astro](https://img.shields.io/badge/Built%20with-Astro-orange?style=for-the-badge&logo=astro)](https://astro.build)
[![Tailwind CSS](https://img.shields.io/badge/Styled%20with-Tailwind%20CSS-38BDF8?style=for-the-badge&logo=tailwindcss)](https://tailwindcss.com)

## Overview

This repository powers the **AI Projects Portfolio** hosted at:

```text
https://dranubhaparashar.github.io/projects/
```

The website is a modern, responsive project and blog-style portfolio built to showcase AI, machine learning, GenAI, Agentic AI, computer vision, MLOps, DevSecOps, and research-oriented engineering work.

Project details are intentionally **not hard-coded in this README** because the project list will continue to grow and change over time. The latest projects, posts, categories, tags, and updates should be managed directly inside the website content files.

## Project Intelligence deployment modes

The public `Ask about my projects` assistant defaults to a fully static, zero-infrastructure-cost architecture:

```text
GitHub Pages
  -> browser BGE embeddings
  -> committed static vector index
  -> lexical + semantic hybrid retrieval
  -> grounded answer with trusted portfolio sources
  -> optional, visitor-triggered local browser Qwen explanation
```

No API key or backend is required. The grounded answer appears without loading Qwen. If a visitor selects **Generate deeper local AI explanation**, the open model weights are downloaded from Hugging Face once and persisted in the site's browser Cache Storage (`transformers-cache`). Refreshes and later visits in the same normal browser profile reuse those cached files while the site's storage remains; inference runs in the visitor's browser and questions are not sent to an external inference API. WebGPU-incompatible and mobile devices continue to use the sourced retrieval answer.

The optional high-power mode remains under `rag-api/`:

```text
GitHub Pages -> FastAPI -> BGE -> FAISS -> Qwen3-4B through Ollama
```

GitHub Pages itself cannot execute Python, FAISS, or Ollama. Configure `PUBLIC_PROJECT_AI_API_URL` only when that separate self-hosted service is intentionally deployed. See [`rag-api/README.md`](rag-api/README.md) for model details, index regeneration, privacy behavior, precedence, tests, and Docker instructions.

## ✨ Features

- [x] Built with [Astro](https://astro.build) and [Tailwind CSS](https://tailwindcss.com)
- [x] Smooth animations and page transitions
- [x] Light / dark mode
- [x] Customizable theme colors & banner
- [x] Responsive design
- [x] Search functionality with [Pagefind](https://pagefind.app/)
- [x] [Markdown extended features](https://github.com/saicaca/fuwari?tab=readme-ov-file#-markdown-extended-syntax)
- [x] Table of contents
- [x] RSS feed

## Technology Used

| Area | Technologies |
|---|---|
| Framework | Astro |
| Styling | Tailwind CSS |
| Language | TypeScript, JavaScript |
| Content | Markdown, YAML frontmatter |
| Search | Pagefind |
| Package Manager | pnpm |
| Formatting / Code Quality | Biome |
| Deployment | GitHub Pages, Vercel, Netlify, or any static hosting platform supported by Astro |
| UI Features | Responsive layout, light/dark mode, animations, page transitions, table of contents |
| Feed | RSS |
| Content Type | AI project posts, research posts, technical blogs, portfolio updates |

## Portfolio Focus Areas

The portfolio is designed for dynamic technical content across:

- Generative AI
- Agentic AI
- LLM applications
- Computer vision
- Deep learning
- MLOps and DevSecOps
- Cloud AI deployment
- Industrial AI systems
- Research engineering
- Data science and analytics
- AI infrastructure
- Automation and intelligent systems

## Getting Started

1. Create your blog repository:
   - [Generate a new repository](https://github.com/saicaca/fuwari/generate) from this template or fork this repository.
   - Or run one of the following commands:

     ```sh
     npm create fuwari@latest
     yarn create fuwari
     pnpm create fuwari@latest
     bun create fuwari@latest
     deno run -A npm:create-fuwari@latest
     ```

2. To edit your blog locally, clone your repository and run `pnpm install` to install dependencies.

   Install [pnpm](https://pnpm.io) if you have not installed it yet:

   ```sh
   npm install -g pnpm
   ```

3. Edit the config file to customize your blog:

   ```text
   src/config.ts
   ```

4. Create a new post:

   ```sh
   pnpm new-post <filename>
   ```

5. Edit the post inside:

   ```text
   src/content/posts/
   ```

6. Deploy your blog to Vercel, Netlify, GitHub Pages, or another static hosting platform by following the [Astro deployment guides](https://docs.astro.build/en/guides/deploy/).

   Before deployment, update the site configuration in:

   ```text
   astro.config.mjs
   ```

## Frontmatter of Posts

Each project or blog post can be defined using frontmatter.

```yaml
---
title: My First Blog Post
published: 2023-09-09
description: This is the first post of my new Astro blog.
image: ./cover.jpg
tags:
category: Front-end
draft: false
lang: jp      # Set only if the post's language differs from the site's language in `config.ts`
---
```

### Recommended Project Post Frontmatter

For AI project posts, the following structure is recommended:

```yaml
---
title: AI Project Title
published: 2026-01-01
description: Short summary of the project, problem, approach, and outcome.
image: ./cover.jpg
tags:
  - AI
  - Machine Learning
  - Computer Vision
  - GenAI
category: Projects
draft: false
---
```

## ⚡ Commands

All commands are run from the root of the project, from a terminal:

| Command | Action |
|:---|:---|
| `pnpm install` | Installs dependencies |
| `pnpm dev` | Starts local dev server at `localhost:4321` |
| `pnpm build` | Build your production site to `./dist/` |
| `pnpm preview` | Preview your build locally, before deploying |
| `pnpm check` | Run checks for errors in your code |
| `pnpm format` | Format your code using Biome |
| `pnpm new-post <filename>` | Create a new post |
| `pnpm migrate:github-comments` | Import GitHub comments into Firestore |
| `pnpm migrate:github-reactions` | Import GitHub reactions/likes into Firestore |
| `pnpm astro ...` | Run CLI commands like `astro add`, `astro check` |
| `pnpm astro --help` | Get help using the Astro CLI |

## Firebase Data

The live interaction data is stored in Firestore and uses the normalized post ID derived from the post path.

Current structure:

```text
projectPosts/{postId}
  baseViews
  views
  baseLikes
  likes
  baseReactions
  reactions
  commentsCount

projectPosts/{postId}/comments/{commentId}
  name
  authorName
  authorAvatarUrl
  body
  message
  source
  sourceCommentId
  importedAt

projectPosts/{postId}/reactionImports/{sourceReactionId}
  source: "github"
  sourceReactionId
  sourceCommentId
  sourceDiscussionNumber
  reactionKey
  reactionLabel
  emoji
  count
  importedAt
```

`projectPosts/{postId}` is the single visible stats document used by the post meta and reaction UI. Imported GitHub reactions are stored separately under `reactionImports` so the migration can be rerun without duplicating counts.

## Firestore Rules

The app currently expects public reads for post content and public writes for the interaction flow already exposed by the UI. A practical rules baseline is:

```js
match /databases/{database}/documents {
  match /projectPosts/{postId} {
    allow read: if true;
    allow update: if true; // tighten with Auth/App Check if you add it later

    match /comments/{commentId} {
      allow read: if true;
      allow create: if true;
      allow update, delete: if false;
    }

    match /reactionImports/{reactionId} {
      allow read: if true;
      allow write: if false; // Admin SDK migration only
    }
  }
}
```

If you later move to authenticated writes or App Check, tighten the update/create rules accordingly.

## Content Management

Project details should be added as individual Markdown posts instead of being written directly in this README.

Recommended content location:

```text
src/content/posts/
```

Recommended content types:

```text
AI project posts
Research posts
Technical implementation notes
Case-study style articles
Deployment walkthroughs
Architecture explanations
```

## Suggested Folder Structure

```text
project-portfolio/
├── public/
│   ├── favicon/
│   └── images/
├── src/
│   ├── assets/
│   ├── components/
│   ├── content/
│   │   └── posts/
│   ├── layouts/
│   ├── pages/
│   ├── styles/
│   └── config.ts
├── astro.config.mjs
├── package.json
├── pnpm-lock.yaml
├── README.md
└── tsconfig.json
```

## Deployment Notes

For GitHub Pages deployment, make sure the Astro configuration contains the correct site URL and base path.

Example:

```js
export default defineConfig({
  site: "https://dranubhaparashar.github.io",
  base: "/projects/",
});
```

For Vercel or Netlify, configure the build command and output directory:

```text
Build command: pnpm build
Output directory: dist
```

## Why This Portfolio Exists

This portfolio is maintained to present AI and research work in a professional, searchable, and scalable format. It is suitable for:

- AI/ML job applications
- Research collaborations
- Technical portfolio review
- Industry project demonstrations
- Client-facing project showcases
- Publication and project credibility building
- Startup or consulting profile presentation

## Author

**Dr. Anubha Parashar**  
AI Developer · GenAI Specialist · Agentic AI Builder · Computer Vision Researcher · MLOps Practitioner

Website:

```text
https://dranubhaparashar.github.io/
```

Projects:

```text
https://dranubhaparashar.github.io/projects/
```

## License and Usage

This README is intended for documenting the AI Projects Portfolio. Project descriptions, images, research content, posts, and personal portfolio material should not be reused without permission.
