// Where the app's data comes from. Today everything is sample data held in this browser tab.
// When the API is connected, this is the one place that changes, and every page's badge follows.
export type DataSource = {
  kind: 'sample' | 'live'
  label: string
  note: string
}

export const dataSource: DataSource = {
  kind: 'sample',
  label: 'Sample data',
  note: 'Demo data kept in this browser tab only. Changes are not saved to a server, are not shared with other staff, and reset when the page is reloaded.',
}
