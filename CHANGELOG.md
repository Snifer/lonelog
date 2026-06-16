# Changelog

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
