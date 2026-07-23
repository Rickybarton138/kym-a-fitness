// Scheduled: morning food-logging nudge (~8am UK).
import { runNudges } from './push-lib.mjs'

export const handler = async () => {
  const result = await runNudges('food')
  return { statusCode: 200, body: JSON.stringify(result) }
}

// 07:00 UTC = 08:00 UK during BST (summer). Winter (GMT) fires at 07:00 UK.
export const config = { schedule: '0 7 * * *' }
