# Ralph Loop for Agent Skills

Start a Ralph loop from the coding session you're already in. When a pass ends, the harness can replay the original task in the same session. The work stays on disk, so you can pick it up from another harness if needed.

Inspired by [Anthropic's Ralph Loop plugin](https://github.com/anthropics/claude-plugins-official/tree/main/plugins/ralph-loop).

## Install the skill

From a checkout, use [Skills CLI](https://github.com/vercel-labs/skills). Add `--global` to install for your user instead of the current project.

```sh
npx skills add /absolute/path/to/ralph-skill --skill ralph-loop -a claude-code codex opencode pi
```

Skills CLI installs the skill into the selected harnesses and carries the adapter files with it. **Configure automatic continuation once per harness.** Skills CLI manages skill files and links. It does not register Stop hooks or load plugin and extension files.

## Run a loop

| Harness | What to type after setup |
| --- | --- |
| Claude Code | `/ralph-loop Fix the flaky checkout test` |
| Codex | `$ralph-loop Fix the flaky checkout test` |
| OpenCode 2 | `/ralph-loop Fix the flaky checkout test` |
| Pi | `/skill:ralph-loop Fix the flaky checkout test` |

If Claude Code already offers a Ralph Loop command from Anthropic's plugin, disable that plugin for the session where you want to test this skill. Check the command picker to confirm which entry you loaded.

Use the same options as Anthropic's plugin. For example, in Claude Code or OpenCode:

```text
/ralph-loop "Fix the flaky checkout test" --max-iterations 5 --completion-promise "CHECKOUT TEST PASSES"
```

- `--max-iterations <n>` limits the number of passes. This skill defaults to eight and requires a positive limit.
- `--completion-promise "<phrase>"` requires an exact promise marker before the run is recorded as complete. The agent still needs to verify the requested criteria.
- `--help` shows the options without starting a run.

Each run stores its prompt and pass count in `.ralph/<run-id>.json` in the session's working directory. Use the same skill invocation with `resume <run-id>` or `cancel <run-id>`. Use the harness's interrupt control to stop an active turn immediately. Keep the state file private and out of commits.

## Enable automatic continuation

Replace `SKILL_DIR` with the absolute path to the installed `ralph-loop` directory. Restart the harness after changing its configuration. To try the skill before configuring the adapter, include “inline mode” in the task. It will run subsequent passes within the same turn.

### Claude Code and Codex

Add the following item to the existing `hooks.Stop` array in Claude Code's `~/.claude/settings.json`. For Codex, use `~/.codex/hooks.json` and change the final argument from `claude` to `codex`. Use an absolute Node executable path if the harness can't resolve `node`.

```json
{
  "hooks": [
    {
      "type": "command",
      "command": "node \"SKILL_DIR/adapters/stop.mjs\" claude"
    }
  ]
}
```

Approve the hook in Codex if prompted. Both adapters require a Stop event with `last_assistant_message`. Remove the Stop entry to disable the adapter.

### OpenCode 2

Add `SKILL_DIR/adapters/opencode` to the `plugins` array in `opencode.jsonc`. Copy `SKILL_DIR/adapters/opencode-command.md` to `~/.config/opencode/commands/ralph-loop.md`. The command loads the skill, and the plugin queues the next pass after a successful turn.

### Pi

In `~/.pi/agent/extensions/ralph-loop.ts`:

```ts
export { default } from "SKILL_DIR/adapters/pi.mjs"
```

Use a Pi version with the `agent_settled` extension event.

## Verification status

Run `node --test` to exercise the state transitions and adapter contracts. Skills CLI installation has been tested for all four targets. Automatic continuation still needs live verification in each harness, including native Codex inside Omnigent.
