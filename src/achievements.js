// The award catalogue. The maths that decides who has earned what lives in the
// database (sync_achievements) so it runs off the same rows as the rest of the
// app and cannot be faked from the browser; this file is only how they read.
//
// Everything here rewards EFFORT AND CONSISTENCY. Nothing rewards body weight
// or a measurement moving a particular way — the app already flags clients who
// have struggled with disordered eating, and "well done for losing 5kg" is the
// last thing that should appear on their phone. Showing up is the thing a
// client controls, so showing up is what gets celebrated.
//
// No emoji: they render as tofu boxes in Ricky's fonts. Badges are short text.

export const AWARD_GROUPS = [
  { id: 'sessions', label: 'Sessions' },
  { id: 'streak', label: 'Consistency' },
  { id: 'lifting', label: 'Lifting' },
  { id: 'habits', label: 'Daily habits' },
  { id: 'progress', label: 'Progress' },
]

export const ACHIEVEMENTS = [
  { key: 'session_first', group: 'sessions', glyph: '1', title: 'First session', blurb: 'You started. That is the hard bit.' },
  { key: 'sessions_5', group: 'sessions', glyph: '5', title: 'Five sessions', blurb: 'Five done. This is becoming a habit.' },
  { key: 'sessions_10', group: 'sessions', glyph: '10', title: 'Ten sessions', blurb: 'Double figures.' },
  { key: 'sessions_25', group: 'sessions', glyph: '25', title: 'Twenty-five sessions', blurb: 'Properly consistent now.' },
  { key: 'sessions_50', group: 'sessions', glyph: '50', title: 'Fifty sessions', blurb: 'Fifty. That is a lot of showing up.' },
  { key: 'sessions_100', group: 'sessions', glyph: '100', title: 'One hundred sessions', blurb: 'A hundred sessions in the bank.' },

  { key: 'weeks_2', group: 'streak', glyph: '2w', title: 'Two weeks running', blurb: 'Two weeks in a row without missing.' },
  { key: 'weeks_4', group: 'streak', glyph: '4w', title: 'A month unbroken', blurb: 'Four weeks in a row. The chain is going.' },
  { key: 'weeks_8', group: 'streak', glyph: '8w', title: 'Eight weeks running', blurb: 'Two months without breaking the chain.' },
  { key: 'weeks_12', group: 'streak', glyph: '12w', title: 'Twelve weeks running', blurb: 'A full block, start to finish.' },
  { key: 'weeks_26', group: 'streak', glyph: '26w', title: 'Half a year running', blurb: 'Twenty-six weeks. This is just who you are now.' },

  { key: 'pb_first', group: 'lifting', glyph: 'PB', title: 'First personal best', blurb: 'You beat your own number.' },
  { key: 'pb_5', group: 'lifting', glyph: 'PB5', title: 'Five personal bests', blurb: 'Five times stronger than you were.' },
  { key: 'pb_10', group: 'lifting', glyph: 'PB10', title: 'Ten personal bests', blurb: 'Ten PBs. The work is showing.' },
  { key: 'pb_25', group: 'lifting', glyph: 'PB25', title: 'Twenty-five personal bests', blurb: 'Twenty-five. Relentless.' },

  { key: 'food_7d', group: 'habits', glyph: '7d', title: 'A week of food logged', blurb: 'Seven days straight of tracking.' },
  { key: 'food_30d', group: 'habits', glyph: '30d', title: 'A month of food logged', blurb: 'Thirty days straight. Serious consistency.' },
  { key: 'steps_7d', group: 'habits', glyph: '7', title: 'Seven step days', blurb: 'Seven days you hit your step target.' },
  { key: 'steps_30d', group: 'habits', glyph: '30', title: 'Thirty step days', blurb: 'Thirty days on target.' },

  { key: 'photo_first', group: 'progress', glyph: 'P', title: 'First progress photo', blurb: 'Your before shot is on the board.' },
  { key: 'measure_first', group: 'progress', glyph: 'M', title: 'First measurements', blurb: 'Numbers down, so you can see them move.' },
]

export const BY_KEY = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.key, a]))

// The next one to aim for in each group — what is shown greyed out beside the
// earned ones, so there is always something just ahead.
export function nextUp(earnedKeys) {
  const have = new Set(earnedKeys || [])
  const out = []
  for (const g of AWARD_GROUPS) {
    const next = ACHIEVEMENTS.find((a) => a.group === g.id && !have.has(a.key))
    if (next) out.push(next)
  }
  return out
}
