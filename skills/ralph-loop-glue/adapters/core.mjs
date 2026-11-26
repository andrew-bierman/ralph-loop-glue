import { lstatSync, mkdirSync, readFileSync, renameSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { isAbsolute, join } from 'node:path'

const marker = /^\[ralph:([a-f0-9]{32}):([1-9]\d*):(retry|done|blocked)\]$/

export function nextPrompt({ cwd, session, message }) {
  if (typeof cwd !== 'string' || !isAbsolute(cwd) || !session || typeof message !== 'string') return
  const lines = message.trimEnd().split(/\r?\n/)
  const match = marker.exec(lines.at(-1))
  if (!match) return

  const [, id, iteration, result] = match
  const directory = join(cwd, '.ralph')
  const file = join(directory, id + '.json')
  const lock = file + '.lock'
  if (!lstatSync(directory, { throwIfNoEntry: false })?.isDirectory()) return
  try {
    mkdirSync(lock)
  } catch (error) {
    if (error.code === 'EEXIST') return
    throw error
  }

  try {
    if (!lstatSync(file, { throwIfNoEntry: false })?.isFile()) return
    const state = JSON.parse(readFileSync(file, 'utf8'))
    if (state?.status !== 'active' || (state.owner && state.owner !== session)) return
    if (!Number.isSafeInteger(state.iteration) || state.iteration !== Number(iteration)) return
    if (!Number.isSafeInteger(state.limit) || state.limit < 0) return
    if (state.limit !== 0 && state.limit < state.iteration) return
    if (typeof state.prompt !== 'string' || !state.prompt.trim()) return

    const promise = state.completionPromise
    if (promise !== undefined && (typeof promise !== 'string' || !promise.trim() || /[<>\r\n]/.test(promise))) return
    const completionAccepted = result === 'done' && promise && lines.at(-2) === `<promise>${promise}</promise>`

    state.owner = session
    if (completionAccepted) state.status = 'done'
    else if (result === 'blocked') state.status = 'blocked'
    else if (state.iteration === state.limit || state.iteration === Number.MAX_SAFE_INTEGER) state.status = 'exhausted'
    else state.iteration += 1

    const stage = file + '.' + randomUUID()
    try {
      writeFileSync(stage, JSON.stringify(state, null, 2) + '\n', { mode: 0o600, flag: 'wx' })
      renameSync(stage, file)
    } finally {
      if (lstatSync(stage, { throwIfNoEntry: false })) unlinkSync(stage)
    }

    if (state.status === 'active') {
      const reminder = promise ? `\nWhen verified, put <promise>${promise}</promise> on the line before the done marker.` : ''
      return `Ralph pass ${state.iteration} ${state.limit ? `of ${state.limit}` : '(unlimited)'}. Resume run ${id} from .ralph/${id}.json. Follow the Ralph skill and verify the original acceptance criteria.${reminder}\n\n${state.prompt}`
    }
  } finally {
    rmdirSync(lock)
  }
}
