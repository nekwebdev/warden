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

## Boundary rules

Preserve Warden ownership boundaries:

- Root bootstrap work belongs to Sentinel, not Piper.
- `run-warden/` runner workflow work belongs to Sentinel by default.
- `pi-warden/<package>/` package work belongs to Piper.
- `nix-warden/` and `dev-warden/` are Systems or future-specialist areas unless explicitly scoped.
- Package-local work must stay package-local.

If a request crosses these boundaries, narrow it to one safe package-local slice, split it into separate packets, or reject the oversized packet.

## Map rules

- maps are orientation only; they are not task plans, issue trackers, or implementation artifacts.
- map information may be stale.
- Use map capsules as orientation hints only.
- Only /skill:warden-map updates map files: `.warden/map.md` and `.warden/maps/**/map.md`.
- Do not edit `.warden/map.md` or `.warden/maps/**/map.md` from this skill.
- If map freshness matters, recommend `/skill:warden-map` for the relevant scope.
- If the packet depends on current facts, instruct the coding agent to inspect repository files before editing.

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

## Boundary notes

## Map freshness notes

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
- `Test strategy`: narrow automated checks where possible; say when none fit.
- `Manual verification`: human-visible check or command output to inspect.
- `Boundary notes`: owner handoffs, package locality, rejected cross-boundary work.
- `Map freshness notes`: map hints used, stale-risk, and whether `/skill:warden-map` is recommended.
- `Decisions`: assumptions and chosen splits; keep brief.
- `Next safe step`: first concrete action for the coding agent.

## Output

Respond in this shape:

```md
# Warden Start Result

Packet path:

## Summary

## Assumptions

## Boundary call

## Packet

<packet markdown here>

## Next action
```

The packet path should be `.warden/work/<slug>/packet.md`. Choose a short lowercase slug from user intent, using hyphens. If tightening an existing packet, keep its path unless unsafe.

Do not continue into implementation. Produce the packet content and next action only.
