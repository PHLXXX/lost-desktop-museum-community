import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { buildRegistry } from '../src/build/registryBuilder'
import { buildStaticSite } from '../src/build/siteBuilder'

const temporary: string[] = []
async function files(root: string, base = root): Promise<string[]> {
  const result: string[] = []
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) result.push(...await files(path, base))
    else result.push(relative(base, path).replaceAll('\\', '/'))
  }
  return result.sort()
}
afterEach(async () => { for (const path of temporary.splice(0)) await rm(path, { recursive: true, force: true }) })

describe('deterministic registry and static site', () => {
  it('produces byte-identical output for identical metadata', async () => {
    const left = await mkdtemp(join(tmpdir(), 'ldm-left-')); const right = await mkdtemp(join(tmpdir(), 'ldm-right-')); temporary.push(left, right)
    const options = { catalogRoot: resolve('catalog'), generatedAt: '2026-08-31T00:00:00.000Z', sourceCommit: 'test-commit' }
    await buildRegistry({ ...options, outputRoot: left }); await buildStaticSite({ outputRoot: left })
    await buildRegistry({ ...options, outputRoot: right }); await buildStaticSite({ outputRoot: right })
    expect(await files(left)).toEqual(await files(right))
    for (const path of await files(left)) expect(await readFile(join(left, path))).toEqual(await readFile(join(right, path)))
  })

  it('emits registry, publisher, case, package and script-free HTML paths', async () => {
    const outputRoot = await mkdtemp(join(tmpdir(), 'ldm-build-')); temporary.push(outputRoot)
    await buildRegistry({ catalogRoot: resolve('catalog'), outputRoot, generatedAt: '2026-08-31T00:00:00.000Z', sourceCommit: 'test-commit' })
    await buildStaticSite({ outputRoot })
    const paths = await files(outputRoot)
    expect(paths).toEqual(expect.arrayContaining(['index.html', 'registry/v1/index.json', 'registry/v1/cases/case-community-sample-001.json', 'registry/v1/publishers/ldm-team.json', 'packages/case-community-sample-001/1.0.0/case-community-sample-001-1.0.0.ldmcase']))
    const home = await readFile(join(outputRoot, 'index.html'), 'utf8')
    expect(home).not.toMatch(/<script|google-analytics|googletagmanager|plausible\.io/i)
    expect(home).toContain('无Cookie')
  })
})
