---
name: ralph-loop-glue
description: "Ralph Loop Glue replays one task in the current coding session. Use when the user explicitly starts, resumes, or cancels a Ralph loop."
license: MIT
---

# Ralph Loop Glue

Keep working on the same prompt. At the end of a pass, the harness can feed that prompt back into the current session. Use the files, diffs, and check results from earlier passes to improve the work.

## Setup

On an explicit `setup` request, run `bun <absolute-skill-directory>/adapters/setup.mjs`. Pass the requested harness names or let it detect existing user config directories. Run with `--dry-run` when the user asks for a preview. Report what was configured. Restart the affected harnesses and approve hooks in the harness if prompted.

## Start

Accept a task followed or preceded by `--max-iterations <n>` and `--completion-promise "<phrase>"`. A limit of zero means unlimited and is the default. If no completion promise is set, the loop continues until cancelled, capped, or blocked. Honor `--help` and `-h` before starting any work. Reject invalid options.

Read `references/state.md` and create a state file. Save the task, constraints, and measurable acceptance criteria in the original prompt. Loop only on explicit user request and within the scope they granted.

## Iterate

Reread the saved prompt and check what changed in the workspace. Use each pass to make progress or verify the result. Report the check result and finish with the current pass marker. The adapter advances the pass count and puts the original task back in front of you. If the user requests inline mode, advance the count yourself and run the next pass in the current turn.

A completion promise is a claim about the work. Emit its exact `<promise>…</promise>` line immediately before the done marker only when the claim is true and all acceptance criteria have current evidence. Never emit a promise to end the loop early. Use the blocked marker if continuing requires outside input. At the limit, report any unfinished criteria.

To cancel, set the run to `cancelled`. To resume a named run, follow the rebinding instructions in `references/state.md`.
