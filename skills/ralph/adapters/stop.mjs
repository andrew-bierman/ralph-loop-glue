import { readFileSync } from 'node:fs'
import { nextPrompt } from './core.mjs'

try {
  const harness = process.argv[2]
  const input = JSON.parse(readFileSync(0, 'utf8'))
  if (['claude', 'codex'].includes(harness) && input.hook_event_name === 'Stop' && input.session_id) {
    const reason = nextPrompt({
      cwd: input.cwd,
      session: harness + ':' + input.session_id,
      message: input.last_assistant_message,
    })
    if (reason) console.log(JSON.stringify({ decision: 'block', reason }))
  }
} catch (error) {
  console.error('Ralph continuation skipped:', error.message)
}
