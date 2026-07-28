// Scheduled every 15 min: fire each client's custom coach-written reminders at
// (or just after) their set time, once per UK day.
import { runReminders } from './push-lib.mjs'

export const handler = async () => {
  const result = await runReminders()
  return { statusCode: 200, body: JSON.stringify(result) }
}

export const config = { schedule: '*/15 * * * *' }
