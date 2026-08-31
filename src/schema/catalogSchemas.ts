import { z } from 'zod'
import { assertSafeRelativePath } from '../validation/pathSecurity'

const semver = z.string().regex(/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/)
const identifier = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(80)
const publisherId = identifier.max(40).refine((value) => !['admin', 'builtin', 'official', 'system'].includes(value), '保留发布者ID')
const httpsUrl = z.string().url().refine((value) => new URL(value).protocol === 'https:', '只允许HTTPS链接')
const relativePath = z.string().min(1).refine((value) => { try { return assertSafeRelativePath(value) === value } catch { return false } }, '必须是安全相对路径')
const isoDate = z.string().datetime({ offset: true })
const safeText = z.string().refine((value) => !/<\/?(?:script|iframe|object|embed|link|style)\b|javascript:/i.test(value), '文本包含不安全标记')
const minutes = z.object({ min: z.number().int().positive(), max: z.number().int().positive() }).strict().refine((value) => value.max >= value.min, '时长范围无效')
const difficulty = z.enum(['easy', 'normal', 'hard'])
const rating = z.enum(['general', 'teen', 'mature'])
const status = z.enum(['active', 'deprecated', 'blocked'])
const saveCompatibility = z.object({ mode: z.enum(['compatible', 'requires-review', 'incompatible']), compatibleFromVersions: z.array(semver), notes: safeText.max(1000).optional() }).strict()

export const publisherSchema = z.object({
  schemaVersion: z.literal(1), publisherId, displayName: safeText.min(1).max(100), description: safeText.max(2000),
  githubUsername: z.string().regex(/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/).optional(), repositoryUrl: httpsUrl.optional(), avatarPath: relativePath.optional(),
  languages: z.array(z.string().min(2)).min(1).max(20), links: z.array(z.object({ label: safeText.min(1).max(80), url: httpsUrl }).strict()).max(10), joinedAt: isoDate, status: z.enum(['active', 'suspended']),
}).strict()

export const sourceEntrySchema = z.object({
  schemaVersion: z.literal(1), caseId: identifier, version: semver, publisherId, title: safeText.min(1).max(160), subtitle: safeText.max(200).optional(), summary: safeText.min(1).max(5000),
  language: z.string().min(2), additionalLanguages: z.array(z.string().min(2)).max(20), difficulty, estimatedMinutes: minutes, tags: z.array(safeText.min(1).max(40)).max(20), contentRating: rating,
  contentWarnings: z.array(safeText.max(200)).max(20), engineCompatibility: z.object({ minimum: semver, maximumExclusive: semver.optional() }).strict(),
  packageFile: relativePath.refine((value) => value.endsWith('.ldmcase'), '案件包必须使用.ldmcase扩展名'), changelogFile: relativePath,
  screenshotFiles: z.array(relativePath).min(1).max(5), license: z.object({ name: safeText.min(1).max(100), url: httpsUrl.optional(), customTextFile: relativePath.optional() }).strict(),
  distributionConsent: z.literal(true), saveCompatibility, status,
  moderation: z.object({ automatedValidationRequired: z.literal(true), curated: z.boolean(), featured: z.boolean(), notes: safeText.max(1000).optional() }).strict(), publishedAt: isoDate, updatedAt: isoDate,
}).strict().superRefine((value, context) => {
  if (value.status === 'blocked' && !value.moderation.notes?.trim()) context.addIssue({ code: 'custom', path: ['moderation', 'notes'], message: 'blocked案件必须提供维护者阻止原因' })
})

const registrySummarySchema = z.object({
  caseId: identifier, latestVersion: semver, publisherId, title: safeText.min(1), subtitle: safeText.optional(), summary: safeText.min(1), language: z.string().min(2), additionalLanguages: z.array(z.string().min(2)),
  difficulty, estimatedMinutes: minutes, tags: z.array(safeText), contentRating: rating, contentWarnings: z.array(safeText), coverPath: relativePath.optional(), status, curated: z.boolean(), featured: z.boolean(),
  publishedAt: isoDate, updatedAt: isoDate, detailPath: relativePath,
}).strict()

export const registryIndexSchema = z.object({
  schemaVersion: z.literal(1), registryVersion: semver, generatedAt: isoDate, sourceCommit: z.string().min(1), engineCompatibility: z.object({ minimumClientVersion: semver }).strict(),
  stats: z.object({ activeCases: z.number().int().nonnegative(), publishers: z.number().int().nonnegative(), languages: z.number().int().nonnegative(), totalPackageBytes: z.number().int().nonnegative() }).strict(),
  featuredCaseIds: z.array(identifier), cases: z.array(registrySummarySchema),
}).strict()

const registryVersionSchema = z.object({
  version: semver, packagePath: relativePath, packageSha256: z.string().regex(/^[a-f0-9]{64}$/), packageByteSize: z.number().int().positive(),
  engineCompatibility: z.object({ minimum: semver, maximumExclusive: semver.optional() }).strict(), saveCompatibility,
  changelog: safeText.min(1).max(20_000), screenshots: z.array(relativePath).min(1).max(5), license: z.object({ name: safeText.min(1), url: httpsUrl.optional(), customTextPath: relativePath.optional() }).strict(),
  automatedValidation: z.object({ passed: z.literal(true), checkedAt: isoDate }).strict(), publishedAt: isoDate, updatedAt: isoDate,
}).strict()

export const registryCaseSchema = z.object({
  schemaVersion: z.literal(1), caseId: identifier, publisherId, title: safeText.min(1), subtitle: safeText.optional(), summary: safeText.min(1), language: z.string().min(2), additionalLanguages: z.array(z.string().min(2)),
  difficulty, estimatedMinutes: minutes, tags: z.array(safeText), contentRating: rating, contentWarnings: z.array(safeText), status, blockReason: safeText.optional(), curated: z.boolean(), featured: z.boolean(),
  publisherPath: relativePath, latestVersion: semver, versions: z.array(registryVersionSchema).min(1),
}).strict().superRefine((value, context) => {
  if (value.status === 'blocked' && !value.blockReason?.trim()) context.addIssue({ code: 'custom', path: ['blockReason'], message: 'blocked案件必须提供阻止原因' })
})

export type Publisher = z.infer<typeof publisherSchema>
export type SourceEntry = z.infer<typeof sourceEntrySchema>
export type RegistryIndex = z.infer<typeof registryIndexSchema>
export type RegistryCase = z.infer<typeof registryCaseSchema>
