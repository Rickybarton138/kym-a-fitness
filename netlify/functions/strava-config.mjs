// Tells the client whether Strava is set up (and the public client id for the
// authorize link). Reads env at runtime, so setting the keys needs no rebuild.
export const handler = async () => {
  const id = process.env.STRAVA_CLIENT_ID || ''
  const secret = process.env.STRAVA_CLIENT_SECRET || ''
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ configured: !!(id && secret), clientId: id }),
  }
}
