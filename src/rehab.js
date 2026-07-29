// Injury / rehab / return-to-play domain model (PPH performance layer). Gated
// behind THEME.features.rehab.

export const BODY_REGIONS = ['Head / Neck', 'Shoulder', 'Elbow', 'Wrist / Hand', 'Chest', 'Upper back', 'Lower back', 'Hip / Groin', 'Hamstring', 'Quad', 'Knee', 'Calf', 'Ankle', 'Foot', 'Other']
export const SIDES = ['Left', 'Right', 'N/A']
export const TISSUES = ['Muscle', 'Tendon', 'Ligament', 'Bone', 'Joint', 'Nerve', 'Other']
export const SEVERITIES = ['Minor', 'Moderate', 'Severe']

export const INJURY_STATUS = [
  { key: 'active', label: 'Active' },
  { key: 'rehab', label: 'In rehab' },
  { key: 'rtp', label: 'Return-to-play' },
  { key: 'resolved', label: 'Resolved' },
]
export const AVAILABILITY = [
  { key: 'full', label: 'Full', color: 'green' },
  { key: 'modified', label: 'Modified', color: 'amber' },
  { key: 'unavailable', label: 'Unavailable', color: 'red' },
]
export const NOTE_TYPES = [
  { key: 'assessment', label: 'Assessment' },
  { key: 'treatment', label: 'Treatment' },
  { key: 'progress', label: 'Progress' },
  { key: 'clearance', label: 'Clearance' },
]

// Graded 5-stage return-to-play ladder (stage 0 = not started).
export const RTP_LADDER = [
  'Rest & protect',
  'Restore range of motion',
  'Rebuild strength & load',
  'Sport-specific / return to train',
  'Return to play',
]

export const statusLabel = (k) => (INJURY_STATUS.find((s) => s.key === k) || {}).label || k
export const availabilityOf = (k) => AVAILABILITY.find((a) => a.key === k) || AVAILABILITY[2]
export const noteTypeLabel = (k) => (NOTE_TYPES.find((n) => n.key === k) || {}).label || k
