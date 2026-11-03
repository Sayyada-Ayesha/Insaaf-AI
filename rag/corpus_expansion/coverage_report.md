# INSAaf AI — Maximum Verified Pakistan Law + Case-Law Corpus — Coverage Report

> Status of the knowledge-base expansion performed on the INSAaf AI RAG corpus.
> Claim: **"maximum verified publicly accessible coverage obtained from the searched authoritative sources"** — NOT all Pakistani law. Gaps are listed explicitly below.

Generated: 2026-09-03 · Companion files: `coverage_matrix.json`, `source_registry.json`, `law_registry.json`, `case_law_registry.json`, `procedure_registry.json`

---

## 1. Before / After (actual index numbers)

| Metric | Before | After | Δ |
|---|---|---|---|
| Documents | 20 | **50** | +30 |
| Chunks | 335 | **869** | +534 |
| — original chunks preserved | 335 | 335 | 0 (additive only) |
| SECTION markers | — | 833 | |
| ARTICLE markers | — | 36 | |
| Federal laws registered | 10 | **34** (632 indexed provisions) | +24 |
| Provincial act records | 0 | **22** (Punjab/Sindh/KP/Balochistan/ICT/AJK/GB) | +22 |
| Judgments / case records | 9 | **37** | +28 |
| Case studies | 3 | 3 | 0 |
| Procedure chunks | 39 | **51** + 22 curated workflows | +12 |
| Rights records | 0 | **26** (fundamental rights digests) | +26 |
| Institution records | 4 | **26** | +22 |
| Court-hierarchy records | 0 | **17** | +17 |
| Remedy records | 4 | **20** | +16 |
| Index size | — | ~9.6 MB | |

## 2. Coverage by legal domain

| Domain | Status | Notes |
|---|---|---|
| Constitution 1973 | CURRENT | 35 article chunks; Art 1–28 + judicature (175/184/199) |
| Fundamental rights | CURRENT | dedicated 26-chunk digest corpus (Art 8–28, remedy/limitations) |
| PPC + ATA | CURRENT | 71 + 19 section digests (incl. 302/311/354/376/489F/498-A…) |
| CrPC 1898 | CURRENT | 47 sections (154, 22-A/22-B remedy, bail 496–498A, remand, challan) |
| CPC 1908 | CURRENT | 29 chunks incl. Order VI–VIII, suit procedure |
| PECA 2016 | CURRENT | 32 chunks incl. s.3–24, dignity 24, FIA procedure |
| Contract Act 1872 | CURRENT | 74 section digests |
| Qanun-e-Shahadat 1984 | CURRENT | 33 section digests |
| Limitation Act 1908 | CURRENT | 28 section digests |
| Specific Relief Act 1877 | CURRENT | 15 section digests |
| Sales of Goods Act 1930 | CURRENT | 15 section digests |
| NAB Ordinance 1999 | CURRENT | 22 section digests |
| Arbitration Act 1940 | CURRENT* | 11 digests; *superseded for new arbitrations by Arbitration Act 2024 — flagged |
| Competition Act 2010 | CURRENT | 7 digests |
| Companies Act 2017 | PARTIAL | 27 digests only (Act has 500+ sections) |
| Tax / Income Tax | PARTIAL | 10 digests only |
| Banking / SBP | PARTIAL | 10 digests only |
| Labour | PARTIAL | digest level; provincial standing-orders not ingested |
| Consumer | PARTIAL | digest level; provincial Acts not ingested |
| Property / TPA / Registration | PARTIAL | digest level; full TPA text not ingested |
| Tenancy / Rent Acts | PARTIAL | digest level |
| Women protection | PARTIAL | 15 digests (Workplace Harassment Act 2010, Acid Act, DV acts…) |
| Environment | PARTIAL | 17 digests |
| Juvenile/child | PARTIAL | 18 digests |
| Police Order 2002 | PARTIAL | 13 digests |
| Succession | PARTIAL | 17 digests |
| Elections 2017 | PARTIAL | 11 digests; ECP rules missing |
| Local government | PARTIAL | 8 digests across provinces |
| IP (copyright/TM/patents) | PARTIAL | 8 digests |
| Prisons / Traffic / Immigration | PARTIAL | 8 digests each |
| Procedure/practical | CURRENT | 51 procedure chunks + 4 situation-remedy workflows |
| Institutions | PARTIAL | 26 records (role/jurisdiction/powers/legal basis; no invented contacts) |
| Court hierarchy | CURRENT | 17 chunks |
| Legal aid | CURRENT | 8 chunks |
| Education/student | CURRENT | 12 chunks |

## 3. Coverage by jurisdiction

| Jurisdiction | Status | Notes |
|---|---|---|
| Federal | CURRENT | Constitution + 34 registered federal laws |
| Punjab | PARTIAL | Punjab-specific digests (Rented Premises 2009, DV Act 2016) + summaries |
| Sindh | PARTIAL | DV Act 2013 + summaries |
| Khyber Pakhtunkhwa | PARTIAL | DV Act 2021 + summaries |
| Balochistan | PARTIAL | summaries only |
| ICT | PARTIAL | summaries only |
| AJK | MISSING | no AJK statutes ingested |
| Gilgit-Baltistan | MISSING | no GB statutes ingested |

## 4. Case-law coverage

| Court | Records | Notes |
|---|---|---|
| Supreme Court of Pakistan | 26 (reported: PLD/SCMR) | + 4 suo motu records without formal citation |
| Federal Shariat Court | 1 | Dr Muhammad Aslam Khaki v Rawalpindi (PLD 2010 FSC 1) |
| IHC / LHC / SHC / PHC / BHC | **0 dedicated** | 3 records carry CLC/CLD reporters (court to verify from volume) — biggest gap |
| Case studies (illustrative) | 3 | FIR refusal, cyber stalking, tenancy eviction |

All case records are **digests for retrieval** (`DIGEST_METADATA_VERIFY_BEFORE_CITATION`); none should be cited before verification against the official reporter. No judgment was fabricated; where full official text is not ingested, the record is explicitly metadata-only.

## 5. Source registry / URL health

| Class | Count |
|---|---|
| VALID EXACT SOURCE | 1 |
| VALID OFFICIAL HOMEPAGE | 19 |
| REDIRECTED / BROKEN / MISSING / UNVERIFIED | 0 / 0 / 0 / 0 |

All 20 registered sources are official (.gov.pk / .org.pk). URLs were classified at registration time; **no network re-probe was performed during the offline build** — re-run `npm run corpus:audit` with network access to refresh.

## 6. RAG capabilities

| Capability | State |
|---|---|
| Exact section/article retrieval | ENABLED (15.0 exact boost; numeric keys domain-scoped; multi-key) |
| Keyword TF-IDF | ENABLED (local, 869 chunks) |
| Semantic retrieval | **DISABLED (0/869 non-zero vectors)** — both `.env` keys are invalid/unfunded; set a valid `GEMINI_API_KEY` and run `npm run rag:build` |
| Case retrieval | ENABLED (case-name routing + landmark FR judgment boosts) |
| Case similarity | PARTIAL (fact-pattern → statute/procedure routing; true similarity needs embeddings) |
| Procedure / rights / institution / court retrieval | ENABLED |
| Offline operation | ENABLED |

## 7. Quality

- Duplicates: **0** · Invalid records: **0** · Validator: **353 passed / 0 warnings / 0 errors**
- Provenance: 100% of documents carry sourceURL/sourceDomain/jurisdiction/legalStatus/version
- Provision statuses: CURRENT digests; repeal notes embedded (e.g., Arbitration Act 1940); UNKNOWN flagged per digest
- 13 spec quality queries + extra probes verified (Article 25 → Constitution art. 25; theft/379 → PPC 379; FIR refusal → 22-A/22-B remedy; bail → CrPC 496–498A; PECA → PECA sections; fundamental rights → rights corpus; landmark-judgment queries → Asma Jilani / Mehrunisa / Rehman / etc.)

## 8. Update system

| Command | Purpose |
|---|---|
| `npm run corpus:audit` | Detect drift: manifest ↔ index counts, missing files, checksum changes, new/removed docs |
| `npm run corpus:update` | Rebuild index only for changed documents (full deterministic rebuild if manifest order/content changed) |
| `npm run corpus:validate` | rag:validate equivalent (structure + checksums, no API needed) |

## 9. Explicit gaps (exact list)

1. **High Court case law (IHC/LHC/SHC/PHC/BHC) — MISSING** (only SC/FSC digests; needs court-portal retrieval)
2. **Full-text official statutes** — all current statute entries are digests, not official consolidated texts
3. **Semantic embeddings — 0 non-zero vectors** (blocked on valid API key; exact/keyword retrieval unaffected)
4. **AJK and GB law — MISSING**
5. **Customs, health, public-service, administrative-law, torts-dedicated, FIA-dedicated corpora — MISSING**
6. **Full Companies Act, Income Tax Ordinance, SBP Act, provincial acts — PARTIAL**
7. **URL network re-verification — pending** (offline build)
8. **Arbitration Act 2024** consolidation (1940 flagged as superseded for new arbitrations)
