import { expect, it } from 'vitest'
import en from './en.json'
import de from './de.json'

function keys(obj: unknown, prefix = ''): string[] {
  if (obj === null || typeof obj !== 'object') return [prefix]
  return Object.entries(obj).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k))
}

it('has the same keys in English and German', () => {
  expect(keys(de).sort()).toEqual(keys(en).sort())
})
