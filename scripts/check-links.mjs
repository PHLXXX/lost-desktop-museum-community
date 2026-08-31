import { access, readFile, readdir } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

const root = resolve(process.env.OUTPUT_ROOT ?? 'dist')
async function htmlFiles(directory) {
  const files = []
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, item.name)
    if (item.isDirectory()) files.push(...await htmlFiles(path)); else if (item.name.endsWith('.html')) files.push(path)
  }
  return files
}
for (const file of await htmlFiles(root)) {
  const html = await readFile(file, 'utf8')
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const target = match[1]
    if (/^https:\/\//.test(target) || target.startsWith('#')) continue
    if (/^[a-z]+:/i.test(target)) throw new Error(`Disallowed protocol in ${file}: ${target}`)
    await access(resolve(dirname(file), target.split('#')[0]))
  }
}
console.log('Static links valid.')
