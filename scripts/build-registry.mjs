import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { buildRegistry } from '../src/build/registryBuilder.ts'

function commit() {
  if (process.env.SOURCE_COMMIT) return process.env.SOURCE_COMMIT
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() }
  catch { return 'local-uncommitted' }
}
const index = await buildRegistry({
  catalogRoot: resolve(process.env.CATALOG_ROOT ?? 'catalog'),
  outputRoot: resolve(process.env.OUTPUT_ROOT ?? 'dist'),
  generatedAt: process.env.GENERATED_AT ?? new Date().toISOString(),
  sourceCommit: commit(),
})
console.log(`Registry ${index.registryVersion}: ${index.cases.length} case(s).`)
