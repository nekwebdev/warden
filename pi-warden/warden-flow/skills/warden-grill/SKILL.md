---
name: warden-grill
description: Pressure-test a Warden work packet before implementation and return Go, Adjust, or Stop.
license: MIT
---

# Warden Grill

Adversarially review a `.warden/work/<slug>/packet.md`, pasted packet, or proposed coding-agent slice before implementation. Return one verdict only: `Go`, `Adjust`, or `Stop`.

Do not edit files by default. Do not implement code. Do not plan a new slice. Do not secretly become `warden-start`. When only rough intent exists, return `Stop` or `Adjust` and recommend `/skill:warden-start`.

## Challenge stance

Be relentless but useful. Test whether the packet can survive implementation pressure, not whether it sounds polished.

- Inspect repo files before asking the user when packet facts or repository evidence can answer.
- Challenge vague language: sharpen vague terms into concrete behavior, boundaries, files, owners, commands, or acceptance signals.
- Surface packet/code/doc contradictions, especially mismatches between packet claims, live files, package guidance, README behavior, map hints, and tests.
- Probe edge scenarios: wrong cwd, stale maps, missing package guidance, unavailable tooling, broad likely files, cross-boundary edits, risky shell/network/install behavior, and untestable acceptance.
- Ask at most one blocking question at a time, and only when repo evidence cannot resolve the blocker.

## Challenge loop

1. Read the packet or pasted slice first.
2. Inspect relevant package guidance, README, likely files, tests, and commands when needed.
3. Convert fuzzy claims into concrete pass/fail checks.
4. Compare packet claims against live repo evidence and documented Warden boundaries.
5. Return one verdict with minimum changes or next safe action.

## Verdicts

- `Go`: slice is small, bounded, testable, research-aware, and safe enough for implementation. Minor notes only; no blocking changes.
- `Adjust`: slice is close but needs tightening before implementation: missing tests, vague acceptance, unclear boundaries, stale map risk, missing external research, or broad likely files.
- `Stop`: slice is unsafe, wrong owner/cwd, crosses too many boundaries, lacks a real implementation object, depends on unverified risky external claims, or must be split before any coding agent edits files.

## Review checks

1. Packet existence and shape
   - Confirm real packet, pasted packet, or proposed coding-agent slice exists.
   - If input is rough intent only, do not shape it into a packet; recommend `/skill:warden-start`.
2. Slice size
   - Require one small vertical implementation pass.
   - Flag broad roadmaps, multiple unrelated packages/runtimes, root + runner + package mixtures, docs/process work disguised as implementation, and vague “improve everything” work.
3. Acceptance behavior
   - Require observable behavior.
   - Flag vague acceptance, “works correctly” with no observable result, or acceptance that cannot be tested or manually verified.
4. Test strategy
   - Require narrow automated tests where possible.
   - Flag missing tests, invented commands without repo evidence, broad “run all tests” as only strategy when narrower tests exist, and claims that tests passed without actual commands.
5. Manual verification
   - Require a human-visible check.
   - Flag no manual verification, checks that only repeat automated tests, or no command output/behavior to inspect.
6. Boundary and ownership
   - Check primary agent, expected cwd, owned work area, likely files, files not to touch, handoffs, package locality, and rejected cross-boundary work.
   - Preserve Warden ownership: root bootstrap and `run-warden/` belong to Sentinel by default; `pi-warden/<package>/` package work belongs to Piper; `nix-warden/` and `dev-warden/` are Systems or future-specialist areas unless explicitly scoped.
7. Map handling
   - maps are orientation only; they are not task state, implementation diaries, issue trackers, release notes, or PRDs.
   - map information may be stale.
   - Only `/skill:warden-map` updates map files: `.warden/map.md` and `.warden/maps/**/map.md`.
   - Other skills may read map capsules as hints but must verify repo facts before relying on them.
   - If map freshness matters, recommend a scoped `/skill:warden-map` refresh.
8. External research
   - Repo facts come from local repo evidence: repository files, commands, tests, boundaries, and implementation behavior.
   - External/current facts use web research when packet depends on current upstream APIs, dependency behavior, package manager behavior, OS/platform behavior, licensing, security guidance, external service behavior, or third-party docs.
   - Prefer official or primary sources for external technical facts.
   - Do not browse to rediscover local repo facts.
   - If external research affects verdict, record researched claim, source/source type, and decision impact.
9. Safety and security
   - Apply extra caution for shell execution, filesystem mutation, installers, network calls, auth/secrets, permissions, agent lifecycle, external tool invocation, dependency loading, commit/apply behavior, map writing, and generated files.
   - Recommend stronger verification or a smaller slice when risk is high.
10. Durable docs
   - Do not edit `CONTEXT.md`, ADRs, map files, or packet files inline.
   - Recommend docs work only when acceptance or boundary clarity needs it; make it a packet adjustment, not a grill-side edit.
   - README is for human/operator usage, setup, commands, and project explanation.
   - AGENTS is for role-neutral agent editing rules and boundaries.
   - `.warden/map.md` and `.warden/maps/**/map.md` are durable orientation only.
   - `.warden/work/<slug>/packet.md` is active task state.
   - `CHANGELOG.md` belongs in seal only when public/operator behavior changes.
   - ADRs are only for pivotal, expensive-to-reverse, surprising, or likely-to-be-reargued choices.
   - Reject PRDs, issue trackers, implementation diaries, and lifecycle state machines. Reject broad roadmaps.

Do not add subagents. Do not add custom tools, extensions, workflow runners, or packet automation.

## Output

Use this exact shape. Keep concise. Prefer specific fixes over abstract criticism.

```md
# Warden Grill

Verdict: Go | Adjust | Stop

## What holds up

## What breaks

## Boundary check

## Slice check

## Acceptance check

## Verification check

## External research check

## Map check

## Durable-docs check

## Tightened next safe step
```

If verdict is `Adjust`, list minimum changes needed to make packet implementation-ready. If verdict is `Stop`, give safest next action: run `/skill:warden-start`, split packet, move work to correct owner/agent, refresh maps with `/skill:warden-map`, research a blocking external claim, or reduce slice to one package-local change.
