/**
 * Chrome Notifications wrapper for price drop alerts
 */

import type { NotificationData } from './types';
import { logger } from '../utils/logger';

export class NotificationManager {
  /**
   * Show a price drop notification
   */
  static async notifyPriceDrop(data: NotificationData): Promise<void> {
    try {
      const notificationId = `price-drop-${data.productId}`;
      
      await chrome.notifications.create(notificationId, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('popup/icons/icon128.svg'),
        title: '💰 ¡Bajada de Precio!',
        message: `${data.title}\n${data.oldPrice}€ → ${data.newPrice}€ (-${data.percentDrop.toFixed(1)}%)`,
        buttons: [
          { title: 'Ver Producto' },
          { title: 'Dejar de Trackear' },
        ],
        priority: 2,
        requireInteraction: true,
      });

      logger.info('Price drop notification sent', {
        productId: data.productId,
        percentDrop: data.percentDrop,
      });
    } catch (error) {
      logger.error('Failed to send notification', error, {
        productId: data.productId,
      });
    }
  }

  /**
   * Handle notification button clicks
   */
  static setupNotificationHandlers(): void {
    chrome.notifications.onButtonClicked.addListener(
      async (notificationId: string, buttonIndex: number) => {
        try {
          // Extract product ID from notification ID
          const productId = notificationId.replace('price-drop-', '');

          if (buttonIndex === 0) {
            // "Ver Producto" button
            await this.handleViewProduct(productId);
          } else if (buttonIndex === 1) {
            // "Dejar de Trackear" button
            await this.handleStopTracking(productId);
          }

          // Clear the notification
          await chrome.notifications.clear(notificationId);
        } catch (error) {
          logger.error('Failed to handle notification button click', error, {
            notificationId,
            buttonIndex,
          });
        }
      }
    );

    chrome.notifications.onClosed.addListener((notificationId: string) => {
      logger.debug('Notification closed', { notificationId });
    });
  }

  /**
   * Handle "View Product" action
   */
  private static async handleViewProduct(productId: string): Promise<void> {
    // Send message to service worker to open product URL
    await chrome.runtime.sendMessage({
      action: 'openProduct',
      productId,
    });
    
    logger.info('Opening product from notification', { productId });
  }

  /**
   * Handle "Stop Tracking" action
   */
  private static async handleStopTracking(productId: string): Promise<void> {
    // Send message to service worker to remove product
    await chrome.runtime.sendMessage({
      action: 'removeProduct',
      productId,
    });
    
    logger.info('Stopped tracking from notification', { productId });
  }

  /**
   * Clear all notifications
   */
  static async clearAll(): Promise<void> {
    return new Promise((resolve) => {
      chrome.notifications.getAll((notifications) => {
        try {
          if (notifications && typeof notifications === 'object') {
            const clearPromises = Object.keys(notifications).map(id =>
              chrome.notifications.clear(id)
            );
            Promise.all(clearPromises).then(() => {
              logger.debug('All notifications cleared');
              resolve();
            }).catch((error) => {
              logger.error('Failed to clear notifications', error);
              resolve();
            });
          } else {
            resolve();
          }
        } catch (error) {
          logger.error('Failed to clear notifications', error);
          resolve();
        }
      });
    });
  }
}
