# pi-warden Agent Guidance

`pi-warden` is the future Pi Agent package area.

Current status: skeleton only.

## Rules

- Do not implement Pi Agent package behavior in bootstrap groundwork.
- Keep this subproject independently testable.
- Add product code only when a later feature explicitly scopes it.

## Tests

```sh
mise run test:pi-warden
```
