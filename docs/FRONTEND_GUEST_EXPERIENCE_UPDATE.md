# Gastora Guest Experience Frontend Update

## Scope
Frontend-only design update. No backend services, AI APIs, staff messaging, or booking logic were added or changed.

## Updated
- `src/features/guests/GuestLandingPage.tsx`
  - Reworked room, facilities, and events content into editorial image-and-description layouts.
  - Reduced the number of simultaneously displayed image cards to avoid a generic gallery feel.
  - Preserved the existing booking search route (`/book`) and guest portal route (`/stay/:token`).
  - Preserved the existing hero slideshow behavior and reduced-motion preference handling.
- `src/features/guests/ConciergeChatWidget.tsx`
  - Added a responsive floating guest concierge chat.
  - Includes suggested questions, mock replies, typing feedback, and a simulated staff handoff.
  - Clearly labels the assistant as demo mode; no real AI or live-agent messages are sent.

## Validation
- TypeScript/TSX transpilation syntax checks passed for both changed files.
- Full project type-check, lint, production build, and browser testing were not run in this environment.
- The repository's existing phase reports already document an environment limitation with the Vite/Rolldown optional native binding; rerun `npm install`, `npm run build`, and targeted lint on a developer machine before merging.
