import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { validateCasePackageBytes } from '../src/validation/packageValidator'

const entry = { caseId: 'case-community-sample-001', version: '1.0.0', publisherId: 'ldm-team' }

describe('community case package validation', () => {
  it('accepts the committed sample package and returns technical metadata', async () => {
    const bytes = new Uint8Array(await readFile(resolve('catalog/cases/case-community-sample-001/1.0.0/case-community-sample-001-1.0.0.ldmcase')))
    const result = await validateCasePackageBytes(bytes, entry)
    expect(result.caseId).toBe(entry.caseId)
    expect(result.clueCount).toBeGreaterThanOrEqual(6)
    expect(result.questionPoints).toBe(100)
  })

  it.each(['evil.js', 'image.svg', 'module.wasm', 'run.sh', 'page.html'])('rejects blocked package entry %s', async (path) => {
    const bytes = zipSync({ [path]: strToU8('blocked') })
    await expect(validateCasePackageBytes(bytes, entry)).rejects.toThrow(/不允许|安全|缺少/)
  })

  it('rejects traversal and absolute paths before extraction', async () => {
    await expect(validateCasePackageBytes(zipSync({ '../case.json': strToU8('{}') }), entry)).rejects.toThrow(/路径/)
    await expect(validateCasePackageBytes(zipSync({ '/case.json': strToU8('{}') }), entry)).rejects.toThrow(/路径/)
  })

  it('rejects incomplete checksum coverage and unregistered assets', async () => {
    const original = new Uint8Array(await readFile(resolve('catalog/cases/case-community-sample-001/1.0.0/case-community-sample-001-1.0.0.ldmcase')))
    const missingChecksum = unzipSync(original); const checksums = JSON.parse(strFromU8(missingChecksum['checksums.json']!)) as Record<string, string>; delete checksums['case.json']; missingChecksum['checksums.json'] = strToU8(JSON.stringify(checksums))
    await expect(validateCasePackageBytes(zipSync(missingChecksum), entry)).rejects.toThrow(/checksums清单/)
    const extraAsset = unzipSync(original); const bytes = strToU8('undeclared'); extraAsset['assets/extra.txt'] = bytes; const complete = JSON.parse(strFromU8(extraAsset['checksums.json']!)) as Record<string, string>; complete['assets/extra.txt'] = createHash('sha256').update(bytes).digest('hex'); extraAsset['checksums.json'] = strToU8(JSON.stringify(complete))
    await expect(validateCasePackageBytes(zipSync(extraAsset), entry)).rejects.toThrow(/未登记资源/)
  })

  it('rejects application records that point to an unknown clue', async () => {
    const original = new Uint8Array(await readFile(resolve('catalog/cases/case-community-sample-001/1.0.0/case-community-sample-001-1.0.0.ldmcase')))
    const unpacked = unzipSync(original)
    const definition = JSON.parse(strFromU8(unpacked['case.json']!)) as { browser: { clueId?: string }[] }
    definition.browser[0]!.clueId = 'missing-clue'
    unpacked['case.json'] = strToU8(JSON.stringify(definition))
    const checksums = JSON.parse(strFromU8(unpacked['checksums.json']!)) as Record<string, string>
    checksums['case.json'] = createHash('sha256').update(unpacked['case.json']!).digest('hex')
    unpacked['checksums.json'] = strToU8(JSON.stringify(checksums))

    await expect(validateCasePackageBytes(zipSync(unpacked), entry)).rejects.toThrow(/记录引用不存在的线索/)
  })
})
