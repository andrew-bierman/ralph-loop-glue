import { lstatSync, mkdirSync, readFileSync, renameSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { isAbsolute, join } from 'node:path'

const marker = /^\[ralph:([a-f0-9]{32}):([1-9]\d*):(retry|done|blocked)\]$/

export function nextPrompt({ cwd, session, message }) {
  if (typeof cwd !== 'string' || !isAbsolute(cwd) || !session || typeof message !== 'string') return
  const match = marker.exec(message.trimEnd().split('\n').at(-1))
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
    if (!Number.isSafeInteger(state.limit) || state.limit < state.iteration) return
    if (typeof state.prompt !== 'string' || !state.prompt.trim()) return

    state.owner = session
    if (result !== 'retry') state.status = result
    else if (state.iteration === state.limit) state.status = 'exhausted'
    else state.iteration += 1

    const stage = file + '.' + randomUUID()
    try {
      writeFileSync(stage, JSON.stringify(state, null, 2) + '\n', { mode: 0o600, flag: 'wx' })
      renameSync(stage, file)
    } finally {
      if (lstatSync(stage, { throwIfNoEntry: false })) unlinkSync(stage)
    }

    if (state.status === 'active') {
      return `Ralph pass ${state.iteration} of ${state.limit}. Resume run ${id} from .ralph/${id}.json. Follow the Ralph skill and verify the original acceptance criteria.\n\n${state.prompt}`
    }
  } finally {
    rmdirSync(lock)
  }
}
