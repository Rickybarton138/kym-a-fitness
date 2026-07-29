// Scheduled daily (~19:00 UK): send opted-in coaches a one-line summary of their
// clients' activity over the last 24h.
import { runCoachDigest } from './push-lib.mjs'

export const handler = async () => {
  const result = await runCoachDigest()
  return { statusCode: 200, body: JSON.stringify(result) }
}

export const config = { schedule: '0 18 * * *' }
