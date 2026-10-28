# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

You can also install [eslint-plugin-react-x](https://npmx.dev/package/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://npmx.dev/package/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])

```

## Browser persistence and same-computer tab sync

Gastora now uses a shared browser-storage hook for POS and inventory data. Relevant records are saved in `localStorage`, loaded when the app opens again, and refreshed in other open Gastora tabs through the browser `storage` event. This supports one browser profile on the same computer; it is not cloud synchronization and does not share records with another computer, browser profile, or device.

Browser storage is not a transactional database. Avoid using multiple tabs to check out sales at exactly the same time, because simultaneous edits can still conflict. Clearing browser site data removes these locally stored records. Payment methods are recorded as POS metadata only; no payment gateway is connected.

## POS workflow additions

- POS navigation is organized into separate pages: Tables / New sale (`/pos`), Orders / History (`/pos/orders`), Menu management (`/pos/menu`), and Recipe & inventory mapping (`/pos/recipes`). Use the POS section dropdown in the page header to switch between them.
- Menu management lets staff add menu items, choose Restaurant or Bar, change prices, and remove items. Menu and price changes persist in this browser and synchronize between open tabs. Each menu item must have an inventory recipe before a sale can be completed.
- Orders can be dine-in, takeaway, or delivery and include a table/address field, customer name, order notes, and a percentage discount.
- Cash checkout captures amount tendered and calculates change. Mobile money and card checkout capture a transaction reference. Room charges require a room number.
- Orders can be held and resumed without payment or stock deduction.
- Inventory is not changed when menu items are added to the cart, quantities are edited, or an order is held. Stock is validated and deducted only during successful checkout.
- Sales history supports search, payment-method filtering, receipt viewing/printing, and CSV export.

These are frontend workflow features. Mobile money/card references are recorded manually; no payment processor is integrated. Room charges are recorded as POS sales but are not automatically posted to a hotel guest folio. Tax/service charges and unit conversions are not configured. Configure and test recipes against the actual inventory units before using real stock.
