// Hourly: send each athlete their daily reminder at the time they chose.
import { runDailyReminders } from './push-lib.mjs'

export const handler = async () => {
  const result = await runDailyReminders()
  return { statusCode: 200, body: JSON.stringify(result) }
}

export const config = { schedule: '0 * * * *' }
