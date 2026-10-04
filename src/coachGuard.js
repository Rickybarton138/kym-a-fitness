// Request tickets, so an older in-flight answer cannot overwrite a newer one.
//
// Its own module because it is the one piece of coachClient worth testing on its
// own, and coachClient imports supabaseClient, which needs Vite's
// import.meta.env and so cannot be loaded from a plain node test.
//
// The race it exists for is real and routine here: the Today card refreshes on
// every confirmed save and every time the app comes back to the foreground, so
// two requests are often in flight, and the slower one is frequently the older.

export function createGuard() {
  let issued = 0
  let newest = 0
  return {
    begin() { issued += 1; newest = issued; return issued },
    isCurrent(ticket) { return ticket === newest },
  }
}
