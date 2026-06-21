# Policy Quality Store

This directory is the free local quality store for the GYO6 law information engine.

Nightly runs write:

- `latest.json`: the latest quality run summary
- `latest.md`: a short human-readable summary
- `runs/`: immutable run snapshots
- `source-expansion-queue.json`: official source and guideline collection candidates
- `regression-candidates.json`: cases that should become regression tests
- `training-cases.jsonl`: simulated question cases for local prompt and rules improvement

The store is intentionally file-based first. It can later be migrated to D1, Firestore, or SQLite without changing the quality loop.
