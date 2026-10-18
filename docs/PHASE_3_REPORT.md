# Gastora Hotel System — Phase 3 Report

## Scope delivered

Phase 3 implements the POS/Kitchen Display shared lifecycle using the project's existing browser-storage synchronization pattern.

- **Shared order record:** POS and KDS both read and update `gastora.pos.heldOrders.v1`. Status changes are written to the same order record, so tabs on the same browser origin can see them.
- **Lifecycle statuses:** `New`, `Preparing`, `Ready`, `Served`, `Cancelled`, and `Draft` (used when an order is resumed in POS for editing). Legacy orders without `status` remain readable through `kitchenStatus` fallback.
- **History:** lifecycle events are retained in `gastora.pos.orderHistory.v1`. New tickets, preparation/status transitions, POS cancellations, KDS cancellations, resuming for editing, and completion from checkout append history events. Served/cancelled tickets remain in the order data and can be viewed from the KDS history toggle instead of being deleted.
- **Cancellation handling:** POS cancellation and KDS cancellation update the status and keep the order for audit/history. Kitchen cancellation controls are available for New/Preparing tickets. Resuming a ticket marks it Draft rather than silently deleting it from the queue.
- **Idempotent stock movement references:** inventory issues now use `POS sale <sale-id> line <line-reference>` movement reasons. Replays of an already-recorded line reference are skipped, while previously unrecorded lines can be processed on retry. Legacy sale-level movement references are detected and blocked from accidental repeat deduction.
- **Stock aggregation:** inventory quantities are validated in aggregate per stock item before deduction, and `takeStock` receives one aggregate quantity per stock item to avoid under-deducting when multiple order lines consume the same ingredient. Movement records remain separately identifiable per order-line/ingredient reference.
- **Stockless menu items:** items explicitly configured with `trackStock: false` can complete checkout without an empty stock request being treated as an error.

## Files changed in Phase 3

- `src/features/pos/PosPage.tsx`
- `src/features/pos/KitchenDisplayPage.tsx`
- `src/features/pos/posTypes.ts`
- `src/features/pos/posDomain.ts`
- `src/features/procurement/RequestsProvider.tsx`
- `src/features/procurement/requestsContext.ts`

## Test report

### Automated checks run

| Check | Result | Details |
|---|---|---|
| `npx tsc -b` | **PASS** | TypeScript project build/type-check completed successfully. |
| Targeted ESLint on the six Phase 3 files | **PASS** | No lint errors in the changed Phase 3 source files. |
| Pure-domain smoke checks using Node's TypeScript type stripping | **PASS** | Verified stable per-line deduction-plan references, exclusion of already-deducted lines, kg-to-g conversion, lifecycle transition to Cancelled, and legacy-order migration defaulting to New. |
| `npm run build` | **BLOCKED by environment** | TypeScript passes, but Vite/Rolldown cannot load optional native binding `@rolldown/binding-linux-x64-gnu` (WASI fallback is also absent). This is a dependency-install/runtime issue; a production bundle was not generated. |
| `npm run lint` (whole repository) | **FAIL — existing repository-wide issues** | ESLint reports 13 errors across both the stale root-level duplicate tree and `src/`, including hook calls in callbacks, ref access during render, and old `Date.now()` purity issues in root-level duplicate POS/KDS files. These are outside the six Phase 3 files; the targeted Phase 3 lint check passes. |

### Manual browser validation still required

The project has no configured browser integration-test runner, and this environment did not launch the application in a browser. Before using this with live hotel inventory, test these scenarios in a running local instance:

1. Send an order from POS and confirm it appears in KDS.
2. Move a ticket New → Preparing → Ready → Served; verify the POS/KDS shared record and history show the same status and events.
3. Cancel a New/Preparing ticket from KDS and cancel an active ticket from POS; verify it leaves the active queue but remains visible in history.
4. Resume a ticket in POS, refresh during editing, and verify the Draft ticket can be resumed again from the POS queue.
5. Complete checkout for a resumed ticket and verify the ticket is marked Served and a sale is recorded.
6. Retry the same stock movement reference and confirm no second deduction is recorded; then retry a mixed set containing one recorded and one unrecorded line and confirm only the unrecorded line is deducted.
7. Make two separate menu lines consume the same stock item and verify the full combined quantity is deducted.
8. Test expiry-tracked ingredients and confirm FEFO batch quantities remain correct after the aggregated deduction.
9. Test two browser tabs attempting checkout at nearly the same time; the current localStorage architecture is not a transactional multi-user database and concurrent writes can still race.

## Important limitations and safety notes

- Synchronization is **same-origin browser storage only**. It does not synchronize separate computers, browsers, or devices; a backend/realtime service is required for multi-device hotel operations.
- Browser localStorage is not transactional. Per-line movement references protect normal retries, but they do not guarantee race-free concurrent checkout across tabs/devices. Do not treat this as production-grade inventory concurrency control until a server-side transaction/unique constraint is added.
- Payment references remain manual POS metadata; no payment gateway is connected.
- Inventory recipes and units must be verified against actual hotel stock units before live use. The movement history records line references; per-line movement batch-detail auditing should be checked with real expiry-tracked inventory in the manual test above.
- Existing localStorage keys were retained. New history is stored under `gastora.pos.orderHistory.v1`; existing records are not bulk-deleted or reset.

## Phase 3 conclusion

The Phase 3 source changes type-check and pass targeted linting, and the pure-domain smoke checks pass. The Vite bundle and full repository lint are not clean for the environment/repository reasons described above. Complete the manual browser checks and address the native dependency install before deploying this phase to a live hotel.
