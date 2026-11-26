---
name: ralph-loop
description: "Ralph repeats a bounded implementation task against a saved prompt and explicit completion checks. Use when the user explicitly requests a Ralph loop or asks to resume or cancel one."
---

# Ralph

Complete the user's task through successive verified passes. Keep the original task and pass count on disk so another harness can resume the work. Finish when every acceptance criterion has current evidence, the user cancels, the pass limit is reached, or a blocker requires outside input.

Start only on explicit invocation. Accept `--max-iterations <n>` and `--completion-promise "<phrase>"` before or after the task. If the user requests help or passes `--help` or `-h`, show usage and the defaults without creating a run. Reject invalid options before starting. Resolve the task, constraints, and acceptance checks from the user's request and project. Ask only if missing information blocks work. The loop inherits the user's scope and permissions.

## Start or resume

Read `references/state.md` for the shared state and marker format. Start a new state file in the harness working directory. For an explicit resume, locate the requested state file, confirm the prior session is idle, and rebind it as described there. A cancellation sets that run's status to `cancelled`.

For each pass, reread the original prompt and current workspace evidence. Make an in-scope improvement and run the checks that assess it. Report what changed, the check result, and what remains. End the pass with the exact marker described in the reference. End the turn after the marker so the configured adapter can replay the original task in the same session. If the user requests inline mode or you know the adapter is unavailable, run the next pass in the current turn and advance the state yourself.

Use the `done` marker only after verifying all acceptance criteria on the current work. If a completion promise is set, put the exact `<promise>…</promise>` line immediately before the done marker. Use `blocked` for a concrete dependency you cannot resolve. At the final allowed pass, report unfinished criteria if any remain. Keep the state available for explicit resume.
