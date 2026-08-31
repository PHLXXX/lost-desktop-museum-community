import { describe, expect, it } from 'vitest'
import { publisherSchema, registryCaseSchema, registryIndexSchema, sourceEntrySchema } from '../src/schema/catalogSchemas'

const publisher = { schemaVersion: 1, publisherId: 'ldm-team', displayName: 'LDM Team', description: 'Static registry maintainer.', languages: ['zh-CN'], links: [], joinedAt: '2026-08-31T00:00:00.000Z', status: 'active' }

describe('registry schemas', () => {
  it('accepts a valid publisher and rejects invalid IDs', () => {
    expect(publisherSchema.parse(publisher).publisherId).toBe('ldm-team')
    expect(() => publisherSchema.parse({ ...publisher, publisherId: '../team' })).toThrow()
  })

  it('rejects non-HTTPS publisher links', () => {
    expect(() => publisherSchema.parse({ ...publisher, links: [{ label: 'site', url: 'http://example.com' }] })).toThrow()
  })

  it('requires semantic versions, license and explicit distribution consent', () => {
    const entry = { schemaVersion: 1, caseId: 'case-community-sample-001', version: '1.0.0', publisherId: 'ldm-team', title: '消失的备用钥匙', summary: '教学案件', language: 'zh-CN', additionalLanguages: [], difficulty: 'easy', estimatedMinutes: { min: 10, max: 15 }, tags: [], contentRating: 'general', contentWarnings: [], engineCompatibility: { minimum: '0.5.0' }, packageFile: 'case-community-sample-001-1.0.0.ldmcase', changelogFile: 'CHANGELOG.md', screenshotFiles: ['screenshots/cover.png'], license: { name: 'MIT' }, distributionConsent: true, saveCompatibility: { mode: 'compatible', compatibleFromVersions: ['1.0.0'] }, status: 'active', moderation: { automatedValidationRequired: true, curated: false, featured: false }, publishedAt: '2026-08-31T00:00:00.000Z', updatedAt: '2026-08-31T00:00:00.000Z' }
    expect(sourceEntrySchema.parse(entry).version).toBe('1.0.0')
    expect(() => sourceEntrySchema.parse({ ...entry, version: 'next' })).toThrow()
    expect(() => sourceEntrySchema.parse({ ...entry, license: undefined })).toThrow()
    expect(() => sourceEntrySchema.parse({ ...entry, distributionConsent: false })).toThrow()
  })

  it('strictly validates generated index and case detail records', () => {
    expect(() => registryIndexSchema.parse({ schemaVersion: 1, injected: true })).toThrow()
    expect(() => registryCaseSchema.parse({ schemaVersion: 1, packagePath: 'https://example.com/case.ldmcase' })).toThrow()
  })
})
