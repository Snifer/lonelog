# Changelog

## 1.4.8

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
