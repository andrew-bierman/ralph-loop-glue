import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { nextPrompt } from '../skills/ralph-loop-glue/adapters/core.mjs'
import piAdapter from '../skills/ralph-loop-glue/adapters/pi.mjs'
import opencodeAdapter from '../skills/ralph-loop-glue/adapters/opencode/index.js'

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

test('Claude, Codex, and Gemini hooks replay and honor a completion promise', (t) => {
  for (const harness of ['claude', 'codex', 'gemini']) {
    const { cwd, state } = fixture(t, { completionPromise: 'FIXED' })
    const gemini = harness === 'gemini'
    const stop = (message) => spawnSync(process.execPath, [
      fileURLToPath(new URL('../skills/ralph-loop-glue/adapters/stop.mjs', import.meta.url)), harness,
    ], {
      input: JSON.stringify({
        cwd,
        session_id: 'one',
        ...(gemini ? { hook_event_name: 'AfterAgent', prompt_response: message } : { hook_event_name: 'Stop', last_assistant_message: message }),
      }),
      encoding: 'utf8',
    })
    const replay = stop(mark(1))
    assert.equal(replay.status, 0)
    assert.equal(JSON.parse(replay.stdout).decision, gemini ? 'deny' : 'block')
    assert.equal(stop(`<promise>FIXED</promise>\n${mark(2, 'done')}`).stdout, '')
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

test('an exact optional completion promise is required to finish', (t) => {
  const { cwd, state } = fixture(t, { completionPromise: 'TESTS PASS' })
  const pass = message => nextPrompt({ cwd, session: 'codex:one', message })
  assert.match(pass(`<promise>tests pass</promise>\n${mark(1, 'done')}`), /<promise>TESTS PASS<\/promise>/)
  assert.equal(state().iteration, 2)
  assert.equal(pass(`<promise>TESTS PASS</promise>\n${mark(2, 'done')}`), undefined)
  assert.equal(state().status, 'done')
})

test('zero keeps replaying and a done marker without a promise does not stop the loop', (t) => {
  const { cwd, state } = fixture(t, { limit: 0 })
  const pass = message => nextPrompt({ cwd, session: 'codex:one', message })
  assert.match(pass(mark(1)), /pass 2 \(unlimited\)/)
  assert.match(pass(mark(2, 'done')), /pass 3 \(unlimited\)/)
  assert.equal(state().status, 'active')
  assert.equal(pass(mark(3, 'blocked')), undefined)
  assert.equal(state().status, 'blocked')
})

test('an active Stop continuation can recover a missing pass marker', (t) => {
  const { cwd, state } = fixture(t, { limit: 0, completionPromise: 'CHECKS PASS' })
  const pass = (message, overrides = {}) => nextPrompt({ cwd, session: 'claude:one', message, ...overrides })
  assert.equal(pass('No marker yet.', { continuing: true }), undefined)
  assert.match(pass(mark(1)), /pass 2/)
  assert.equal(pass('Someone else replied.', { continuing: true, session: 'claude:two' }), undefined)
  assert.equal(pass('An unrelated turn.'), undefined)
  assert.match(pass('One check still fails.', { continuing: true }), /pass 3/)
  assert.equal(pass('<promise> CHECKS\nPASS </promise>', { continuing: true }), undefined)
  assert.equal(state().status, 'done')
})
