// src/scripts/project-intelligence.ts
var NO_INFORMATION = "I could not find that information in the published portfolio.";
var NO_MATCH = "I could not find a matching project in the published portfolio.";
var PORTFOLIO_REDIRECT = "This assistant answers questions about Anubha?s published projects, technologies and research. Try asking which projects use computer vision, Snowflake or Generative AI.";
var GENERIC_TERMS = /* @__PURE__ */ new Set([
  "ai",
  "python",
  "project",
  "projects",
  "application",
  "applications",
  "machine learning"
]);
var STOP_WORDS = /* @__PURE__ */ new Set([
  "a",
  "about",
  "all",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "built",
  "do",
  "does",
  "for",
  "from",
  "have",
  "how",
  "i",
  "in",
  "involving",
  "is",
  "me",
  "most",
  "my",
  "of",
  "on",
  "related",
  "relevant",
  "show",
  "that",
  "the",
  "these",
  "this",
  "those",
  "to",
  "use",
  "used",
  "uses",
  "what",
  "which",
  "with",
  "you"
]);
var QUERY_EXPANSIONS = [
  {
    pattern: /\bcomputer vision\b/i,
    terms: [
      "computer vision",
      "object detection",
      "video analytics",
      "image processing",
      "yolo",
      "ocr"
    ]
  },
  {
    pattern: /\bgenerative ai\b|\bgenai\b/i,
    terms: [
      "generative ai",
      "genai",
      "large language model",
      "llm",
      "rag",
      "language model"
    ]
  },
  {
    pattern: /\bmultimodal(?: ai)?\b/i,
    terms: [
      "multimodal ai",
      "multimodal",
      "vision language",
      "image and text",
      "document intelligence"
    ]
  },
  {
    pattern: /\bhealth(?:care)?\b|\bmedical\b/i,
    terms: ["healthcare", "medical", "clinical", "claim", "insurance"]
  },
  {
    pattern: /\blogistics?\b|\bsupply chain\b/i,
    terms: [
      "logistics",
      "warehouse",
      "vehicle routing",
      "vrp",
      "route optimization",
      "inventory",
      "truck",
      "field operations"
    ]
  },
  {
    pattern: /\bidentity\b|\bdecentralized identity\b/i,
    terms: [
      "identity",
      "decentralized identity",
      "verifiable presentation",
      "zero knowledge",
      "zkp",
      "bbs",
      "anoncreds",
      "privacy"
    ]
  }
];
function normalize(value) {
  return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9+#.]+/g, " ").replace(/\s+/g, " ").trim();
}
function unique(values) {
  const seen = /* @__PURE__ */ new Set();
  return values.filter((value) => {
    const key = normalize(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function queryTerms(query) {
  const normalizedQuery = normalize(query);
  const terms = [];
  for (const expansion of QUERY_EXPANSIONS) {
    if (expansion.pattern.test(query)) terms.push(...expansion.terms);
  }
  for (const token of normalizedQuery.split(" ")) {
    if (token.length < 2 || STOP_WORDS.has(token) || GENERIC_TERMS.has(token)) {
      continue;
    }
    terms.push(token);
  }
  if (normalizedQuery.length > 2 && !GENERIC_TERMS.has(normalizedQuery) && !/^which |^show |^have |^what |^is |^compare /.test(normalizedQuery)) {
    terms.unshift(normalizedQuery);
  }
  return unique(terms.map(normalize));
}
function findExactValue(values, term) {
  return values.find((value) => normalize(value) === term);
}
function findContainingValue(values, term) {
  return values.find((value) => normalize(value).includes(term));
}
function rankProject(project, query, terms) {
  const normalizedQuery = normalize(query);
  const title = normalize(project.title);
  const description = normalize(project.description);
  const category = normalize(project.category);
  const content = normalize(project.searchableContent);
  const tags = project.tags || [];
  const technologies = project.technologies || [];
  const capabilities = project.capabilities || [];
  const domains = project.impactDomains || [];
  const problemLabels = (project.problems || []).map(
    (problem) => problem.label
  );
  const reasons = /* @__PURE__ */ new Set();
  let score = 0;
  if (normalizedQuery === title) {
    score += 1200;
    reasons.add("Exact project title match.");
  } else if (title.length >= 8 && normalizedQuery.includes(title)) {
    score += 900;
    reasons.add("The question names this project.");
  }
  for (const term of terms) {
    if (!term || GENERIC_TERMS.has(term)) continue;
    if (title.includes(term)) {
      score += 120;
      reasons.add(`Title matches ?${term}?.`);
    }
    const exactDomain = findExactValue(domains, term);
    const exactProblem = findExactValue(problemLabels, term);
    const exactTechnology = findExactValue(technologies, term);
    const exactTag = findExactValue(tags, term);
    const exactCapability = findExactValue(capabilities, term);
    if (exactDomain) {
      score += 420;
      reasons.add(`Mapped to the ${exactDomain} impact domain.`);
    } else if (exactProblem) {
      score += 390;
      reasons.add(`Addresses ${exactProblem}.`);
    } else if (exactTechnology) {
      score += 380;
      reasons.add(`Uses ${exactTechnology}.`);
    } else if (exactTag) {
      score += 350;
      reasons.add(`Tagged ${exactTag}.`);
    } else if (exactCapability) {
      score += 350;
      reasons.add(`Lists ${exactCapability} as a capability.`);
    } else {
      const domain = findContainingValue(domains, term);
      const problem = findContainingValue(problemLabels, term);
      const technology = findContainingValue(technologies, term);
      const tag = findContainingValue(tags, term);
      const capability = findContainingValue(capabilities, term);
      if (domain) {
        score += 170;
        reasons.add(`Mapped to the ${domain} impact domain.`);
      }
      if (problem) {
        score += 160;
        reasons.add(`Addresses ${problem}.`);
      }
      if (technology) {
        score += 150;
        reasons.add(`Uses ${technology}.`);
      }
      if (tag) {
        score += 140;
        reasons.add(`Tagged ${tag}.`);
      }
      if (capability) {
        score += 140;
        reasons.add(`Lists ${capability} as a capability.`);
      }
    }
    if (category === term || category.includes(term)) {
      score += category === term ? 120 : 65;
      reasons.add(`Category: ${project.category}.`);
    }
    if (description.includes(term)) {
      score += 48;
      reasons.add("The published description directly matches the question.");
    }
    if (content.includes(term)) {
      score += 8;
    }
  }
  return { project, score, reasons: [...reasons] };
}
function searchPortfolio(index, query, scopeIds) {
  const allowed = scopeIds?.length ? new Set(scopeIds) : null;
  const terms = queryTerms(query);
  return index.projects.filter((project) => !allowed || allowed.has(project.id)).map((project) => rankProject(project, query, terms)).filter((match) => match.score >= 35).sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;
    if (a.project.year !== b.project.year) {
      return b.project.year.localeCompare(a.project.year);
    }
    return a.project.title.localeCompare(b.project.title);
  });
}
function titleTokens(project) {
  return normalize(`${project.title} ${project.slug}`).split(" ").filter(
    (token) => token.length >= 2 && !STOP_WORDS.has(token) && !GENERIC_TERMS.has(token)
  );
}
function findProjectReference(index, reference) {
  const normalizedReference = normalize(reference);
  if (!normalizedReference) return void 0;
  const referenceTokens = normalizedReference.split(" ").filter((token) => token.length >= 2 && !STOP_WORDS.has(token));
  let best;
  for (const project of index.projects) {
    const normalizedTitle = normalize(project.title);
    let score = 0;
    if (normalizedTitle === normalizedReference || normalizedTitle.includes(normalizedReference)) {
      score += 500;
    }
    const tokens = titleTokens(project);
    for (const token of referenceTokens) {
      if (tokens.includes(token)) score += token.length >= 5 ? 80 : 45;
    }
    if (!best || score > best.score) best = { project, score };
  }
  return best && best.score >= 45 ? best.project : void 0;
}
function currentProject(index, currentSlug) {
  const slug = normalize(currentSlug);
  return index.projects.find(
    (project) => normalize(project.slug) === slug || normalize(project.id) === slug
  );
}
function statusLabel(status) {
  return {
    production: "Production deployment",
    prototype: "Prototype",
    research: "Research experiment",
    concept: "Concept",
    demo: "Demo",
    unspecified: "Deployment not specified"
  }[status];
}
function rankedReason(match) {
  return match.reasons.slice(0, 2).join(" ") || match.project.description || "Matches the published portfolio data.";
}
function collectTechnologies(projects) {
  return unique(
    projects.flatMap((project) => project.technologies || [])
  ).slice(0, 12);
}
function scopedProjects(index, state, query) {
  if (!/\b(those|these|them|previous|above)\b/i.test(query)) return void 0;
  if (!state.lastProjectIds.length) return void 0;
  const ids = new Set(state.lastProjectIds);
  return index.projects.filter((project) => ids.has(project.id));
}
function namedProjects(index, query, current) {
  if (current && /\b(this|current) project\b/i.test(query)) return [current];
  const references = query.replace(/^.*?\bcompare\b/i, "").split(/\b(?:and|versus|vs\.?|with)\b|,/i).map((part) => part.replace(/\bprojects?\b/gi, "").trim()).filter(Boolean);
  const found = references.map((reference) => findProjectReference(index, reference)).filter(
    (project) => Boolean(project)
  );
  return unique(found.map((project) => project.id)).map(
    (id) => found.find((project) => project.id === id)
  );
}
function isPortfolioQuestion(query, ranked, current) {
  if (current && /\b(this|current)\b/i.test(query)) return true;
  if (ranked.length > 0) return true;
  return /\b(project|portfolio|technolog(?:y|ies)|research|deploy|production|prototype|demo|github|paper|architecture|dataset|metric|result|accuracy|impact domain|problem|capabilit(?:y|ies)|compare)\b/i.test(
    query
  );
}
function detailAnswer(projects, kind) {
  const available = projects.filter((project) => {
    if (kind === "dataset") return Boolean(project.datasetDetails);
    if (kind === "results") return Boolean(project.resultsAndMetrics);
    return project.architecture.available;
  });
  if (!available.length) return { lead: NO_INFORMATION, projects: [] };
  return {
    lead: kind === "dataset" ? "Published dataset details are available for the following project(s)." : kind === "results" ? "Published results or metrics are available for the following project(s)." : "Published architecture information is available for the following project(s).",
    projects: available.map((project) => ({
      project,
      reason: kind === "dataset" ? project.datasetDetails : kind === "results" ? project.resultsAndMetrics : project.architecture.details || "The project includes an architecture section or asset."
    })),
    technologies: collectTechnologies(available)
  };
}
function deploymentAnswer(projects, productionOnly) {
  const selected = productionOnly ? projects.filter((project) => project.deployment.status === "production") : projects;
  if (!selected.length) return { lead: NO_INFORMATION, projects: [] };
  return {
    lead: productionOnly ? `Yes. I found ${selected.length} project${selected.length === 1 ? "" : "s"} with explicit production-deployment evidence in the published portfolio.` : "The published deployment classification is shown below.",
    projects: selected.map((project) => ({
      project,
      reason: project.deployment.details || statusLabel(project.deployment.status),
      evidence: project.deployment.evidence
    })),
    technologies: collectTechnologies(selected)
  };
}
function similarProjects(index, project) {
  const byId = new Map(
    index.projects.map((candidate) => [candidate.id, candidate])
  );
  const explicit = (project.relatedProjectIds || []).map((id) => byId.get(id)).filter(
    (candidate) => Boolean(candidate)
  );
  if (explicit.length) return explicit.slice(0, 5);
  const query = unique([
    ...project.impactDomains || [],
    ...project.technologies || [],
    ...project.tags || []
  ]).slice(0, 8).join(" ");
  return searchPortfolio(index, query).map((match) => match.project).filter((candidate) => candidate.id !== project.id).slice(0, 5);
}
function answerPortfolioQuestion(index, query, state, currentSlug = "") {
  const trimmed = query.trim();
  const current = currentProject(index, currentSlug);
  const scoped = scopedProjects(index, state, trimmed);
  const ranked = searchPortfolio(
    index,
    trimmed,
    scoped?.map((project) => project.id)
  );
  if (!isPortfolioQuestion(trimmed, ranked, current)) {
    return { lead: PORTFOLIO_REDIRECT, projects: [] };
  }
  if (/\bcompare\b|\bversus\b|\bvs\.?\b/i.test(trimmed)) {
    const compared = namedProjects(index, trimmed, current).slice(0, 2);
    if (compared.length < 2) {
      return { lead: NO_MATCH, projects: [], navigation: true };
    }
    return {
      lead: "Here is a portfolio-grounded comparison of the two published projects.",
      projects: compared.map((project) => ({
        project,
        reason: `${project.category}; ${statusLabel(project.deployment.status)}. ${project.description}`,
        evidence: project.deployment.evidence
      })),
      technologies: collectTechnologies(compared)
    };
  }
  if (current && /\bexplain this project\b/i.test(trimmed)) {
    return {
      lead: "Here is the published summary for the current project.",
      projects: [{ project: current, reason: current.description }],
      technologies: collectTechnologies([current])
    };
  }
  if (current && /\bshow similar projects?\b|\bsimilar to this\b/i.test(trimmed)) {
    const similar = similarProjects(index, current);
    if (!similar.length)
      return { lead: NO_MATCH, projects: [], navigation: true };
    return {
      lead: "These projects have the strongest published domain, technology, tag or related-project overlap.",
      projects: similar.map((project) => ({
        project,
        reason: project.description
      })),
      technologies: collectTechnologies(similar)
    };
  }
  if (current && /\bwhat problem|\bproblem does this solve/i.test(trimmed)) {
    const reasons = current.problems.map((problem) => problem.label);
    return {
      lead: reasons.length ? "The current project maps to the following published problem areas." : "The current project?s published description provides the available problem context.",
      projects: [
        {
          project: current,
          reason: reasons.length ? reasons.join("; ") : current.description || NO_INFORMATION
        }
      ],
      technologies: collectTechnologies([current])
    };
  }
  const referenced = namedProjects(index, trimmed, current);
  const detailScope = scoped?.length ? scoped : referenced.length ? referenced : current ? [current] : [];
  if (/\b(dataset|training data|data size|data source)\b/i.test(trimmed)) {
    return detailAnswer(
      detailScope.length ? detailScope : ranked.map((match) => match.project),
      "dataset"
    );
  }
  if (/\b(result|metric|accuracy|precision|recall|f1|latency|throughput)\b/i.test(
    trimmed
  )) {
    return detailAnswer(
      detailScope.length ? detailScope : ranked.map((match) => match.project),
      "results"
    );
  }
  if (/\barchitecture|system design\b/i.test(trimmed)) {
    return detailAnswer(
      detailScope.length ? detailScope : ranked.map((match) => match.project),
      "architecture"
    );
  }
  if (/\b(deploy|deployed|deployment|production|live system|24\s*x\s*7)\b/i.test(
    trimmed
  )) {
    const scope = scoped || referenced || (current ? [current] : index.projects);
    const productionOnly = !current || /\bproduction|which of those|which are deployed|have you deployed\b/i.test(
      trimmed
    );
    return deploymentAnswer(scope, productionOnly);
  }
  if (/\btechnolog(?:y|ies)|tech stack\b/i.test(trimmed) && current) {
    if (!current.technologies.length) {
      return {
        lead: NO_INFORMATION,
        projects: [{ project: current, reason: current.description }]
      };
    }
    return {
      lead: "The current project lists the following technologies in its published portfolio data.",
      projects: [{ project: current, reason: current.description }],
      technologies: current.technologies
    };
  }
  const availabilityKind = /\bgithub|repositories?\b/i.test(trimmed) ? "github" : /\blive demos?|demo links?\b/i.test(trimmed) ? "demo" : /\bpapers?|publications?\b/i.test(trimmed) ? "paper" : /\bdocumentation|docs\b/i.test(trimmed) ? "docs" : void 0;
  if (availabilityKind) {
    const available = index.projects.filter(
      (project) => project.actions.some((action) => action.kind === availabilityKind)
    );
    if (!available.length) return { lead: NO_INFORMATION, projects: [] };
    const label = {
      github: "GitHub repository",
      demo: "live demo",
      paper: "paper",
      docs: "documentation",
      video: "video"
    }[availabilityKind];
    return {
      lead: `I found ${available.length} published project${available.length === 1 ? "" : "s"} with an explicit ${label} link.`,
      projects: available.map((project) => ({
        project,
        reason: `The published portfolio includes an explicit ${label} URL.`
      })),
      technologies: collectTechnologies(available)
    };
  }
  let results = ranked;
  if (/\bresearch\b/i.test(trimmed)) {
    const researchResults = results.filter(
      (match) => /\bresearch|experiment|benchmark\b/i.test(
        `${match.project.category} ${match.project.description} ${match.project.searchableContent}`
      )
    );
    if (researchResults.length) results = researchResults;
  }
  if (!results.length)
    return { lead: NO_MATCH, projects: [], navigation: true };
  const recommendation = /\bmost relevant|\bbest match|\brecommend/i.test(
    trimmed
  );
  const selected = results.slice(0, recommendation ? 3 : 6);
  return {
    lead: recommendation ? "The strongest deterministic portfolio match is shown first, followed by closely related published projects." : `I found ${selected.length} relevant published project${selected.length === 1 ? "" : "s"}.`,
    projects: selected.map((match) => ({
      project: match.project,
      reason: rankedReason(match)
    })),
    technologies: collectTechnologies(selected.map((match) => match.project))
  };
}
function element(tagName, className) {
  const node = document.createElement(tagName);
  if (className) node.className = className;
  return node;
}
function appendText(parent, tag, text, className) {
  const node = element(tag, className);
  node.textContent = text;
  parent.append(node);
  return node;
}
function externalLink(anchor, href) {
  if (/^https?:\/\//i.test(href)) {
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
  }
}
function renderProjectCard(answerProject, index) {
  const { project, reason, evidence = [] } = answerProject;
  const card = element("article", "project-intelligence-project-card");
  const heading = element("h4");
  const title = element("a");
  title.href = project.url;
  title.textContent = project.title;
  title.setAttribute("aria-label", `View project: ${project.title}`);
  heading.append(title);
  card.append(heading);
  const meta = element("div", "project-intelligence-project-meta");
  appendText(meta, "span", project.category);
  appendText(meta, "span", project.year);
  appendText(
    meta,
    "span",
    statusLabel(project.deployment.status),
    `project-intelligence-status is-${project.deployment.status}`
  );
  card.append(meta);
  appendText(card, "p", reason, "project-intelligence-match-reason");
  if (evidence.length) {
    const evidenceBox = element("div", "project-intelligence-evidence");
    appendText(evidenceBox, "strong", "Published evidence");
    appendText(evidenceBox, "p", evidence.slice(0, 2).join(" "));
    card.append(evidenceBox);
  }
  const projectTechnologies = unique(project.technologies || []).slice(0, 7);
  if (projectTechnologies.length) {
    const chips = element("div", "project-intelligence-card-chips");
    chips.setAttribute("aria-label", `${project.title} technologies`);
    for (const technology of projectTechnologies) {
      appendText(chips, "span", technology);
    }
    card.append(chips);
  }
  const actions = element("div", "project-intelligence-actions");
  actions.setAttribute("aria-label", `Available links for ${project.title}`);
  const viewProject = element("a", "project-intelligence-primary-action");
  viewProject.href = project.url;
  viewProject.textContent = "View Project";
  viewProject.setAttribute("aria-label", `View project: ${project.title}`);
  actions.append(viewProject);
  const actionLabels = {
    github: "Open GitHub",
    demo: "Open Demo",
    paper: "Open Paper",
    docs: "Documentation"
  };
  for (const action of project.actions || []) {
    const label = actionLabels[action.kind];
    if (!label) continue;
    const anchor = element("a");
    anchor.href = action.url;
    anchor.textContent = label;
    anchor.setAttribute("aria-label", `${label} for ${project.title}`);
    externalLink(anchor, action.url);
    actions.append(anchor);
  }
  if (project.architecture.available && project.architecture.url) {
    const architecture = element("a");
    architecture.href = project.architecture.url;
    architecture.textContent = "View Architecture";
    architecture.setAttribute(
      "aria-label",
      `View architecture for ${project.title}`
    );
    actions.append(architecture);
  }
  if (project.impactDomains.length) {
    const impact = element("a");
    impact.href = index.links.impactDomain;
    impact.textContent = "Explore Impact Domain";
    impact.setAttribute(
      "aria-label",
      `Explore impact domains related to ${project.title}`
    );
    actions.append(impact);
  }
  if (project.relatedProjectIds.length) {
    const similar = element("button");
    similar.type = "button";
    similar.textContent = "Show Similar Projects";
    similar.dataset.projectIntelligenceQuery = `Show projects similar to ${project.title}`;
    actions.append(similar);
  }
  card.append(actions);
  return card;
}
function renderAnswer(container, answer, index) {
  const message = element(
    "article",
    "project-intelligence-message is-assistant"
  );
  message.setAttribute("aria-label", "Project Intelligence answer");
  appendText(message, "p", answer.lead, "project-intelligence-answer-lead");
  if (answer.projects.length) {
    appendText(message, "h3", "Relevant projects");
    const list = element("ol", "project-intelligence-project-list");
    for (const answerProject of answer.projects) {
      const item = element("li");
      item.append(renderProjectCard(answerProject, index));
      list.append(item);
    }
    message.append(list);
  }
  if (answer.technologies?.length) {
    const section = element("section", "project-intelligence-technologies");
    appendText(section, "h3", "Technologies");
    const chips = element("div");
    for (const technology of answer.technologies) {
      appendText(chips, "span", technology);
    }
    section.append(chips);
    message.append(section);
  }
  if (answer.navigation) {
    const navigation = element("nav", "project-intelligence-navigation");
    navigation.setAttribute("aria-label", "Explore the published portfolio");
    const links = [
      ["Browse all projects", index.links.allProjects],
      ["Choose a Problem", index.links.chooseProblem],
      ["Search Impact Domain", index.links.impactDomain]
    ];
    for (const [label, href] of links) {
      const anchor = element("a");
      anchor.textContent = label;
      anchor.href = href;
      navigation.append(anchor);
    }
    message.append(navigation);
  }
  container.append(message);
  return message;
}
function renderUserMessage(container, query) {
  const message = element("article", "project-intelligence-message is-user");
  message.setAttribute("aria-label", "Your question");
  appendText(message, "p", query);
  container.append(message);
}
function mountProjectIntelligence(root) {
  const trigger = root.querySelector(
    "[data-project-intelligence-trigger]"
  );
  const layer = root.querySelector(
    "[data-project-intelligence-layer]"
  );
  const dialog = root.querySelector(
    "[data-project-intelligence-dialog]"
  );
  const form = root.querySelector(
    "[data-project-intelligence-form]"
  );
  const input = root.querySelector(
    "[data-project-intelligence-input]"
  );
  const body = root.querySelector(
    "[data-project-intelligence-body]"
  );
  const messages = root.querySelector(
    "[data-project-intelligence-messages]"
  );
  const live = root.querySelector(
    "[data-project-intelligence-live]"
  );
  const suggestions = root.querySelector(
    "[data-project-intelligence-suggestions]"
  );
  const closeButtons = [
    ...root.querySelectorAll(
      "[data-project-intelligence-close]"
    )
  ];
  const abortController = new AbortController();
  const state = { lastProjectIds: [] };
  const currentSlug = root.dataset.currentProjectSlug || "";
  let previouslyFocused = null;
  let indexPromise = null;
  const loadIndex = () => {
    if (!indexPromise) {
      indexPromise = fetch(root.dataset.indexUrl || "").then((response) => {
        if (!response.ok) throw new Error("Portfolio index unavailable");
        return response.json();
      }).catch((error) => {
        indexPromise = null;
        throw error;
      });
    }
    return indexPromise;
  };
  const close = () => {
    if (!layer || !dialog || layer.hidden) return;
    layer.hidden = true;
    dialog.setAttribute("aria-hidden", "true");
    trigger?.setAttribute("aria-expanded", "false");
    document.documentElement.classList.remove("project-intelligence-open");
    previouslyFocused?.focus({ preventScroll: true });
  };
  const open = () => {
    if (!layer || !dialog) return;
    previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : trigger;
    layer.hidden = false;
    dialog.setAttribute("aria-hidden", "false");
    trigger?.setAttribute("aria-expanded", "true");
    document.documentElement.classList.add("project-intelligence-open");
    void loadIndex();
    input?.focus({ preventScroll: true });
  };
  const submitQuestion = async (question) => {
    const query = question.trim();
    if (!query || !messages || !form || !input) return;
    renderUserMessage(messages, query);
    input.value = "";
    input.disabled = true;
    form.setAttribute("aria-busy", "true");
    if (suggestions) suggestions.hidden = true;
    try {
      const index = await loadIndex();
      const answer = answerPortfolioQuestion(index, query, state, currentSlug);
      renderAnswer(messages, answer, index);
      if (answer.projects.length) {
        state.lastProjectIds = answer.projects.map(
          (answerProject) => answerProject.project.id
        );
      }
      if (live) live.textContent = answer.lead;
    } catch {
      const errorMessage = element(
        "article",
        "project-intelligence-message is-assistant"
      );
      appendText(
        errorMessage,
        "p",
        "The published portfolio index could not be loaded. Please try again."
      );
      messages.append(errorMessage);
      if (live) live.textContent = "The portfolio index could not be loaded.";
    } finally {
      input.disabled = false;
      form.removeAttribute("aria-busy");
      input.focus({ preventScroll: true });
      body?.scrollTo({ top: body.scrollHeight, behavior: "smooth" });
    }
  };
  for (const button of closeButtons) {
    button.addEventListener("click", close, {
      signal: abortController.signal
    });
  }
  form?.addEventListener(
    "submit",
    (event) => {
      event.preventDefault();
      if (input) void submitQuestion(input.value);
    },
    { signal: abortController.signal }
  );
  root.addEventListener(
    "click",
    (event) => {
      const target = event.target instanceof Element ? event.target.closest(
        "[data-project-intelligence-suggestion], [data-project-intelligence-query]"
      ) : null;
      if (!target) return;
      const question = target.dataset.projectIntelligenceQuery || target.textContent || "";
      void submitQuestion(question);
    },
    { signal: abortController.signal }
  );
  document.addEventListener(
    "keydown",
    (event) => {
      if (!layer || layer.hidden || !dialog) return;
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [
        ...dialog.querySelectorAll(
          'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ].filter((node) => !node.hasAttribute("hidden"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    },
    { signal: abortController.signal }
  );
  return {
    open,
    destroy() {
      abortController.abort();
      if (layer && !layer.hidden) close();
    }
  };
}
export {
  answerPortfolioQuestion,
  mountProjectIntelligence,
  searchPortfolio
};
