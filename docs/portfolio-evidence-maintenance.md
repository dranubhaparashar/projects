# Portfolio evidence maintenance

This site renders a headline result only when a project has a verified `evaluation` record in its post frontmatter. Projects without that record render no metric placeholder.

## Evaluation records still needed

Provide the raw evaluation output plus the dataset/split/scenario definition, baseline, run count or seed policy, and hardware where relevant.

| Project | Evidence needed before a metric can be published |
| --- | --- |
| AI-Powered Telecom Reclamation | Labeled document test corpus, field-level exact match/precision/recall, parser version, and comparison baseline. |
| AegisFlow | Fixed repository benchmark suite, gate-level pass/fail accuracy, run-time distribution, failure categories, and baseline/manual comparison. |
| ASHU Mentor AI Studio | Held-out rubric agreement or scoring reliability, test-set definition, evaluator protocol, and baseline. |
| Engineering Work-Order P&L Analytics | Reproducible test report, synthetic scenario count, calculation-error rate, and reference implementation/baseline. |
| End-to-End YOLO Key Detection | Ultralytics `results.csv` or equivalent containing precision, recall, mAP@50, and mAP@50:95; held-out split details; latency/FPS with hardware and batch size. |
| DACR-Q | Controlled model/task benchmark containing peak memory, tokens/second or latency, quality/perplexity, model names, sequence lengths, and dense/quantized baselines. |
| MCP 2.0 | Repeatable load/resilience results: request volume, concurrency, p50/p95 latency, success rate, and failure-recovery conditions. |
| Autonomous Microservice Composition via LLM Agents | Held-out workflow/task success, planning/execution latency, failure rate, scenario count, and hard-coded orchestration baseline. |
| Vehicle-Scale LLMs | Controlled memory, latency/tokens-per-second, and quality results for the toy transformer, including device, sequence length, and uncompressed baseline. |
| MedClaim Sentinel | Clearly labeled synthetic claims test set with duplicate/fraud/clinical-review ground truth, precision, recall, F1, sample count, and error analysis. |
| Generator Reliability / CBM | Final held-out ROC-AUC, PR-AUC, precision, recall, F1 or Precision@K for each horizon, with train/validation/test split and calibration output. |

## Publications and patents

Structured records live in `src/data/credentials.ts`. The selected-publication dataset currently contains one DOI-verified Array article: “Vehicle-Scale LLMs: Integrating low-rank residuals and 4-bit quantization for in-vehicle AI” (2026), DOI `10.1016/j.array.2026.100709`.

The patent dataset and Google Scholar URL remain empty because no verified patent registry records or Scholar profile URL have been supplied. For a future publication, provide the complete author order, title, journal/venue, year, bibliographic fields, and DOI or publisher URL. For a patent, provide title, application/patent number, status, year, and official registry URL. Add the verified Scholar URL to `googleScholarUrl` only after it has been checked.

## Recorded project demos

No local WebM, MP4, or GIF project recording exists in the repository. Existing external demo videos are documented for AegisFlow, ASHU Mentor AI Studio, End-to-End YOLO Key Detection, Execution-Aware VRP, MedClaim Sentinel, AI-Powered Pole Validation, and Generator Reliability.

Add lightweight local recordings under:

```text
public/demos/<project-slug>/preview.webm
public/demos/<project-slug>/preview.mp4       # optional compatibility fallback
public/demos/<project-slug>/poster.webp
```

Recommended delivery:

- 1280×720 or 960×540, 16:9
- 10–20 seconds, ideally about 15 seconds
- WebM/VP9 preferred; H.264 MP4 optional fallback
- muted-safe content with no essential audio
- concise poster image matching the first useful frame
- keep each recording near or below 3 MB where practical

Associate a recording with a project post:

```yaml
demo:
  src: /demos/project-slug/preview.webm
  poster: /demos/project-slug/poster.webp
  type: video
  caption: Short factual description of the demonstrated workflow.
  description: Accessible description of the visible interaction and outcome.
```

The video component uses `muted`, `loop`, `playsInline`, `preload="none"`, native controls, a poster, and reduced-motion-aware hover/focus playback.

## Technical deep dives

The existing Archive remains the writing system. Do not create a second blog. Project frontmatter can link to related long-form posts:

```yaml
seo_title: Concise search title
social_image: /social/project-name.jpg
deep_dives:
  - title: Technical deep-dive title
    url: /archive-post-route/
    description: One-sentence scope.
    published: 2026-08-22
```

Archive posts already support publication date, tags, Markdown code blocks, diagrams/images, references, descriptions, and per-page metadata. Add `evaluation` or source links only when evidence exists.

## GoatCounter

Set this only in the production build environment:

```env
PUBLIC_GOATCOUNTER_CODE=your-site-code
```

For a standard GoatCounter site such as `example.goatcounter.com`, the code is `example`. A full count endpoint is also accepted. Leaving the value empty disables script loading, view-count fallback requests, and custom events. No local-development tracking is enabled.

Prepared anonymous events include project card opens, project CTA clicks, GitHub links, evaluation sources, publication/patent links, Impact Domain opens, project report downloads, deep dives, and Ask About This Project.

## Portrait source required

The only profile asset found is `src/assets/images/demo-avatar-removebg-preview.png`, a 200×200 transparent cutout. Do not retouch or upscale it as evidence of a better source. To correct edge/background color artifacts, provide the original high-resolution portrait before background removal, ideally PNG/TIFF/JPEG at 1500 px or larger on the long edge.
