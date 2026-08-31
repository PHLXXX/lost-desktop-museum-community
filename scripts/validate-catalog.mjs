import { resolve } from 'node:path'
import { validateCatalog } from '../src/validation/catalogValidator.ts'
import { formatIssue } from '../src/validation/issues.ts'

const result = await validateCatalog(resolve(process.env.CATALOG_ROOT ?? 'catalog'))
if (result.issues.length) {
  console.error(result.issues.map(formatIssue).join('\n\n'))
  process.exitCode = 1
} else {
  console.log(`Catalog valid: ${result.entries.length} version(s), ${result.publishers.size} publisher(s).`)
}
