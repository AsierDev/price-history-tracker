/**
 * Local client identity helper
 * Generates and stores a stable anonymous ID without using Firebase Auth
 */

import { StorageManager } from '../core/storage';
import { logger } from '../utils/logger';

/**
 * Get or create anonymous user ID
 * This function is idempotent - it will reuse existing ID if available
 */
export async function getAnonymousUserId(): Promise<string> {
  try {
    // Check if user ID already exists in storage
    const storedUserId = await StorageManager.getAnonymousUserId();
    if (storedUserId) {
      logger.debug('Using existing anonymous user ID', { userId: storedUserId });
      return storedUserId;
    }

    logger.info('Generating new local anonymous user ID');
    const uid =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `pht-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

    // Save to storage for future use
    await StorageManager.setAnonymousUserId(uid);

    logger.info('Anonymous user ID created successfully', { userId: uid });
    return uid;
  } catch (error) {
    logger.error('Failed to get anonymous user ID', error);
    throw new Error('Failed to initialize client identity');
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const userId = await StorageManager.getAnonymousUserId();
    return !!userId;
  } catch {
    return false;
  }
}

/**
 * Sign out (for testing/debugging)
 */
export async function signOut(): Promise<void> {
  try {
    // Clear stored user ID
    await StorageManager.setAnonymousUserId('');
    
    logger.info('Local anonymous user ID cleared');
  } catch (error) {
    logger.error('Failed to sign out', error);
    throw error;
  }
}
