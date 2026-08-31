import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { validateCasePackageBytes } from '../src/validation/packageValidator.ts'

function option(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}
const packagePath = option('--package')
const caseId = option('--case-id')
const version = option('--version')
const publisherId = option('--publisher-id')
if (!packagePath || !caseId || !version || !publisherId) {
  console.error('Usage: npm run package:validate -- --package <file> --case-id <id> --version <semver> --publisher-id <id>')
  process.exitCode = 2
} else {
  const metadata = await validateCasePackageBytes(new Uint8Array(await readFile(resolve(packagePath))), { caseId, version, publisherId })
  console.log(JSON.stringify(metadata, null, 2))
}
