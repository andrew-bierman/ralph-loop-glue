# 🔁 Ralph Loop Glue

Give your coding agent another pass without typing “keep going.”

When a pass ends, Ralph Loop Glue can replay the original task in the same session. The agent can inspect its previous edits, rerun checks, and improve the result. The task stays on disk, so you can pick it up from another harness.

Inspired by [Anthropic's Ralph Loop plugin](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/ralph-loop).

## 🧰 Install and set up

Use [Skills CLI](https://github.com/vercel-labs/skills). Add `--global` to install for your user instead of the current project.

```sh
npx skills add andrew-bierman/ralph-loop-glue --skill ralph-loop-glue -a claude-code codex opencode pi gemini-cli
```

Skills CLI installs the skill and its adapter files. Then run this once to configure the harnesses on your machine:

```sh
bun .agents/skills/ralph-loop-glue/adapters/setup.mjs
```

For a global install, use `~/.agents/skills/ralph-loop-glue/adapters/setup.mjs`. The setup can also be run from the skill. For example, type `$ralph-loop-glue setup` in Codex or `/ralph-loop-glue setup` in Claude Code. It uses your existing user config directories. Append harness names such as `codex pi` to select specific targets or `--dry-run` to preview changes. Restart the affected harnesses afterward and approve any hook the harness prompts you to review.

## 🚀 Start a loop

| Harness | What to type after setup |
| --- | --- |
| Claude Code | `/ralph-loop-glue Fix the flaky checkout test` |
| Codex | `$ralph-loop-glue Fix the flaky checkout test` |
| OpenCode 2 | `/ralph-loop-glue Fix the flaky checkout test` |
| Pi | `/skill:ralph-loop-glue Fix the flaky checkout test` |
| Gemini CLI | `/ralph-loop-glue Fix the flaky checkout test` |

The `ralph-loop-glue` name keeps the command distinct from Anthropic's `/ralph-loop`.

Try a five-pass run with a clear finish line. The options match Anthropic’s plugin.

```text
/ralph-loop-glue "Fix the flaky checkout test" --max-iterations 5 --completion-promise "CHECKOUT TEST PASSES"
```

- `--max-iterations <n>` limits the number of passes. Omit it or pass `0` for no Ralph-imposed cap. The harness may still enforce its own turn or hook limit.
- `--completion-promise "<phrase>"` matches the phrase in a `<promise>…</promise>` tag before marking the run complete. The agent still needs to verify the requested criteria. Without a promise, a loop continues until its limit, cancellation, or a blocker.
- `--help` shows the options without starting a run.

### ⏸️ Interrupt, resume, or cancel

Each run stores its prompt and pass count in `.ralph/<run-id>.json` in the session's working directory. Use the same skill invocation with `resume <run-id>` or `cancel`. If several runs are active, use `cancel <run-id>`. Use the harness's interrupt control to stop an active turn immediately. Keep the state file private and out of commits.

## 🔌 Wire up hooks by hand

Replace `SKILL_DIR` with the absolute path to the installed `ralph-loop-glue` directory. Restart the harness after changing its configuration. To try the skill before configuring the adapter, include “inline mode” in the task. It will run subsequent passes within the same turn.

### Claude Code and Codex

Add the following item to the existing `hooks.Stop` array in Claude Code's `~/.claude/settings.json`. For Codex, use `~/.codex/hooks.json` and change the final argument from `claude` to `codex`. The command uses Bun. Use an absolute Bun path if the harness cannot resolve it. Node also works if you replace `bun` with `node`.

```json
{
  "hooks": [
    {
      "type": "command",
      "command": "bun \"SKILL_DIR/adapters/stop.mjs\" claude"
    }
  ]
}
```

Approve the hook in Codex if prompted. Both adapters use the Stop event’s `last_assistant_message`. After a run is bound to a session, a Stop event already in the hook’s continuation chain can recover a missing pass marker. Remove the Stop entry to disable the adapter.

### OpenCode 2

Add `SKILL_DIR/adapters/opencode` to the `plugins` array in `opencode.jsonc`. Copy `SKILL_DIR/adapters/opencode-command.md` to `~/.config/opencode/commands/ralph-loop-glue.md`. The command loads the skill, and the plugin queues the next pass after a successful turn.

### Pi

In `~/.pi/agent/extensions/ralph-loop-glue.ts`:

```ts
export { default } from "SKILL_DIR/adapters/pi.mjs"
```

Use a Pi version with the `agent_settled` extension event.

### Gemini CLI

Copy `SKILL_DIR/adapters/gemini-command.toml` to `~/.gemini/commands/ralph-loop-glue.toml`. Add the same hook entry shown for Claude to the `hooks.AfterAgent` array in `~/.gemini/settings.json`, using `gemini` as the final argument. Gemini may ask you to approve skill activation or enable the hook.

## 🧪 What’s been tested

Run `bun test` or `node --test` to exercise the state transitions and adapter contracts. Skills CLI installation has been tested for Claude Code, Codex, OpenCode, Pi, and Gemini CLI. Automatic continuation still needs live verification in each harness, including native Codex inside Omnigent.
