import { NativeModulesProxy, EventEmitter, Subscription } from 'expo-modules-core';

const ClutchAccessibilityModule = NativeModulesProxy.ClutchAccessibility;
const emitter = new EventEmitter(ClutchAccessibilityModule);

/**
 * Check if the Clutch Accessibility Service is enabled in Android settings.
 * @returns {Promise<boolean>}
 */
export async function isEnabled() {
  return await ClutchAccessibilityModule.isEnabled();
}

/**
 * Open Android Accessibility Settings so the user can enable the service.
 */
export async function openSettings() {
  return await ClutchAccessibilityModule.openSettings();
}

/**
 * Get the most recently captured screen data.
 * @returns {Promise<{appName: string, text: string, timestamp: number} | null>}
 */
export async function getLastCapture() {
  return await ClutchAccessibilityModule.getLastCapture();
}

/**
 * Subscribe to real-time screen captures.
 * @param {function} listener - Called with {appName, text, timestamp} on each capture
 * @returns {Subscription}
 */
export function addScreenCaptureListener(listener) {
  return emitter.addListener('onScreenCapture', listener);
}

export function removeScreenCaptureListener(subscription) {
  subscription.remove();
}
