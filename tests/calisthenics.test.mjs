import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SKILLS, SESSIONS, SKILL_BY_KEY, STEP_NAMES, ADAPTATIONS,
  ladderFor, stepIndex, stepFor, nextStep, buildSession, laddersForPrompt,
} from '../src/calisthenics.js'

// No globals stubbed on purpose: calisthenics.js imports nothing, because a
// Netlify function reads it too. If this file ever needs a window, that rule
// has been broken.

test('every ladder is ordered, complete and ends somewhere', () => {
  assert.equal(SKILLS.length, 6)
  for (const skill of SKILLS) {
    assert.ok(skill.steps.length >= 5, `${skill.key} is too short to be a ladder`)
    skill.steps.forEach((s, i) => {
      assert.ok(s.name && s.cue && s.reps && s.sets, `${skill.key} step ${i} is missing a field`)
      // Every step but the last says what earns the next one; the last says nothing.
      if (i < skill.steps.length - 1) assert.ok(s.unlock, `${skill.key} step ${i} has no unlock`)
      else assert.equal(s.unlock, null, `${skill.key} last step should not have an unlock`)
    })
  }
})

test('step names are unique across the whole system', () => {
  const all = SKILLS.flatMap((s) => s.steps.map((st) => st.name))
  assert.equal(new Set(all).size, all.length, 'two ladders share a step name')
  assert.ok(STEP_NAMES.length >= all.length)
})

test('a missing, absent or nonsense position reads as the first step', () => {
  assert.equal(stepFor({}, 'pull').index, 0)
  assert.equal(stepFor(null, 'pull').index, 0)
  assert.equal(stepFor({ pull: 'banana' }, 'pull').index, 0)
  assert.equal(stepFor({ pull: -4 }, 'pull').index, 0)
})

test('a position past the end of a shortened ladder clamps to the top', () => {
  const top = SKILL_BY_KEY.pull.steps.length - 1
  const cur = stepFor({ pull: 99 }, 'pull')
  assert.equal(cur.index, top)
  assert.equal(cur.last, true)
  assert.equal(nextStep({ pull: 99 }, 'pull'), null)
  assert.equal(stepIndex('pull', 99), top)
})

test('an unknown skill key does not throw', () => {
  assert.equal(stepFor({}, 'levitation'), null)
  assert.equal(nextStep({}, 'levitation'), null)
  assert.equal(stepIndex('levitation', 3), 0)
})

test('a session is built from where the client actually is', () => {
  const beginner = buildSession('upper', {})
  const stronger = buildSession('upper', { pull: 5, push: 3, dip: 2, core: 6 })
  assert.equal(beginner.exercises[0].name, 'Dead Hang')
  assert.equal(stronger.exercises[0].name, 'Pull-up (full)')
  assert.equal(stronger.exercises[1].name, 'Archer Press-up')
  // Same session, same shape — only the movements move.
  assert.equal(beginner.exercises.length, stronger.exercises.length)
  assert.equal(beginner.title, stronger.title)
})

test('every session is runnable by the guided player', () => {
  for (const s of SESSIONS) {
    const built = buildSession(s.key, {})
    assert.equal(built.title, s.title)
    assert.ok(built.exercises.length >= 4, `${s.key} is too thin`)
    for (const ex of built.exercises) {
      assert.ok(ex.name && ex.cue && ex.equipment, `${s.key} produced an incomplete exercise`)
      assert.equal(typeof ex.sets, 'number')
      assert.equal(typeof ex.reps, 'string')
    }
    assert.ok(built.finisher === null || typeof built.finisher === 'string')
  }
})

test('a slot can cap the sets without touching the ladder', () => {
  // The skills session deliberately takes pull at 3 sets, not the ladder's 4.
  const built = buildSession('skills', { pull: 5 })
  const pull = built.exercises.find((e) => e.name === 'Pull-up (full)')
  assert.equal(pull.sets, 3)
  assert.equal(SKILL_BY_KEY.pull.steps[5].sets, 4)
})

test('an unknown session key returns null rather than half a workout', () => {
  assert.equal(buildSession('nonsense', {}), null)
})

test('the prompt block names every ladder and every step', () => {
  const text = laddersForPrompt()
  for (const skill of SKILLS) {
    assert.ok(text.includes(skill.goal), `${skill.key} goal missing from the prompt`)
    for (const step of skill.steps) assert.ok(text.includes(step.name), `${step.name} missing from the prompt`)
  }
})

// --- Adaptations -----------------------------------------------------------
// Ricky, 21 Sept: "can we modify mine to account for bad knees and wrist."

const KNEES = { knees: true }
const WRISTS = { wrists: true }
const BOTH = { knees: true, wrists: true }

test('every adapted ladder is as complete as a default one', () => {
  for (const a of ADAPTATIONS) {
    const on = { [a.key]: true }
    for (const skill of SKILLS) {
      const ladder = ladderFor(skill.key, on)
      assert.ok(ladder.steps.length >= 5, `${skill.key} under ${a.key} is too short`)
      ladder.steps.forEach((st, i) => {
        assert.ok(st.name && st.cue && st.reps && st.sets, `${skill.key}/${a.key} step ${i} incomplete`)
        if (i < ladder.steps.length - 1) assert.ok(st.unlock, `${skill.key}/${a.key} step ${i} has no unlock`)
        else assert.equal(st.unlock, null)
      })
    }
  }
})

test('bad knees removes deep knee bending and ends somewhere real', () => {
  const ladder = ladderFor('legs', KNEES)
  const names = ladder.steps.map((s) => s.name).join(' | ')
  assert.match(ladder.goal, /box squat/i)
  assert.ok(!/pistol|skater|bulgarian/i.test(names), 'a deep knee-bend survived: ' + names)
  assert.match(names, /Glute Bridge/)
})

test('bad wrists takes bodyweight off the flat palm, everywhere it was', () => {
  // Press-ups, dips, the L-sit and the handstand all loaded an extended wrist.
  assert.match(ladderFor('handstand', WRISTS).goal, /forearm/i)
  assert.ok(!ladderFor('dip', WRISTS).steps.some((s) => /Bench Dip/.test(s.name)), 'the bench dip survived')
  assert.ok(ladderFor('push', WRISTS).steps.every((s) => /Handles|Fist|Ring/.test(s.name)), 'a flat-palm press-up survived')
  assert.ok(ladderFor('core', WRISTS).steps.every((s) => !/^L-sit$|^Tuck L-sit$|^Front Plank$/.test(s.name)), 'a floor L-sit or palm plank survived')
})

test('a skill nothing threatens is left alone', () => {
  // Hanging is wrist-neutral and bends no knee, so the pull ladder is untouched.
  assert.equal(ladderFor('pull', BOTH), SKILL_BY_KEY.pull)
  assert.equal(stepFor({ pull: 5 }, 'pull', BOTH).adaptedFor, null)
})

test('adapting keeps your step number rather than starting you again', () => {
  assert.equal(stepFor({ push: 3 }, 'push', {}).index, 3)
  assert.equal(stepFor({ push: 3 }, 'push', WRISTS).index, 3)
  assert.equal(stepFor({ push: 3 }, 'push', WRISTS).adaptedFor, 'wrists')
  // A shorter adapted ladder clamps instead of rendering nothing.
  const deep = stepFor({ push: 7 }, 'push', WRISTS)
  assert.equal(deep.index, ladderFor('push', WRISTS).steps.length - 1)
  assert.equal(deep.last, true)
})

test('sessions are built from the adapted ladders, accessories included', () => {
  const lower = buildSession('lower', {}, KNEES).exercises.map((e) => e.name)
  assert.ok(lower.includes('Glute Bridge'), lower.join(' | '))
  assert.ok(!lower.some((n) => /Nordic/.test(n)), 'the Nordic survived a bad knee')
  assert.ok(lower.includes('Hamstring Bridge Walkout'))

  const skills = buildSession('skills', {}, WRISTS).exercises.map((e) => e.name)
  assert.ok(skills.includes('Wrist Prep (pain-free range)'), skills.join(' | '))
  assert.ok(skills.some((n) => /Forearm/.test(n)))

  // And with both on, nothing in any session is a known offender.
  for (const s of SESSIONS) {
    const names = buildSession(s.key, { pull: 9, push: 9, dip: 9, legs: 9, core: 9, handstand: 9 }, BOTH)
      .exercises.map((e) => e.name).join(' | ')
    assert.ok(!/Pistol|Handstand Press-up|Bench Dip|Freestanding Handstand/.test(names), `${s.key}: ${names}`)
  }
})

test('the prompt hands over the adapted ladders and the rule behind them', () => {
  const plain = laddersForPrompt()
  const adapted = laddersForPrompt(BOTH)
  assert.match(plain, /Pistol Squat/)
  assert.ok(!/Pistol Squat/.test(adapted), 'the prompt still offers pistols')
  assert.match(adapted, /HARD CONSTRAINTS/)
  assert.match(adapted, /Bad knees/)
  assert.match(adapted, /Bad wrists/)
  assert.match(adapted, /Freestanding Forearm Stand/)
})

test('the dropdown offers the adapted movements too', () => {
  for (const n of ['Glute Bridge', 'Fist Press-up', 'Chest-to-Wall Forearm Stand', 'Single-leg Box Squat (high box)']) {
    assert.ok(STEP_NAMES.includes(n), n + ' is missing from the catalogue')
  }
})
