---
name: warden-prompt
description: Workshop rough work ideas into comprehensive warden-start prompts without editing files or starting workflows.
argument-hint: [rough work idea]
disable-model-invocation: true
license: MIT
---

# Warden Prompt

## When to use

Use when the user has a vague, messy, or partially formed work idea and wants help turning it into a strong `/skill:warden-start` prompt before creating a packet.

Use this before `/skill:warden-start` when the user needs discussion, decision compression, scope narrowing, or explicit confidence checkpoints.

If the user input does not already provide enough context to discuss a useful work idea, start by asking what needs worked on.

## Outcome

- User receives a concise, comprehensive `/skill:warden-start` prompt they can run when ready.
- Prompt contains goal, scope, context, constraints, non-goals, acceptance criteria, verification expectations, and handoff notes.
- Prompt instructs target agent to inspect relevant existing files/docs before implementation.
- No project files are edited.
- No code is implemented.
- No Warden workflow is invoked, handed off, or run automatically.

## Argument handling

Treat all text after invocation as rough work-idea input.

If input is empty, too broad, or missing essential context, ask what needs worked on before choosing a mode.

If input already contains a clear goal, begin in Explore mode unless the user explicitly asks to craft a final prompt or says they are ready.

User phrases such as "start workflow", "craft prompt", "make the warden-start prompt", or "ready" mean evaluate whether Start-prompt mode is safe. They do not authorize running `/skill:warden-start`.

## Non-goals

- Must not implement code.
- Must not edit project files.
- Must not run workflows automatically.
- Must not create packets, PRDs, issue trackers, ADRs, implementation diaries, or repo task files.
- Must not invoke, hand off to, or auto-run `warden-start`, `warden-grill`, `warden-tdd`, `warden-close`, `warden-commit`, or other workflow automation.
- Must not treat unresolved open questions as settled requirements.

It must not invoke, hand off to, or auto-run `warden-start`; after confirmation, it only produces prompt text and a recommended command for the user to run.

## Modes

Guide the workshop through Explore, Lock, and Start-prompt modes.

### Explore mode

Use Explore mode to discover the work shape.

- Clarify goal, affected area, user-visible outcome, constraints, non-goals, risks, and verification needs.
- Prefer repo-aware wording when user supplied repo context, but do not inspect or edit files unless the user explicitly changes tasks outside this skill.
- Use decision compression: turn messy conversation into concise prompt-ready requirements.
- Keep unresolved uncertainty visible under Open questions.

### Lock mode

Use Lock mode when enough candidate requirements exist to propose a stable concept.

- Summarize concept in compact form.
- Show decisions that appear ready to lock.
- Ask the user to confirm before treating any concept as locked.
- If user changes direction, move old direction to Rejected options when useful and return to Explore mode.

### Start-prompt mode

Use Start-prompt mode only when locked decisions are sufficient and no unresolved open questions remain.

Start-prompt mode means producing a `warden-start` prompt and suggested command, not running workflow automation.

Before producing final output, ask the user to confirm the workshop output is ready for `warden-start`.

After confirmation, only produce final prompt text and an exact recommended next command for the user to run.

## Working sections

During discussion, maintain these compact working sections in responses only, not as repo files:

```md
## Current goal

## Locked decisions

## Open questions

## Rejected options

## Acceptance/checklist notes
```

Keep sections short. Compress repeated conversation into durable requirements. Remove resolved questions from Open questions only after decision is locked.

## Interaction model

Ask only for decisions needed to make the final prompt safe, useful, and packet-ready.

When asking, provide a recommended answer when useful. Keep each checkpoint focused.

Always ask for confirmation before treating a concept as locked.

Always ask for confirmation before treating the workshop output as ready for `warden-start`.

If open questions remain, keep workshopping instead of producing final `warden-start` prompt.

## Final prompt contract

When user asks to start workflow, craft prompt, or says ready, produce a final comprehensive `warden-start` prompt only if all open questions are resolved and readiness is confirmed.

Final prompt must include:

- goal;
- scope;
- context;
- constraints;
- non-goals;
- acceptance criteria;
- verification expectations;
- handoff notes;
- instruction for target agent to inspect relevant existing files/docs before implementation.

Final prompt should be comprehensive but not transcript-dumpy. Include rejected options when useful to prevent backsliding. It must not carry unresolved open questions.

Recommended command format:

```text
/skill:warden-start <final prompt>
```

Do not run that command. Do not invoke another skill. Do not create or update packet files.

## Execution tracking

When the harness exposes a plan or todo tool, mirror the top-level `## Procedure` steps in an ephemeral task list before starting. Use the tool name and schema advertised by the harness.

Track progress in the harness only. Do not create repo task files or durable work artifacts. Keep exactly one task in progress; mark each task complete immediately when its step finishes.

## Procedure

### Step 1: Collect rough intent

1. Read the user's rough work idea from invocation text.
2. If context is insufficient, ask what needs worked on.
3. Identify whether the user needs Explore, Lock, or Start-prompt mode.

### Step 2: Explore requirements

1. Build compact working sections in the response only.
2. Clarify goal, scope, constraints, non-goals, acceptance, and verification.
3. Apply decision compression after each material answer.
4. Keep unresolved items under Open questions.

### Step 3: Lock decisions

1. When a coherent concept emerges, summarize it.
2. Ask for confirmation before treating concept as locked.
3. Move confirmed items to Locked decisions.
4. Record rejected directions only when they prevent future confusion.

### Step 4: Prepare start prompt

1. Enter Start-prompt mode only when no open questions remain.
2. Ask for confirmation that output is ready for `warden-start`.
3. If confirmation is missing or new questions appear, return to Explore or Lock mode.

### Step 5: Output final prompt

1. Produce one comprehensive `warden-start` prompt following the final prompt contract.
2. Provide exact recommended next command for the user to run.
3. State that no workflow was run and no files were edited.

## Review checklist

Before final Start-prompt output, verify:

- concept was confirmed before being treated as locked;
- readiness for `warden-start` was confirmed;
- no open questions remain;
- prompt includes goal, scope, context, constraints, non-goals, acceptance criteria, verification expectations, and handoff notes;
- prompt tells target agent to inspect relevant existing files/docs before implementation;
- rejected options are included when useful;
- output does not imply code, file edits, packet creation, or workflow execution happened.

## Stop conditions

Stop or keep workshopping instead of producing final prompt when:

- user has not provided enough context to identify the work;
- concept is not confirmed as locked;
- open questions remain;
- readiness for `warden-start` is not confirmed;
- requested action would implement code, edit files, create packets, or run workflows automatically.

If user wants implementation, packet creation, or TDD execution, explain that this skill only prepares the prompt and provide the next command for the user to run manually.

## Output format

During workshop, respond with compact working sections and the next question or checkpoint.

When final prompt is ready, respond in this shape:

```md
# Warden Prompt Result

## Final warden-start prompt

<final prompt text>

## Recommended next command

`/skill:warden-start <final prompt text>`

## Safety note

No workflow was run. No files were edited.
```

Report skipped checks with exact reasons. Do not imply commit, push, deploy, publish, map refresh, packet creation, or follow-up workflow happened unless it did.
