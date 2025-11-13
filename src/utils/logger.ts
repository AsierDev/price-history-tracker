/**
 * Centralized logging utility with context
 */

import { isProductionBuild } from '../config/env';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogContext {
  domain?: string;
  productId?: string;
  adapter?: string;
  timestamp?: number;
  retryCount?: number;
  [key: string]: unknown;
}

class Logger {
  private prefix = '[PriceTracker]';

  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `${this.prefix} [${level.toUpperCase()}] ${timestamp} - ${message}${contextStr}`;
  }

  info(message: string, context?: LogContext): void {
    console.log(this.formatMessage('info', message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage('warn', message, context));
  }

  error(message: string, error?: Error | unknown, context?: LogContext): void {
    const errorContext = {
      ...context,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    };
    console.error(this.formatMessage('error', message, errorContext));
  }

  debug(message: string, context?: LogContext): void {
    if (!isProductionBuild()) {
      console.debug(this.formatMessage('debug', message, context));
    }
  }
}

export const logger = new Logger();
