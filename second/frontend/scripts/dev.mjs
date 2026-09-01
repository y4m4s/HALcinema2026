import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const frontendDir = fileURLToPath(new URL('../', import.meta.url))
const backendDir = fileURLToPath(new URL('../../backend/', import.meta.url))
const viteEntry = fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))
const isWindows = process.platform === 'win32'
const children = new Set()
let shuttingDown = false

function start(name, command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
    detached: !isWindows,
  })

  children.add(child)
  child.once('error', (error) => {
    console.error(`[dev] ${name} を起動できませんでした: ${error.message}`)
    void shutdown(1)
  })
  child.once('exit', (code, signal) => {
    children.delete(child)
    if (shuttingDown) return
    const reason = signal ? `signal ${signal}` : `exit code ${code ?? 1}`
    console.error(`[dev] ${name} が停止しました (${reason})`)
    void shutdown(code ?? 1)
  })

  return child
}

function stop(child) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve()
  }

  if (isWindows) {
    return new Promise((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
        stdio: 'ignore',
        windowsHide: true,
      })
      killer.once('error', resolve)
      killer.once('exit', resolve)
    })
  }

  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch {
    // The process may already have exited.
  }
  return Promise.resolve()
}

async function shutdown(exitCode) {
  if (shuttingDown) return
  shuttingDown = true
  await Promise.all([...children].map(stop))
  process.exit(exitCode)
}

process.once('SIGINT', () => void shutdown(0))
process.once('SIGTERM', () => void shutdown(0))

console.log('[dev] バックエンド: http://localhost:8080')
start('バックエンド', 'go', ['run', './cmd/server'], backendDir)

console.log('[dev] フロントエンド: http://localhost:5173')
start('フロントエンド', process.execPath, [viteEntry], frontendDir)
