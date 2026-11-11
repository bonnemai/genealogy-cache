---
name: genealogy-cache
description: Reuse or save structured genealogy extractions for archival source URLs through the Genealogy Cache API. Use when analysing civil-register, marriage, death, birth, or notarial documents that may have been parsed before.
---

# Genealogy Cache

Before fetching or interpreting an archival document, call `GET /records?url=<encoded URL>` against the configured cache API.

- If `found` is true, use the returned fields and cite `url` as the source. Do not parse the document again unless the record has `status: needs_review` or the requested fields are absent.
- If the source is not cached, parse it carefully, retain the exact source URL, then call `POST /records` with `url`, `fields`, `parserVersion`, `status`, and any available `documentType`, `actDate`, `place`, `people`, `confidence`, and `extractedText`.

The cache is shared across users by canonical source URL. Never write account credentials, private research notes, or information not present in the archival source. Treat cached extraction as a reusable lead: surface its status and confidence when material to the answer.

The deployment uses IAM authentication. Obtain short-lived credentials through the approved runtime configuration; do not store AWS keys in this skill or in source control.
