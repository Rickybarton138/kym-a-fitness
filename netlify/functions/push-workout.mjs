// Scheduled: evening workout nudge (~6pm UK) — only if they haven't trained today.
import { runNudges } from './push-lib.mjs'

export const handler = async () => {
  const result = await runNudges('workout')
  return { statusCode: 200, body: JSON.stringify(result) }
}

// 17:00 UTC = 18:00 UK during BST (summer). Winter (GMT) fires at 17:00 UK.
export const config = { schedule: '0 17 * * *' }
