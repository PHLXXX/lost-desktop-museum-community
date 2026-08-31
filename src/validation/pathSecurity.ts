import { isAbsolute } from 'node:path'

const reservedNames = new Set(['con', 'prn', 'aux', 'nul', 'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9', 'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9'])

export function assertSafeRelativePath(input: string): string {
  const value = input.normalize('NFC')
  const parts = value.split('/')
  const protocol = /^[a-z][a-z0-9+.-]*:/i.test(value)
  const invalidPart = parts.some((part) => !part || part === '.' || part === '..' || reservedNames.has(part.split('.')[0]!.toLowerCase()))
  if (value !== input || value.includes('\\') || value.startsWith('/') || isAbsolute(value) || protocol || invalidPart || /[\0<>:"|?*]/.test(value)) {
    throw new Error(`路径不安全或不是规范相对路径：${input}`)
  }
  return value
}

export function findPathCollisions(paths: string[]): string[][] {
  const groups = new Map<string, string[]>()
  for (const original of paths) {
    const key = original.normalize('NFC').toLocaleLowerCase('en-US')
    groups.set(key, [...(groups.get(key) ?? []), original])
  }
  return [...groups.values()].filter((group) => group.length > 1)
}
