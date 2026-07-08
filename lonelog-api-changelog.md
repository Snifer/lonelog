# Lonelog API Changelog

This file tracks the public Lonelog API independently from the general plugin changelog.

## v1.6.1

### Added
- Initial public API v1 exposed through `plugin.api`
- Core parsing, tokenization, settings, and view-opening APIs
- `capabilities.get()` for machine-readable feature discovery
- `info.get()`, `info.getModules()`, and `info.getStabilityPolicy()`
- Public error contract with stable error codes
- Public event system for general and domain mutation hooks
- Add-on API modules for Dungeon, Resources, Combat, Progress, and Partylog
- JSON-friendly outputs for Lonelog, Partylog, Dungeon, Resources, Combat, and Progress
- Unified adapters layer:
  - `adapters.content(...)`
  - `adapters.file(...)`
  - `adapters.activeFile()`
- Fine-grained read helpers:
  - `progress.getLatestTrack(...)`
  - `dungeon.getLatestRoom(...)`
  - `partylog.getOpenThreads(...)`
  - `partylog.getActiveGoals(...)`
  - `partylog.getPartyResource(...)`
- Write API for Progress
- Deep write API for Resources
- Partial write API for Dungeon
- Expanded partial write API for Combat with encounter targeting and combatant updates/removal
- Expanded partial write API for Partylog with block targeting and structured upserts

### Stability notes
- `progress` and `resources` are considered **complete for v1 scope**
- `dungeon`, `combat`, and `partylog` remain **partial** and are expected to grow in the next API iteration
- `parse`, `json`, `tokenize`, `info`, `capabilities`, `settings`, `views`, and `adapters` are public read/support surfaces, not write surfaces

### Recommended migration direction
- Prefer `json.*` for serialized external consumption
- Prefer `adapters.*` for note-centric integrations
- Prefer capability checks instead of version-string assumptions
