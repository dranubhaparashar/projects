---
title: "HealthBook AI: Privacy-First Family Health Workspace for Longitudinal Records, Human-Verified Extraction, and Selective Doctor Sharing"
published: 2026-10-10
description: "A privacy-first family health workspace for longitudinal medical records, human-verified document extraction, daily health tracking, clinical timelines, secure PDF exports and selective doctor sharing across web and Android."
image: ./cover.png
card_image:
  src: ./cover.png
  alt: "Synthetic HealthBook AI illustration: family profiles connected to a secure health record hub with document, trend, calendar and sharing modules"
card:
  problem: "Family medical history is scattered across paper reports, prescriptions, vaccination cards and phone photos, so no one can reliably answer what is actually documented about a person's health or where the original proof is."
tags:
  - Health AI
  - Healthcare AI
  - Full-Stack Platform
  - Web + Android
  - Personal Health Records
  - Document Intelligence
  - OCR
  - Human-in-the-Loop
  - Privacy Engineering
capabilities:
  - Document Intelligence
  - Human-in-the-Loop
  - Security
technologies:
  - Python
  - FastAPI
  - PostgreSQL
  - Supabase
  - Firebase
  - React Native
  - Expo
  - TypeScript
github_url: "https://github.com/dranubhaparashar/HealthBook-AI"
demo_url: "https://childcare-2c3ab.web.app"
documentation_url: "https://github.com/dranubhaparashar/HealthBook-AI/wiki"
project_links:
  - label: "Technical Wiki"
    url: "https://github.com/dranubhaparashar/HealthBook-AI/wiki"
    kind: documentation
project_intelligence:
  data_basis: "Family-owned medical documents (PDF, PNG, JPEG, HEIC) stored encrypted, candidate OCR transcriptions, guardian-verified structured records, and a daily care journal; the public repository, tests and wiki use synthetic data only."
  dataset_size: ""
  models_methods: "PyMuPDF text-layer extraction with local Tesseract OCR fallback, field-level human verification before any structured record is created, deterministic clinical-safety rules, observational analytics, and SHA-256 duplicate detection."
  architecture_summary: "Web application (Firebase Hosting) and Android application (Expo React Native) → one FastAPI API with authentication and per-family ownership checks → Supabase PostgreSQL with encrypted clinical fields and a private encrypted object bucket → PDF export, scoped doctor-share links and reminder delivery."
  evaluation: "The public repository includes a pytest suite of 130 test functions and 20 Playwright browser tests on synthetic data, covering family isolation, human verification, prescribed-versus-given rules, exports, sharing, storage and security; no clinical validation is claimed."
  key_results: "Implements family profiles, an encrypted document library, human-verified extraction, medicines, vaccinations, labs, growth, Daily Health, Care Calendar, a longitudinal timeline, Lifetime Health, secure PDF dossiers and selective, expiring doctor sharing on web and Android from one backend."
  deployment_summary: "Deployed web application on Firebase Hosting with a FastAPI API on Render and Supabase PostgreSQL and private storage; an Android app uses the same API. The public repository is a sanitized showcase; production infrastructure is maintained separately."
  why_it_matters: "Families can keep a private, provenance-backed health history in which nothing becomes a record until a person has verified it, and share exactly the part a clinician needs."
  field_statuses:
    dataset_size: not_applicable
    evaluation: present
    live_demo: present
    video: not_applicable
    documentation: present
    architecture_preview: documented
status:
  label: Operational
  type: operational
category: "Self Project"
draft: false
---

> **HealthBook AI** is a privacy-first family health workspace. It keeps original medical documents encrypted and private, turns them into structured records only after a person has verified them, separates what was prescribed from what was actually given, and lets a family export or share exactly the part of the history a clinician needs, from one common web and Android architecture.

HealthBook AI is a personal health record, not a medical device, and it never prescribes or changes a dose.

## Project Links

- **[Technical Wiki](https://github.com/dranubhaparashar/HealthBook-AI/wiki)**: architecture, data model, security boundaries and every feature pipeline, with diagrams
- **[GitHub Repository](https://github.com/dranubhaparashar/HealthBook-AI)**: sanitized public source code, tests and deployment templates
- **[Live Application](https://childcare-2c3ab.web.app)**: the deployed web application (sign-in required; no public data)

::github{repo="dranubhaparashar/HealthBook-AI"}

---

## One-Line Idea

Give every family one private place that answers a practical question: *what is actually documented about this person's health, and where is the original that proves it?*

---

## Why This Project Exists

A family's medical history usually lives in many places at once:

- paper and PDF lab reports;
- prescriptions and discharge notes;
- vaccination cards;
- phone photos of documents;
- memory of what was given, when, and for how long.

When a doctor asks a simple question, such as which antibiotic courses a child has had or when a vaccine was actually given, the answer is often reconstructed from memory. HealthBook AI keeps the original evidence, turns it into structured history only after human review, and keeps every statement linked to the document page it came from.

---

## Project at a Glance

| Area | Description |
|---|---|
| Project type | Self-built full-stack health platform |
| Domain | Personal and family health records |
| Clients | Web application and Android application |
| Backend | One FastAPI API that owns every secret and every rule |
| Data | Supabase PostgreSQL with encrypted clinical fields; private encrypted object storage for originals |
| Extraction | PyMuPDF text layer with local Tesseract OCR fallback; field-level human verification |
| Outputs | Designed PDF dossiers and scoped, expiring doctor-share links |
| Governance boundary | Nothing becomes a structured record until a person confirms it |
| Public showcase | Sanitized repository and technical wiki using synthetic data only |

---

## Key Capabilities

- **Family health profiles**: each person (infant to senior) is a separate profile with its own timezone, modules and records
- **Medical document library**: PDF, PNG, JPEG and HEIC originals stored encrypted, with SHA-256 duplicate detection
- **Human-verified extraction**: OCR produces a *candidate* transcription that a guardian checks field by field before anything is saved
- **Medicine history**: draft and verified prescriptions, revisions and separate administration events
- **Vaccination history**: card entries and a reference chart that is never auto-activated; due is never treated as given
- **Labs and growth trends**: observations, cultures, lab series, growth entries and vitals
- **Daily Health**: a daily journal for fluids, sleep, activity, symptoms, vitals and medicines given
- **Care Calendar**: day, week and month views over the unified timeline
- **Longitudinal timeline** and **Lifetime Health**: illness episodes, fever episodes and antibiotic courses linked to evidence
- **Secure PDF export**: a designed dossier with the original documents appended and linked
- **Selective doctor sharing**: preview, choose exactly which records to share, and send an expiring, revocable link with an optional PIN
- **Android + Web**: one backend serving a web application and an Expo React Native Android app
- **Private encrypted storage**: Fernet encryption for clinical text and every stored file

---

## Clinical Safety Rules

These rules are enforced by the data model and the API, not only by the interface:

| Rule | Meaning |
|---|---|
| Prescribed ≠ scheduled ≠ given | A planned dose is never counted as an administered dose |
| OCR extracted ≠ verified | Extraction output stays unverified until a person confirms it |
| Due date ≠ administered | A vaccination reminder is not a vaccination record |
| Reminder ≠ proof | A notification is never evidence that a dose was given |
| Provenance is kept | Structured records keep a link to the original document page |

---

## Architecture

```text
Web application (Firebase Hosting)      Android application (Expo React Native)
                \                          /
                 \________ HTTPS _________/
                            |
                 FastAPI API (authentication, family ownership checks,
                 medical records, daily care, export, sharing, reminders)
                            |
          ------------------------------------------
          |                                        |
  Supabase PostgreSQL                    Private storage bucket
  (encrypted clinical fields)            (encrypted original documents)
```

The [Technical Wiki](https://github.com/dranubhaparashar/HealthBook-AI/wiki) documents each layer in detail, including deployment, authentication and session security, family profile isolation, the OCR and human-verification workflow, PDF export, doctor sharing, encryption and the API design.

---

## Technology Stack

| Layer | Technologies |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy, Alembic, Pydantic |
| Database and storage | PostgreSQL, Supabase (PostgreSQL and private storage bucket) |
| Documents | PyMuPDF, Tesseract OCR, Pillow, ReportLab |
| Security | cryptography (Fernet), hashed session tokens, CSRF protection |
| Web | Firebase Hosting, no-build JavaScript client with a service worker |
| Android | Expo, React Native, TypeScript |
| Testing | pytest, Playwright |

---

## Testing and Validation

The public repository includes a pytest suite of **130** test functions and **20** Playwright browser tests. All tests use synthetic data only (fictional names, `example.invalid` emails, generated PDFs and images). Many tests encode the clinical safety rules directly, for example that a scheduled medicine is never counted as given, and that one family can never read or confirm another family's records.

---

## Privacy and Scope

- The public repository and wiki are a **sanitized showcase**. Production infrastructure, credentials, source medical documents and patient records are maintained separately and are not public.
- Every example in the documentation uses synthetic data.
- HealthBook AI is a family-maintained record. It is not a medical device and makes no claim of clinical validation or regulatory clearance.

For limitations and the roadmap, see the [Technical Wiki](https://github.com/dranubhaparashar/HealthBook-AI/wiki).
