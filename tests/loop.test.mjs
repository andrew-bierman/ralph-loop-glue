import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { nextPrompt } from '../skills/ralph/adapters/core.mjs'
import piAdapter from '../skills/ralph/adapters/pi.mjs'
import opencodeAdapter from '../skills/ralph/adapters/opencode/index.js'

const id = '1234567890abcdef1234567890abcdef'
const mark = (iteration, result = 'retry') => `[ralph:${id}:${iteration}:${result}]`

function fixture(t, overrides = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'ralph-test-'))
  t.after(() => rmSync(cwd, { force: true, recursive: true }))
  mkdirSync(join(cwd, '.ralph'))
  const file = join(cwd, '.ralph', id + '.json')
  writeFileSync(file, JSON.stringify({ prompt: 'Fix the test.', iteration: 1, limit: 2, status: 'active', ...overrides }))
  return { cwd, state: () => JSON.parse(readFileSync(file, 'utf8')) }
}

test('replays the original prompt, binds a session, rejects replay, and enforces the limit', (t) => {
  const { cwd, state } = fixture(t)
  const pass = (message, session = 'claude:one') => nextPrompt({ cwd, session, message })
  assert.match(pass(mark(1)), /pass 2 of 2[\s\S]+Fix the test\.$/)
  assert.equal(state().owner, 'claude:one')
  assert.equal(pass(mark(1)), undefined)
  assert.equal(pass(mark(2), 'codex:two'), undefined)
  assert.equal(pass(mark(2)), undefined)
  assert.equal(state().status, 'exhausted')
})

test('leaves unrelated and cancelled turns alone', (t) => {
  const { cwd, state } = fixture(t, { status: 'cancelled' })
  for (const message of ['ordinary answer', mark(1), `${mark(1)}\nquoted example`]) {
    assert.equal(nextPrompt({ cwd, session: 'pi:one', message }), undefined)
  }
  assert.equal(state().status, 'cancelled')
})

test('Claude and Codex Stop adapters replay and honor a completion marker', (t) => {
  for (const harness of ['claude', 'codex']) {
    const { cwd, state } = fixture(t)
    const stop = (message) => spawnSync(process.execPath, [
      fileURLToPath(new URL('../skills/ralph/adapters/stop.mjs', import.meta.url)), harness,
    ], {
      input: JSON.stringify({ cwd, session_id: 'one', hook_event_name: 'Stop', last_assistant_message: message }),
      encoding: 'utf8',
    })
    const replay = stop(mark(1))
    assert.equal(replay.status, 0)
    assert.equal(JSON.parse(replay.stdout).decision, 'block')
    assert.equal(stop(mark(2, 'done')).stdout, '')
    assert.equal(state().status, 'done')
  }
})

test('Pi queues a continuation through the extension interface', (t) => {
  const { cwd, state } = fixture(t)
  let handler
  const messages = []
  piAdapter({ on(event, callback) { assert.equal(event, 'agent_settled'); handler = callback }, sendUserMessage(text) { messages.push(text) } })
  handler({ messages: [{ role: 'assistant', content: [{ type: 'text', text: mark(1) }] }] }, {
    cwd, sessionManager: { getSessionId: () => 'one' },
  })
  assert.match(messages[0], /Fix the test/)
  assert.equal(state().owner, 'pi:one')
})

test('OpenCode queues a continuation in the same session', async (t) => {
  const { cwd, state } = fixture(t)
  let deliver
  const queued = new Promise(resolve => { deliver = resolve })
  const stop = opencodeAdapter.setup({
    location: { directory: cwd },
    event: { async *subscribe() { yield { data: { sessionID: 'one' } } } },
    session: {
      async context() { return [{ type: 'assistant', finish: 'stop', content: [{ type: 'text', text: mark(1) }] }, { type: 'idle' }] },
      async prompt(input) { deliver(input) },
    },
  })
  t.after(stop)
  const input = await queued
  assert.equal(input.sessionID, 'one')
  assert.match(input.text, /Fix the test/)
  assert.equal(state().owner, 'opencode:one')
})
