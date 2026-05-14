/**
 * Orval fails to generate valid code if an API endpoint has a path parameter with
 * the same name as a body parameter (https://github.com/orval-labs/orval/issues/2491), e.g.:
 * ```
 * POST /clusters/{clusters}/namespaces/{namespace}/instances/{instance}
 * body: { instance: Instance }
 * ```
 * This renames duplicate params: `(instance: string, instance: Instance)` → `(instanceName: string, instance: Instance)`
 * and fixes the corresponding URL getter calls.
 */

import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const filePath = resolve(__dirname, '../generated/http-api.client.gen.ts')

let content = readFileSync(filePath, 'utf-8')

// Rename duplicate parameters: `(instance: string, instance: Instance)` → `(instanceName: string, instance: Instance)`.
// Matches a word followed by `: string,` then the same word with a non-string type.
const renamedParams = []
content = content.replace(
  /(\w+)(: string,\s*\n\s+)\1(: (?!string\b)\w+)/g,
  (match, paramName, mid, rest) => {
    renamedParams.push(paramName)
    return `${paramName}Name${mid}${paramName}${rest}`
  },
)

// Fix URL getter calls inside functions that had a param renamed.
// e.g. `getUpdateInstanceUrl(cluster,namespace,instance)` must become
// `getUpdateInstanceUrl(cluster,namespace,instanceName)` because `instance`
// now refers to the body object, not the path parameter.
// The regex scopes the replacement to functions containing the renamed signature
// to avoid affecting other functions where the param name was not renamed.
for (const param of [...new Set(renamedParams)]) {
  const fnPattern = new RegExp(
    `(${param}Name: string,[\\s\\S]*?)(get\\w+Url\\([^)]*,)${param}(\\))`,
    'g',
  )
  content = content.replace(fnPattern, `$1$2${param}Name$3`)
}

writeFileSync(filePath, content)
console.log('✓ Post-processed generated client')
