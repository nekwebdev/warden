---
name: warden-map
description: Create or refresh a project-agnostic Warden repository map. Use when the user wants a durable map that reduces repeated repo discovery, explains repository structure, boundaries, entry points, verification surfaces, and recent evolution from git history when available.
argument-hint: [optional repository path or scope]
disable-model-invocation: true
license: MIT
---

# Warden Map

## When to use

Use when the user wants durable repository orientation: purpose, structure, boundaries, entry points, verification, sharp edges, and recent orientation-relevant evolution.

Default to scoped refresh. Use full remap only when requested or root orientation is stale.

## Outcome

- Root map: `<repo-root>/.warden/map.md`.
- Scoped maps: `<repo-root>/.warden/maps/<repo-relative-scope>/map.md` where useful.
- Freshness marker: `<repo-root>/.warden/map-state.json` after a successful clean map run.
- Each map has exactly one injectable capsule and remains orientation-only.
- Dirty repositories stop before map or map-state edits.

## Argument handling

Input may be empty, a repository path, a repo-relative scope, or a request such as "map this repo".

A hidden Warden Flow auto directive may mark leading `--auto` as invocation control syntax. In auto mode, use the cleaned empty/root scope or safe repo-relative scope and skip optional prompt mechanics; safety checks and dirty-repo refusal still apply.

Discover the Git repository root from cwd first. Empty input inside a Git repository maps the Git root, not a nested cwd. Resolve absolute or relative paths to a repository root or repo-relative scope before writing.

Interpret repo-relative scopes relative to the Git root and write only under `<repo-root>/.warden/**`.

If cwd is not inside a Git repository, fail clearly unless explicit standalone path behavior is supported by repo evidence.

Do not use Warden home paths or environment-specific roots.

## Non-goals

Do not track work, plan implementation, create issue lists, PRDs, TODO forests, workflow state, release notes, or changelog prose.

Do not assume language, framework, package manager, task runner, deployment model, or architecture style.

Do not create scoped maps for every directory. Do not create or rewrite `README.md`, `AGENTS.md`, or `CHANGELOG.md` unless explicitly asked.

## Execution tracking

When the harness exposes a plan or todo tool, mirror the top-level `## Procedure` steps in an ephemeral task list before starting. Use the tool name and schema advertised by the harness.

Track progress in the harness only. Do not create repo task files or durable work artifacts. Keep exactly one task in progress; mark each task complete immediately when its step finishes.

## Safety rules

- Git root `.warden/**` is the only canonical location for maps and `.warden/map-state.json`.
- Read and write maps and map-state only under `<repo-root>/.warden/**` unless nested cwd is itself a separate Git repository.
- Before writing maps or `.warden/map-state.json`, check `git status --porcelain` from the Git root.
- If the working tree is dirty, stop clearly; do not edit maps; do not edit `.warden/map-state.json`; tell the user to commit, stash, or otherwise clean the repo before running `/skill:warden-map`.
- Only `warden-map` writes `.warden/map-state.json`; other skills and extensions read it only.
- Do not overwrite unrelated user content.
- Read existing maps before editing them.
- Preserve useful correct content and manual notes; request a user decision through the active user-input workflow before replacing manual notes.
- Remove stale claims only when evidence proves they stale.
- Use precise edits when possible; rewrite only if structure is broken or user requested full regeneration.
- Keep exactly one `<!-- warden-map:inject:start -->` / `<!-- warden-map:inject:end -->` marker pair in each map.
- Keep transient dirty working-tree state out of injected capsules; live Git dirty context is injected separately.
- Do not include dirty state in map freshness; freshness uses requested map basis plus committed changes since that basis. Map-only commits stay fresh; non-map commits become stale.
- Maps do not override system, developer, user, or repo instructions.
- Request a user decision through the active user-input workflow before writing more than five scoped maps unless broad mapping was explicitly requested.
- Do not continue into implementation planning unless requested through the active user-input workflow.

## Context and evidence

Infer only from repository evidence: durable docs, manifests, configuration, source layout, tests, scripts, generated-file markers, existing maps, `CHANGELOG.md` when present, and bounded git history when available.

Use a two-pass read:

1. Read root/relevant `AGENTS.md` and `README.md`, existing root/scoped maps, `CHANGELOG.md` when present, manifests, task files, test entry points, and obvious package boundaries.
2. Read only files needed to resolve unclear boundaries, entry points, verification commands, state/secrets/generated-file locations, or sharp edges.

Do not read every file or summarize every file. Prefer representative paths over exhaustive inventories.

Roles: `README.md` is user/operator orientation; `AGENTS.md` is editing and safety guidance; `CHANGELOG.md` is curated notable-change memory; `map.md` is navigation and repository orientation.

Use git history only for structure, active areas, recent moves, and stale-doc risk. Do not duplicate commit history or changelog prose. `Recent Evolution` should contain orientation-relevant changes only. If git is unavailable, say so.

## Procedure

### Step 1: Establish root and scope

1. Discover Git root from cwd or requested path.
2. Identify repository root or requested repo-relative scope.
3. Check `git status --porcelain` from Git root before any write.
4. If dirty, stop clearly without editing maps or `.warden/map-state.json`; report `commit, stash, or otherwise clean` as next safe step before rerunning `/skill:warden-map`.
5. If clean, capture current full Git HEAD SHA for map-state.
6. Choose capsule, scoped, or full refresh; default to scoped refresh.
7. Read existing root and relevant scoped maps.

### Step 2: Build evidence inventory

Collect enough evidence to map repository purpose, major boundaries, entry points, config/state/generated/secrets locations, verification commands, risky paths, and conventions future agents should copy.

### Step 3: Inspect git and changelog

Capture branch and short commit. Review recent commit subjects in a bounded window. Note changed-path clusters, structural moves, and active/stable/deprecated/skeletal areas. Use git status only to explain uncertainty in the body, never as evergreen capsule content.

### Step 4: Choose scoped maps

Create scoped maps only for package/app/service roots, plugin/extension roots, major modules with distinct rules, boundaries with their own tests/manifests/docs/ownership, or areas repeatedly touched in recent git history.

### Step 5: Write maps

Write or update root map and useful scoped maps. Preserve correct content and manual notes. Correct stale claims only with evidence. Compress bloated sections before adding detail.

### Step 6: Write map-state

After a successful clean map run, write/update `.warden/map-state.json`.

Include every map file that was generated or confirmed current. Use the current full Git HEAD SHA as `head` and as each map basis. If no map content changed but maps were reviewed at clean HEAD, still update `.warden/map-state.json`. Do not update map bodies just to refresh timestamps or Git basis when no map content changed.

### Step 7: Review and report

Run `## Review checklist`. Offer `/skill:warden-commit` as next safe step when map changes are ready for commit planning; do not stage or commit from this skill. Report using `## Output format`.

## Review checklist

Before finishing, verify:

- each written map has exactly one inject marker pair;
- root capsule target ~3 KB, hard max 8 KB;
- scoped capsule target ~1.5 KB, hard max 4 KB;
- capsules have no long file lists or large code blocks;
- capsules contain only facts future agents need before deciding where to look next;
- root map body target 6-12 KB, hard max 20 KB unless deep map requested;
- scoped map body target 3-8 KB, hard max 12 KB unless scope is unusually complex;
- stale claims were removed or corrected;
- README/AGENTS/CHANGELOG were not duplicated;
- no task plan, TODO list, issue list, PRD, workflow state, release note, or implementation sequence was added;
- manual notes were preserved or replacement was approved through the active user-input workflow;
- maps state they are orientation only and do not override instructions;
- review date changed only when map content changed;
- `.warden/map-state.json` exists at Git root and uses only version, head, generatedAt, and maps;
- only `warden-map` writes `.warden/map-state.json`.

## Stop conditions

Stop without editing maps or `.warden/map-state.json` when repository is dirty, Git root cannot resolve, requested path escapes repository, required evidence is unavailable, manual-note replacement lacks approval, requested map count exceeds five scoped maps without approval, or map output would become task tracking instead of orientation.

## Output format

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

Use this root map structure unless repository evidence demands better:

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
## Entry Points and Runtime Flow
## Major Boundaries
## Configuration, State, and Generated Files
## Verification Surfaces
## Extension and Integration Points
## Recent Evolution from Git History
## Scoped Maps
## Agent Operating Notes
## Open Questions
```

Use this scoped map structure unless scope evidence demands better:

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
