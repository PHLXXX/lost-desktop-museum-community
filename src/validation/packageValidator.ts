import { createHash } from 'node:crypto'
import { strFromU8, unzipSync } from 'fflate'
import { assertSafeRelativePath, findPathCollisions } from './pathSecurity'

export interface PackageEntryIdentity { caseId: string; version: string; publisherId: string }
export interface ValidatedPackageMetadata { caseId: string; version: string; sha256: string; packageByteSize: number; unpackedByteSize: number; fileCount: number; resourceCount: number; clueCount: number; applicationCount: number; questionPoints: number }
interface CentralEntry { path: string; compressedSize: number; size: number; encrypted: boolean; symlink: boolean }

const limits = { package: 30 * 1024 * 1024, unpacked: 60 * 1024 * 1024, entries: 250, entry: 8 * 1024 * 1024, ratio: 100 }
const allowedRoots = new Set(['manifest.json', 'case.json', 'checksums.json'])
const allowedAssets = new Set(['png', 'jpg', 'jpeg', 'webp', 'wav', 'ogg', 'txt', 'md'])
const blocked = new Set(['js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'html', 'htm', 'wasm', 'svg', 'sh', 'bash', 'cmd', 'bat', 'ps1', 'exe', 'dll', 'com', 'scr'])

function u16(bytes: Uint8Array, offset: number) { return bytes[offset]! | (bytes[offset + 1]! << 8) }
function u32(bytes: Uint8Array, offset: number) { return (bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16) | (bytes[offset + 3]! << 24)) >>> 0 }
function sha256(bytes: Uint8Array) { return createHash('sha256').update(bytes).digest('hex') }

function centralDirectory(bytes: Uint8Array): CentralEntry[] {
  let eocd = -1
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65_557); index--) if (u32(bytes, index) === 0x06054b50) { eocd = index; break }
  if (eocd < 0) throw new Error('案件包不是有效ZIP文件。')
  const count = u16(bytes, eocd + 10)
  let offset = u32(bytes, eocd + 16)
  const decoder = new TextDecoder()
  const entries: CentralEntry[] = []
  for (let index = 0; index < count; index++) {
    if (u32(bytes, offset) !== 0x02014b50) throw new Error('ZIP中央目录损坏。')
    const flags = u16(bytes, offset + 8); const compressedSize = u32(bytes, offset + 20); const size = u32(bytes, offset + 24)
    const nameLength = u16(bytes, offset + 28); const extraLength = u16(bytes, offset + 30); const commentLength = u16(bytes, offset + 32); const external = u32(bytes, offset + 38)
    const path = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength)); const unixMode = external >>> 16
    entries.push({ path, compressedSize, size, encrypted: Boolean(flags & 1), symlink: (unixMode & 0o170000) === 0o120000 })
    offset += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

function validateEntries(entries: CentralEntry[]) {
  if (entries.length > limits.entries) throw new Error('案件包文件数量超过250个安全限制。')
  const collisions = findPathCollisions(entries.map((entry) => entry.path))
  if (collisions.length) throw new Error(`案件包包含重复或大小写冲突路径：${collisions[0]!.join('、')}`)
  let unpacked = 0
  for (const entry of entries) {
    assertSafeRelativePath(entry.path)
    const extension = entry.path.split('.').at(-1)?.toLowerCase() ?? ''
    if (blocked.has(extension)) throw new Error(`案件包不允许${extension || '未知'}文件：${entry.path}`)
    if (!allowedRoots.has(entry.path) && (!entry.path.startsWith('assets/') || !allowedAssets.has(extension))) throw new Error(`案件包包含不允许的文件：${entry.path}`)
    if (entry.encrypted) throw new Error(`案件包不允许加密条目：${entry.path}`)
    if (entry.symlink) throw new Error(`案件包不允许符号链接：${entry.path}`)
    if (entry.size > limits.entry) throw new Error(`单个资源超过8MB：${entry.path}`)
    if (entry.compressedSize > 0 && entry.size / entry.compressedSize > limits.ratio) throw new Error(`异常压缩比：${entry.path}`)
    unpacked += entry.size
  }
  if (unpacked > limits.unpacked) throw new Error('案件包解压后超过60MB。')
  return unpacked
}

function assertSafeContent(value: unknown, path = '$') {
  if (typeof value === 'string') {
    if (/(?:https?:)?\/\//i.test(value)) throw new Error(`案件包含远程资源：${path}`)
    if (/<\/?(?:script|iframe|object|embed|link|style)\b|javascript:/i.test(value)) throw new Error(`案件包含HTML或脚本内容：${path}`)
    if (/\b(?:TODO|TBD|Coming Soon)\b/i.test(value)) throw new Error(`案件包含占位文案：${path}`)
    return
  }
  if (Array.isArray(value)) { value.forEach((item, index) => assertSafeContent(item, `${path}[${index}]`)); return }
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    if (['code', 'script', 'javascript', 'html', 'iframe', 'shell'].includes(key.toLowerCase())) throw new Error(`案件包含可执行字段：${path}.${key}`)
    assertSafeContent(child, `${path}.${key}`)
  }
}

function dependencyIds(condition: unknown): string[] {
  if (!condition || typeof condition !== 'object') return []
  const value = condition as { type?: unknown; clueId?: unknown; conditions?: unknown[] }
  if (value.type === 'clue' && typeof value.clueId === 'string') return [value.clueId]
  return Array.isArray(value.conditions) ? value.conditions.flatMap(dependencyIds) : []
}

function assertReachable(definition: Record<string, unknown>) {
  const clues = Array.isArray(definition.clues) ? definition.clues as Record<string, unknown>[] : []
  const questions = Array.isArray(definition.questions) ? definition.questions as Record<string, unknown>[] : []
  if (!clues.length || !questions.length) throw new Error('CaseDefinition缺少线索或推理题。')
  const itemIds = new Set<string>()
  for (const key of ['files', 'emails', 'browser', 'calendar', 'photos', 'logs', 'audioTracks', 'broadcastEvents', 'dataTables', 'terminalEntries', 'versionDiffs', 'sitemap']) {
    for (const item of Array.isArray(definition[key]) ? definition[key] as Record<string, unknown>[] : []) if (typeof item.id === 'string') itemIds.add(item.id)
  }
  for (const chat of Array.isArray(definition.chats) ? definition.chats as Record<string, unknown>[] : []) for (const message of Array.isArray(chat.messages) ? chat.messages as Record<string, unknown>[] : []) if (typeof message.id === 'string') itemIds.add(message.id)
  const clueIds = new Set(clues.flatMap((clue) => typeof clue.id === 'string' ? [clue.id] : []))
  const graph = new Map<string, string[]>()
  for (const clue of clues) {
    if (typeof clue.id !== 'string') throw new Error('线索ID无效。')
    const discovery = clue.discovery as { itemId?: unknown } | undefined
    if (!discovery || typeof discovery.itemId !== 'string' || !itemIds.has(discovery.itemId)) throw new Error(`线索理论不可达：${clue.id}`)
    const dependencies = dependencyIds(clue.condition)
    if (dependencies.some((id) => !clueIds.has(id))) throw new Error(`线索引用不存在：${clue.id}`)
    graph.set(clue.id, dependencies)
  }
  const visiting = new Set<string>(); const visited = new Set<string>()
  const visit = (id: string) => { if (visiting.has(id)) throw new Error(`线索依赖循环：${id}`); if (visited.has(id)) return; visiting.add(id); for (const next of graph.get(id) ?? []) visit(next); visiting.delete(id); visited.add(id) }
  for (const id of graph.keys()) visit(id)
  const points = questions.reduce((sum, question) => sum + (typeof question.points === 'number' ? question.points : 0), 0)
  if (points !== 100) throw new Error('推理题总分必须为100。')
  for (const question of questions) {
    const options = Array.isArray(question.options) ? question.options as Record<string, unknown>[] : []
    if (!options.some((option) => option.id === question.correctId)) throw new Error(`推理正确答案不可达：${String(question.id)}`)
  }
  return { clueCount: clues.length, questionPoints: points }
}

export async function validateCasePackageBytes(bytes: Uint8Array, expected: PackageEntryIdentity): Promise<ValidatedPackageMetadata> {
  if (bytes.length > limits.package) throw new Error('案件包超过30MB。')
  const entries = centralDirectory(bytes)
  const unpackedByteSize = validateEntries(entries)
  let unpacked: Record<string, Uint8Array>
  try { unpacked = unzipSync(bytes) } catch { throw new Error('案件包解压失败。') }
  for (const required of allowedRoots) if (!unpacked[required]) throw new Error(`案件包缺少${required}。`)
  let manifest: Record<string, unknown>; let definition: Record<string, unknown>; let checksums: Record<string, string>
  try {
    manifest = JSON.parse(strFromU8(unpacked['manifest.json']!)) as Record<string, unknown>
    definition = JSON.parse(strFromU8(unpacked['case.json']!)) as Record<string, unknown>
    checksums = JSON.parse(strFromU8(unpacked['checksums.json']!)) as Record<string, string>
  } catch { throw new Error('案件包JSON损坏。') }
  if (manifest.kind !== 'ldmcase' || manifest.packageFormatVersion !== 1) throw new Error('案件包manifest格式不受支持。')
  if (manifest.caseId !== expected.caseId || definition.id !== expected.caseId || (definition.manifest as Record<string, unknown> | undefined)?.caseId !== expected.caseId) throw new Error('案件包caseId与目录或entry不一致。')
  if (manifest.version !== expected.version || (definition.manifest as Record<string, unknown> | undefined)?.version !== expected.version) throw new Error('案件包version与目录或entry不一致。')
  const caseManifest = definition.manifest as Record<string, unknown> | undefined
  if (caseManifest?.builtIn !== false || caseManifest.author !== expected.publisherId) throw new Error('案件包发布者与entry不一致或冒充内置案件。')
  for (const [path, expectedHash] of Object.entries(checksums)) if (!unpacked[path] || sha256(unpacked[path]!) !== expectedHash) throw new Error(`案件包SHA-256不匹配：${path}`)
  assertSafeContent(definition)
  const reachability = assertReachable(definition)
  const assets = Array.isArray(definition.assets) ? definition.assets as Record<string, unknown>[] : []
  for (const asset of assets) {
    const path = String(asset.path).startsWith('assets/') ? String(asset.path) : `assets/${String(asset.path)}`
    const content = unpacked[path]
    if (!content || content.length !== asset.size || sha256(content) !== asset.sha256) throw new Error(`案件资源声明不匹配：${String(asset.id)}`)
  }
  const applications = Array.isArray(definition.applications) ? definition.applications : []
  return { caseId: expected.caseId, version: expected.version, sha256: sha256(bytes), packageByteSize: bytes.length, unpackedByteSize, fileCount: entries.length, resourceCount: assets.length, clueCount: reachability.clueCount, applicationCount: applications.length, questionPoints: reachability.questionPoints }
}
