export interface CatalogIssue {
  caseId?: string
  version?: string
  file: string
  fieldPath: string
  code: string
  reason: string
  fixHint: string
}

export function issue(input: CatalogIssue): CatalogIssue { return input }
export function formatIssue(value: CatalogIssue) {
  return `[${value.code}] ${value.caseId ?? 'catalog'}${value.version ? `@${value.version}` : ''} · ${value.file} · ${value.fieldPath}\n原因：${value.reason}\n修复：${value.fixHint}`
}
