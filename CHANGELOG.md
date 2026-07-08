# Changelog

## [1.6.2]

### Public API v1 documentation and integration hardening

This patch release refines the first public Lonelog API with stronger external-integration helpers, deeper partial write support in Combat and Partylog, consolidated bilingual API documentation, and lint-safety fixes in the implementation.

### What Changed

- Added unified external integration adapters:
  - `api.adapters.content(...)`
  - `api.adapters.file(...)`
  - `api.adapters.activeFile()`
- Expanded JSON-friendly normalized outputs across all public gameplay domains so third-party consumers can rely on serializable snapshots consistently.
- Expanded Combat API with targeted encounter helpers:
  - `getEncounter(...)`
  - `getLatestEncounter(...)`
  - targeted add/update/remove combatant mutations
  - targeted round advancement and encounter closing helpers
- Expanded Partylog API with block-targeted and lifecycle-style mutations:
  - `getLatestBlockIndex(...)`
  - append entry/tag into a specific Partylog block
  - upsert helpers for goals, quests, factions, threads, and party resources
- Added new public mutation events for:
  - `combat-combatant-updated`
  - `combat-combatant-removed`
  - `partylog-tag-mutated`
- Consolidated API documentation into two primary files:
  - `lonelog-api.md` (English)
  - `lonelog-api-es.md` (Spanish)
- Expanded API documentation with:
  - real-world integration examples
  - snippets by consumer plugin type
  - formal mutation result contract
  - event payload shapes
  - clearer support labeling for complete vs partial write modules
- Added dedicated API changelog files:
  - `lonelog-api-changelog.md`
  - `lonelog-api-changelog-es.md`
- Hardened several implementation boundaries to eliminate unsafe-type lint warnings in API/editor/highlighter/parser-related files.

### Release Notes

- This is a **patch release** because it strengthens the already introduced API surface and its documentation without changing the main end-user workflow.
- The API remains version `v1`, but its integration story is now significantly clearer and safer for third-party plugin authors.

## [1.6.1]

### Public API v1 and Slot-Based Inventory Container Support

This patch release introduces the first public Lonelog API for interoperability with other Obsidian plugins and documents the new integration surface, while also crediting the new slot-based inventory container support feature contribution.

### What Changed

- Added the first **Lonelog Public API v1** exposed through the plugin instance for third-party Obsidian plugin integrations.
- Expanded the public API with Partylog parsing support, capabilities discovery, and an explicit public error contract for file-based operations.
- Added public API metadata (`info.get`) and reactive hooks/events for settings changes, note changes, and opened Lonelog views.
- Added dedicated add-on API modules for Dungeon, Resources, Combat, Progress, and Partylog, plus add-on status discovery through `addons.getStatus()`.
- Added the first public write layer for the API with serializer and mutation helpers for Progress and Resources, plus a dedicated write/mutation integration guide.
- Added domain mutation events for Progress and Resources, plus serializable list/get helpers for Dungeon, Resources, Combat, and Progress.
- Added module-level API metadata and a public stability/deprecation policy so integrators can reason about compatibility over time.
- Extended the write API to Dungeon and Partylog with room upserts, Partylog entry append helpers, and matching domain events.
- Expanded Resources with deeper inventory mutations (set, delta, property updates, slot moves) and expanded Partylog with structured tag write helpers plus new domain events.
- Added a first official Combat write API (create encounter, add combatant, advance round, close encounter) and expanded Dungeon with partial room mutation helpers for statuses and exits.
- Added fine-grained lookup helpers for lightweight integrations: latest room/track plus Partylog open threads, active goals, and party resource access.
- Added JSON-friendly normalized API outputs for Lonelog, Partylog, Dungeon, Resources, Combat, and Progress so external consumers can rely on consistent array/object snapshots instead of mixed Maps and richer native structures.
- Added `api.adapters.content/file/activeFile` as a unified integration layer for external plugins that want a single snapshot instead of orchestrating multiple API calls manually.
- Consolidated API documentation into `lonelog-api.md` (English) and `lonelog-api-es.md` (Spanish), including a formal support policy for full vs partial write API modules and next-version expectations.
- Expanded Combat write support with targeted encounter helpers (`getEncounter`, `getLatestEncounter`, targeted add/advance/close, combatant update/remove) and new combat mutation events.
- Expanded Partylog write support with block-targeted append helpers plus structured upserts for goals, quests, factions, party resources, and threads, together with a new mutation event for lifecycle-style updates.
- Expanded the API guides with real-world integration examples and consumer-plugin snippets, and added dedicated API changelog files for English and Spanish.
- Added public API methods for:
  - `parse.content`
  - `parse.file`
  - `parse.isLonelogNote`
  - `tokenize.line`
  - `tokenize.lines`
  - `settings.get`
  - `views.open...`
- Added dedicated API test coverage to validate the public contract.
- Added a new `lonelog-api.md` guide with usage examples and integration notes for plugin developers.
- Updated the English and Spanish READMEs to reference the new public API guide and the v1 contract.
- Added **[FEAT] Slot-based Inventory container support** by @AntonioMorenoRubio.

### Release Notes

- This is a **patch release** because it adds a first interoperability surface and documentation without changing the main user workflow or introducing a new end-user subsystem.
- The public API is intentionally small in v1 so future versions can expand safely without exposing unstable internals too early.

---

## [1.6.0]

### New Feature: Partylog Add-on for Group Session Notes

Added the first Partylog release inside the existing Lonelog plugin as an activable add-on for group-session notation, parsing, and dashboard-driven review.

### What Changed

- Added a new **Partylog add-on** toggle in plugin settings.
- Registered fenced `partylog` code blocks alongside `lonelog` blocks.
- Added syntax highlighting support for Partylog world events using `!`.
- Introduced a dedicated `PartylogParser` for extracting timeline, roster, and scene-aware dashboard data from Partylog notes.
- Added a new **Partylog Dashboard** with internal tabs for:
  - `Overview`
  - `Scenes`
  - `Threads`
  - `Timeline`
  - `Roster`
  - `Recap`
- Added Partylog-focused test coverage for tokenizer and parser behavior.
- Documented Partylog activation and usage in both English and Spanish READMEs.
- Updated plugin metadata and badges to version `1.6.0`.
- Fixed `version-bump.mjs` so new releases are added to `versions.json` by version key instead of incorrectly checking only `minAppVersion`.

### Release Notes

- This is a **minor release** because it adds a substantial new user-facing feature set rather than a small patch fix.
- Build and test artifacts should be regenerated in a fully enabled local environment before publishing the release bundle.

---

## [1.5.7]

### Inventory Parser Fixes: Bundles, Slot Updates, and Property Mutations

Fixed multiple inventory parsing issues so shorthand item updates, bundle notation, slot-based inventory, and item property mutations now behave consistently with the add-on manual.

### What Changed

- Normalized bundle notation in item names so forms like `[Inv:Arrow×20]` and `[Inv:Arrowx20]` register item `Arrow` with quantity `20`.
- Fixed shorthand inventory deltas so `[Inv:Torch+2]`, `[Inv:Torch +2]`, and `[Inv:Torch|+2]` follow the same update flow.
- Routed logical item updates such as `[Inv:Torch-1]`, `[Inv:Torch+2]`, `[Inv:Torch|0]`, and `[Inv:Torch|depleted]` through existing slot/container entries instead of creating duplicate root items.
- Added deterministic multi-slot consumption and update behavior when the same logical item exists in more than one slot.
- Fixed inventory property mutation semantics so `+prop`, `-prop`, `prop->new`, and `prop→new` now work for `[Inv:]` items just like entity tags.
- Ensured property mutations still apply on inventory lines that also include absolute quantities such as `[Inv:Short Sword|1|+enchanted]`.
- Aligned release metadata and documentation badges to version `1.5.7`.
- Closes #36.
- Closes #37.

---

## [1.5.6]

### Resource Tracking Fixes: Decimal Wealth and Slot-Based Inventory

Fixed two resource-tracking issues in the parser: decimal wealth deltas were truncating fractional values, and slot/container-based inventory entries could not be consumed through shorthand updates like `[Inv:Torch-1]`.

### What Changed

- Fixed `[Wealth:...]` delta parsing so decimal balances are preserved when applying signed updates such as `[Wealth:Bank -1]`.
- Reworked decimal arithmetic to stay compatible with the current ES6 TypeScript target without relying on `BigInt`.
- Extended `[Inv:...]` parsing so shorthand consumption can resolve item quantities nested inside slot/container entries such as `[Inv:Backpack 1|Torch×6]`.
- Added multi-slot consumption support using a deterministic first-mentioned-first-consumed strategy when the same item exists in more than one slot.
- Updated nested slot quantities to re-render correctly after consumption, including converting exhausted slots to `empty`.
- Aligned release metadata and documentation badges to version `1.5.6`.
- Closes #34.
- Closes #35.

---

## [1.5.5]

Support Obsidian version 1.12.7

## [1.5.4]

### Entity Merge Fix: Lonelog Threads PC State

Fixed entity tag merging so `Lonelog Threads` no longer drops previously known PC or NPC attributes when a later mention only updates one field.

### What Changed

- Updated the parser merge logic for repeated entity tags such as `[PC:...]`, `[N:...]`, and `[L:...]`.
- Changed partial entity updates to merge by attribute key instead of replacing the full tag list.
- Preserved existing values like `HIT`, `GRIT`, and `WILL` when a later tag only updates one field.
- Kept support for additive (`+`), removal (`-`), and replacement (`->`) tag update semantics.
- Added parser tests covering partial PC updates and attribute replacement behavior.
- `Lonelog Threads` now shows stable combined entity state across multiple mentions.
- Closes #32.
- Closes #33.

---

## [1.5.3]

### Compatibility Update: Obsidian API and Popout Windows

Repeated the compatibility adjustments from `1.5.2` as part of the latest release cycle, reflecting the changes that were made to metadata and UI behavior.

### What Changed

- Kept `minAppVersion` aligned with the current compatibility baseline used by the plugin.
- Preserved the Obsidian API compatibility adjustments around modern workspace and frontmatter helpers.
- Kept the popout window compatibility fixes based on `activeDocument`, element-owned documents, and window-scoped timers.
- Retained the settings tab rendering cleanup that avoids internal direct calls to `display()`.
- Registered this release as a follow-up compatibility update in the changelog.
- Documented the compatibility changes again under `1.5.3`.
- Kept the release history aligned with the latest metadata and implementation changes.

---

## [1.5.2]

### Compatibility Update: Obsidian API and Popout Windows

Updated the plugin metadata and UI code to match the Obsidian APIs already used by Lonelog, and improved compatibility with popout windows.

### What Changed

- Raised `minAppVersion` to `1.13.0` to match the current compatibility baseline for the Obsidian APIs used by the plugin, including `processFrontMatter`, `workspace.activeEditor`, and newer workspace helpers.
- Replaced direct `document` access with `activeDocument` or element-owned documents where needed, so overlays, settings rendering, and syntax highlighting behave correctly in popout windows.
- Replaced global `setTimeout()` calls with window-scoped timers for popout window safety.
- Removed internal direct calls to `display()` inside the settings tab implementation while keeping the `display()` override for backward compatibility with older Obsidian versions.

---

## [1.5.1]

### Performance Fix: IME and CJK Input Lag

Improved editor responsiveness when typing with IME-based keyboards such as Chinese, Japanese, and Korean input methods.

### What Changed

- Skipped expensive editor highlighting rebuilds while CodeMirror is in text composition mode.
- Prevented autocomplete from reparsing the full document during IME composition.
- Optimized autocomplete so a full Lonelog parse happens once per autocomplete session instead of on every query update while typing inside the same tag context.

### Result

- Reduced typing lag with IME composition.
- Lowered unnecessary parsing work in large notes.
- Improved responsiveness when editing Lonelog tags such as `[N:...]`, `[PC:...]`, `[Thread:...]`, and similar entities.

---

## [1.5.0]

### Syntax Highlighting Fix: Multi-line Entity Tags

Fixed syntax highlighting for multi-line bracket entities such as `PC`, `N`, and other Lonelog tags, so the tag scope is now preserved across lines in both the editor and reading view. (Reported by @loukaka in #30.)

**Before:**

Multi-line forms like:

```lonelog
[PC:Jonah
| trait: friendly, curious
| status: wounded
| stat: HP 8, Stress 2
]
```

were parsed correctly by the Lonelog engine, but the highlighter failed to keep the tag scope active across lines in the editor and reading mode.

**Now:**

- Highlighting is preserved from the opening `[` line through the closing `]`.
- Tokenization now supports multi-line tag context consistently in both editor highlighting and reading mode.

### Settings UI Redesign

Redesigned the Lonelog settings tab from a single long scrolling page into a **sidebar + content panel** layout for faster navigation as the plugin grows.

### What Changed

- Reorganized settings into 7 navigable sections:
  - `Interface`
  - `Notation`
  - `Templates`
  - `Colors`
  - `Dice`
  - `Add-ons`
  - `About`
- Moved syntax editor controls into `Interface`.
- Moved all highlighting color controls into a dedicated `Colors` panel.
- Added visible `Active` / `Inactive` badges for add-ons.
- Moved `About` to the end of the navigation.
- Added a version badge in the `About` panel using the plugin manifest version.


---

## [1.4.8]

### New Feature: Fractional Track Progress

Added support for fractional (decimal) values in track progress, enabling systems like **Ironsworn** that advance progress in partial steps instead of whole integers.

**Examples:**

```
[Track:Find who killed my uncle 1.5/10]
[Track:Bonds 0.25/4]
[Track:Vow 0.5/10]
```

Inline update syntax also supports fractional values:

```
[Track:Find who killed my uncle 0.5/10 ->1.5/10]
```

> Source: [Reddit feedback from an Ironsworn user](https://www.reddit.com/r/lonelog/comments/1shof87/comment/onx1ohc/)

---

### CI/CD & Repository Infrastructure

- **GitHub Actions Release Workflow Update (`release.yml`)**:
  - Configured the workflow to extract specific release notes from `CHANGELOG.md` to populate the GitHub Release body automatically.
  - Added build artifact attestation (`actions/attest-build-provenance`) for secure verification of generated files.
  - Ensured `CHANGELOG.md` presence validation before finishing builds.
