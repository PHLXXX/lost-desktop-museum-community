import { resolve } from 'node:path'
import { buildStaticSite } from '../src/build/siteBuilder.ts'

await buildStaticSite({ outputRoot: resolve(process.env.OUTPUT_ROOT ?? 'dist') })
console.log('Static community site built.')
