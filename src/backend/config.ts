/**
 * Firebase configuration and initialization
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
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
let auth: Auth | null = null;
let db: Firestore | null = null;

/**
 * Initialize Firebase (lazy initialization)
 */
export function initializeFirebase(): { app: FirebaseApp; auth: Auth; db: Firestore } {
  if (!app) {
    try {
      // Validate config
      if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
        throw new Error('Firebase configuration is incomplete. Check environment variables.');
      }

      app = initializeApp(firebaseConfig);
      auth = getAuth(app);
      db = getFirestore(app);

      logger.info('Firebase initialized successfully', {
        projectId: firebaseConfig.projectId,
      });
    } catch (error) {
      logger.error('Failed to initialize Firebase', error);
      throw error;
    }
  }

  return { app, auth: auth!, db: db! };
}

/**
 * Get Firebase Auth instance
 */
export function getFirebaseAuth(): Auth {
  if (!auth) {
    const firebase = initializeFirebase();
    return firebase.auth;
  }
  return auth;
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
