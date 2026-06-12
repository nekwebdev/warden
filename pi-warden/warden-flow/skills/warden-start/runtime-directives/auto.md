# Warden Start Auto Mode

Auto mode changes only optional interaction mechanics for this `warden-start` invocation.

Skip optional and late fine-tuning user-input workflow when enough evidence exists to proceed safely. Create the same decision points internally, choose recommended/default answers, record auto-selected defaults under packet `## Decisions`, then continue normal packet review.

When package-computed selection metadata is present, use it for packet type, slug, branch name, prompt skip decisions, and local branch action state. Do not ask another slug/type/branch prompt when the directive says to skip it.

Safety cannot be bypassed. Stop conditions, unclear repository root or packet path, unsafe packet path, unsafe boundary, impossible-to-reduce work, dirty repo refusal before auto branch switch/create, and higher-priority instructions still win. If safety, scope, ownership, or path decisions are blocked, stop or request user input through the active workflow.
