import { Server as SocketIOServer } from 'socket.io';
import logger from '../utils/logger';
import { ExchangeManager } from '../exchanges/ExchangeManager';
import {
    PriceAlert,
    PriceAlertData,
    ExchangePriceData,
    PriceChangeStats,
    PriceAnomaly,
    ArbitrageOpportunity,
    OHLCVArray
} from '../types';

export class PriceMonitor {
    private io: SocketIOServer;
    private exchangeManager: ExchangeManager;
    private watchedSymbols: string[] = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'ADA/USDT', 'SOL/USDT'];
    private priceAlerts: Map<string, PriceAlert[]> = new Map();
    private priceHistory: Map<string, OHLCVArray[]> = new Map();
    private isRunning: boolean = false;
    private monitoringInterval: NodeJS.Timeout | null = null;
    
    constructor(io: SocketIOServer) {
        this.io = io;
        this.exchangeManager = new ExchangeManager();
    }
    
    public async start(): Promise<void> {
        if (this.isRunning) {
            logger.warn('Price monitor is already running');
            return;
        }
        
        try {
            await this.exchangeManager.initialize();
            this.isRunning = true;
            
            await this.initializePriceHistory();
            
            this.startRealTimeMonitoring();
            
            logger.info('Price monitor started successfully');
        } catch (error) {
            logger.error('Failed to start price monitor:', error);
            throw error;
        }
    }
    
    public async stop(): Promise<void> {
        this.isRunning = false;
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        logger.info('Price monitor stopped');
    }
    
    private async initializePriceHistory(): Promise<void> {
        for (const symbol of this.watchedSymbols) {
            try {
                const ohlcv = await this.exchangeManager.getOHLCV('binance', symbol, '1m', 100);
                this.priceHistory.set(symbol, ohlcv);
                logger.info(`Initialized price history for ${symbol}`);
            } catch (error) {
                logger.error(`Failed to initialize price history for ${symbol}:`, error);
            }
        }
    }
    
    private startRealTimeMonitoring(): void {
        this.monitoringInterval = setInterval(async () => {
            if (this.isRunning) {
                await this.updatePrices();
            }
        }, 30000);
    }
    
    public async updatePrices(): Promise<void> {
        const priceUpdates: Record<string, Record<string, ExchangePriceData | null>> = {};
        
        for (const symbol of this.watchedSymbols) {
            try {
                const prices = await this.exchangeManager.getMultiExchangePrices(symbol);
                priceUpdates[symbol] = prices;
                
                await this.updatePriceHistory(symbol);
                
                await this.checkPriceAlerts(symbol, prices);
                
            } catch (error) {
                logger.error(`Error updating prices for ${symbol}:`, error);
            }
        }
        
        // Filter out null values for emission
        const filteredPrices: Record<string, ExchangePriceData> = {};
        Object.entries(priceUpdates).forEach(([symbol, exchangePrices]) => {
            const validExchangePrices: Record<string, ExchangePriceData> = {};
            Object.entries(exchangePrices).forEach(([exchange, data]) => {
                if (data !== null) {
                    validExchangePrices[exchange] = data;
                }
            });
            if (Object.keys(validExchangePrices).length > 0) {
                filteredPrices[symbol] = validExchangePrices as any;
            }
        });
        
        this.io.emit('price_update', {
            timestamp: new Date().toISOString(),
            prices: filteredPrices
        });
        
        await this.broadcastArbitrageOpportunities();
    }
    
    private async updatePriceHistory(symbol: string): Promise<void> {
        try {
            const latestCandle = await this.exchangeManager.getOHLCV('binance', symbol, '1m', 1);
            if (latestCandle && latestCandle.length > 0) {
                let history = this.priceHistory.get(symbol) || [];
                
                const newCandle = latestCandle[0];
                const lastCandle = history[history.length - 1];
                
                if (!lastCandle || newCandle[0] > lastCandle[0]) {
                    history.push(newCandle);
                    
                    if (history.length > 1000) {
                        history = history.slice(-1000);
                    }
                    
                    this.priceHistory.set(symbol, history);
                } else if (newCandle[0] === lastCandle[0]) {
                    history[history.length - 1] = newCandle;
                    this.priceHistory.set(symbol, history);
                }
            }
        } catch (error) {
            logger.error(`Error updating price history for ${symbol}:`, error);
        }
    }
    
    private async broadcastArbitrageOpportunities(): Promise<void> {
        const opportunities: ArbitrageOpportunity[] = [];
        
        for (const symbol of this.watchedSymbols) {
            try {
                const symbolOpportunities = await this.exchangeManager.calculateArbitrageOpportunities(symbol);
                opportunities.push(...symbolOpportunities);
            } catch (error) {
                logger.error(`Error calculating arbitrage for ${symbol}:`, error);
            }
        }
        
        if (opportunities.length > 0) {
            this.io.emit('arbitrage_opportunities', {
                timestamp: new Date().toISOString(),
                opportunities: opportunities.slice(0, 10)
            });
        }
    }
    
    public setPriceAlert(
        symbol: string, 
        targetPrice: number, 
        type: 'above' | 'below' = 'above', 
        callback?: (data: PriceAlertData) => Promise<void>
    ): string {
        const alertId = `${symbol}_${type}_${targetPrice}_${Date.now()}`;
        
        const alert: PriceAlert = {
            id: alertId,
            symbol,
            targetPrice,
            type,
            callback,
            createdAt: new Date().toISOString(),
            triggered: false
        };
        
        if (!this.priceAlerts.has(symbol)) {
            this.priceAlerts.set(symbol, []);
        }
        
        this.priceAlerts.get(symbol)!.push(alert);
        logger.info(`Price alert set: ${symbol} ${type} ${targetPrice}`);
        
        return alertId;
    }
    
    public removePriceAlert(alertId: string): boolean {
        for (const [, alerts] of this.priceAlerts.entries()) {
            const index = alerts.findIndex(alert => alert.id === alertId);
            if (index !== -1) {
                alerts.splice(index, 1);
                logger.info(`Price alert removed: ${alertId}`);
                return true;
            }
        }
        return false;
    }
    
    private async checkPriceAlerts(
        symbol: string, 
        prices: Record<string, ExchangePriceData | null>
    ): Promise<void> {
        const alerts = this.priceAlerts.get(symbol);
        if (!alerts || alerts.length === 0) return;
        
        for (const alert of alerts) {
            if (alert.triggered) continue;
            
            const currentPrice = prices.binance?.price;
            if (!currentPrice) continue;
            
            let shouldTrigger = false;
            
            if (alert.type === 'above' && currentPrice >= alert.targetPrice) {
                shouldTrigger = true;
            } else if (alert.type === 'below' && currentPrice <= alert.targetPrice) {
                shouldTrigger = true;
            }
            
            if (shouldTrigger) {
                alert.triggered = true;
                
                const alertData: PriceAlertData = {
                    id: alert.id,
                    symbol: alert.symbol,
                    currentPrice,
                    targetPrice: alert.targetPrice,
                    type: alert.type,
                    timestamp: new Date().toISOString()
                };
                
                this.io.emit('price_alert', alertData);
                
                if (alert.callback && typeof alert.callback === 'function') {
                    try {
                        await alert.callback(alertData);
                    } catch (error) {
                        logger.error('Error executing price alert callback:', error);
                    }
                }
                
                logger.info(`Price alert triggered: ${symbol} ${alert.type} ${alert.targetPrice}, current: ${currentPrice}`);
            }
        }
        
        this.priceAlerts.set(symbol, alerts.filter(alert => !alert.triggered));
    }
    
    public getPriceHistory(symbol: string, limit: number = 100): OHLCVArray[] {
        const history = this.priceHistory.get(symbol) || [];
        return history.slice(-limit);
    }
    
    public getWatchedSymbols(): string[] {
        return [...this.watchedSymbols];
    }
    
    public addWatchedSymbol(symbol: string): void {
        if (!this.watchedSymbols.includes(symbol)) {
            this.watchedSymbols.push(symbol);
            logger.info(`Added ${symbol} to watched symbols`);
            
            this.initializePriceHistory().catch(error => {
                logger.error(`Failed to initialize price history for new symbol ${symbol}:`, error);
            });
        }
    }
    
    public removeWatchedSymbol(symbol: string): void {
        const index = this.watchedSymbols.indexOf(symbol);
        if (index !== -1) {
            this.watchedSymbols.splice(index, 1);
            this.priceHistory.delete(symbol);
            this.priceAlerts.delete(symbol);
            logger.info(`Removed ${symbol} from watched symbols`);
        }
    }
    
    public getPriceChangeStats(symbol: string, timeframe: string = '24h'): PriceChangeStats | null {
        const history = this.priceHistory.get(symbol);
        if (!history || history.length < 2) {
            return null;
        }
        
        let periods: number;
        switch (timeframe) {
            case '1h':
                periods = 60;
                break;
            case '4h':
                periods = 240;
                break;
            case '24h':
            default:
                periods = 1440;
                break;
        }
        
        const currentPrice = history[history.length - 1][4];
        const startIndex = Math.max(0, history.length - periods);
        const startPrice = history[startIndex][4];
        
        const change = currentPrice - startPrice;
        const changePercent = (change / startPrice) * 100;
        
        let high = -Infinity;
        let low = Infinity;
        let volume = 0;
        
        for (let i = startIndex; i < history.length; i++) {
            high = Math.max(high, history[i][2]);
            low = Math.min(low, history[i][3]);
            volume += history[i][5];
        }
        
        return {
            symbol,
            timeframe,
            currentPrice,
            startPrice,
            change,
            changePercent: parseFloat(changePercent.toFixed(2)),
            high,
            low,
            volume,
            timestamp: new Date().toISOString()
        };
    }
    
    public detectPriceAnomalies(symbol: string, threshold: number = 5): PriceAnomaly | null {
        const history = this.priceHistory.get(symbol);
        if (!history || history.length < 20) {
            return null;
        }
        
        const recentPrices = history.slice(-20).map(candle => candle[4]);
        const currentPrice = recentPrices[recentPrices.length - 1];
        const previousPrices = recentPrices.slice(0, -1);
        
        const avgPrice = previousPrices.reduce((sum, price) => sum + price, 0) / previousPrices.length;
        const variance = previousPrices.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) / previousPrices.length;
        const stdDev = Math.sqrt(variance);
        
        const zScore = Math.abs((currentPrice - avgPrice) / stdDev);
        
        if (zScore > threshold) {
            const anomaly: PriceAnomaly = {
                symbol,
                currentPrice,
                avgPrice,
                zScore: parseFloat(zScore.toFixed(2)),
                threshold,
                type: currentPrice > avgPrice ? 'SPIKE' : 'DROP',
                severity: zScore > threshold * 2 ? 'HIGH' : 'MEDIUM',
                timestamp: new Date().toISOString()
            };
            
            this.io.emit('price_anomaly', anomaly);
            
            logger.warn(`Price anomaly detected for ${symbol}: ${anomaly.type} with Z-score ${zScore}`);
            
            return anomaly;
        }
        
        return null;
    }
}

export default PriceMonitor;