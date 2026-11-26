import { randomUUID } from 'node:crypto'
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const home = homedir()
const adapters = dirname(fileURLToPath(import.meta.url))
const paths = {
  claude: process.env.CLAUDE_CONFIG_DIR || join(home, '.claude'),
  codex: process.env.CODEX_HOME || join(home, '.codex'),
  opencode: process.env.OPENCODE_CONFIG_DIR || join(process.env.XDG_CONFIG_HOME || join(home, '.config'), 'opencode'),
  pi: process.env.PI_CODING_AGENT_DIR || join(home, '.pi', 'agent'),
  gemini: join(home, '.gemini'),
}
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const selected = args.filter(arg => arg !== '--dry-run')

function usage() {
  console.log('Usage: bun setup.mjs [--dry-run] [claude codex opencode pi gemini]')
  console.log('With no harness names, configure harnesses with an existing user config directory.')
}

function write(path, content, before) {
  if (content === before) return console.log('current ' + path)
  console.log((dryRun ? 'would configure ' : 'configure ') + path)
  if (dryRun) return
  mkdirSync(dirname(path), { recursive: true })
  const stage = path + '.' + randomUUID()
  try {
    writeFileSync(stage, content, { flag: 'wx', mode: before === undefined ? 0o600 : lstatSync(path).mode & 0o777 })
    if (before !== undefined) copyFileSync(path, path + '.before-ralph-loop-glue-' + randomUUID())
    renameSync(stage, path)
  } finally {
    rmSync(stage, { force: true })
  }
}

function read(path) {
  const info = lstatSync(path, { throwIfNoEntry: false })
  if (!info) return undefined
  if (!info.isFile()) throw Error('Expected a regular file at ' + path)
  return readFileSync(path, 'utf8')
}

function installFile(path, content) {
  const before = read(path)
  if (before !== undefined && before !== content) throw Error('Already exists with different content: ' + path)
  write(path, content, before)
}

function addStop(harness, filename, event) {
  const path = join(paths[harness], filename)
  const before = read(path)
  const config = before === undefined ? {} : JSON.parse(before)
  const stops = (config.hooks ??= {})[event] ??= []
  const script = join(adapters, 'stop.mjs')
  const sameHook = stops.some(group => group.hooks?.some(hook =>
    typeof hook.command === 'string' && hook.command.includes(script) && hook.command.trimEnd().endsWith(' ' + harness),
  ))
  if (sameHook) return console.log('current ' + path)
  const command = [process.execPath, script].map(path => JSON.stringify(path)).join(' ') + ' ' + harness
  stops.push({ hooks: [{ type: 'command', command }] })
  write(path, JSON.stringify(config, null, 2) + '\n', before)
}

function configure(harness) {
  const root = paths[harness]
  switch (harness) {
    case 'claude': return addStop(harness, 'settings.json', 'Stop')
    case 'codex': return addStop(harness, 'hooks.json', 'Stop')
    case 'gemini':
      installFile(join(root, 'commands', 'ralph-loop-glue.toml'), readFileSync(join(adapters, 'gemini-command.toml'), 'utf8'))
      return addStop(harness, 'settings.json', 'AfterAgent')
    case 'pi':
      return installFile(join(root, 'extensions', 'ralph-loop-glue.ts'), 'export { default } from ' + JSON.stringify(join(adapters, 'pi.mjs')) + '\n')
    case 'opencode': {
      const plugin = join(adapters, 'opencode')
      installFile(join(root, 'commands', 'ralph-loop-glue.md'), readFileSync(join(adapters, 'opencode-command.md'), 'utf8'))
      const configured = ['opencode.json', 'opencode.jsonc'].some(name => {
        const config = read(join(root, name))
        return config && Bun.JSONC.parse(config).plugins?.includes(plugin)
      })
      if (!configured) {
        installFile(join(root, 'plugins', 'ralph-loop-glue.js'), 'export { default } from ' + JSON.stringify(pathToFileURL(join(plugin, 'index.js')).href) + '\n')
      }
    }
  }
}

if (selected.includes('--help') || selected.includes('-h')) {
  usage()
} else if (selected.some(name => !Object.hasOwn(paths, name))) {
  usage()
  process.exitCode = 1
} else {
  const targets = selected.length ? [...new Set(selected)] : Object.keys(paths).filter(name => existsSync(paths[name]))
  if (!targets.length) usage()
  for (const harness of targets) {
    try {
      configure(harness)
    } catch (error) {
      console.error(harness + ': ' + error.message)
      process.exitCode = 1
    }
  }
}
