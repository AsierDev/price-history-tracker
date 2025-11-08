/**
 * Date and time utilities
 */

export function getCurrentTimestamp(): number {
  return Date.now();
}

export function addMinutes(timestamp: number, minutes: number): number {
  return timestamp + minutes * 60 * 1000;
}

export function addHours(timestamp: number, hours: number): number {
  return timestamp + hours * 60 * 60 * 1000;
}

export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString();
}

export function getMinutesSince(timestamp: number): number {
  return Math.floor((Date.now() - timestamp) / (60 * 1000));
}

export function getHoursSince(timestamp: number): number {
  return Math.floor((Date.now() - timestamp) / (60 * 60 * 1000));
}

export function isExpired(timestamp: number): boolean {
  return Date.now() >= timestamp;
}
