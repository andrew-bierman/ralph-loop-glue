import { nextPrompt, sessionContext } from '../core.mjs'

export default {
  id: 'ralph-loop-glue',
  async setup(ctx) {
    const admission = await ctx.session.hook('prompt', event => {
      const context = sessionContext(event.prompt.text, 'opencode:' + event.sessionID)
      if (context) event.prompt.text += '\n\n' + context
    })
    const controller = new AbortController()
    const events = ctx.event.subscribe({
      types: ['session.execution.succeeded'],
      signal: controller.signal,
    })
    void (async () => {
      for await (const event of events) {
        const sessionID = event.data.sessionID
        if (!sessionID) continue
        try {
          const messages = await ctx.session.context({ sessionID })
          const last = messages.at(-1)?.type === 'idle' ? messages.at(-2) : messages.at(-1)
          if (last?.type !== 'assistant' || last.finish !== 'stop') continue
          const message = last.content.filter(part => part.type === 'text').map(part => part.text).join('\n')
          const text = nextPrompt({ cwd: event.location?.directory ?? ctx.location.directory, session: 'opencode:' + sessionID, message })
          if (text) await ctx.session.prompt({ sessionID, text, delivery: 'queue' })
        } catch (error) {
          console.error('Ralph continuation skipped:', error.message)
        }
      }
    })().catch(error => {
      if (!controller.signal.aborted) console.error('Ralph event subscription stopped:', error.message)
    })
    return async () => {
      controller.abort()
      await admission.dispose()
    }
  },
}
