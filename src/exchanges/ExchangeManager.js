const ccxt = require('ccxt');
const logger = require('../utils/logger');

class ExchangeManager {
    constructor() {
        this.exchanges = {};
        this.supportedExchanges = ['binance', 'okx', 'huobi'];
    }
    
    async initialize() {
        try {
            // 初始化Binance
            if (process.env.BINANCE_API_KEY && process.env.BINANCE_SECRET) {
                this.exchanges.binance = new ccxt.binance({
                    apiKey: process.env.BINANCE_API_KEY,
                    secret: process.env.BINANCE_SECRET,
                    sandbox: process.env.NODE_ENV === 'development',
                    enableRateLimit: true,
                    options: {
                        adjustForTimeDifference: true
                    }
                });
                logger.info('Binance exchange initialized');
            }
            
            // 初始化OKX
            if (process.env.OKX_API_KEY && process.env.OKX_SECRET && process.env.OKX_PASSPHRASE) {
                this.exchanges.okx = new ccxt.okx({
                    apiKey: process.env.OKX_API_KEY,
                    secret: process.env.OKX_SECRET,
                    password: process.env.OKX_PASSPHRASE,
                    sandbox: process.env.NODE_ENV === 'development',
                    enableRateLimit: true
                });
                logger.info('OKX exchange initialized');
            }
            
            // 测试连接
            await this.testConnections();
            
        } catch (error) {
            logger.error('Failed to initialize exchanges:', error);
            throw error;
        }
    }
    
    async testConnections() {
        for (const [name, exchange] of Object.entries(this.exchanges)) {
            try {
                await exchange.loadMarkets();
                logger.info(`${name} connection test successful`);
            } catch (error) {
                logger.warn(`${name} connection test failed:`, error.message);
            }
        }
    }
    
    getExchange(exchangeName) {
        const exchange = this.exchanges[exchangeName.toLowerCase()];
        if (!exchange) {
            throw new Error(`Exchange ${exchangeName} not available`);
        }
        return exchange;
    }
    
    async getTicker(exchangeName, symbol) {
        try {
            const exchange = this.getExchange(exchangeName);
            return await exchange.fetchTicker(symbol);
        } catch (error) {
            logger.error(`Error fetching ticker for ${symbol} on ${exchangeName}:`, error);
            throw error;
        }
    }
    
    async getOHLCV(exchangeName, symbol, timeframe = '1h', limit = 100) {
        try {
            const exchange = this.getExchange(exchangeName);
            return await exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
        } catch (error) {
            logger.error(`Error fetching OHLCV for ${symbol} on ${exchangeName}:`, error);
            throw error;
        }
    }
    
    async getOrderBook(exchangeName, symbol, limit = 20) {
        try {
            const exchange = this.getExchange(exchangeName);
            return await exchange.fetchOrderBook(symbol, limit);
        } catch (error) {
            logger.error(`Error fetching order book for ${symbol} on ${exchangeName}:`, error);
            throw error;
        }
    }
    
    async getTrades(exchangeName, symbol, limit = 50) {
        try {
            const exchange = this.getExchange(exchangeName);
            return await exchange.fetchTrades(symbol, undefined, limit);
        } catch (error) {
            logger.error(`Error fetching trades for ${symbol} on ${exchangeName}:`, error);
            throw error;
        }
    }
    
    async getBalance(exchangeName) {
        try {
            const exchange = this.getExchange(exchangeName);
            return await exchange.fetchBalance();
        } catch (error) {
            logger.error(`Error fetching balance on ${exchangeName}:`, error);
            throw error;
        }
    }
    
    async createOrder(exchangeName, symbol, type, side, amount, price = undefined, params = {}) {
        try {
            const exchange = this.getExchange(exchangeName);
            return await exchange.createOrder(symbol, type, side, amount, price, params);
        } catch (error) {
            logger.error(`Error creating order on ${exchangeName}:`, error);
            throw error;
        }
    }
    
    async cancelOrder(exchangeName, orderId, symbol) {
        try {
            const exchange = this.getExchange(exchangeName);
            return await exchange.cancelOrder(orderId, symbol);
        } catch (error) {
            logger.error(`Error canceling order on ${exchangeName}:`, error);
            throw error;
        }
    }
    
    async getOrder(exchangeName, orderId, symbol) {
        try {
            const exchange = this.getExchange(exchangeName);
            return await exchange.fetchOrder(orderId, symbol);
        } catch (error) {
            logger.error(`Error fetching order on ${exchangeName}:`, error);
            throw error;
        }
    }
    
    // 获取多个交易所的价格进行对比
    async getMultiExchangePrices(symbol) {
        const prices = {};
        const promises = [];
        
        for (const [name, exchange] of Object.entries(this.exchanges)) {
            promises.push(
                this.getTicker(name, symbol)
                    .then(ticker => {
                        prices[name] = {
                            price: ticker.last,
                            bid: ticker.bid,
                            ask: ticker.ask,
                            volume: ticker.baseVolume,
                            timestamp: ticker.timestamp
                        };
                    })
                    .catch(error => {
                        logger.warn(`Failed to get price from ${name}: ${error.message}`);
                        prices[name] = null;
                    })
            );
        }
        
        await Promise.all(promises);
        return prices;
    }
    
    // 计算套利机会
    async calculateArbitrageOpportunities(symbol) {
        const prices = await this.getMultiExchangePrices(symbol);
        const opportunities = [];
        
        const validPrices = Object.entries(prices).filter(([_, data]) => data !== null);
        
        for (let i = 0; i < validPrices.length; i++) {
            for (let j = i + 1; j < validPrices.length; j++) {
                const [exchange1, data1] = validPrices[i];
                const [exchange2, data2] = validPrices[j];
                
                const priceDiff = Math.abs(data1.price - data2.price);
                const avgPrice = (data1.price + data2.price) / 2;
                const percentage = (priceDiff / avgPrice) * 100;
                
                if (percentage > 0.1) { // 0.1%以上的价差
                    opportunities.push({
                        symbol,
                        buyExchange: data1.price < data2.price ? exchange1 : exchange2,
                        sellExchange: data1.price < data2.price ? exchange2 : exchange1,
                        buyPrice: Math.min(data1.price, data2.price),
                        sellPrice: Math.max(data1.price, data2.price),
                        priceDifference: priceDiff,
                        percentage: percentage.toFixed(3),
                        timestamp: new Date().toISOString()
                    });
                }
            }
        }
        
        return opportunities.sort((a, b) => b.percentage - a.percentage);
    }
    
    getAvailableExchanges() {
        return Object.keys(this.exchanges);
    }
    
    async getExchangeInfo(exchangeName) {
        try {
            const exchange = this.getExchange(exchangeName);
            await exchange.loadMarkets();
            
            return {
                name: exchangeName,
                markets: Object.keys(exchange.markets).length,
                symbols: Object.keys(exchange.markets),
                fees: exchange.fees,
                limits: exchange.limits,
                capabilities: exchange.has
            };
        } catch (error) {
            logger.error(`Error getting exchange info for ${exchangeName}:`, error);
            throw error;
        }
    }
}

module.exports = ExchangeManager;
