# Provenance-aware subject catalogue design

The existing workspace must continue accepting learner-created subjects and topics. A catalogue is an optional reference layer, not a replacement for `profile.subjects`, manual topics, or exam topics.

## Proposed model

A catalogue entry would have a stable provider and version, country or education system, level, subject code, display name, and optional parent/child topic codes. Workspace profile selections would store the catalogue reference only when a learner chooses it, while preserving the displayed custom subject string for backward compatibility. Manual subjects remain valid when no catalogue entry exists.

## Synchronization rules

Catalogue data is immutable versioned reference data. A newer catalogue version may add entries but must not rename or delete a learner’s custom subject. Existing workspace records continue to resolve by their stored custom subject and topic IDs. A missing or retired catalogue entry is displayed as “custom/original” rather than being deleted. No curriculum provider data should be silently presented as authoritative educational truth without provenance.

## Ghana-first scope boundary

The first optional provider could represent Ghanaian SHS/WASSCE structures, but implementation requires a verified source dataset, licensing/provenance metadata, level taxonomy, and a user-facing selection policy. It must also support university and vocational/technical paths without assuming one country or educational system.

## Current status

This is a design boundary, not an implemented catalogue. No migration or seed data should be added until a real provenance-approved dataset and compatibility tests are available.
