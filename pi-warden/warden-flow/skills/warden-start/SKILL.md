---
name: warden-start
description: Start a lean Warden dev cycle by turning rough intent into one small, testable work packet.
argument-hint: [rough intent or packet.md path]
license: MIT
---

<argument-handling>

User input may be messy intent, a narrow change request, an existing rough packet path, or a request to split/reduce work.

- Do not require a polished plan. Shape messy intent into one safe slice.
- If input points to an existing `packet.md`, tighten that packet instead of creating a new path unless unsafe.
- If input is rough intent, choose a short lowercase slug from user intent, using hyphens.
- Report packet paths as `.warden/work/<slug>/packet.md`, relative to the Git repository root.
- Use this skill as the entry point for a lean Warden dev cycle, for example: `/skill:warden-start add warden-grill`.

Canonical packet root:

- First discover the Git repository root from current cwd.
- When cwd is inside a Git repository, create or update packets only under `<git-root>/.warden/work/**`.
- If invoked from nested cwd with no explicit path, write packet under the Git repository root, not the nested cwd.
- Do not write `.warden/work/**` under a nested cwd unless that cwd is itself a separate Git repository.
- If cwd is not inside a Git repository, fail clearly unless explicit standalone path behavior is already supported by available repo evidence.
- Do not use Warden home paths or environment-specific roots.

</argument-handling>

<scope-gates>

Valid modes:

1. Create a new packet from messy user intent.
2. Tighten an existing rough packet.
3. Split or reject work that crosses too many boundaries.
4. State assumptions instead of blocking unless implementation safety is truly blocked.

Slice rules:

- Prefer one small vertical slice with concrete acceptance behavior.
- Keep the packet lean enough for a coding agent to execute next.
- Include narrow automated test strategy where possible.
- Include manual verification even when automated tests exist.
- Identify clear work area, likely files, and files not to touch.
- Make non-goals explicit.
- End with a next safe step suitable for a coding agent.
- Split or reject broad requests that span unrelated boundaries, owners, packages, or runtimes.
- Ask clarification only when implementation safety is truly blocked. Otherwise state assumptions and proceed until the late fine-tuning checkpoint.
- Fine-tuning questions are not blockers or safety clarifications: once you believe the packet is ready, ask the user at least two structured questions to tune the slice before finalizing.

Anti-bloat rules:

- Do not create PRDs by default.
- Do not create issue trackers.
- Do not create lifecycle state machines.
- Do not create broad roadmaps.
- Do not create implementation diaries.
- Do not add an ADR unless the decision is pivotal, expensive to reverse, surprising, or likely to be reargued.

</scope-gates>

<safety>

Default behavior when file-editing tools are available:

- Create or update `<git-root>/.warden/work/<slug>/packet.md`.
- Create `<git-root>/.warden/work/<slug>/` first when needed.
- Only output packet markdown instead of writing the file when user explicitly asks for preview or dry run, environment cannot edit files, or implementation safety is blocked.

Do not write outside packet path:

- Do not create PRDs, issue trackers, roadmaps, lifecycle machinery, or files outside `.warden/work/<slug>/packet.md`.
- Do not put task state in `README.md`, `AGENTS.md`, or map files.
- Do not edit `.warden/map.md` or `.warden/maps/**/map.md`; only `/skill:warden-map` updates maps.
- Do not continue into implementation.

</safety>

<context-sources>

Repo facts come from local repo evidence: repository structure, commands, tests, boundaries, docs, and implementation behavior.

Map rules:

- Maps are orientation only; they are not task plans, issue trackers, or implementation artifacts.
- Map information may be stale.
- Use map capsules as orientation hints only.
- Only `/skill:warden-map` updates map files: `.warden/map.md` and `.warden/maps/**/map.md`.
- If map freshness matters, recommend `/skill:warden-map` for the relevant scope.
- If packet depends on current repo facts, instruct the coding agent to inspect repository files before editing.

External research rules:

- External/current facts come from web research; use it only when the packet depends on facts outside the repository or facts likely to have changed.
- External facts include current upstream APIs, dependency behavior, package manager behavior, OS/platform behavior, licensing, security guidance, and external service behavior.
- Prefer official or primary sources for external technical facts.
- Do not browse to rediscover local repo facts.
- If external research affects the packet, record what needed research, source or source type, decision impact, and whether implementation should verify again before editing.

</context-sources>

<questioning-policy>

Use `ask_user_question`, questionnaire extension, or equivalent structured choice UI when available.

Early clarification:

- Ask early only if implementation safety, canonical path, or boundary choice is truly blocked.

Ready-packet fine-tuning:

- After the draft packet passes review checks and before final output, ask at least two structured questions in one checkpoint.
- Do not skip this checkpoint because assumptions feel obvious.
- Each question must include your recommended answer and 2-4 concise options when using structured UI.
- Aim questions at slice boundaries, acceptance wording, files not to touch, test/manual verification emphasis, and deferred non-goals.
- Incorporate answers into `packet.md`, then re-run review checks.

</questioning-policy>

<workflow>

1. Resolve canonical Git repository root and packet path.
2. Determine whether user wants a new packet, an existing packet tightened, or a broad request split/rejected.
3. Inspect enough repo evidence, maps, and docs to make safe boundary assumptions. Do not over-research.
4. Use external research only when required by `<context-sources>`.
5. Choose one small vertical slice, with explicit non-goals and files not to touch.
6. Create or refine packet markdown using the section set in `<output-format>`.
7. Once the packet appears ready, ask at least two fine-tuning questions, wait for answers, and incorporate them.
8. Write packet to `<git-root>/.warden/work/<slug>/packet.md` unless preview/dry-run/no-edit/blocked safety applies.
9. Respond with `# Warden Start Result` and next action `/skill:warden-grill <repo-root>/.warden/work/<slug>/packet.md`.

</workflow>

<review-checks>

Before finishing, verify packet has:

- one small vertical slice, not a roadmap;
- concrete observable acceptance behavior;
- explicit non-goals;
- narrow work area and likely files;
- files not to touch, including protected boundaries, maps, generated files, secrets, and unrelated packages;
- automated test strategy where possible, or a clear reason none fits;
- manual verification with a human-visible check or command output to inspect;
- boundary notes covering primary agent, expected cwd, owned work area, handoffs, package locality, and rejected cross-boundary work;
- map freshness notes, including stale-risk and whether `/skill:warden-map` is recommended;
- external research notes, using `None; repo-local slice.` when no external research is needed;
- assumptions and chosen splits under `Decisions`;
- first concrete coding-agent action under `Next safe step`;
- at least two packet-ready fine-tuning questions were asked and their answers incorporated.

For prose-only `SKILL.md` or docs edits, prefer manual read/verification over markdown prose assertion tests. Reserve automated tests for runtime behavior, package contracts, or existing tested invariants.

</review-checks>

<output-format>

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

## External research notes

## Decisions

## Next safe step
```

Section guidance:

- `Intent`: one-paragraph rough goal in user language.
- `Non-goals`: explicit exclusions and deferred adjacent work.
- `Current slice`: one vertical behavior slice, not a roadmap.
- `Acceptance behavior`: observable outcomes, concrete enough to test.
- `Work area`: narrow repo/package boundary for edits.
- `Likely files`: probable files to inspect or edit; mark uncertain entries.
- `Files not to touch`: protected boundaries, maps, generated files, secrets, unrelated packages.
- `Test strategy`: narrow automated checks where possible; say when none fit.
- `Manual verification`: human-visible check or command output to inspect.
- `Boundary notes`: primary agent, expected cwd, owned work area, handoffs, package locality, and rejected cross-boundary work.
- `Map freshness notes`: map hints used, stale-risk, and whether `/skill:warden-map` is recommended.
- `External research notes`: what needed research, source or source type, decision impact, and reverify-before-editing call; use `None; repo-local slice.` when no external research is needed.
- `Decisions`: assumptions and chosen splits; keep brief.
- `Next safe step`: first concrete action for the coding agent.

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

When packet file is written, keep `## Packet` to a written-file note unless user asks to see full content. When writing is skipped for preview, dry run, no file-editing tools, or blocked safety, put full packet markdown in `## Packet`.

Offer next action: `/skill:warden-grill <repo-root>/.warden/work/<slug>/packet.md`.

</output-format>
