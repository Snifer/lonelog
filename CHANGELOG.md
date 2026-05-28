# Changelog

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
