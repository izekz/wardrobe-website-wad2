// Starts an empty MongoDB only for these E2E tests, so they never touch the team's real data.
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const folder = join(tmpdir(), 'wardrobe-business-e2e-db')
rmSync(folder, { recursive: true, force: true })
mkdirSync(folder, { recursive: true })
const database = spawn('mongod', ['--dbpath', folder, '--port', '27099', '--bind_ip', '127.0.0.1', '--quiet'], { stdio: 'ignore' })
database.on('error', () => { console.error('MongoDB (mongod) was not found. Install it, then run the tests again.'); process.exit(1) })
database.on('exit', code => process.exit(code ?? 0))
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => database.kill())
