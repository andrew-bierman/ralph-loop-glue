# Ralph skill

Start a bounded Ralph loop inside your coding agent. The same skill and state file work across harnesses. Each continuation adapter replays the saved prompt when a pass ends with a retry marker. Your edits and checks stay in the workspace.

## Install

From a checkout, install the skill using the Skills CLI.

```sh
npx skills add /absolute/path/to/ralph-skill --skill ralph -a claude-code codex opencode pi
```

For global installation, add `--global`. Once the repo is published, its Git URL can replace the local checkout path.

| Harness | Start a task |
| --- | --- |
| Claude Code | `/ralph Fix the flaky checkout test` |
| Codex | `$ralph Fix the flaky checkout test` |
| OpenCode | `/ralph Fix the flaky checkout test` |
| Pi | `/skill:ralph Fix the flaky checkout test` |

The same entry points accept `resume <run-id>` and `cancel <run-id>`. To stop a running turn immediately, use the harness's interrupt control.

## Enable automatic continuation

Use the absolute path to the installed skill folder wherever you see `SKILL_DIR` below. Restart the harness after configuring its adapter. If you skip adapter setup, request inline mode in the same skill invocation. You can resume from disk in either mode.

### Claude Code and Codex

Add this entry to the existing `hooks.Stop` array in Claude Code's `~/.claude/settings.json` or Codex's `~/.codex/hooks.json`. Replace `claude` with `codex` in the Codex command. Use an absolute Node executable path if the harness cannot find `node`.

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

Approve the hook in Codex if prompted. Both adapters require a Stop event with `last_assistant_message`.

### OpenCode 2

Add the absolute path `SKILL_DIR/adapters/opencode` to the `plugins` array in `opencode.jsonc`. Copy `adapters/opencode-command.md` to `~/.config/opencode/commands/ralph.md` for the slash command. The plugin listens for successful session execution and queues the next pass in that session.

### Pi

Create `~/.pi/agent/extensions/ralph.ts` with the following line.

```ts
export { default } from "SKILL_DIR/adapters/pi.mjs"
```

Use a Pi version with the `agent_settled` extension event.

## Development

Run `node --test` for the state and adapter fixtures. The adapters are experimental until exercised in live sessions on all four harnesses.
