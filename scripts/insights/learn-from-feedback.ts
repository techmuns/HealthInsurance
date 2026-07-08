// ---------------------------------------------------------------------------
//  Insights — fold specialist relevance ratings into the engine's weights.
//
//  The reader's 👍/👎 votes re-rank their own feed instantly (localStorage).
//  This script makes that learning DURABLE and GLOBAL: it reads an exported
//  votes file ({ "<detector>::<companyIds>": "up" | "down" }) and writes the
//  corresponding relevance weights into src/data/insight-preferences.json, which
//  the engine multiplies into every finding's score at generation time. Once
//  committed, every future run — including brand-new periods as data lands —
//  surfaces the up-voted patterns more and the down-voted patterns less.
//
//  Idempotent: the same votes file always yields the same weights. Keys absent
//  from the votes file keep their existing weight (multiple specialists can be
//  merged by running once per export). Weights are clamped by the engine.
//
//  Run:  npm run insights:learn -- path/to/votes.json
//        (votes.json = the "Export ratings" download from the Insights tab)
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync } from 'node:fs'

const PREFS = 'src/data/insight-preferences.json'
const UP = 1.6 // up-voted patterns surface more
const DOWN = 0.5 // down-voted patterns surface less

interface PrefsFile {
  _meta: Record<string, unknown>
  weights: Record<string, number>
}

function main(): number {
  const votesPath = process.argv[2]
  if (!votesPath) {
    console.error('usage: npm run insights:learn -- path/to/votes.json')
    return 1
  }
  const votes = JSON.parse(readFileSync(votesPath, 'utf8')) as Record<string, 'up' | 'down'>
  const file = JSON.parse(readFileSync(PREFS, 'utf8')) as PrefsFile

  let up = 0, down = 0, cleared = 0
  for (const [key, vote] of Object.entries(votes)) {
    if (!/^[a-z_]+::.+$/.test(key)) { console.warn(`skipping malformed key: ${key}`); continue }
    if (vote === 'up') { file.weights[key] = UP; up++ }
    else if (vote === 'down') { file.weights[key] = DOWN; down++ }
    else { delete file.weights[key]; cleared++ }
  }

  file._meta.updated_at = new Date().toISOString()
  writeFileSync(PREFS, JSON.stringify(file, null, 2) + '\n')
  console.log(`folded ${up + down} ratings into ${PREFS}: ${up} relevant, ${down} set-aside${cleared ? `, ${cleared} cleared` : ''}.`)
  console.log('Run `npm run insights:generate:engine` to re-surface the feed with the new weights.')
  return 0
}

process.exit(main())
