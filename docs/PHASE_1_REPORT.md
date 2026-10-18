# Gastora Hotel System — Phase 1 Foundations Report

## Summary

This increment establishes shared POS/KDS domain foundations while preserving existing browser-storage keys and existing UI behavior:

- Added `src/features/pos/posTypes.ts` as the shared source for POS/KDS product, sale, order, line and recipe types. Legacy `Product.stock` remains for compatibility until the inventory-mapping phase.
- Updated POS and Kitchen Display to import the shared types rather than maintain duplicate Product/HeldOrder declarations.
- Added `src/features/pos/posStore.ts` with stable legacy key constants and a non-destructive migration helper. Existing keys and saved object shapes are not renamed or cleared.
- Added `src/features/pos/posDomain.ts` with pure functions for compatible unit conversion, recipe costing, portion availability, recipe validation, deduction planning and timestamped order-status transitions.
- New order lifecycle fields are optional so legacy records remain readable. Existing kitchen actions and order removal behavior are not changed in this foundations increment.

## Files created

- `src/features/pos/posTypes.ts`
- `src/features/pos/posStore.ts`
- `src/features/pos/posDomain.ts`
- `PHASE_1_REPORT.md`

## Shared files edited

- `src/features/pos/PosPage.tsx` — imports the shared POS types; current UI and behavior otherwise left in place.
- `src/features/pos/KitchenDisplayPage.tsx` — imports the shared order and product types; current UI and behavior otherwise left in place.

## Storage / migration notes

- Existing keys remain unchanged: `gastora.pos.products.v1`, `gastora.pos.heldOrders.v1`, `gastora.pos.tables.v1`, `gastora.pos.sales.v1`, and `gastora.pos.recipes.v1`.
- `migrateHeldOrders` adds a default `status` to valid legacy orders in the migrated value and preserves all existing fields. The helper is not automatically run against persisted storage yet, avoiding an unreviewed write during this foundation-only increment.
- No existing localStorage values are deleted or rewritten by this phase.

## Manual test script

1. Run `npm install` in the project directory, then `npm run build` and `npm run lint`.
2. Start with `npm run dev` and open the POS. Confirm the existing menu, orders, table management, menu management, recipes and payments screens still render.
3. Create a test order and send it to the kitchen. Open Kitchen Display in another tab on the same origin and confirm the ticket appears.
4. Confirm the existing `gastora.pos.*` localStorage keys remain present and the table list is unchanged.
5. Review `posDomain.ts` functions against these expected results: 1 kg converts to 1000 g; converting kg to ml throws an incompatible-unit error; recipe cost equals the sum of ingredient quantity × unit cost adjusted for yield; available portions equal the minimum whole portions across ingredients; duplicate/missing recipe stock IDs produce validation errors; deduction references are stable as `orderId:lineId`.
6. Reload the page and confirm existing products, sales, recipes, held orders and tables still load.

## Validation results in this build environment

- `node node_modules/typescript/bin/tsc -b`: **passed**.
- `npm run build`: could not launch the Vite executable (`vite: Permission denied`). Running Vite directly with Node then failed because the installed `rolldown` native optional binding is missing from this environment.
- Targeted ESLint: **failed on two existing React purity errors** involving `Date.now()` in `PosPage.tsx` and `KitchenDisplayPage.tsx`. No lint errors were reported in the newly added domain/type/store files.

These environment failures must be rechecked after a clean `npm install` on the developer machine.

## Scope boundary / review items

- The full `PosPage.tsx` screen split from H1 is not complete in this increment; it is intentionally not attempted without a focused review because the page is large and the team's working rules say not to refactor teammate-owned POS/KDS files without agreement.
- KDS still removes a ticket when marked served. Lifecycle timestamps and historical order retention are foundations only; the behavior change belongs in the POS/KDS synchronization phase.
- `posStore.ts` provides the migration seam but is not yet wired to an automatic migration. Confirm the team's preferred migration timing before enabling writes.
- No dependencies were added.
