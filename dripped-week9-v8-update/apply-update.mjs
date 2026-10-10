// Apply the Week 9 community and demo-checkout changes to the exact uploaded-main baseline.
// Run this with Node from your existing project folder. No packages are installed.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const bundle = path.dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const checkOnly = args.includes('--check')
const project = path.resolve(args.find(arg => arg !== '--check') || process.cwd())
const manifest = JSON.parse(fs.readFileSync(path.join(bundle, 'manifest.json'), 'utf8'))
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
const fail = message => { console.error(message); process.exit(1) }

if (!fs.existsSync(path.join(project, 'src/App.vue')) || !fs.existsSync(path.join(project, 'server/server.js'))) {
  fail('Run this from your existing wardrobe-website-wad2 project folder, or provide that folder as the final argument.')
}
const changes = [], conflicts = []
for (const item of manifest.files) {
  if (path.isAbsolute(item.path) || item.path.split('/').includes('..')) fail('The update contains an invalid file path.')
  const source = path.join(bundle, 'project', item.path), target = path.join(project, item.path)
  if (!fs.existsSync(source) || digest(source) !== item.after) fail(`The update file is missing or damaged: ${item.path}`)
  const current = fs.existsSync(target) ? digest(target) : null
  if (current === item.after) continue
  if (current !== item.before) conflicts.push(item.path)
  else changes.push(item)
}
if (conflicts.length) fail(`No files changed. These files differ from the main-branch ZIP used for this update:\n${conflicts.map(file => `  ${file}`).join('\n')}\nKeep those changes. Merge the matching files from the update's project folder manually, or have this update adapted to your newer main branch.`)
if (!changes.length) { console.log('This update is already applied.'); process.exit(0) }
console.log(`Project: ${project}\nFiles to update: ${changes.length}`)
if (checkOnly) { console.log('Compatibility check passed. No files changed.'); process.exit(0) }

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '').replace('T', '-')
const backup = `${project}-before-week9-update-${stamp}`
fs.mkdirSync(backup, { recursive: false })
for (const item of changes) {
  const target = path.join(project, item.path)
  if (fs.existsSync(target)) {
    const saved = path.join(backup, item.path)
    fs.mkdirSync(path.dirname(saved), { recursive: true }); fs.copyFileSync(target, saved)
  }
}
fs.writeFileSync(path.join(backup, 'RESTORE.json'), JSON.stringify({ project, files: changes.map(item => ({ path: item.path, existedBefore: item.before !== null })) }, null, 2))
let branch = null
try { branch = execFileSync('git', ['-C', project, 'branch', '--show-current'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() }
catch { console.log('No Git branch detected. Applying to these local project files only.') }
if (branch === 'main' || branch === 'master') {
  const nextBranch = `javier/week9-demo-${stamp}`
  try { execFileSync('git', ['-C', project, 'switch', '-c', nextBranch], { stdio: 'inherit' }) }
  catch { fail(`Could not create a working branch. No source files changed. Backup: ${backup}`) }
  console.log(`Working branch: ${nextBranch}`)
}
for (const item of changes) {
  const target = path.join(project, item.path)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.copyFileSync(path.join(bundle, 'project', item.path), target)
}
console.log(`Update applied. Backup: ${backup}\nYour .env files and package files were not replaced. Your existing profile, preferences, admin and report features are retained.\nNothing was committed or pushed. Restart your frontend and backend, then follow START-HERE.md.`)
