import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { strToU8, zipSync } from 'fflate'
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
})
