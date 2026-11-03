# Local Semantic Vector Index — 2026-10-18T17:17:34.237Z

## Model
- **Model**: Xenova/multilingual-e5-small
- **Dimension**: 384
- **Source**: Local HF cache (quantized ONNX), fully offline
- **Prefix convention**: passage: for chunks / query: for queries (e5 convention)
- **Long-text handling**: lead truncation to the first 360 words (e5 RAG practice; avoids diffuse vectors for full-text judgments)

## Build
- **Method**: non-colliding chunk ids reused from the previous verified build after an 8/8 bit-identical determinism check; both members of each former collision embedded with the same model, because the shared base id had stored only the last passage
- **Previous build**: 2026-10-18T15:50:25.185Z
- **Chunks indexed**: 2236
- **Vectors stored**: 2236 (distinct keys, one per chunk)
- **Reused verified vectors**: 2228
- **Freshly embedded**: 8 — family_laws_1961_section_5, family_laws_1961_section_7, family_laws_1961_section_10, bisp_8171_programme_procedures_section_BISP_KAFALAAT_PMT_SCALE_AND_FISCAL_SPACE, bisp_8171_programme_procedures_section_BISP_KAFALAAT_TRANSGENDER_INCLUSION, bisp_8171_programme_procedures_section_BISP_TALEEMI_WAZAIF_AGE_BANDS_AND_SCHOOL_ADMISSION, bisp_8171_programme_procedures_section_BISP_NASHONUMA_CONDITIONS_SNF_AND_WITHHELD_AMOUNTS, bisp_8171_programme_procedures_section_BISP_SOURCE_AVAILABILITY_2026_10_18
- **Zero vectors**: 0
- **Chunks with no vector**: 0
- **Dimensions present**: 384
- **File size**: 17.19 MB (18,023,729 bytes)

## Verification status
**PASS** — every chunk id has exactly one non-zero vector; no id collision remains.
