// Scheduled every 3 hours: pull new VALD ForceDecks + SmartSpeed results for every
// connected coach. No-ops until a coach connects (vald_integrations_due is empty).
import { runValdSync } from './vald-lib.mjs'

export const handler = async () => {
  const result = await runValdSync()
  return { statusCode: 200, body: JSON.stringify(result) }
}

export const config = { schedule: '0 */3 * * *' }
