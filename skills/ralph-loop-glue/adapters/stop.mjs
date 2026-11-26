import { readFileSync } from 'node:fs'
import { nextPrompt, sessionContext } from './core.mjs'

try {
  const harness = process.argv[2]
  const input = JSON.parse(readFileSync(0, 'utf8'))
  const gemini = harness === 'gemini'
  const event = gemini ? 'AfterAgent' : 'Stop'
  const promptEvent = gemini ? 'BeforeAgent' : 'UserPromptSubmit'
  if (['claude', 'codex', 'gemini'].includes(harness) && input.session_id) {
    if (input.hook_event_name === promptEvent) {
      const additionalContext = sessionContext(input.prompt, harness + ':' + input.session_id)
      if (additionalContext) console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: promptEvent, additionalContext } }))
    } else if (input.hook_event_name === event) {
      const reason = nextPrompt({
        cwd: input.cwd,
        session: harness + ':' + input.session_id,
        message: (gemini ? input.prompt_response : input.last_assistant_message) ?? '',
        continuing: input.stop_hook_active === true,
      })
      if (reason) console.log(JSON.stringify({ decision: gemini ? 'deny' : 'block', reason }))
    }
  }
} catch (error) {
  console.error('Ralph continuation skipped:', error.message)
}
