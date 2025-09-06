import axios from 'axios';
import logger from './logger';
import { notificationConfig } from '../config';
import { PriceAlertData, ArbitrageOpportunity, PriceAnomaly } from '../types';

export interface NotificationPayload {
    type: 'price_alert' | 'arbitrage_opportunity' | 'price_anomaly' | 'system_error';
    title: string;
    message: string;
    data?: any;
    timestamp: string;
}

class NotificationManager {
    
    public async sendNotification(payload: NotificationPayload): Promise<void> {
        const promises: Promise<void>[] = [];

        // Send to enabled notification channels
        if (notificationConfig.telegram.enabled) {
            promises.push(this.sendTelegramNotification(payload));
        }

        if (notificationConfig.email.enabled) {
            promises.push(this.sendEmailNotification(payload));
        }

        if (notificationConfig.webhook.enabled) {
            promises.push(this.sendWebhookNotification(payload));
        }

        // Send all notifications in parallel
        try {
            await Promise.allSettled(promises);
        } catch (error) {
            logger.error('Error sending notifications:', error);
        }
    }

    private async sendTelegramNotification(payload: NotificationPayload): Promise<void> {
        try {
            const { botToken, chatId } = notificationConfig.telegram;
            
            if (!botToken || !chatId) {
                logger.warn('Telegram notification skipped: missing bot token or chat ID');
                return;
            }

            const message = this.formatTelegramMessage(payload);
            
            await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                chat_id: chatId,
                text: message,
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            });

            logger.info('Telegram notification sent successfully');
        } catch (error) {
            logger.error('Failed to send Telegram notification:', error);
        }
    }

    private async sendEmailNotification(payload: NotificationPayload): Promise<void> {
        try {
            const { user, password } = notificationConfig.email;
            
            if (!user || !password) {
                logger.warn('Email notification skipped: missing credentials');
                return;
            }

            // This is a placeholder - you would integrate with nodemailer or similar
            logger.info('Email notification would be sent:', {
                to: user,
                subject: payload.title,
                body: payload.message
            });

            // TODO: Implement actual email sending with nodemailer
            // const nodemailer = require('nodemailer');
            // const transporter = nodemailer.createTransporter({...});
            // await transporter.sendMail({...});

        } catch (error) {
            logger.error('Failed to send email notification:', error);
        }
    }

    private async sendWebhookNotification(payload: NotificationPayload): Promise<void> {
        try {
            const { url, secret } = notificationConfig.webhook;
            
            if (!url) {
                logger.warn('Webhook notification skipped: missing URL');
                return;
            }

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'User-Agent': 'CryptoTradingAnalyzer/1.0'
            };

            if (secret) {
                headers['X-Webhook-Secret'] = secret;
            }

            await axios.post(url, payload, { headers, timeout: 10000 });
            
            logger.info('Webhook notification sent successfully');
        } catch (error) {
            logger.error('Failed to send webhook notification:', error);
        }
    }

    private formatTelegramMessage(payload: NotificationPayload): string {
        const icon = this.getTypeIcon(payload.type);
        let message = `${icon} *${payload.title}*\n\n${payload.message}`;

        if (payload.data) {
            message += '\n\n*Details:*';
            
            switch (payload.type) {
                case 'price_alert':
                    const alertData = payload.data as PriceAlertData;
                    message += `\n• Symbol: ${alertData.symbol}`;
                    message += `\n• Current Price: $${alertData.currentPrice.toLocaleString()}`;
                    message += `\n• Target Price: $${alertData.targetPrice.toLocaleString()}`;
                    message += `\n• Alert Type: ${alertData.type.toUpperCase()}`;
                    break;

                case 'arbitrage_opportunity':
                    const arbData = payload.data as ArbitrageOpportunity;
                    message += `\n• Symbol: ${arbData.symbol}`;
                    message += `\n• Buy on: ${arbData.buyExchange} ($${arbData.buyPrice.toLocaleString()})`;
                    message += `\n• Sell on: ${arbData.sellExchange} ($${arbData.sellPrice.toLocaleString()})`;
                    message += `\n• Profit: ${arbData.percentage}%`;
                    break;

                case 'price_anomaly':
                    const anomalyData = payload.data as PriceAnomaly;
                    message += `\n• Symbol: ${anomalyData.symbol}`;
                    message += `\n• Current Price: $${anomalyData.currentPrice.toLocaleString()}`;
                    message += `\n• Average Price: $${anomalyData.avgPrice.toLocaleString()}`;
                    message += `\n• Z-Score: ${anomalyData.zScore}`;
                    message += `\n• Type: ${anomalyData.type}`;
                    message += `\n• Severity: ${anomalyData.severity}`;
                    break;
            }
        }

        message += `\n\n_${new Date(payload.timestamp).toLocaleString()}_`;
        return message;
    }

    private getTypeIcon(type: string): string {
        const icons = {
            'price_alert': '🔔',
            'arbitrage_opportunity': '💰',
            'price_anomaly': '⚠️',
            'system_error': '🚨'
        };
        return icons[type as keyof typeof icons] || '📊';
    }

    // Convenience methods for specific notification types
    public async notifyPriceAlert(alertData: PriceAlertData): Promise<void> {
        const payload: NotificationPayload = {
            type: 'price_alert',
            title: `Price Alert Triggered - ${alertData.symbol}`,
            message: `${alertData.symbol} has ${alertData.type === 'above' ? 'risen above' : 'fallen below'} $${alertData.targetPrice.toLocaleString()}`,
            data: alertData,
            timestamp: alertData.timestamp
        };

        await this.sendNotification(payload);
    }

    public async notifyArbitrageOpportunity(opportunity: ArbitrageOpportunity): Promise<void> {
        const payload: NotificationPayload = {
            type: 'arbitrage_opportunity',
            title: `Arbitrage Opportunity - ${opportunity.symbol}`,
            message: `${opportunity.percentage}% profit opportunity detected between ${opportunity.buyExchange} and ${opportunity.sellExchange}`,
            data: opportunity,
            timestamp: opportunity.timestamp
        };

        await this.sendNotification(payload);
    }

    public async notifyPriceAnomaly(anomaly: PriceAnomaly): Promise<void> {
        const payload: NotificationPayload = {
            type: 'price_anomaly',
            title: `Price Anomaly Detected - ${anomaly.symbol}`,
            message: `${anomaly.type} detected with ${anomaly.severity} severity (Z-score: ${anomaly.zScore})`,
            data: anomaly,
            timestamp: anomaly.timestamp
        };

        await this.sendNotification(payload);
    }

    public async notifySystemError(error: Error, context?: string): Promise<void> {
        const payload: NotificationPayload = {
            type: 'system_error',
            title: 'System Error',
            message: `${context ? `[${context}] ` : ''}${error.message}`,
            data: {
                error: error.name,
                stack: error.stack,
                context
            },
            timestamp: new Date().toISOString()
        };

        await this.sendNotification(payload);
    }

    // Test notification method
    public async testNotifications(): Promise<void> {
        const testPayload: NotificationPayload = {
            type: 'system_error',
            title: 'Test Notification',
            message: 'This is a test notification from the Crypto Trading Analyzer system.',
            timestamp: new Date().toISOString()
        };

        await this.sendNotification(testPayload);
        logger.info('Test notifications sent to all enabled channels');
    }
}

// Singleton instance
export const notificationManager = new NotificationManager();
export default notificationManager;