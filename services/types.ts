// Shared shapes for every service. A real API client and the in-browser mocks both follow these.

/** The staff member doing something. The backend will take this from the session, not trust the browser. */
export type Actor = { id: string; name: string }

/** Called when a service's data changes, so screens can reload. */
export type Unsubscribe = () => void
