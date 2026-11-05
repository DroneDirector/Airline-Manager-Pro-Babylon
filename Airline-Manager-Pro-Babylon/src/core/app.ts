// The app's name, version and engine version, put in by the build (scripts/build.mjs).
declare const __APP__: { name: string; short: string; id: string; version: string; babylon: string; updates: { repo: string; tagPrefix: string } };
export const APP = __APP__;
/** The PC app (its own window) or a phone or tablet. */
export const IS_PC = /Electron/i.test(navigator.userAgent) || (!/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) && !('ontouchstart' in window));
export const IS_TOUCH = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
