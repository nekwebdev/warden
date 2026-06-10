---
name: warden-create-skill
description: Create a new global or project Agent Skill from Warden's bundled skill template. Use when the user wants a reusable Pi skill scaffold in `$PI_CODING_AGENT_DIR/.agents/skills/` or project `.agents/skills/`.
argument-hint: [skill name or intent]
disable-model-invocation: true
license: MIT
---

# Warden Create Skill

## When to use

Use when the user wants to create a reusable Agent Skill for Pi, either globally for the current Pi agent environment or inside the current project.

## Outcome

A new `<skill-name>/SKILL.md` exists under one chosen skills directory:

- global: `$PI_CODING_AGENT_DIR/.agents/skills/<skill-name>/SKILL.md`
- project: `<git-root>/.agents/skills/<skill-name>/SKILL.md`

The generated skill uses the bundled `templates/SKILL-template.md` as guidance, but contains only concrete final content for the new skill.

## Argument handling

User arguments may include a skill name, description, intent, rough workflow, target scope, or notes for generated content.

If the skill name is missing, invalid, ambiguous, or too broad, ask for a valid name before writing. Use lowercase letters, numbers, and hyphens only.

If description, trigger, or behavior is unclear, ask only for the missing information needed to draft a useful skill.

Arguments never authorize overwriting an existing skill.

Pi skill command arguments arrive after the `</skill>` block as user text. Do not rely on `$ARGUMENTS`, `$0`, or `$1` substitution inside this file.

## Scope choice

Before writing, ask the user to choose exactly one scope through the active user-input workflow.

Show both target roots in the question:

- `Global` — `$PI_CODING_AGENT_DIR/.agents/skills/`
- `Project` — `<git-root>/.agents/skills/`

Use project scope from the current Git repository root. If project scope is chosen outside a Git repository, stop and ask the user to rerun from a project repository or provide a project root.

Use global scope from `PI_CODING_AGENT_DIR`. If `PI_CODING_AGENT_DIR` is unavailable, stop and report that the global skill root cannot be resolved.

## Non-goals

Do not implement the new skill's workflow, create helper scripts, create assets, install dependencies, edit maps, edit package manifests, or update existing skills unless the user explicitly asks.

Do not create both global and project skills in one run unless the user explicitly requests both after the initial scope choice.

## Execution tracking

When the harness exposes a plan or todo tool, mirror the top-level `## Procedure` steps in an ephemeral task list before starting. Use the tool name and schema advertised by the harness.

Track progress in the harness only. Do not create repo task files or durable work artifacts. Keep exactly one task in progress; mark each task complete immediately when its step finishes.

## Template contract

Read this bundled template before drafting:

```text
templates/SKILL-template.md
```

Use the template as a category palette, not as literal output.

Generated `SKILL.md` content should keep only:

- required frontmatter fields;
- mandatory sections with concrete content;
- optional sections relevant to the requested skill;
- default content blocks from the template when they apply.

Generated `SKILL.md` content must strip:

- `Status:` labels;
- placeholder text;
- comments;
- generator guidance;
- unused optional headings;
- examples that do not prevent real misuse.

## Safety rules

- Inspect the target directory before writing.
- Never silently overwrite an existing `<skill-name>/SKILL.md`.
- If the target skill already exists, stop and ask whether to revise the existing skill or choose another name.
- Create only the target skill directory and `SKILL.md` unless the user explicitly asks for more files.
- Protect unrelated dirty project files.
- Never claim the new skill was tested unless a real check ran.
- Keep generated skill instructions safe for mutation, commit, deploy, send, delete, publish, or apply workflows by including approval gates when relevant.

## Procedure

### Step 1: Choose scope

1. Resolve global root from `$PI_CODING_AGENT_DIR/.agents/skills/`.
2. Resolve project root from `<git-root>/.agents/skills/`.
3. Ask the user to choose `Global` or `Project`, showing both roots.
4. Stop if the chosen root cannot be resolved.
5. Keep the chosen root for target-path checks; do not write yet.

### Step 2: Read template

1. Read `templates/SKILL-template.md` from this skill directory.
2. Keep the template in context as a category palette for the final skill.
3. Do not copy template comments, `Status:` labels, placeholders, or unused headings into final output.

### Step 3: Collect inputs and grill skill shape

1. Determine the skill name, purpose, trigger, outcome, inputs, boundaries, risky actions, procedure, and output shape from user text when clear.
2. Grill the user one unresolved decision at a time until the exact skill name and behavior are clear.
3. For each question, provide your recommended answer.
4. If a question can be answered from the user's existing request, chosen scope, or local evidence, use that evidence instead of asking.
5. Challenge vague or overloaded terms, unsafe scope, unclear mutation behavior, unclear approval gates, and names that do not match the intended trigger.
6. Validate the final skill name: lowercase letters, numbers, and hyphens only.
7. Stop if the skill name or requested behavior remains too vague to draft safely.

### Step 4: Check target

1. Derive target path `<chosen-root>/<skill-name>/SKILL.md`.
2. Inspect whether the target skill directory or `SKILL.md` already exists.
3. Stop before overwrite unless the user explicitly approves updating the existing skill.

### Step 5: Draft skill

1. Draft final `SKILL.md` content from the template categories.
2. Keep concrete content only.
3. Include relevant safety defaults and approval policy for risky workflows.
4. Do not include template comments, status labels, or unused headings.

### Step 6: Confirm write

Show the chosen scope, target path, generated frontmatter, and section list. Ask for confirmation before writing.

### Step 7: Write and report

1. Create the target directory if needed.
2. Write `SKILL.md`.
3. Report the path and next safe step.

## Review checklist

Before writing, confirm:

- user chose global or project scope;
- target root was shown to the user;
- bundled template was read;
- inputs were grilled until skill name and behavior were clear;
- skill name is valid;
- target path was inspected;
- no existing `SKILL.md` will be overwritten without explicit approval;
- generated skill strips template-only guidance;
- final write is limited to the chosen target skill directory.

## Stop conditions

Stop without writing when:

- skill name is invalid or unclear;
- both global and project roots cannot be resolved;
- user has not chosen a scope;
- target `SKILL.md` exists and overwrite/update is not explicitly approved;
- requested skill behavior is too vague to draft safely;
- target path would escape the chosen skills directory.

## Output format

After writing:

```md
# Warden Create Skill Result

## Result

Created `<target-path>`.

## Scope

Global | Project

## Skill

- Name: `<skill-name>`
- Description: <description>

## Files changed

- `<target-path>`

## Next safe step

Review the generated skill, then invoke it with `/skill:<skill-name>` when ready.
```

For stopped work, use the same shape and put the blocker in `## Result`.
