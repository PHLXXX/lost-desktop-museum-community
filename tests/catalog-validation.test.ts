import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { validateCatalog } from '../src/validation/catalogValidator'

const temporary: string[] = []
async function catalogCopy() {
  const root = await mkdtemp(join(tmpdir(), 'ldm-community-'))
  temporary.push(root)
  await cp(resolve('catalog'), join(root, 'catalog'), { recursive: true })
  return join(root, 'catalog')
}
afterEach(async () => { for (const path of temporary.splice(0)) await rm(path, { recursive: true, force: true }) })

describe('catalog validation', () => {
  it('accepts the complete sample catalog', async () => {
    const result = await validateCatalog(resolve('catalog'))
    expect(result.issues).toEqual([])
    expect(result.entries.map((record) => record.entry.version)).toEqual(['1.0.0', '1.0.1'])
  })

  it('reports a precise field path and fix hint for invalid entries', async () => {
    const catalog = await catalogCopy()
    const path = join(catalog, 'cases/case-community-sample-001/1.0.0/entry.json')
    const entry = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>
    entry.distributionConsent = false
    await writeFile(path, JSON.stringify(entry))
    const result = await validateCatalog(catalog)
    expect(result.issues[0]).toMatchObject({ caseId: 'case-community-sample-001', version: '1.0.0' })
    expect(result.issues[0]?.fieldPath).toContain('distributionConsent')
    expect(result.issues[0]?.fixHint).toBeTruthy()
  })

  it('rejects missing package, changelog and screenshots', async () => {
    const catalog = await catalogCopy()
    await rm(join(catalog, 'cases/case-community-sample-001/1.0.0/case-community-sample-001-1.0.0.ldmcase'))
    await rm(join(catalog, 'cases/case-community-sample-001/1.0.0/CHANGELOG.md'))
    await rm(join(catalog, 'cases/case-community-sample-001/1.0.0/screenshots'), { recursive: true })
    const result = await validateCatalog(catalog)
    expect(result.issues.map((issue) => issue.code)).toEqual(expect.arrayContaining(['PACKAGE_MISSING', 'CHANGELOG_MISSING', 'SCREENSHOT_MISSING']))
  })

  it('rejects files in a version directory that are not registered by entry.json', async () => {
    const catalog = await catalogCopy()
    await writeFile(join(catalog, 'cases/case-community-sample-001/1.0.0/undeclared.bin'), 'not catalog data')
    const result = await validateCatalog(catalog)
    expect(result.issues).toContainEqual(expect.objectContaining({ code: 'UNREGISTERED_FILE', file: 'undeclared.bin' }))
  })
})
