/**
 * Firebase configuration and initialization
 */

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import type { FirebaseApp } from 'firebase/app';
import type { Firestore } from 'firebase/firestore';
import { logger } from '../utils/logger';
import { ENV } from '../config/env';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: ENV.FIREBASE.apiKey,
  authDomain: ENV.FIREBASE.authDomain,
  projectId: ENV.FIREBASE.projectId,
  storageBucket: ENV.FIREBASE.storageBucket,
  messagingSenderId: ENV.FIREBASE.messagingSenderId,
  appId: ENV.FIREBASE.appId,
};

let app: FirebaseApp | null = null;
let db: Firestore | null = null;

/**
 * Initialize Firebase (lazy initialization)
 */
export function initializeFirebase(): { app: FirebaseApp; db: Firestore } {
  if (!app) {
    try {
      // Validate config
      if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
        throw new Error('Firebase configuration is incomplete. Check environment variables.');
      }

      app = initializeApp(firebaseConfig);
      db = getFirestore(app);

      logger.info('Firebase initialized successfully', {
        projectId: firebaseConfig.projectId,
      });
    } catch (error) {
      logger.error('Failed to initialize Firebase', error);
      throw error;
    }
  }

  return { app, db: db! };
}

/**
 * Get Firestore instance
 */
export function getFirebaseDb(): Firestore {
  if (!db) {
    const firebase = initializeFirebase();
    return firebase.db;
  }
  return db;
}

/**
 * Check if Firebase is configured
 */
export function isFirebaseConfigured(): boolean {
  return !!(firebaseConfig.apiKey && firebaseConfig.projectId);
}
