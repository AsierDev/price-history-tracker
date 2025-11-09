/**
 * Firebase Anonymous Authentication
 * Handles transparent user authentication without registration
 */

import { signInAnonymously } from 'firebase/auth';
import type { UserCredential } from 'firebase/auth';
import { getFirebaseAuth } from './config';
import { StorageManager } from '../core/storage';
import { logger } from '../utils/logger';

/**
 * Get or create anonymous user ID
 * This function is idempotent - it will reuse existing auth if available
 */
export async function getAnonymousUserId(): Promise<string> {
  try {
    // Check if user ID already exists in storage
    const storedUserId = await StorageManager.getAnonymousUserId();
    if (storedUserId) {
      logger.debug('Using existing anonymous user ID', { userId: storedUserId });
      return storedUserId;
    }

    // Authenticate anonymously with Firebase
    logger.info('Creating new anonymous user');
    const auth = getFirebaseAuth();
    const userCredential: UserCredential = await signInAnonymously(auth);
    const uid = userCredential.user.uid;

    // Save to storage for future use
    await StorageManager.setAnonymousUserId(uid);

    logger.info('Anonymous user created successfully', { userId: uid });
    return uid;
  } catch (error) {
    logger.error('Failed to get anonymous user ID', error);
    throw new Error('Failed to authenticate with backend');
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
    const auth = getFirebaseAuth();
    await auth.signOut();
    
    // Clear stored user ID
    await StorageManager.setAnonymousUserId('');
    
    logger.info('User signed out');
  } catch (error) {
    logger.error('Failed to sign out', error);
    throw error;
  }
}
