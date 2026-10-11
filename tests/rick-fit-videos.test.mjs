import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { getRickFitVideos } from '../src/rickFitVideos.js'

const collection = JSON.parse(readFileSync(new URL('../src/rickFitVideos.json', import.meta.url)))
test('All 20 exercises have two real, correctly hashed assets and posters', () => {
  assert.equal(collection.clips.length, 40)
  assert.equal(new Set(collection.clips.map(c => c.id)).size, 40)
  for (const name of new Set(collection.clips.map(c => c.exercise))) {
    const clips = getRickFitVideos({ name }, 'ricky')
    assert.deepEqual(clips.map(c => c.view).sort(), ['A', 'B'])
    for (const c of clips) {
      const file = new URL('../public' + c.src, import.meta.url)
      assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'), c.sha256)
      assert.ok(existsSync(new URL('../public' + c.poster, import.meta.url)))
    }
  }
})
test('Catalog aliases resolve, different variations and other brands do not', () => {
  for (const name of ['Back Squat (barbell)', 'Lat Pulldown (cable)', 'Dumbbell Curl', 'Plank']) assert.equal(getRickFitVideos({ name }, 'ricky').length, 2)
  for (const name of ['Front Squat (barbell)', 'Deadlift', 'Lying Leg Curl', 'Incline Barbell Press', 'Calf Raise', 'Triceps Pushdown (cable)']) assert.equal(getRickFitVideos({ name }, 'ricky').length, 0)
  assert.equal(getRickFitVideos({ name: 'Plank' }, 'kim').length, 0)
})
