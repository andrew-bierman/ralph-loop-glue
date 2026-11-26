# Ralph Loop Glue

Start a Ralph loop from the coding session you're already in. When a pass ends, the harness can replay the original task in the same session. The work stays on disk, so you can pick it up from another harness if needed.

Inspired by [Anthropic's Ralph Loop plugin](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/ralph-loop).

## Install the skill

Use [Skills CLI](https://github.com/vercel-labs/skills). Add `--global` to install for your user instead of the current project.

```sh
npx skills add andrew-bierman/ralph-loop-glue --skill ralph-loop-glue -a claude-code codex opencode pi gemini-cli
```

Skills CLI installs the skill and its adapter files. Then run this once to configure the harnesses on your machine:

```sh
bun .agents/skills/ralph-loop-glue/adapters/setup.mjs
```

For a global install, use `~/.agents/skills/ralph-loop-glue/adapters/setup.mjs`. The setup can also be run from the skill. For example, type `$ralph-loop-glue setup` in Codex or `/ralph-loop-glue setup` in Claude Code. It uses your existing user config directories. Append harness names such as `codex pi` to select specific targets or `--dry-run` to preview changes. Restart the affected harnesses afterward and approve any hook the harness prompts you to review.

## Run a loop

| Harness | What to type after setup |
| --- | --- |
| Claude Code | `/ralph-loop-glue Fix the flaky checkout test` |
| Codex | `$ralph-loop-glue Fix the flaky checkout test` |
| OpenCode 2 | `/ralph-loop-glue Fix the flaky checkout test` |
| Pi | `/skill:ralph-loop-glue Fix the flaky checkout test` |
| Gemini CLI | `/ralph-loop-glue Fix the flaky checkout test` |

The `ralph-loop-glue` name keeps the command distinct from Anthropic's `/ralph-loop`.

Use the same options as Anthropic's plugin. For example, in Claude Code or OpenCode:

```text
/ralph-loop-glue "Fix the flaky checkout test" --max-iterations 5 --completion-promise "CHECKOUT TEST PASSES"
```

- `--max-iterations <n>` limits the number of passes. Omit it or pass `0` for no Ralph-imposed cap. The harness may still enforce its own turn or hook limit.
- `--completion-promise "<phrase>"` requires an exact promise marker before the run is recorded as complete. The agent still needs to verify the requested criteria. Without a promise, a loop continues until its limit, cancellation, or a blocker.
- `--help` shows the options without starting a run.

Each run stores its prompt and pass count in `.ralph/<run-id>.json` in the session's working directory. Use the same skill invocation with `resume <run-id>` or `cancel <run-id>`. Use the harness's interrupt control to stop an active turn immediately. Keep the state file private and out of commits.

## Manual setup

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

Approve the hook in Codex if prompted. Both adapters require a Stop event with `last_assistant_message`. Remove the Stop entry to disable the adapter.

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

## Verification status

Run `bun test` or `node --test` to exercise the state transitions and adapter contracts. Skills CLI installation has been tested for Claude Code, Codex, OpenCode, Pi, and Gemini CLI. Automatic continuation still needs live verification in each harness, including native Codex inside Omnigent.
