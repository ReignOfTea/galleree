#!/usr/bin/env node
// Validates public/gallery/meta JSON files against schemas/*.schema.json

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const metaRoot = path.join(root, 'public', 'gallery', 'meta')
const schemasDir = path.join(root, 'schemas')

const IMAGE_ID_RE = /^[a-f0-9]{32}\.json$/i

const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)

function loadValidator(name) {
  const file = path.join(schemasDir, name)
  const schema = JSON.parse(fs.readFileSync(file, 'utf8'))
  return ajv.compile(schema)
}

const validators = {
  image: loadValidator('gallery-image-meta.schema.json'),
  collection: loadValidator('gallery-collection-meta.schema.json'),
  equipment: loadValidator('gallery-equipment-meta.schema.json'),
}

function jsonFiles(dir) {
  if (!fs.existsSync(dir)) return []
  const out = []
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name)
    if (ent.isDirectory()) out.push(...jsonFiles(full))
    else if (ent.isFile() && ent.name.endsWith('.json')) out.push(full)
  }
  return out
}

function pickValidator(file) {
  const rel = path.relative(metaRoot, file).replace(/\\/g, '/')
  if (rel.startsWith('collections/')) return validators.collection
  if (rel.startsWith('cameras/') || rel.startsWith('lenses/')) {
    return validators.equipment
  }
  if (IMAGE_ID_RE.test(path.basename(rel))) return validators.image
  return null
}

function main() {
  if (!fs.existsSync(metaRoot)) {
    console.log('[validate-gallery-meta] No meta folder — ok.')
    return
  }

  const files = jsonFiles(metaRoot)
  let failed = 0

  for (const file of files) {
    const validate = pickValidator(file)
    if (!validate) continue

    let data
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf8'))
    } catch (e) {
      failed += 1
      console.error(`[validate-gallery-meta] ${file}: invalid JSON — ${e.message}`)
      continue
    }

    if (!validate(data)) {
      failed += 1
      const rel = path.relative(root, file)
      console.error(`[validate-gallery-meta] ${rel}:`)
      for (const err of validate.errors ?? []) {
        console.error(`  - ${err.instancePath || '/'} ${err.message}`)
      }
    }
  }

  if (failed > 0) {
    console.error(`[validate-gallery-meta] ${failed} file(s) failed validation.`)
    process.exit(1)
  }

  console.log(`[validate-gallery-meta] OK (${files.length} JSON file(s) checked).`)
}

main()
