// Saving a photo taken in the game: on Android into the phone's Pictures (Airport Dynasty Pro), through the app's own
// plugin; on the PC into Pictures\Airport Dynasty Pro (the PC app puts every photo there without asking); in a
// browser as a download.
import { registerPlugin, Capacitor } from '@capacitor/core';
const PhotoSave: any = registerPlugin('PhotoSave');
/** Save a picture (a data URL); answers where it went. */
export async function savePhoto(dataUrl: string, name: string): Promise<string> {
  const mime = (dataUrl.match(/^data:([^;]+);/) || [])[1] || 'image/png';
  if (Capacitor.isNativePlatform()) { const r = await PhotoSave.save({ data: dataUrl.slice(dataUrl.indexOf(',') + 1), name, mime }); return (r && r.where) || 'Pictures/Airport Dynasty Pro'; }
  const a = document.createElement('a'); a.href = dataUrl; a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => a.remove(), 1000);
  return /Electron/i.test(navigator.userAgent) ? 'Pictures\\Airport Dynasty Pro' : 'Downloads';
}
