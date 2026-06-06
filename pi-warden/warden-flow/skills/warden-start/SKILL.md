---
name: warden-start
description: Start a lean Warden dev cycle by turning rough intent into one small, testable work packet.
license: MIT
---

# Warden Start

Turn rough user intent into one small, testable Warden work packet at:

```text
.warden/work/<slug>/packet.md
```

Canonical packet root:

- First discover the Git repository root from the current cwd.
- When cwd is inside a Git repository, create or update packets only under `<git-root>/.warden/work/**`.
- If invoked from a nested cwd with no explicit path, write the packet under the Git repository root, not the nested cwd.
- Do not write `.warden/work/**` under a nested cwd unless that cwd is itself a separate Git repository.
- If cwd is not inside a Git repository, do not pretend there is a canonical packet root. Fail clearly unless explicit standalone path behavior is already supported by available repo evidence.
- Do not use Warden home paths or environment-specific roots.

When file-editing tools are available, create or update `<git-root>/.warden/work/<slug>/packet.md` and create the parent directory if needed.

Use this skill as the entry point for a lean Warden dev cycle. It can work from a very small prompt, such as:

```text
/skill:warden-start add warden-grill
```

Do not require a polished plan. Shape messy intent into one safe slice.

## Modes

1. Create a new packet from messy user intent.
2. Tighten an existing rough packet.
3. Split or reject work that crosses too many boundaries.
4. State assumptions instead of blocking unless implementation safety is truly blocked.

## File write rules

- Default behavior: discover the Git repository root, then create or update `<git-root>/.warden/work/<slug>/packet.md` when file-editing tools are available.
- Create `<git-root>/.warden/work/<slug>/` first when needed.
- Report packet paths as `.warden/work/<slug>/packet.md`, relative to the Git repository root.
- Only output packet markdown instead of writing the file when the user explicitly asks for preview or dry run, the environment cannot edit files, or implementation safety is blocked.
- Do not create PRDs, issue trackers, roadmaps, lifecycle machinery, or files outside the packet path.

## Slice rules

- Prefer one small vertical slice with concrete acceptance behavior.
- Keep the packet lean enough for a coding agent to execute next.
- Include narrow automated test strategy where possible.
- Include manual verification even when automated tests exist.
- Identify clear work area, likely files, and files not to touch.
- Make non-goals explicit.
- End with a next safe step suitable for a coding agent.
- Split or reject broad requests that span unrelated boundaries, owners, packages, or runtimes.
- Ask clarification only when implementation safety is truly blocked. Otherwise state assumptions and proceed.

## Map rules

- maps are orientation only; they are not task plans, issue trackers, or implementation artifacts.
- map information may be stale.
- Use map capsules as orientation hints only.
- Only /skill:warden-map updates map files: `.warden/map.md` and `.warden/maps/**/map.md`.
- Do not edit `.warden/map.md` or `.warden/maps/**/map.md` from this skill.
- If map freshness matters, recommend `/skill:warden-map` for the relevant scope.
- If the packet depends on current repo facts, instruct the coding agent to inspect repository files before editing.

## External research rules

- Repo facts come from local repo evidence: repository structure, commands, tests, boundaries, and implementation behavior.
- External/current facts come from web research; use it only when the packet depends on facts outside the repository or facts likely to have changed.
- External facts include current upstream APIs, dependency behavior, package manager behavior, OS or platform behavior, licensing, security guidance, and external service behavior.
- Prefer official or primary sources for external technical facts.
- Do not browse to rediscover local repo facts.
- If external research affects the packet, record what needed research, source or source type, decision impact, and whether implementation should verify again before editing.

## Anti-bloat rules

- Do not create PRDs by default.
- Do not create issue trackers.
- Do not create lifecycle state machines.
- Do not create broad roadmaps.
- Do not create implementation diaries.
- Do not put task state in `README.md`, `AGENTS.md`, or map files.
- Do not add an ADR unless the decision is pivotal, expensive to reverse, surprising, or likely to be reargued.

## Packet shape

Create or refine packet markdown with this exact section set:

```md
# <Slice Title>

## Intent

## Non-goals

## Current slice

## Acceptance behavior

## Work area

## Likely files

## Files not to touch

## Test strategy

## Manual verification

## Map freshness notes

## External research notes

## Decisions

## Next safe step
```

Section guidance:

- `Intent`: one-paragraph rough goal in user language.
- `Non-goals`: explicit exclusions and deferred adjacent work.
- `Current slice`: one vertical behavior slice, not a roadmap.
- `Acceptance behavior`: observable outcomes; concrete enough to test.
- `Work area`: narrow repo/package boundary for edits.
- `Likely files`: probable files to inspect or edit; mark uncertain entries.
- `Files not to touch`: protected boundaries, maps, generated files, secrets, unrelated packages.
- `Test strategy`: narrow automated checks where possible; say when none fit. For prose-only `SKILL.md` or docs edits, prefer manual read/verification over markdown prose assertion tests; reserve automated tests for runtime behavior, package contracts, or existing tested invariants.
- `Manual verification`: human-visible check or command output to inspect.
- `Boundary notes`: primary agent, expected cwd, owned work area, handoffs, package locality, and rejected cross-boundary work.
- `Map freshness notes`: map hints used, stale-risk, and whether `/skill:warden-map` is recommended.
- `External research notes`: what needed research, source or source type, decision impact, and reverify-before-editing call; use `None; repo-local slice.` when no external research is needed.
- `Decisions`: assumptions and chosen splits; keep brief.
- `Next safe step`: first concrete action for the coding agent.

## Output

Respond in this shape:

```md
# Warden Start Result

Packet path:
Packet action:

## Summary

## Assumptions

## Boundary call

## Packet

<packet markdown or written-file note>

## Next action
```

The packet path should be `.warden/work/<slug>/packet.md`, relative to the Git repository root when inside a Git repository. Choose a short lowercase slug from user intent, using hyphens. If tightening an existing packet, keep its path unless unsafe.

When the packet file is written, keep `## Packet` to a written-file note unless the user asks to see full content. When writing is skipped for preview, dry run, no file-editing tools, or blocked safety, put full packet markdown in `## Packet`.

Do not continue into implementation. Produce the packet file or preview plus next action only.
