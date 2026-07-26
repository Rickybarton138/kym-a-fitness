// Check-in form builder: field types, Paul's default template, and answer
// formatting. Each field carries an immutable id (never derived from the label)
// so responses keep their meaning even after the coach edits the form; each
// response snapshots the fields it was answered against.

export const FIELD_TYPES = [
  { type: 'scale10', label: 'Score 1–10' },
  { type: 'overunder', label: 'Over / on / under' },
  { type: 'number', label: 'Number' },
  { type: 'yesno', label: 'Yes / no' },
  { type: 'text', label: 'Free text' },
]

export const newField = (type = 'scale10', label = '') => ({ id: crypto.randomUUID(), type, label })

// Paul's exact 14-field weekly check-in (from his round-2 feedback).
export function paulTemplate() {
  const f = (type, label) => ({ id: crypto.randomUUID(), type, label })
  return [
    f('overunder', 'Did you hit your calorie target?'),
    f('number', 'Average daily steps'),
    f('overunder', 'Did you hit your protein target?'),
    f('yesno', 'Did you drink 2–3 litres of fluid most days?'),
    f('number', 'How many training sessions did you complete?'),
    f('scale10', 'Strength (1 weak – 10 very strong)'),
    f('scale10', 'Energy & recovery (1 low – 10 great)'),
    f('scale10', 'Appetite (1 none – 10 starving)'),
    f('scale10', 'Sleep (1 poor – 10 great)'),
    f('scale10', 'Stress (1 none – 10 very high)'),
    f('text', 'Challenges this week (programme + life)'),
    f('text', 'Wins this week (programme + life)'),
    f('scale10', 'Confidence to stay on track next week (1 – 10)'),
    f('text', 'Any events coming up next week we should know about?'),
  ]
}

// Read-back of a stored answer for the coach and the client's history.
export function formatAnswer(field, val) {
  if (val === undefined || val === null || val === '') return '—'
  switch (field.type) {
    case 'overunder': return { over: 'Over', on: 'On track', under: 'Under' }[val] || String(val)
    case 'yesno': return val ? 'Yes' : 'No'
    case 'scale10': return val + ' / 10'
    default: return String(val)
  }
}
