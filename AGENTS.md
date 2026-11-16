# moligod engineering rules

## Product and scope

moligod is a long-lived Windows game companion, starting with a toolbox and growing toward game guides.
Keep local tools usable offline. Do not silently add login, analytics, background networking or elevated privileges.

## Boundaries

- Read docs/architecture.md before structural changes; record decisions and evidence.
- crates/core must not depend on Tauri, Windows, storage or network.
- src-tauri is the composition root; platform handles belong in explicit adapters when implemented.
- Frontend native calls stay in src/api.ts. Do not introduce framework dependencies without a concrete need.
- Do not copy the legacy UI/runtime into the main process; .reference is read-only and excluded from builds.
- If a healthy codebase-memory index matches this repository, use the codebase-memory skill; otherwise use rg. Never create an index automatically.

## Lifecycles and data

- No polling, worker thread, capture or inference at startup unless necessary and measured.
- Every native tool must implement stop and release; never join a potentially blocking worker on the UI thread.
- Version persisted formats. Never overwrite unsupported or corrupt data with defaults.
- Do not remove unknown user data during migrations. Test backward import against fixed fixtures.
- Do not label previews or scaffolding as functioning native tools.

## Verification

Run affected checks: npm test, npm run test:core, npm run check:boundaries, npm run build,
cargo fmt --all -- --check, cargo clippy --workspace --all-targets --locked -- -D warnings.
Build the desktop application after IPC/Tauri changes. Measure whole process trees in release, not just the host EXE.
Update docs/verification.md with actual evidence and unresolved acceptance items.
Use current PowerShell 7 locally, single quoted literals, rg for search. Preserve unrelated edits.
