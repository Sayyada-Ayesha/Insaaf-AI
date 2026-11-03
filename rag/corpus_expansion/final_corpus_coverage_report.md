# INSAaf AI — Final Corpus Freeze & Coverage Report

- **Corpus version:** `2.6.0-final`
- **Freeze timestamp:** 2026-09-07T18:44:46.948Z
- **Freeze hash (content, sha256):** `1d25a823ff700b734508c3109fb1ca4d66314cff1aa7f2e6750e04bc9ae3e24c`
- **Reproducible / tamper-evident:** yes — see `final_corpus_freeze.json`

> This freezes the CURRENT expanded legal + cross-border corpus for RAG and future retraining. It is **not** all Pakistani law and **not** all international law. See Gaps.

## 1. Totals (live index)

| Metric | Value |
|---|---|
| Documents (manifest) | 83 |
| Index chunks | 1554 |
| Unique indexed doc ids | 83 |
| SECTION markers | 1518 |
| ARTICLE markers | 36 |
| General/whole-doc chunks | 0 |
| Distinct source domains | 25 |
| Registered primary sources | 20 |

## 2. Pakistan federal / provincial / case-law

| Area | Count |
|---|---|
| Federal law documents | 34 |
| Federal provisions indexed | 635 |
| Provincial act records | 22 |
| Case-law records (total) | 465 |
| — Supreme Court digests | 51 |
| — Federal Constitutional Court records | 10 |
| — Federal Shariat Court digests | 1 |
| — Lahore High Court (full-text+metadata) | 50 |
| — Islamabad High Court (full-text+metadata) | 20 |
| — Peshawar High Court (full-text+metadata) | 270 |
| — Balochistan High Court (full-text+metadata) | 53 |
| — Sindh High Court (full-text+metadata) | 0 |
| — Other reported (verify) | 3 |
| — Suo motu (no formal citation) | 4 |
| — Case studies | 3 |
| Procedure chunks | 60 |
| Curated workflows | 22 |

## 3. Chunks by corpus folder (domain category)

| Folder / category | Documents | Chunks |
|---|---|---|
| hc-judgments | 8 | 401 |
| contract | 1 | 74 |
| ppc | 1 | 73 |
| cross-border | 6 | 69 |
| crpc | 1 | 47 |
| case-law | 2 | 45 |
| procedure | 3 | 39 |
| offices | 1 | 39 |
| constitution | 1 | 35 |
| evidence | 1 | 33 |
| peca | 1 | 32 |
| commercial | 2 | 30 |
| cpc | 1 | 29 |
| limitation | 1 | 28 |
| provincial | 2 | 28 |
| amendments | 1 | 28 |
| companies | 1 | 27 |
| rights-corpus | 1 | 26 |
| nab | 1 | 22 |
| expanded-institutions | 1 | 22 |
| family | 1 | 19 |
| ata | 1 | 19 |
| juvenile | 1 | 18 |
| environment | 1 | 17 |
| succession | 1 | 17 |
| court-hierarchy | 1 | 17 |
| expanded-procedures | 1 | 17 |
| foreigners | 3 | 17 |
| expanded-remedies | 1 | 16 |
| civic | 2 | 16 |
| women | 1 | 15 |
| police | 1 | 13 |
| elections | 1 | 11 |
| arbitration | 1 | 11 |
| banking | 1 | 10 |
| tax | 1 | 10 |
| poa | 1 | 10 |
| property | 1 | 9 |
| expanded-case-law | 1 | 9 |
| labour | 1 | 8 |
| student | 1 | 8 |
| legal-aid | 1 | 8 |
| local-govt | 1 | 8 |
| ip | 1 | 8 |
| prisons | 1 | 8 |
| traffic | 1 | 8 |
| immigration | 1 | 8 |
| gb | 1 | 8 |
| consumer | 1 | 7 |
| competition | 1 | 7 |
| ajk | 1 | 7 |
| customs | 1 | 7 |
| health | 1 | 7 |
| fia | 1 | 7 |
| admin-service | 1 | 7 |
| history | 1 | 6 |
| torts | 1 | 6 |
| tenancy | 1 | 4 |
| education | 1 | 4 |
| court-procedure | 1 | 4 |
| remedies | 1 | 4 |
| institutions | 1 | 4 |
| case-studies | 1 | 3 |

## 4. Cross-border corpus

- **Documents:** 6  |  **Chunks:** 69

| Cross-border document | Chunks | Source |
|---|---|---|
| Cross-Border Family, Property, Inheritance & Foreign Court Matters | 10 | https://www.mofa.gov.pk |
| Overseas Pakistanis: Consular Services & Pakistani Missions Abroad | 15 | https://www.mofa.gov.pk |
| International Travel, Visa & Immigration Basics for Pakistani Citizens | 15 | https://www.dgip.gov.pk |
| Overseas Employment, Emigration Clearance & Migrant Worker Protection | 10 | https://beoe.gov.pk |
| Study Abroad, Foreign Universities, Scholarships & HEC Attestation | 10 | https://www.hec.gov.pk |
| Pakistan Foreign Policy, Missions, Treaties & International Cooperation | 9 | https://www.mofa.gov.pk |

### Countries / jurisdictions actually represented in the cross-border corpus

- United Arab Emirates (UAE)
- Saudi Arabia
- Qatar
- Kuwait
- Oman
- Bahrain
- United Kingdom
- United States
- Canada
- Australia
- China
- Japan
- Türkiye (Turkey)
- Germany
- France
- Netherlands
- Italy
- Schengen / European states (region)

> **Honest framing:** these countries appear as **official-source links, named scholarship/programme examples, or illustrative references** (e.g. "a U.S. court summons"). The corpus stores **no country-specific foreign substantive law**. It keeps Pakistan-law and foreign-law layers separate and routes to the correct official authority. **This is not coverage of all international law.**

Official source hosts referenced in the cross-border corpus:

- beoe.gov.pk
- beoe.gov.pk,
- beoe.gov.pk.
- campuschina.org
- canada.ca
- chevening.org
- daad.de
- dgip.gov.pk
- dvprogram.state.gov
- fbr.gov.pk
- gov.uk
- hec.gov.pk
- hec.gov.pk.
- immi.homeaffairs.gov.au
- mofa.gov.pk
- mofa.gov.pk.
- nadra.gov.pk
- nadra.gov.pk.
- ophrd.gov.pk
- ophrd.gov.pk,
- sbp.org.pk,
- studyinaustralia.gov.au
- travel.state.gov
- turkiyeburslari.gov.tr
- uscis.gov;

## 5. Unresolved coverage gaps (genuine)

- **High Court case law:** High Court (LHC/IHC/PHC/BHC) judgments ingested with full-text+metadata records in 2.5.0-final. SHC online repository unreachable (Cloudflare 522); FSC/SCP/FCC hosts unreachable from this environment. Prior 72 SC/FSC digests retained.
- **Case-law provenance:** All case records are DIGEST METADATA requiring verification against official reporters before citation.
- **Provincial full text:** CLOSED in 2.6.0-final: provincial_fulltext.txt (20 sections, per-province operative provisions + full/partial/summary matrix) + ajk_laws.txt + gb_laws.txt indexed.
- **Missing dedicated domains:** CLOSED in 2.6.0-final: customs, health, FIA, administrative law/public service, torts added and indexed (34 domains covered; see coverage_matrix).
- **Amendment history:** CLOSED in 2.6.0-final: 28-section amendment corpus + amendment_registry.json (27 chains). Corpus is current only up to the 26th Constitutional Amendment (Oct 2024); yearly Finance-Act changes are not enumerated by design.
- **Cross-border foreign law:** NO country-specific FOREIGN substantive law is stored. The cross-border layer gives Pakistan-side rules + routing to official foreign authorities for named countries only; it never asserts foreign rules it has not verified. Countries listed are MENTIONED (as official-source links / examples), not comprehensively covered.
- **Dual-nationality country list:** The permitted-countries list for Pakistani dual nationality is deliberately NOT enumerated (changes by official notification; confirmed via MOFA/NADRA).
- **Semantic embeddings:** Local semantic embeddings ACTIVE: 1554/1554 non-zero vectors (Xenova/multilingual-e5-small, dim 384, offline).

## 6. Integrity

- All manifest documents indexed: **YES**
- Orphan indexed docs absent from manifest: **NONE**
- Frozen files hashed in lock: **92**

## 7. How to use / re-verify

- Re-run `node server/freezeFinalCorpus.js` to regenerate these three artifacts. If the corpus has not mutated, `freeze_hash` is identical.
- The corpus itself is only changed through the sanctioned pipeline: edit `rag/documents/*`, register in `rag/manifest.json`, then `npm run corpus:update` and `npm run corpus:validate`.
- Do **not** edit `rag/indexes/rag_index.json` or the frozen source files by hand; the freeze lock will detect it.

---
Generated read-only from the live corpus by `server/freezeFinalCorpus.js` at 2026-09-07T18:44:46.948Z.
