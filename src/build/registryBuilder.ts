import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { registryCaseSchema, registryIndexSchema, type RegistryCase, type RegistryIndex } from '../schema/catalogSchemas'
import { validateCatalog } from '../validation/catalogValidator'
import { formatIssue } from '../validation/issues'

export interface BuildRegistryOptions { catalogRoot: string; outputRoot: string; generatedAt: string; sourceCommit: string }
function sha256(bytes: Uint8Array) { return createHash('sha256').update(bytes).digest('hex') }
function json(value: unknown) { return `${JSON.stringify(value, null, 2)}\n` }
async function put(path: string, value: string | Uint8Array) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, value) }
async function outputFiles(root: string, current = ''): Promise<string[]> {
  const files: string[] = []
  for (const item of await readdir(join(root, current), { withFileTypes: true })) {
    const path = current ? `${current}/${item.name}` : item.name
    if (item.isDirectory()) files.push(...await outputFiles(root, path)); else files.push(path)
  }
  return files
}
function compareSemver(left: string, right: string) { const a = left.split('.').map(Number); const b = right.split('.').map(Number); for (let i = 0; i < 3; i++) { const delta = (a[i] ?? 0) - (b[i] ?? 0); if (delta) return delta } return left.localeCompare(right) }
function safeOutput(path: string) { const normalized = path.replaceAll('\\', '/'); if (!normalized || normalized === '/' || /^[A-Za-z]:\/?$/.test(normalized)) throw new Error('拒绝使用文件系统根目录作为构建输出。') }

export async function buildRegistry(options: BuildRegistryOptions): Promise<RegistryIndex> {
  safeOutput(options.outputRoot)
  const catalog = await validateCatalog(options.catalogRoot)
  if (catalog.issues.length) throw new Error(catalog.issues.map(formatIssue).join('\n\n'))
  await rm(options.outputRoot, { recursive: true, force: true }); await mkdir(options.outputRoot, { recursive: true })
  for (const [publisherId, publisher] of [...catalog.publishers].sort(([left], [right]) => left.localeCompare(right))) await put(join(options.outputRoot, `registry/v1/publishers/${publisherId}.json`), json(publisher))
  const grouped = new Map<string, typeof catalog.entries>()
  for (const record of catalog.entries) grouped.set(record.entry.caseId, [...(grouped.get(record.entry.caseId) ?? []), record])
  const summaries: RegistryIndex['cases'] = []
  for (const [caseId, records] of [...grouped].sort(([left], [right]) => left.localeCompare(right))) {
    records.sort((left, right) => compareSemver(left.entry.version, right.entry.version))
    const latest = records.at(-1)!
    const versions: RegistryCase['versions'] = []
    for (const record of records) {
      const packageName = `${caseId}-${record.entry.version}.ldmcase`; const packagePath = `packages/${caseId}/${record.entry.version}/${packageName}`
      await mkdir(join(options.outputRoot, dirname(packagePath)), { recursive: true }); await copyFile(join(record.directory, record.entry.packageFile), join(options.outputRoot, packagePath))
      const screenshots: string[] = []
      for (const source of record.entry.screenshotFiles) {
        const filename = source.split('/').at(-1)!; const target = `screenshots/${caseId}/${record.entry.version}/${filename}`
        await mkdir(join(options.outputRoot, dirname(target)), { recursive: true }); await copyFile(join(record.directory, source), join(options.outputRoot, target)); screenshots.push(target)
      }
      if (record.entry.license.customTextFile) {
        const licenseTarget = `licenses/${caseId}/${record.entry.version}.txt`
        await mkdir(join(options.outputRoot, dirname(licenseTarget)), { recursive: true }); await copyFile(join(record.directory, record.entry.license.customTextFile), join(options.outputRoot, licenseTarget))
      }
      versions.push({ version: record.entry.version, packagePath, packageSha256: record.package.sha256, packageByteSize: record.package.packageByteSize, engineCompatibility: record.entry.engineCompatibility,
        saveCompatibility: record.entry.saveCompatibility, changelog: record.changelog, screenshots, license: { name: record.entry.license.name, ...(record.entry.license.url ? { url: record.entry.license.url } : {}), ...(record.entry.license.customTextFile ? { customTextPath: `licenses/${caseId}/${record.entry.version}.txt` } : {}) },
        automatedValidation: { passed: true, checkedAt: options.generatedAt }, publishedAt: record.entry.publishedAt, updatedAt: record.entry.updatedAt })
    }
    const detail = registryCaseSchema.parse({ schemaVersion: 1, caseId, publisherId: latest.entry.publisherId, title: latest.entry.title, subtitle: latest.entry.subtitle, summary: latest.entry.summary,
      language: latest.entry.language, additionalLanguages: latest.entry.additionalLanguages, difficulty: latest.entry.difficulty, estimatedMinutes: latest.entry.estimatedMinutes, tags: latest.entry.tags,
      contentRating: latest.entry.contentRating, contentWarnings: latest.entry.contentWarnings, status: latest.entry.status, ...(latest.entry.status === 'blocked' ? { blockReason: latest.entry.moderation.notes } : {}), curated: latest.entry.moderation.curated, featured: latest.entry.moderation.featured,
      publisherPath: `registry/v1/publishers/${latest.entry.publisherId}.json`, latestVersion: latest.entry.version, versions })
    await put(join(options.outputRoot, `registry/v1/cases/${caseId}.json`), json(detail))
    summaries.push({ caseId, latestVersion: latest.entry.version, publisherId: latest.entry.publisherId, title: latest.entry.title, subtitle: latest.entry.subtitle, summary: latest.entry.summary,
      language: latest.entry.language, additionalLanguages: latest.entry.additionalLanguages, difficulty: latest.entry.difficulty, estimatedMinutes: latest.entry.estimatedMinutes, tags: latest.entry.tags,
      contentRating: latest.entry.contentRating, contentWarnings: latest.entry.contentWarnings, coverPath: versions.at(-1)?.screenshots[0], status: latest.entry.status,
      curated: latest.entry.moderation.curated, featured: latest.entry.moderation.featured, publishedAt: latest.entry.publishedAt, updatedAt: latest.entry.updatedAt, detailPath: `registry/v1/cases/${caseId}.json` })
  }
  const languages = new Set(summaries.flatMap((item) => [item.language, ...item.additionalLanguages]))
  const index = registryIndexSchema.parse({ schemaVersion: 1, registryVersion: '1.0.0', generatedAt: options.generatedAt, sourceCommit: options.sourceCommit,
    engineCompatibility: { minimumClientVersion: '0.5.0' }, stats: { activeCases: summaries.filter((item) => item.status === 'active').length, publishers: catalog.publishers.size, languages: languages.size, totalPackageBytes: catalog.entries.reduce((sum, item) => sum + item.package.packageByteSize, 0) },
    featuredCaseIds: summaries.filter((item) => item.featured).map((item) => item.caseId), cases: summaries })
  await put(join(options.outputRoot, 'registry/v1/index.json'), json(index))
  await put(join(options.outputRoot, 'registry/v1/stats.json'), json(index.stats))
  const checksumTargets = (await outputFiles(options.outputRoot)).filter((path) => path !== 'registry/v1/checksums.json').sort()
  const checksums: Record<string, string> = {}
  for (const path of checksumTargets) checksums[path] = sha256(new Uint8Array(await readFile(join(options.outputRoot, path))))
  await put(join(options.outputRoot, 'registry/v1/checksums.json'), json(checksums))
  return index
}
