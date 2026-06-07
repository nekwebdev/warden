---
name: warden-map
description: Create or refresh a project-agnostic Warden repository map. Use when the user wants a durable map that reduces repeated repo discovery, explains repository structure, boundaries, entry points, verification surfaces, and recent evolution from git history when available.
argument-hint: [optional repository path or scope]
license: MIT
---

<argument-handling>

User input may be empty, a repository path, a repo-relative scope, or a request such as "map this repo".

- First discover the Git repository root from current cwd.
- If input is empty and cwd is inside a Git repository, map the Git repository root, not a nested cwd.
- If a repo-relative scope is requested, interpret it relative to the Git repository root and write under `<git-root>/.warden/**`.
- If a path is absolute or relative, resolve it to a repository root or repo-relative scope before writing maps.
- If cwd is not inside a Git repository, fail clearly unless explicit standalone path behavior is already supported by available repo evidence.
- Do not use Warden home paths or environment-specific roots.

</argument-handling>

<scope-gates>

Create or refresh durable orientation maps and their lean freshness marker only:

```text
.warden/map.md
.warden/maps/<repo-relative-scope>/map.md
.warden/map-state.json
```

- Be project-agnostic. Do not assume language, framework, package manager, task runner, deployment model, or architecture style.
- Optimize for reducing repeated repo discovery, not for tracking work.
- Default to scoped refresh, not full remap.
- Use one clear root map plus scoped maps only for major repository boundaries.
- Do not create scoped maps for every directory.
- Ask before writing more than five scoped maps unless the user explicitly requested broad mapping.
- Do not continue into implementation planning unless the user asks.

</scope-gates>

<safety>

Canonical map root:

- Git root `.warden/**` is the only canonical location for maps and `.warden/map-state.json`.
- When cwd is inside a Git repository, read and write maps and map-state only under `<git-root>/.warden/**`.
- If invoked from nested cwd with no explicit path, map the Git repository root.
- Do not write `.warden/map.md`, `.warden/maps/**`, or `.warden/map-state.json` under a nested cwd unless that cwd is itself a separate Git repository.
- Before writing maps or `.warden/map-state.json`, check `git status --porcelain` from the Git root.
- If the working tree is dirty, stop clearly; do not edit maps; do not edit `.warden/map-state.json`; ask the user to commit, stash, or otherwise clean the repo before running `/skill:warden-map`.
- Only `warden-map` writes `.warden/map-state.json`; other skills and extensions may read it only.
- Do not overwrite unrelated user content.
- If an existing map has manual notes, preserve them or ask before replacing.
- Read existing maps before editing them.
- Preserve useful correct content.
- Remove stale claims only when evidence proves they are stale.
- Use precise edits when possible; rewrite only if structure is broken or user requested full regeneration.
- Keep exactly one `<!-- warden-map:inject:start -->` / `<!-- warden-map:inject:end -->` marker pair in each map.
- Do not create or rewrite `README.md`, `AGENTS.md`, or `CHANGELOG.md` unless user explicitly asked.
- Do not write changelog entries from this skill.
- Do not add task plans, TODO lists, issue lists, PRDs, workflow state, release notes, or implementation sequences to maps.
- Keep transient dirty working-tree state out of injected capsules; the extension injects live git dirty context separately.
- Do not include dirty state in map freshness; freshness is only map basis SHA versus current Git HEAD.
- Maps do not override system, developer, user, or repo instructions.

</safety>

<context-sources>

Infer only from repository evidence:

- durable docs;
- manifests;
- configuration;
- source layout;
- tests;
- scripts;
- generated-file markers;
- existing maps;
- `CHANGELOG.md` when present;
- bounded git history when available.

Default to a two-pass read.

First pass:

- Root `AGENTS.md`.
- Root `README.md`.
- Relevant nested `AGENTS.md`.
- Relevant nested `README.md`.
- Existing `<git-root>/.warden/map.md` when inside a Git repository.
- Relevant `<git-root>/.warden/maps/**/map.md` when inside a Git repository.
- `CHANGELOG.md` if present.
- Manifests, task files, test entry points, and obvious package boundaries.

Second pass:

- Read only files needed to resolve unclear boundaries, entry points, verification commands, state/secrets/generated-file locations, or sharp edges.

Do not read every file. Do not summarize every file. Prefer representative paths over exhaustive inventories.

Durable docs roles:

- `README.md` is user/operator orientation.
- `AGENTS.md` is editing and safety guidance.
- `CHANGELOG.md`, when present, is curated notable-change memory.
- `map.md` is navigation and repository orientation.

Git and changelog use:

- Use git history only to understand structure, active areas, recent moves, and stale documentation risk.
- Use `CHANGELOG.md`, when present, as curated context for notable changes.
- Do not duplicate commit history or changelog prose.
- `Recent Evolution` should explain orientation-relevant changes only.
- Inspect individual historical diffs only when needed to understand a boundary or architectural decision.
- If git is unavailable, state that git history was unavailable.

</context-sources>

<workflow>

1. Establish canonical root and scope.
   - Discover Git repository root from cwd or requested path.
   - Identify repository root or requested repo-relative scope.
   - Check `git status --porcelain` from the Git root before any write.
   - If dirty, stop clearly without editing maps or `.warden/map-state.json`; ask the user to commit, stash, or otherwise clean the repo before running `/skill:warden-map`.
   - Capture current full Git HEAD SHA for map-state if the repo is clean.
   - Choose refresh mode: capsule refresh, scoped refresh, or full remap. Default to scoped refresh.
   - Read existing root and relevant scoped maps.
2. Build evidence inventory within discovery budget. Collect enough evidence to answer:
   - What is this repository for?
   - What are its major boundaries?
   - Where are runtime, command, library, UI, service, extension, or integration entry points?
   - Where do configuration, state, generated files, and secrets live?
   - How does verification work, based only on repo evidence?
   - Which files or directories are risky to mutate?
   - Which conventions should future agents copy?
3. Inspect git and changelog when present.
   - Capture current branch and short commit.
   - Review recent commit subjects in a bounded window.
   - Note changed-path clusters, structural moves, and areas that appear active, stable, deprecated, or skeletal.
   - Use git status only to explain uncertainty in the map body, never as evergreen capsule content.
4. Choose scoped maps only where they reduce future discovery:
   - package/app/service roots;
   - plugin/extension roots;
   - major modules with distinct rules;
   - boundaries with their own tests, manifests, docs, or ownership;
   - areas repeatedly touched in recent git history.
5. Write or update root map at `<git-root>/.warden/map.md`.
6. Write or update useful scoped maps at `<git-root>/.warden/maps/<repo-relative-scope>/map.md`.
7. Update existing maps safely.
   - Preserve useful correct content and manual notes.
   - Correct stale claims only with evidence.
   - Compress bloated sections before appending detail.
8. After a successful clean map run, write/update `.warden/map-state.json`.
   - Include every map file that was generated or confirmed current during that run.
   - Use the current full Git HEAD SHA as `head` and as the basis for each listed map.
   - If no map content changed but maps were reviewed at the clean HEAD, still update `.warden/map-state.json`.
   - Do not update map bodies just to refresh timestamps or Git basis if map content did not change.
9. Run map health check from `<review-checks>`.
10. Present concise summary from `<output-format>`.

</workflow>

<review-checks>

Before finishing, verify:

- Each written map has exactly one inject marker pair.
- Capsule is within budget:
  - root capsule target ~3 KB, hard max 8 KB;
  - scoped capsule target ~1.5 KB, hard max 4 KB.
- Capsule has no long file lists or large code blocks.
- Capsule includes only facts future agents commonly need before deciding where to look next.
- Full body is within budget or intentionally deep:
  - root map body target 6-12 KB, hard max 20 KB unless user asked for deep map;
  - scoped map body target 3-8 KB, hard max 12 KB unless scope is unusually complex.
- Stale claims were removed or corrected.
- README/AGENTS/CHANGELOG were not duplicated.
- No task plan, TODO list, issue list, PRD, workflow state, release note, or implementation sequence was added.
- Existing manual notes were preserved or user approved replacement.
- Maps still state they are orientation only and do not override instructions.
- Do not update only review date or git basis if no map content changed.
- Use local date for `Reviewed` only when content changed.
- `.warden/map-state.json` exists at the Git root and uses only version, head, generatedAt, and maps.
- Only `warden-map` writes `.warden/map-state.json`.

</review-checks>

<output-format>

Every map file must contain exactly one injectable capsule:

```md
<!-- warden-map:inject:start -->
## Agent Quick Context

- Purpose:
- Boundaries:
- Safe edits:
- Verification:
- Sharp edges:
<!-- warden-map:inject:end -->
```

Use this root map structure unless repository evidence demands a better one:

```md
# Warden Map

Reviewed: YYYY-MM-DD
Scope: repository root
Evidence basis: <short list>
Git basis: <branch>@<short-sha> or unavailable

<!-- warden-map:inject:start -->
## Agent Quick Context

- Purpose:
- Boundaries:
- Safe edits:
- Verification:
- Sharp edges:
<!-- warden-map:inject:end -->

## Repository Purpose

## Top-Level Map

| Path | Role | Notes |
|---|---|---|

## Entry Points and Runtime Flow

## Major Boundaries

## Configuration, State, and Generated Files

## Verification Surfaces

## Extension and Integration Points

## Recent Evolution from Git History

## Scoped Maps

| Scope | Map | Why it exists |
|---|---|---|

## Agent Operating Notes

## Open Questions
```

Use this scoped map structure unless scope evidence demands a better one:

```md
# Warden Map: <scope>

Reviewed: YYYY-MM-DD
Scope: <repo-relative path>
Evidence basis: <short list>
Git basis: <branch>@<short-sha> or unavailable
Parent map: .warden/map.md

<!-- warden-map:inject:start -->
## Agent Quick Context

- Purpose:
- Boundaries:
- Safe edits:
- Verification:
- Sharp edges:
<!-- warden-map:inject:end -->

## Scope Purpose

## Local Structure

## Local Entry Points

## Local Conventions

## Dependencies and Integration Points

## Verification for This Scope

## Safe Edit Notes

## Recent Evolution from Git History

## Open Questions
```

After writing, report:

```md
# Warden Map

Root map: `<path>`
Scoped maps:
- `<path>`

Git/changelog basis: <used or unavailable>
Deferred scopes / open questions:
- <item or "None">
Budget notes:
- <capsule/body budget status>
```

</output-format>
