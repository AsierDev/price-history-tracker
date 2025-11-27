/**
 * Firebase Backend API
 * Handles all Firestore operations for price history
 */

import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import type { PriceDataPoint, ProductDocument } from '../core/types';
import { getFirebaseDb, isFirebaseConfigured } from './config';
import { cleanUrl, hashUrl } from '../utils/urlUtils';
import { logger } from '../utils/logger';

const COLLECTION_NAME = 'products';

/**
 * Add or update price in backend
 * Returns the complete price history for the product
 */
export async function addPriceToBackend(data: {
  url: string;
  price: number;
  currency: string;
  title: string;
  platform: string;
  imageUrl?: string;
}): Promise<{ success: boolean; priceHistory: PriceDataPoint[]; error?: string }> {
  try {
    // Check if Firebase is configured
    if (!isFirebaseConfigured()) {
      logger.warn('Firebase not configured, skipping backend sync');
      return {
        success: false,
        priceHistory: [],
        error: 'Backend not configured',
      };
    }

    const cleanedUrl = cleanUrl(data.url);
    const docId = hashUrl(cleanedUrl);
    const db = getFirebaseDb();
    const productRef = doc(db, COLLECTION_NAME, docId);

    // Create new price data point
    const newDataPoint: PriceDataPoint = {
      price: data.price,
      currency: data.currency,
      timestamp: Date.now(),
      source: 'user',
    };

    // Get existing document
    const productDoc = await getDoc(productRef);

    if (!productDoc.exists()) {
      // Create new document
      const newProduct: ProductDocument = {
        url: cleanedUrl,
        title: data.title,
        platform: data.platform,
        imageUrl: data.imageUrl,
        priceHistory: [newDataPoint],
        lastUpdated: Date.now(),
        contributorCount: 1,
      };

      await setDoc(productRef, newProduct);

      logger.info('Product created in backend', {
        docId,
        title: data.title,
        platform: data.platform,
      });

      return { success: true, priceHistory: [newDataPoint] };
    } else {
      // Update existing document
      const existingData = productDoc.data() as ProductDocument;
      const lastPrice = existingData.priceHistory[existingData.priceHistory.length - 1];

      // Only add if price changed or >1 hour passed
      const shouldAdd =
        Math.abs(lastPrice.price - data.price) > 0.01 ||
        Date.now() - lastPrice.timestamp > 3600000; // 1 hour

      if (shouldAdd) {
        const updatedHistory = [...existingData.priceHistory, newDataPoint];

        // Limit history to last 500 entries (prevent unbounded growth)
        const trimmedHistory = updatedHistory.slice(-500);

        await updateDoc(productRef, {
          priceHistory: trimmedHistory,
          lastUpdated: Date.now(),
          title: data.title, // Update title if changed
          imageUrl: data.imageUrl || existingData.imageUrl,
        });

        logger.info('Product updated in backend', {
          docId,
          newPrice: data.price,
          historyLength: trimmedHistory.length,
        });

        return { success: true, priceHistory: trimmedHistory };
      } else {
        logger.debug('Price unchanged, skipping backend update', { docId });
        return { success: true, priceHistory: existingData.priceHistory };
      }
    }
  } catch (error) {
    logger.error('Failed to add price to backend', error);
    return {
      success: false,
      priceHistory: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Update price during automatic check
 */
export async function updatePriceInBackend(data: {
  url: string;
  price: number;
  currency: string;
  title: string;
  platform: string;
}): Promise<{ success: boolean; priceHistory: PriceDataPoint[] }> {
  try {
    if (!isFirebaseConfigured()) {
      return { success: false, priceHistory: [] };
    }

    const cleanedUrl = cleanUrl(data.url);
    const docId = hashUrl(cleanedUrl);
    const db = getFirebaseDb();
    const productRef = doc(db, COLLECTION_NAME, docId);

    const newDataPoint: PriceDataPoint = {
      price: data.price,
      currency: data.currency,
      timestamp: Date.now(),
      source: 'check',
    };

    const productDoc = await getDoc(productRef);

    if (!productDoc.exists()) {
      // Document doesn't exist (shouldn't happen in normal flow)
      logger.warn('Product not found in backend during check', { docId });
      return { success: false, priceHistory: [] };
    }

    const existingData = productDoc.data() as ProductDocument;
    const lastPrice = existingData.priceHistory[existingData.priceHistory.length - 1];

    // Only add if price actually changed
    if (Math.abs(lastPrice.price - data.price) > 0.01) {
      const updatedHistory = [...existingData.priceHistory, newDataPoint];
      const trimmedHistory = updatedHistory.slice(-500);

      await updateDoc(productRef, {
        priceHistory: trimmedHistory,
        lastUpdated: Date.now(),
      });

      logger.info('Price check updated in backend', {
        docId,
        oldPrice: lastPrice.price,
        newPrice: data.price,
      });

      return { success: true, priceHistory: trimmedHistory };
    }

    return { success: true, priceHistory: existingData.priceHistory };
  } catch (error) {
    logger.error('Failed to update price in backend', error);
    return { success: false, priceHistory: [] };
  }
}

/**
 * Get product history from backend
 */
export async function getProductHistory(url: string): Promise<PriceDataPoint[]> {
  try {
    if (!isFirebaseConfigured()) {
      logger.debug('Firebase not configured, returning empty history');
      return [];
    }

    const cleanedUrl = cleanUrl(url);
    const docId = hashUrl(cleanedUrl);
    const db = getFirebaseDb();
    const productRef = doc(db, COLLECTION_NAME, docId);

    const productDoc = await getDoc(productRef);

    if (productDoc.exists()) {
      const data = productDoc.data() as ProductDocument;
      logger.debug('Product history retrieved from backend', {
        docId,
        historyLength: data.priceHistory.length,
      });
      return data.priceHistory;
    }

    logger.debug('Product not found in backend', { docId });
    return [];
  } catch (error) {
    logger.error('Failed to get product history from backend', error);
    return [];
  }
}

/**
 * Get product image URL from backend
 */
export async function getProductImageUrl(url: string): Promise<string | undefined> {
  try {
    if (!isFirebaseConfigured()) {
      return undefined;
    }

    const cleanedUrl = cleanUrl(url);
    const docId = hashUrl(cleanedUrl);
    const db = getFirebaseDb();
    const productRef = doc(db, COLLECTION_NAME, docId);

    const productDoc = await getDoc(productRef);

    if (productDoc.exists()) {
      const data = productDoc.data() as ProductDocument;
      return data.imageUrl;
    }

    return undefined;
  } catch (error) {
    logger.error('Failed to get product image from backend', error);
    return undefined;
  }
}

/**
 * Check backend connectivity
 */
export async function checkBackendConnectivity(): Promise<{ success: boolean; error?: string }> {
  try {
    if (!isFirebaseConfigured()) {
      return { success: false, error: 'Firebase configuration missing' };
    }

    // Try to read a lightweight document to validate connectivity
    const db = getFirebaseDb();
    const productRef = doc(db, COLLECTION_NAME, 'connectivity_test');
    await getDoc(productRef);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown connectivity error';
    return { success: false, error: errorMessage };
  }
}
