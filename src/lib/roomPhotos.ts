// Photos of a room: what the attendant found, a stain, a broken lamp, the room as she left it. A photo is
// kept with the room (and with a reported problem) together with who took it and when, so a supervisor
// can see it later. Before real photos, the app kept text placeholders ("Photo 1"); those still show as
// placeholders.
//
// Honest limits: photos are kept in this browser's own storage, which holds only a few megabytes for the
// whole hotel record, so they are shrunk before saving and only a few are kept per room. The real system
// keeps them on the server. Pure rules only: no React.

export interface RoomPhoto {
  id: string
  /** The picture itself, as a data URL (a shrunk JPEG). */
  src: string
  /** Who took it. */
  by: string
  day: string
  time: string
}

/** A room's photo list as stored: real photos, and the old text placeholders. */
export type StoredPhoto = string | RoomPhoto

/** Photos kept per room. Enough to show a problem; few enough that the browser does not fill up. */
export const MAX_ROOM_PHOTOS = 6
/** Photos on one reported problem. */
export const MAX_DEFECT_PHOTOS = 3
/** Longest side of a saved photo, in pixels. Plenty to see a stain on a carpet. */
export const PHOTO_MAX_SIDE = 1280

export const STORAGE_FULL_MESSAGE =
  "This device's storage for the hotel record is full, so the photo was not saved. Remove an old photo from a room and try again."

export const isRealPhoto = (p: StoredPhoto): p is RoomPhoto => typeof p !== 'string'

/** How many real photos a room has. Placeholders take no space and do not count. */
export const realPhotoCount = (photos: StoredPhoto[]) => photos.filter(isRealPhoto).length

/** Whether another photo may be added to this room. */
export const roomHasSpace = (photos: StoredPhoto[]) => realPhotoCount(photos) < MAX_ROOM_PHOTOS

/** The error a browser throws when its storage is full. The name differs between browsers. */
export function isStorageFull(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const e = error as { name?: string; code?: number }
  return e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' || e.code === 22 || e.code === 1014
}

/** Roughly how many kilobytes a data URL takes when stored. */
export const photoKb = (src: string) => Math.round((src.length * 2) / 1024)
