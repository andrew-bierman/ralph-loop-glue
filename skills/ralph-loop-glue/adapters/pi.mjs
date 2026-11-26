import { nextPrompt, sessionContext } from './core.mjs'

export default function ralph(pi) {
  pi.on('before_agent_start', (event, ctx) => {
    const content = sessionContext(event.prompt, 'pi:' + ctx.sessionManager.getSessionId())
    if (content) return { message: { customType: 'ralph-loop-glue', content, display: false } }
  })
  pi.on('agent_settled', (event, ctx) => {
    if (event.aborted) return
    const last = event.messages?.at(-1) ?? ctx.sessionManager.getBranch().at(-1)?.message
    if (last?.role !== 'assistant' || ['aborted', 'error'].includes(last.stopReason)) return
    const message = last.content.filter(part => part.type === 'text').map(part => part.text).join('\n')
    const prompt = nextPrompt({ cwd: ctx.cwd, session: 'pi:' + ctx.sessionManager.getSessionId(), message })
    if (prompt) pi.sendUserMessage(prompt)
  })
}
