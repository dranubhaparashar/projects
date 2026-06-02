# Anubha Parashar GitHub Pages Site

Personal blog and project portfolio built with Astro and Tailwind CSS.

- Live site: [https://anubhaparashar.github.io/](https://anubhaparashar.github.io/)
- GitHub repository: [https://github.com/anubhaparashar/anubhaparashar.github.io](https://github.com/anubhaparashar/anubhaparashar.github.io)

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

## 🚀 Getting Started

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
2. To edit your blog locally, clone your repository, run `pnpm install` to install dependencies.
    - Install [pnpm](https://pnpm.io) `npm install -g pnpm` if you haven't.
3. Edit the config file `src/config.ts` to customize your blog.
4. Run `pnpm new-post <filename>` to create a new post and edit it in `src/content/posts/`.
5. Deploy your blog to Vercel, Netlify, GitHub Pages, etc. following [the guides](https://docs.astro.build/en/guides/deploy/). You need to edit the site configuration in `astro.config.mjs` before deployment.

## 📝 Frontmatter of Posts

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

## ⚡ Commands

All commands are run from the root of the project, from a terminal:

| Command                    | Action                                              |
|:---------------------------|:----------------------------------------------------|
| `pnpm install`             | Installs dependencies                               |
| `pnpm dev`                 | Starts local dev server at `localhost:4321`         |
| `pnpm build`               | Build your production site to `./dist/`             |
| `pnpm preview`             | Preview your build locally, before deploying        |
| `pnpm check`               | Run checks for errors in your code                  |
| `pnpm format`              | Format your code using Biome                        |
| `pnpm new-post <filename>` | Create a new post                                   |
| `pnpm astro ...`           | Run CLI commands like `astro add`, `astro check`    |
| `pnpm astro --help`        | Get help using the Astro CLI                        |

## Firebase views, likes, and comments

Project post stats are stored in the Firestore `projectPosts` collection. Documents are created automatically when a post card or post page is opened, so no manual Firestore document creation is needed for each post.

Counters are split so historical data is preserved:

- GoatCounter historical views are imported into `baseViews`.
- New Firebase page views are stored in `views`.
- Displayed views are `baseViews + views`.
- Preserved/imported likes belong in `baseLikes`; new Firebase likes are stored in `likes`.
- Displayed likes are `baseLikes + likes`.
- Preserved/imported comment counts belong in `baseCommentsCount`; new Firebase comments increment `commentsCount`.
- Displayed comment counts are `baseCommentsCount + commentsCount`.

Run the GoatCounter migration only from a trusted local machine or CI environment with secrets in environment variables:

```sh
pnpm node scripts/migrate-goatcounter-to-firestore.mjs
```

If the GoatCounter API export is not available, edit `scripts/base-views.json` and run:

```sh
pnpm node scripts/import-base-views-from-json.mjs
```

The Firebase service account key is only for migration scripts. Never commit `serviceAccountKey.json`, `FIREBASE_SERVICE_ACCOUNT_JSON`, GoatCounter API tokens, or any private API token to the repository or frontend code.

