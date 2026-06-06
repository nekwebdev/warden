# warden-flow

`@nekwebdev/warden-flow` is Warden's Pi Agent workflow, durable-orientation, and commit-safety package.

It reduces repeated repo discovery by maintaining a small map tree, injecting only token-conscious capsules when relevant, and providing lean workflow skills plus safe local commit planning tools.

## What it provides

- `/skill:warden-map` — creates or refreshes repository map files.
- `/skill:warden-start` — turns rough intent into one small `.warden/work/<slug>/packet.md` work packet for a lean dev cycle.
- `/skill:warden-grill` — pressure-tests a work packet through a question/update loop until it is solid for TDD.
- `/skill:warden-tdd` — implements one grilled work packet slice with strict test-first workflow.
- `/skill:warden-commit` — plans safe, atomic local commits and can apply them after exact `Commit` confirmation.
- `/warden:effort` — opens the Warden panel Effort pane for Warden skill thinking-level settings through `@nekwebdev/warden-panel`.
- `extensions/warden-map` — injects map capsules and git context.
- `extensions/warden-commit` — registers `warden_commit_snapshot` and `warden_commit_apply` for safe local commit planning and execution.
- `extensions/warden-effort` — seeds Warden skill effort defaults and applies configured effort before `/skill:warden-*` expansion.
- Session-start map injection — hidden root map capsule from `<git-root>/.warden/map.md`.
- Scoped map injection — hidden scoped capsules from `<git-root>/.warden/maps/<scope>/map.md` appended to relevant tool results.
- Git context injection — branch, short commit, and dirty state.

## Map layout

When cwd is inside a Git repository, maps are canonical at the Git top-level, even when Pi runs from a nested cwd:

```text
<git-root>/.warden/
├── map.md
└── maps/
    └── <repo-relative-scope>/
        └── map.md
```

Examples:

```text
.warden/map.md
.warden/maps/pi-warden/map.md
.warden/maps/pi-warden/warden-flow/map.md
```

## Capsule contract

Only marked capsules are auto-injected:

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

Full map bodies stay on disk. Agents can read them explicitly when a task needs deeper context.

## Token budget

Approximate budget rule: 1 KB markdown is about 250–350 tokens.

| Context | Target | Hard cap |
|---|---:|---:|
| Root capsule | 3 KB (~900 tokens) | 8 KB (~2,400 tokens) |
| Scoped capsule | 1.5 KB (~450 tokens) | 4 KB (~1,200 tokens) |
| One scoped injection event | — | 6 KB (~1,800 tokens) |
| Session start total | — | 10 KB (~3,000 tokens) |

When a capsule is missing or too large, the extension injects a small notice pointing at the map file instead of injecting the full file.

## Git context

When git is available, the extension injects:

```md
## Current Git Context
- Branch: main
- Commit: abc1234
- Dirty: yes — staged 1, unstaged 3, untracked 2
- Dirty paths: src/a.ts, docs/b.md
```

Git context is cached and re-injected only when branch, commit, or dirty state changes.

## Skill effort

Warden Flow stores per-skill effort settings and the skill status indicator toggle in Pi `settings.json`:

```json
{
  "warden": {
    "effort": {
      "showSkillStatus": false,
      "skills": {
        "warden-map": "low",
        "warden-start": "medium",
        "warden-grill": "high",
        "warden-tdd": "high",
        "warden-commit": "medium"
      }
    }
  }
}
```

Current defaults seeded at session start:

- `warden-map`: `low`
- `warden-start`: `medium`
- `warden-grill`: `high`
- `warden-tdd`: `high`
- `warden-commit`: `medium`

`/warden:effort` opens the Effort pane contributed through the public pane API from `@nekwebdev/warden-panel`. `warden-flow` declares that package as a dependency so the pane framework is available when the Effort extension loads. Space/Enter cycles a selected skill through `off`, `minimal`, `low`, `medium`, `high`, `xhigh` and writes immediately; there is no Apply step.

`extensions/warden-effort` also contributes a Display pane setting for the skill status indicator through `contributeWardenDisplaySetting()`. The indicator defaults off. Toggle it from Display; the setting writes inline.

When a `/skill:warden-*` turn starts, `extensions/warden-effort` reads the configured level, calls Pi's public `setThinkingLevel()`, shows a small themed Pi status indicator with the active skill and effort level when `warden.effort.showSkillStatus` is `true` (default off), then restores the previous thinking level and clears the status indicator after the agent turn. Pi may clamp unsupported levels depending on the active model/provider.

## Commit helper

`/skill:warden-commit` uses `warden_commit_snapshot` from `extensions/warden-commit` to plan local commits without token-heavy repeated git inspection.

`warden_commit_snapshot` is read-only. It reports compact git status, Warden boundaries, path risks, deterministic buckets, recent commit subjects, and a stable snapshot hash. It does not stage, commit, push, pull, fetch, rebase, reset, amend, tag, or create PRs.

`warden_commit_apply` can create local commits only from an explicit plan after the user replies exactly `Commit`. It recomputes the snapshot, refuses when the hash changed, validates exact repo-relative paths, rejects risky/excluded paths by default, refuses mixed staged/unstaged or pre-existing staged changes, stages only exact paths, verifies the staged set before `git commit`, and returns commit hashes plus final `git status --short`.

It never pushes, pulls, fetches, rebases, resets, amends, tags, stashes, checks out, cleans, restores, creates PRs, or runs remote git operations.

## Package dependency

`warden-flow` depends on `@nekwebdev/warden-panel` for the Effort pane registry and panel opener used by `/warden:effort`. In this repository the dependency is declared as `file:../warden-panel` so local package development and Pi local installs resolve the sibling package explicitly.

## Scope boundary

This package owns Warden workflow/orientation Pi behavior, including `warden-map`, `warden-start`, `warden-grill`, `warden-tdd`, `warden-commit`, map capsule injection, commit snapshot/apply tooling, and Warden Flow skill effort settings.

It does not own Warden runner workflows, Pi agent lifecycle commands, or sibling package installation workflows.

## Local development

```sh
npm install --prefix pi-warden/warden-panel
npm install --prefix pi-warden/warden-flow
npm test --prefix pi-warden/warden-flow
mise run test:pi-warden
```

From the Warden repo root, load temporarily during development:

```sh
pi -e ./pi-warden/warden-flow
```

Or install locally into a Pi environment:

```sh
pi install ./pi-warden/warden-flow
```
