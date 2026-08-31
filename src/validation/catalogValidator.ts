import { lstat, readFile, readdir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { publisherSchema, sourceEntrySchema, type Publisher, type SourceEntry } from '../schema/catalogSchemas'
import { validateCasePackageBytes, type ValidatedPackageMetadata } from './packageValidator'
import { assertSafeRelativePath, findPathCollisions } from './pathSecurity'
import { issue, type CatalogIssue } from './issues'

export interface ValidatedCatalogEntry { entry: SourceEntry; directory: string; package: ValidatedPackageMetadata; changelog: string }
export interface CatalogValidationResult { issues: CatalogIssue[]; publishers: Map<string, Publisher>; entries: ValidatedCatalogEntry[] }

async function exists(path: string) { try { await stat(path); return true } catch { return false } }
async function catalogFiles(root: string, current = ''): Promise<{ path: string; symlink: boolean }[]> {
  const values: { path: string; symlink: boolean }[] = []
  for (const item of await readdir(join(root, current), { withFileTypes: true })) {
    const path = current ? `${current}/${item.name}` : item.name
    if (item.isSymbolicLink()) values.push({ path, symlink: true })
    else if (item.isDirectory()) values.push(...await catalogFiles(root, path))
    else values.push({ path, symlink: false })
  }
  return values
}
function signatureMatches(extension: string, bytes: Uint8Array) {
  if (extension === 'png') return [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
  if (extension === 'jpg' || extension === 'jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  if (extension === 'webp') return new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP'
  return false
}
function schemaIssues(error: { issues: { path: PropertyKey[]; message: string }[] }, file: string, caseId?: string, version?: string): CatalogIssue[] {
  return error.issues.map((value) => issue({ caseId, version, file, fieldPath: value.path.join('.') || '$', code: 'SCHEMA_INVALID', reason: value.message, fixHint: '按照schemas中的格式修正该字段，并保持严格JSON结构。' }))
}

export async function validateCatalog(catalogRoot: string): Promise<CatalogValidationResult> {
  const issues: CatalogIssue[] = []; const publishers = new Map<string, Publisher>(); const entries: ValidatedCatalogEntry[] = []
  const publisherRoot = join(catalogRoot, 'publishers')
  for (const filename of await readdir(publisherRoot)) {
    if (!filename.endsWith('.json')) { issues.push(issue({ file: filename, fieldPath: '$', code: 'PUBLISHER_FILE_TYPE', reason: '发布者目录只允许JSON。', fixHint: '移除未登记文件。' })); continue }
    try {
      if ((await lstat(join(publisherRoot, filename))).isSymbolicLink()) { issues.push(issue({ file: `publishers/${filename}`, fieldPath: '$', code: 'SYMLINK_BLOCKED', reason: '发布者资料不能是符号链接。', fixHint: '提交普通JSON文件。' })); continue }
      const parsed = publisherSchema.safeParse(JSON.parse(await readFile(join(publisherRoot, filename), 'utf8')) as unknown)
      if (!parsed.success) issues.push(...schemaIssues(parsed.error, `publishers/${filename}`))
      else if (filename !== `${parsed.data.publisherId}.json`) issues.push(issue({ file: `publishers/${filename}`, fieldPath: 'publisherId', code: 'PUBLISHER_PATH_MISMATCH', reason: '发布者文件名与publisherId不一致。', fixHint: `重命名为${parsed.data.publisherId}.json。` }))
      else if (publishers.has(parsed.data.publisherId)) issues.push(issue({ file: `publishers/${filename}`, fieldPath: 'publisherId', code: 'PUBLISHER_DUPLICATE', reason: 'publisherId重复。', fixHint: '保留唯一发布者资料。' }))
      else publishers.set(parsed.data.publisherId, parsed.data)
    } catch (error) { issues.push(issue({ file: `publishers/${filename}`, fieldPath: '$', code: 'PUBLISHER_JSON', reason: error instanceof Error ? error.message : 'JSON损坏', fixHint: '保存为UTF-8合法JSON。' })) }
  }
  const caseRoot = join(catalogRoot, 'cases')
  const caseIds = await readdir(caseRoot)
  const collision = findPathCollisions(caseIds)
  if (collision.length) issues.push(issue({ file: 'cases', fieldPath: '$', code: 'CASE_PATH_COLLISION', reason: collision[0]!.join('、'), fixHint: '使用唯一的小写caseId目录。' }))
  for (const caseId of caseIds.sort()) {
    if ((await lstat(join(caseRoot, caseId))).isSymbolicLink()) { issues.push(issue({ caseId, file: `cases/${caseId}`, fieldPath: '$', code: 'SYMLINK_BLOCKED', reason: '案件目录不能是符号链接。', fixHint: '提交普通目录。' })); continue }
    try { assertSafeRelativePath(caseId) } catch (error) { issues.push(issue({ caseId, file: `cases/${caseId}`, fieldPath: '$', code: 'CASE_PATH', reason: String(error), fixHint: '使用小写字母、数字和连字符。' })); continue }
    const versions = await readdir(join(caseRoot, caseId))
    for (const version of versions.sort()) {
      const directory = join(caseRoot, caseId, version); const entryFile = join(directory, 'entry.json'); const fileLabel = relative(catalogRoot, entryFile).replaceAll('\\', '/')
      if ((await lstat(directory)).isSymbolicLink()) { issues.push(issue({ caseId, version, file: relative(catalogRoot, directory).replaceAll('\\', '/'), fieldPath: '$', code: 'SYMLINK_BLOCKED', reason: '版本目录不能是符号链接。', fixHint: '提交普通目录。' })); continue }
      let entry: SourceEntry
      try {
        const parsed = sourceEntrySchema.safeParse(JSON.parse(await readFile(entryFile, 'utf8')) as unknown)
        if (!parsed.success) { issues.push(...schemaIssues(parsed.error, fileLabel, caseId, version)); continue }
        entry = parsed.data
      } catch (error) { issues.push(issue({ caseId, version, file: fileLabel, fieldPath: '$', code: 'ENTRY_JSON', reason: error instanceof Error ? error.message : 'JSON损坏', fixHint: '添加合法UTF-8 entry.json。' })); continue }
      if (entry.caseId !== caseId) issues.push(issue({ caseId, version, file: fileLabel, fieldPath: 'caseId', code: 'CASE_ID_MISMATCH', reason: 'entry.caseId与目录不一致。', fixHint: `改为${caseId}。` }))
      if (entry.version !== version) issues.push(issue({ caseId, version, file: fileLabel, fieldPath: 'version', code: 'VERSION_MISMATCH', reason: 'entry.version与目录不一致。', fixHint: `改为${version}。` }))
      if (!publishers.has(entry.publisherId)) issues.push(issue({ caseId, version, file: fileLabel, fieldPath: 'publisherId', code: 'PUBLISHER_MISSING', reason: `发布者${entry.publisherId}未登记。`, fixHint: '先在catalog/publishers添加发布者资料。' }))
      const screenshotOutputCollisions = findPathCollisions(entry.screenshotFiles.map((path) => path.split('/').at(-1)!))
      if (screenshotOutputCollisions.length) issues.push(issue({ caseId, version, file: fileLabel, fieldPath: 'screenshotFiles', code: 'OUTPUT_PATH_COLLISION', reason: `截图构建输出路径冲突：${screenshotOutputCollisions[0]!.join('、')}`, fixHint: '为每张截图使用大小写和规范化后仍唯一的文件名。' }))
      const allowedFiles = new Set(['entry.json', entry.packageFile, entry.changelogFile, ...entry.screenshotFiles, ...(entry.license.customTextFile ? [entry.license.customTextFile] : [])])
      const sourceFiles = await catalogFiles(directory); const symlinkPaths = new Set(sourceFiles.filter((item) => item.symlink).map((item) => item.path))
      for (const file of sourceFiles) {
        try { assertSafeRelativePath(file.path) } catch (error) { issues.push(issue({ caseId, version, file: file.path, fieldPath: '$', code: 'CATALOG_PATH', reason: String(error), fixHint: '使用规范安全的相对路径。' })); continue }
        if (file.symlink) issues.push(issue({ caseId, version, file: file.path, fieldPath: '$', code: 'SYMLINK_BLOCKED', reason: 'catalog不能包含符号链接。', fixHint: '提交普通文件。' }))
        else if (!allowedFiles.has(file.path)) issues.push(issue({ caseId, version, file: file.path, fieldPath: '$', code: 'UNREGISTERED_FILE', reason: '版本目录包含entry未登记的文件。', fixHint: '删除该文件或在允许字段中明确登记。' }))
      }
      const packagePath = join(directory, entry.packageFile); const changelogPath = join(directory, entry.changelogFile)
      if (!await exists(packagePath)) issues.push(issue({ caseId, version, file: fileLabel, fieldPath: 'packageFile', code: 'PACKAGE_MISSING', reason: '案件包不存在。', fixHint: '将经过档案工坊校验的.ldmcase放入版本目录。' }))
      if (!await exists(changelogPath)) issues.push(issue({ caseId, version, file: fileLabel, fieldPath: 'changelogFile', code: 'CHANGELOG_MISSING', reason: 'CHANGELOG不存在。', fixHint: '添加实际版本变更说明。' }))
      if (entry.license.customTextFile && !await exists(join(directory, entry.license.customTextFile))) issues.push(issue({ caseId, version, file: fileLabel, fieldPath: 'license.customTextFile', code: 'LICENSE_FILE_MISSING', reason: '自定义许可证文件不存在。', fixHint: '补齐登记的纯文本许可证文件。' }))
      let screenshotMissing = false
      for (const screenshot of entry.screenshotFiles) {
        const path = join(directory, screenshot)
        if (!await exists(path)) { screenshotMissing = true; continue }
        if (symlinkPaths.has(screenshot)) continue
        const info = await stat(path); const bytes = new Uint8Array(await readFile(path)); const extension = screenshot.split('.').at(-1)?.toLowerCase() ?? ''
        if (info.size > 2 * 1024 * 1024) issues.push(issue({ caseId, version, file: screenshot, fieldPath: '$', code: 'SCREENSHOT_TOO_LARGE', reason: '单张截图超过2MB。', fixHint: '压缩截图后重新提交。' }))
        if (!['png', 'jpg', 'jpeg', 'webp'].includes(extension) || !signatureMatches(extension, bytes)) issues.push(issue({ caseId, version, file: screenshot, fieldPath: '$', code: 'SCREENSHOT_SIGNATURE', reason: '截图扩展名或文件签名无效。', fixHint: '重新导出PNG、JPEG或WebP。' }))
      }
      if (screenshotMissing) issues.push(issue({ caseId, version, file: fileLabel, fieldPath: 'screenshotFiles', code: 'SCREENSHOT_MISSING', reason: '至少一张登记截图不存在。', fixHint: '补齐entry登记的1至5张截图。' }))
      if (!await exists(packagePath) || symlinkPaths.has(entry.packageFile)) continue
      try {
        const packageBytes = new Uint8Array(await readFile(packagePath)); const packageMetadata = await validateCasePackageBytes(packageBytes, { caseId, version, publisherId: entry.publisherId })
        const changelog = await exists(changelogPath) && !symlinkPaths.has(entry.changelogFile) ? await readFile(changelogPath, 'utf8') : ''
        if (/\b(?:TODO|TBD|Coming Soon)\b/i.test(changelog)) throw new Error('CHANGELOG包含占位文案。')
        entries.push({ entry, directory, package: packageMetadata, changelog })
      } catch (error) { issues.push(issue({ caseId, version, file: entry.packageFile, fieldPath: '$', code: 'PACKAGE_INVALID', reason: error instanceof Error ? error.message : '案件包无效。', fixHint: '回到档案工坊重新校验并导出案件包。' })) }
    }
  }
  return { issues, publishers, entries }
}
