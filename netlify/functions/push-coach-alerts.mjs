// Near-real-time: every 15 min, push coaches when an athlete self-reports a
// severe red flag (high soreness or a low readiness score). Each flag fires once.
import { runCoachAlerts } from './push-lib.mjs'

export const handler = async () => {
  const result = await runCoachAlerts()
  return { statusCode: 200, body: JSON.stringify(result) }
}

export const config = { schedule: '*/15 * * * *' }
