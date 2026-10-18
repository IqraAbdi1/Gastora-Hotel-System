# Gastora Hotel System — Phase 2 Report

## Summary

Implemented the first Recipe & Inventory Mapping phase slice. The live application source is under `src/`; the stale root-level duplicate tree has not been changed for this phase.

- Added illustrative food and beverage stock in UGX, including perishables and reorder/par levels.
- Added Kitchen and Bar stores, Food/Beverage categories, a Bar department and Bar budget line.
- Added a non-destructive startup migration that appends missing F&B seed stock, Kitchen/Bar stores and the Bar budget line without resetting existing inventory rows.
- Added starter recipes for all 12 seeded POS menu products, including 1:1 mappings for packaged soda, water and beer.
- Added compatible unit conversion for mass (kg/g), volume (l/ml) and count units (piece/each/bottle/cup), with incompatible units rejected.
- Added yield-aware portion availability and stock deduction quantity calculation, recipe validation, recipe cost, margin and food-cost display.
- Added automatic sold-out (86) disablement when a mapped recipe has no available portions, plus low-ingredient warnings and a Request restock action that uses the existing `topUp()` flow.
- Added a recipe mapping health panel and “Used in recipes” information to the inventory item panel.
- Removed the legacy `Product.stock` field from the POS product type and seed products.

## Files created

- `PHASE_2_REPORT.md`

## Files edited

- `src/features/procurement/requestsModel.ts` — seed F&B stock, store list, stock categories, departments and budget line.
- `src/features/procurement/RequestsProvider.tsx` — non-destructive seed migration.
- `src/features/pos/posTypes.ts` — explicit stock tracking flag and recipe fields.
- `src/features/pos/posDomain.ts` — compatible count units for conversion/costing.
- `src/features/pos/PosPage.tsx` — starter recipes, conversion-aware availability/deductions, costing and mapping health UI.
- `src/features/inventory/ItemPanel.tsx` — display menu products using this stock item.

Shared files touched: `RequestsProvider.tsx`, `requestsModel.ts`, `posTypes.ts`, `posDomain.ts`, `PosPage.tsx`, and `ItemPanel.tsx`. These are shared by inventory, procurement and POS flows; changes are limited to the F&B seed/mapping additions and their display/validation.

## Data-shape and migration notes

- Existing localStorage keys and saved shapes are retained.
- Existing stock records are not overwritten. New seed rows are appended only when both their ID and normalized name are absent.
- New fields are optional.
- Recipe mappings continue to use `gastora.pos.recipes.v1`.
- `Product.stock` was removed from the shared POS type as required by B6; the current live POS source no longer reads it.

## Manual test script

1. Start with a fresh localStorage profile and open Inventory → Stock. Expected: food and beverage ingredients appear alongside the original hotel supplies; Kitchen and Bar stores are available.
2. Open POS → Menus. Expected: all 12 seeded menu products are present; packaged soda, water and beer each map to one bottle.
3. Open POS → Recipe & Inventory Mapping and select Beef burger. Expected: recipe ingredients, cost per portion, margin, and food-cost percentage display.
4. Change an ingredient unit between kg and g or l and ml. Expected: conversion is accepted and available portions remain sensible; incompatible unit families are rejected.
5. Set an ingredient quantity to zero or add the same stock item twice. Expected: recipe validation blocks saving.
6. Reduce a recipe ingredient's stock to zero. Expected: that menu product shows “Sold out (86)” and cannot be added to the order.
7. Reduce an ingredient to/below its reorder level and use Request restock. Expected: the existing top-up request flow is called; permission restrictions may reject the action for users without stock-management rights.
8. Open an inventory item's detail panel. Expected: “Used in recipes” lists mapped POS product IDs.
9. With existing stock data in localStorage, reload the app. Expected: missing F&B seed stock/store/budget entries are appended without resetting existing stock quantities.
10. Verify actual stock movements after checkout before using this build operationally. Full POS/KDS deduction timing, FEFO integration, per-line idempotency and stock reservations are Phase 3 scope, not completed in this phase.

## Build and lint results

- `npx tsc -b`: **passed**.
- `npm run build`: TypeScript passed, but Vite build could not run because the environment is missing the optional native Rolldown binding (`@rolldown/binding-linux-x64-gnu` / WASI fallback). This is an environment/dependency installation issue; rerun after a clean `npm install` on the target machine.
- `npm run lint`: **failed on existing repository-wide issues**, including hook rule violations in front desk and inventory files, `Date.now()` purity warnings in POS/KDS, and ref access in `useBrowserSyncedState`. No clean lint result is claimed.

## Assumptions and open questions

- **ASSUMPTION:** sample ingredient quantities, stock levels and costs are illustrative UGX values; the hotel must replace them with supplier/recipe data before production use.
- **ASSUMPTION:** food-cost warning threshold is 35%; confirm the hotel's preferred threshold.
- **ASSUMPTION:** yield percentage is the edible/prepared yield; gross stock usage is calculated as recipe quantity divided by yield, plus optional waste percentage.
- **ASSUMPTION:** unit costs are expressed per stock unit (for example UGX per g, kg, bottle or piece). Confirm whether the hotel wants costs stored per purchase unit instead.
- Existing inventory screens in this snapshot do not expose a stock delete/archive action in the item panel. The panel now identifies recipe usage and documents the rule; if a deletion/archive path is introduced, it must block changes until recipes are remapped.
- Full restock-to-procurement verification, received-cost updates, store-specific FEFO deduction and live sold-out refresh across all surfaces remain to be completed in later phases.

## Duplicate root source tree

The repository contains stale root-level copies of files also present under `src/` (including `App.tsx`, `router.tsx`, `components/`, `features/`, `lib/`, `hooks/`, and `types/`). They were not intentionally edited in Phase 2. Recommend removing them only in a separate, agreed cleanup PR after the team confirms `src/` is the sole live source tree.
