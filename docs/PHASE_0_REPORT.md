# Gastora POS Sync — Phase 0 Report

## Scope completed
- Changed the POS navigation label for `/pos` from **Tables** to **Menus** in `src/lib/nav.ts`.
- Changed the `/pos` section dropdown option to **Menus · New order**.
- Changed the `/pos` page title to **Menus & new order**.
- Route paths and actual table-management functionality were not intentionally changed.

## Files edited
- `src/lib/nav.ts` — renamed only the POS navigation label for `/pos`.
- `src/features/pos/PosPage.tsx` — changed the `/pos` title and matching dropdown label.

## Stale duplicate source tree at repository root
The archive contains root-level duplicates alongside the live `src/` tree:
- `App.tsx`
- `router.tsx`
- `components/`
- `features/`
- `lib/`
- `hooks/`

Per the project instructions, these root copies were not edited. Consider removing them in a separate, agreed PR after confirming no tooling or team workflow depends on them.

## Build and lint
- `npm run build`: could not complete in this environment; shell returned `vite: Permission denied`.
- `npm run lint`: could not complete in this environment; shell returned `eslint: Permission denied`.
- These are execution-permission/environment failures, not a successful quality-gate result. Please rerun both commands in a normal development environment.

## Assumptions and team questions
- No business-rule assumptions were introduced in this phase.
- Confirm the team approves the eventual removal of the stale root-level duplicate source tree.
- Review this rename before proceeding to Phase 1, as required by the delivery plan.

## Manual smoke test
1. Start the app using the repository's normal development command.
2. Open the POS module and navigate to `/pos`.
3. Confirm the navigation item reads **Menus**.
4. Confirm the POS section dropdown option reads **Menus · New order**.
5. Confirm the page title reads **Menus & new order**.
6. Open `/pos/tables`; verify table management, occupancy, and table selection behave as before.
