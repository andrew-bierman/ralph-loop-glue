import { lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { isAbsolute, join } from 'node:path'

const marker = /^\[ralph:([a-f0-9]{32}):([1-9]\d*):(retry|done|blocked)\]$/

function findActiveRun(directory, session) {
  const matches = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !/^[a-f0-9]{32}\.json$/.test(entry.name)) continue
    try {
      const state = JSON.parse(readFileSync(join(directory, entry.name), 'utf8'))
      if (state?.status === 'active' && state.owner === session) matches.push(entry.name.slice(0, -5))
    } catch (error) {
      if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error
    }
  }
  return matches.length === 1 ? matches[0] : undefined
}

export function nextPrompt({ cwd, session, message, continuing = false }) {
  if (typeof cwd !== 'string' || !isAbsolute(cwd) || !session || typeof message !== 'string') return
  const lines = message.trimEnd().split(/\r?\n/)
  const match = marker.exec(lines.at(-1))
  if (!match && !continuing) return

  const directory = join(cwd, '.ralph')
  if (!lstatSync(directory, { throwIfNoEntry: false })?.isDirectory()) return
  const id = match?.[1] ?? findActiveRun(directory, session)
  if (!id) return
  const file = join(directory, id + '.json')
  const lock = file + '.lock'
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
    if (!Number.isSafeInteger(state.iteration) || state.iteration < 1) return
    if (match ? state.iteration !== Number(match[2]) : state.owner !== session) return
    if (!Number.isSafeInteger(state.limit) || state.limit < 0) return
    if (state.limit !== 0 && state.limit < state.iteration) return
    if (typeof state.prompt !== 'string' || !state.prompt.trim()) return

    const promise = state.completionPromise
    if (promise !== undefined && (typeof promise !== 'string' || !promise.trim() || /[<>\r\n]/.test(promise))) return
    const reportedPromise = /<promise>([\s\S]*?)<\/promise>/.exec(message)?.[1].trim().replace(/\s+/g, ' ')
    const completionAccepted = promise && reportedPromise === promise
    const result = match?.[3]

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
      const reminder = promise ? `\nWhen verified, put <promise>${promise}</promise> and end with the done marker.` : ''
      return `Ralph pass ${state.iteration} ${state.limit ? `of ${state.limit}` : '(unlimited)'}. Resume run ${id} from .ralph/${id}.json. Follow the Ralph skill and verify the original acceptance criteria.${reminder}\n\n${state.prompt}`
    }
  } finally {
    rmdirSync(lock)
  }
}
