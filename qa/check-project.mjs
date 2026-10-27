// Run: node qa/check-project.mjs (after pnpm install in the project root).
// Offline structural QA: catches links to missing pages, missing relative imports,
// and Vue template/script syntax errors without connecting to the team's database.
import fs from 'node:fs'
import path from 'node:path'
import { parse, compileTemplate, compileScript } from 'vue/compiler-sfc'

const sourceRoot = path.resolve('src')
const routeRoot = path.join(sourceRoot, 'router')
const issues = []
let components = 0
const routes = new Map()

for (const file of fs.readdirSync(routeRoot).filter(file => file.endsWith('.js'))) {
  const source = fs.readFileSync(path.join(routeRoot, file), 'utf8')
  // Locate route registrations, not guard redirects (which also contain `name`).
  const pattern = /\{\s*path:\s*['"]([^'"]+)['"]\s*,\s*name:\s*['"]([^'"]+)['"]/g
  for (const match of source.matchAll(pattern)) {
    if (routes.has(match[2])) issues.push(`Duplicate route ${match[2]} in ${file}`)
    routes.set(match[2], match[1])
  }
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) { walk(file); continue }
    if (!/\.(?:vue|js|mjs)$/.test(file)) continue
    const source = fs.readFileSync(file, 'utf8')
    for (const match of source.matchAll(/\bname:\s*['"]([a-z][a-z-]+)['"]/g)) {
      if (!routes.has(match[1])) issues.push(`Unknown route ${match[1]} in ${path.relative('.', file)}`)
    }
    for (const match of source.matchAll(/\bfrom\s+['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const full = path.resolve(path.dirname(file), match[1])
      if (![full, full + '.js', full + '.mjs', full + '.vue', full + '.css'].some(fs.existsSync)) {
        issues.push(`Missing import ${match[1]} in ${path.relative('.', file)}`)
      }
    }
    if (file.endsWith('.vue')) {
      components++
      try {
        const { descriptor, errors } = parse(source, { filename: file })
        for (const err of errors) issues.push(`${file}: ${err.message}`)
        if (descriptor.scriptSetup) compileScript(descriptor, { id: file })
        if (descriptor.template) {
          const output = compileTemplate({ filename: file, source: descriptor.template.content, id: file })
          for (const err of output.errors) issues.push(`${file}: ${err.message}`)
        }
      } catch (err) { issues.push(`${file}: ${err.message}`) }
    }
  }
}
walk(sourceRoot)
const mustHave = ['login', 'register', 'profile', 'style-feed', 'business-style-videos',
  'community-member', 'community-requests', 'community-request', 'discover', 'discover-product',
  'wardrobe', 'wardrobe-edit', 'outfit-match', 'business-products', 'business-promotions']
for (const name of mustHave) if (!routes.has(name)) issues.push(`Required route missing: ${name}`)
console.log(`QA: ${routes.size} named routes, ${components} Vue components checked.`)
if (issues.length) { issues.forEach(issue => console.error('FAIL:', issue)); process.exitCode = 1 }
else console.log('PASS: No broken named-route references, relative imports, or Vue compilation errors found.')
