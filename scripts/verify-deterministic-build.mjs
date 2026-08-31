import { createHash } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { buildRegistry } from '../src/build/registryBuilder.ts'
import { buildStaticSite } from '../src/build/siteBuilder.ts'

async function inventory(root, base = root) {
  const result = []
  for (const item of await readdir(root, { withFileTypes: true })) {
    const path = join(root, item.name)
    if (item.isDirectory()) result.push(...await inventory(path, base))
    else result.push(relative(base, path).replaceAll('\\', '/'))
  }
  return result.sort()
}
const left = await mkdtemp(join(tmpdir(), 'ldm-registry-a-'))
const right = await mkdtemp(join(tmpdir(), 'ldm-registry-b-'))
try {
  const options = { catalogRoot: resolve('catalog'), generatedAt: '2000-01-01T00:00:00.000Z', sourceCommit: 'deterministic-check' }
  await buildRegistry({ ...options, outputRoot: left }); await buildStaticSite({ outputRoot: left })
  await buildRegistry({ ...options, outputRoot: right }); await buildStaticSite({ outputRoot: right })
  const leftFiles = await inventory(left); const rightFiles = await inventory(right)
  if (JSON.stringify(leftFiles) !== JSON.stringify(rightFiles)) throw new Error('Build file trees differ.')
  for (const path of leftFiles) {
    const a = createHash('sha256').update(await readFile(join(left, path))).digest('hex')
    const b = createHash('sha256').update(await readFile(join(right, path))).digest('hex')
    if (a !== b) throw new Error(`Non-deterministic output: ${path}`)
  }
  console.log(`Deterministic build verified: ${leftFiles.length} files.`)
} finally {
  await rm(left, { recursive: true, force: true }); await rm(right, { recursive: true, force: true })
}
