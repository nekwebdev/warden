# fresh-skill Agent Guidance

Package-local guidance for `pi-warden/fresh-skill/`.

## Scope

`@nekwebdev/fresh-skill` owns standalone `/fresh` Pi extension behavior.

It may:

- register `/fresh`;
- parse `/fresh <skill> [args...]`;
- validate loaded skill commands from `pi.getCommands()`;
- create clean replacement sessions with `ctx.newSession()`;
- replay `/skill:<name> <args>` with replacement-session `ctx.sendUserMessage()`;
- provide package-local docs and tests.

It must not:

- depend on `@nekwebdev/warden-flow`;
- hardcode Warden skill names;
- intercept all `/skill:` input;
- mutate/delete old session history;
- implement runner workflows, `warden pi`, or `warden agents` behavior;
- own panel UI or package-manager behavior.

## Implementation notes

- Keep deterministic parsing, filtering, autocomplete, and replay helpers in `src/`.
- Keep Pi runtime wiring in `extensions/fresh/index.ts`.
- Capture only plain strings before `ctx.newSession()`.
- Use only replacement-session `ctx` inside `withSession`.
- Keep autocomplete skill-only for the first argument and insert bare skill names; after the skill token, yield to Pi's default prompt autocomplete.

## Tests

Run package-local validation after changes:

```sh
npm test --prefix pi-warden/fresh-skill
```

Run package-area smoke after package manifest, inventory, or GitHub package-list changes:

```sh
mise run test:pi-warden
```
