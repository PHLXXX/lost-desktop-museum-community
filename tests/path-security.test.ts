import { describe, expect, it } from 'vitest'
import { assertSafeRelativePath, findPathCollisions } from '../src/validation/pathSecurity'

describe('catalog path security', () => {
  it.each(['../case.json', '/absolute/case.json', 'C:/case.json', 'a\\b.json', 'javascript:case', 'data:text/plain,x'])('rejects unsafe path %s', (path) => {
    expect(() => assertSafeRelativePath(path)).toThrow(/路径/)
  })

  it('accepts a normalized relative catalog path', () => {
    expect(assertSafeRelativePath('screenshots/cover.webp')).toBe('screenshots/cover.webp')
  })

  it('detects case-insensitive and normalized duplicate paths', () => {
    expect(findPathCollisions(['Case/File.json', 'case/file.json', 'café.txt', 'café.txt'])).toHaveLength(2)
  })
})
