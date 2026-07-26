// Filter dimensions for the programme library (Paul's round-2 ask): filter by
// location, equipment, audience and goal. Shared by the coach's create form and
// the client's filter bar so labels stay in sync. `goal` already existed on
// workout_programs; location/equipment/audience were added by migration.
export const PROGRAM_DIMS = [
  { key: 'location',  label: 'Location',  options: [['gym', 'Gym'], ['home', 'Home'], ['both', 'Home or gym']] },
  { key: 'equipment', label: 'Equipment', options: [['full', 'Full kit'], ['minimal', 'Minimal kit'], ['bodyweight', 'Bodyweight']] },
  { key: 'audience',  label: 'For',       options: [['all', 'Everyone'], ['women', 'Women'], ['men', 'Men']] },
  { key: 'goal',      label: 'Goal',      options: [['lose', 'Fat loss'], ['maintain', 'Maintain'], ['gain', 'Build muscle'], ['performance', 'Performance']] },
]

export function programTagLabel(key, val) {
  if (!val) return null
  const d = PROGRAM_DIMS.find((x) => x.key === key)
  const o = d && d.options.find(([v]) => v === val)
  return o ? o[1] : null
}

// A programme passes if, for every dimension, no filter is set OR the programme is
// unspecified for it OR it matches. (Unspecified programmes stay visible.)
export function programMatches(pr, filters) {
  return PROGRAM_DIMS.every((d) => {
    const f = filters[d.key]
    return !f || pr[d.key] == null || pr[d.key] === f
  })
}
