import { nextPrompt } from './core.mjs'

export default function ralph(pi) {
  pi.on('agent_settled', (event, ctx) => {
    const last = event.messages?.at(-1) ?? ctx.sessionManager.getBranch().at(-1)?.message
    if (last?.role !== 'assistant' || ['aborted', 'error'].includes(last.stopReason)) return
    const message = last.content.filter(part => part.type === 'text').map(part => part.text).join('\n')
    const prompt = nextPrompt({ cwd: ctx.cwd, session: 'pi:' + ctx.sessionManager.getSessionId(), message })
    if (prompt) pi.sendUserMessage(prompt)
  })
}
