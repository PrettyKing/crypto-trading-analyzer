const logger = require('../utils/logger');
const ExchangeManager = require('../exchanges/ExchangeManager');

class PriceMonitor {
    constructor(io) {
        this.io = io;
        this.exchangeManager = new ExchangeManager();
        this.watchedSymbols = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'ADA/USDT', 'SOL/USDT'];
        this.priceAlerts = new Map();
        this.priceHistory = new Map();
        this.isRunning = false;
        this.monitoringInterval = null;
    }
    
    async start() {
        if (this.isRunning) {
            logger.warn('Price monitor is already running');
            return;
        }
        
        try {
            await this.exchangeManager.initialize();
            this.isRunning = true;
            
            // 初始化价格历史
            await this.initializePriceHistory();
            
            // 开始实时监控
            this.startRealTimeMonitoring();
            
            logger.info('Price monitor started successfully');
        } catch (error) {
            logger.error('Failed to start price monitor:', error);
            throw error;
        }
    }
    
    async stop() {
        this.isRunning = false;
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        logger.info('Price monitor stopped');
    }
    
    async initializePriceHistory() {
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
    
    startRealTimeMonitoring() {
        // 每30秒更新一次价格
        this.monitoringInterval = setInterval(async () => {
            if (this.isRunning) {
                await this.updatePrices();
            }
        }, 30000);
    }
    
    async updatePrices() {
        const priceUpdates = {};
        
        for (const symbol of this.watchedSymbols) {
            try {
                // 获取多交易所价格
                const prices = await this.exchangeManager.getMultiExchangePrices(symbol);
                priceUpdates[symbol] = prices;
                
                // 更新价格历史
                await this.updatePriceHistory(symbol);
                
                // 检查价格预警
                await this.checkPriceAlerts(symbol, prices);
                
            } catch (error) {
                logger.error(`Error updating prices for ${symbol}:`, error);
            }
        }
        
        // 广播价格更新
        this.io.emit('price_update', {
            timestamp: new Date().toISOString(),
            prices: priceUpdates
        });
        
        // 计算并广播套利机会
        await this.broadcastArbitrageOpportunities();
    }
    
    async updatePriceHistory(symbol) {
        try {
            const latestCandle = await this.exchangeManager.getOHLCV('binance', symbol, '1m', 1);
            if (latestCandle && latestCandle.length > 0) {
                let history = this.priceHistory.get(symbol) || [];
                
                // 添加新的K线数据
                const newCandle = latestCandle[0];
                const lastCandle = history[history.length - 1];
                
                // 如果是新的时间段，添加新K线
                if (!lastCandle || newCandle[0] > lastCandle[0]) {
                    history.push(newCandle);
                    
                    // 保持历史数据不超过1000条
                    if (history.length > 1000) {
                        history = history.slice(-1000);
                    }
                    
                    this.priceHistory.set(symbol, history);
                } else if (newCandle[0] === lastCandle[0]) {
                    // 更新当前K线
                    history[history.length - 1] = newCandle;
                    this.priceHistory.set(symbol, history);
                }
            }
        } catch (error) {
            logger.error(`Error updating price history for ${symbol}:`, error);
        }
    }
    
    async broadcastArbitrageOpportunities() {
        const opportunities = [];
        
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
                opportunities: opportunities.slice(0, 10) // 只发送前10个最佳机会
            });
        }
    }
    
    // 设置价格预警
    setPriceAlert(symbol, targetPrice, type = 'above', callback = null) {
        const alertId = `${symbol}_${type}_${targetPrice}_${Date.now()}`;
        
        const alert = {
            id: alertId,
            symbol,
            targetPrice,
            type, // 'above', 'below'
            callback,
            createdAt: new Date().toISOString(),
            triggered: false
        };
        
        if (!this.priceAlerts.has(symbol)) {
            this.priceAlerts.set(symbol, []);
        }
        
        this.priceAlerts.get(symbol).push(alert);
        logger.info(`Price alert set: ${symbol} ${type} ${targetPrice}`);
        
        return alertId;
    }
    
    // 移除价格预警
    removePriceAlert(alertId) {
        for (const [symbol, alerts] of this.priceAlerts.entries()) {
            const index = alerts.findIndex(alert => alert.id === alertId);
            if (index !== -1) {
                alerts.splice(index, 1);
                logger.info(`Price alert removed: ${alertId}`);
                return true;
            }
        }
        return false;
    }
    
    // 检查价格预警
    async checkPriceAlerts(symbol, prices) {
        const alerts = this.priceAlerts.get(symbol);
        if (!alerts || alerts.length === 0) return;
        
        for (const alert of alerts) {
            if (alert.triggered) continue;
            
            // 使用Binance价格作为参考
            const currentPrice = prices.binance ? prices.binance.price : null;
            if (!currentPrice) continue;
            
            let shouldTrigger = false;
            
            if (alert.type === 'above' && currentPrice >= alert.targetPrice) {
                shouldTrigger = true;
            } else if (alert.type === 'below' && currentPrice <= alert.targetPrice) {
                shouldTrigger = true;
            }
            
            if (shouldTrigger) {
                alert.triggered = true;
                
                const alertData = {
                    id: alert.id,
                    symbol: alert.symbol,
                    currentPrice,
                    targetPrice: alert.targetPrice,
                    type: alert.type,
                    timestamp: new Date().toISOString()
                };
                
                // 广播预警
                this.io.emit('price_alert', alertData);
                
                // 执行回调
                if (alert.callback && typeof alert.callback === 'function') {
                    try {
                        await alert.callback(alertData);
                    } catch (error) {
                        logger.error(`Error executing price alert callback:`, error);
                    }
                }
                
                logger.info(`Price alert triggered: ${symbol} ${alert.type} ${alert.targetPrice}, current: ${currentPrice}`);
            }
        }
        
        // 清理已触发的预警
        this.priceAlerts.set(symbol, alerts.filter(alert => !alert.triggered));
    }
    
    // 获取价格历史
    getPriceHistory(symbol, limit = 100) {
        const history = this.priceHistory.get(symbol) || [];
        return history.slice(-limit);
    }
    
    // 获取当前监控的交易对
    getWatchedSymbols() {
        return [...this.watchedSymbols];
    }
    
    // 添加监控交易对
    addWatchedSymbol(symbol) {
        if (!this.watchedSymbols.includes(symbol)) {
            this.watchedSymbols.push(symbol);
            logger.info(`Added ${symbol} to watched symbols`);
            
            // 初始化该交易对的价格历史
            this.initializePriceHistory().catch(error => {
                logger.error(`Failed to initialize price history for new symbol ${symbol}:`, error);
            });
        }
    }
    
    // 移除监控交易对
    removeWatchedSymbol(symbol) {
        const index = this.watchedSymbols.indexOf(symbol);
        if (index !== -1) {
            this.watchedSymbols.splice(index, 1);
            this.priceHistory.delete(symbol);
            this.priceAlerts.delete(symbol);
            logger.info(`Removed ${symbol} from watched symbols`);
        }
    }
    
    // 获取价格变化统计
    getPriceChangeStats(symbol, timeframe = '24h') {
        const history = this.priceHistory.get(symbol);
        if (!history || history.length < 2) {
            return null;
        }
        
        let periods;
        switch (timeframe) {
            case '1h':
                periods = 60; // 60分钟
                break;
            case '4h':
                periods = 240; // 4小时
                break;
            case '24h':
            default:
                periods = 1440; // 24小时
                break;
        }
        
        const currentPrice = history[history.length - 1][4]; // 当前收盘价
        const startIndex = Math.max(0, history.length - periods);
        const startPrice = history[startIndex][4]; // 开始时间的收盘价
        
        const change = currentPrice - startPrice;
        const changePercent = (change / startPrice) * 100;
        
        // 计算最高和最低价
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
    
    // 检测价格异常波动
    detectPriceAnomalies(symbol, threshold = 5) {
        const history = this.priceHistory.get(symbol);
        if (!history || history.length < 20) {
            return null;
        }
        
        const recentPrices = history.slice(-20).map(candle => candle[4]);
        const currentPrice = recentPrices[recentPrices.length - 1];
        const previousPrices = recentPrices.slice(0, -1);
        
        // 计算平均价和标准差
        const avgPrice = previousPrices.reduce((sum, price) => sum + price, 0) / previousPrices.length;
        const variance = previousPrices.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) / previousPrices.length;
        const stdDev = Math.sqrt(variance);
        
        // 计算Z-score
        const zScore = Math.abs((currentPrice - avgPrice) / stdDev);
        
        if (zScore > threshold) {
            const anomaly = {
                symbol,
                currentPrice,
                avgPrice,
                zScore: parseFloat(zScore.toFixed(2)),
                threshold,
                type: currentPrice > avgPrice ? 'SPIKE' : 'DROP',
                severity: zScore > threshold * 2 ? 'HIGH' : 'MEDIUM',
                timestamp: new Date().toISOString()
            };
            
            // 广播异常检测
            this.io.emit('price_anomaly', anomaly);
            
            logger.warn(`Price anomaly detected for ${symbol}: ${anomaly.type} with Z-score ${zScore}`);
            
            return anomaly;
        }
        
        return null;
    }
}

module.exports = PriceMonitor;
