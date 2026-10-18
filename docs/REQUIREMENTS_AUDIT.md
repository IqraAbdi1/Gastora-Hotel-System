# Gastora Hotel System — Requirements Audit Snapshot

This is a code-based snapshot of what can be established from the current repository. A separate formal original project specification was not found in the project tree, so this is not a final compliance sign-off against that specification.

## Present in the codebase

- Front desk reservations, room assignments/check-in and check-out workflows.
- Guest directory and guest profile pages.
- Folio charges, payments, balance display and simulated invoice output.
- Housekeeping tasks/requests and maintenance work-order feature areas.
- Inventory stock, movements, stock counts, procurement requests, purchase orders and suppliers.
- POS menu/cart/order types, discount handling, sale history, receipts/CSV export and recipe-based stock deductions.
- Kitchen Display order lifecycle and same-origin browser-storage synchronization.
- Phase 4 POS room-charge posting to a uniquely matched in-house guest folio.

## Incomplete, unverified, or explicitly limited

- Production build currently fails because the installed Vite/Rolldown package cannot load its optional native binding in this environment.
- Repository-wide lint currently reports 13 errors; targeted lint for the Phase 4 files passes.
- POS/inventory browser storage and hotel in-memory state are not a unified durable backend.
- No transactional multi-user concurrency control or database uniqueness constraints for exactly-once stock/folio posting.
- No live payment gateway or provider-confirmed mobile-money/card processing.
- No real EFRIS/URA integration; invoice fiscal code is simulated in the current provider.
- Full accounting ledger, bank reconciliation, period close and tax reporting have not been verified against a formal specification.
- End-to-end browser testing and production security review remain outstanding.

## Release gate

Do not mark the system production-ready until the original specification is obtained and mapped line-by-line, a durable backend and transaction strategy are in place, the build succeeds on a clean install, repository lint issues are resolved or formally waived, and critical hotel workflows pass browser end-to-end tests.
