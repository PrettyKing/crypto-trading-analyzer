const express = require('express');
const router = express.Router();
const ExchangeManager = require('../exchanges/ExchangeManager');
const TechnicalIndicators = require('../indicators/TechnicalIndicators');
const logger = require('../utils/logger');

// 创建全局实例
const exchangeManager = new ExchangeManager();
const technicalIndicators = new TechnicalIndicators();

// 初始化交易所管理器
exchangeManager.initialize().catch(error => {
    logger.error('Failed to initialize exchange manager in API routes:', error);
});

// 获取支持的交易所列表
router.get('/exchanges', async (req, res) => {
    try {
        const exchanges = exchangeManager.getAvailableExchanges();
        res.json({
            success: true,
            data: exchanges
        });
    } catch (error) {
        logger.error('Error getting exchanges:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 获取交易所详细信息
router.get('/exchanges/:exchange', async (req, res) => {
    try {
        const { exchange } = req.params;
        const info = await exchangeManager.getExchangeInfo(exchange);
        res.json({
            success: true,
            data: info
        });
    } catch (error) {
        logger.error(`Error getting exchange info for ${req.params.exchange}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 获取实时价格
router.get('/price/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { exchange = 'binance' } = req.query;
        
        const ticker = await exchangeManager.getTicker(exchange, symbol);
        res.json({
            success: true,
            data: {
                symbol,
                exchange,
                price: ticker.last,
                bid: ticker.bid,
                ask: ticker.ask,
                volume: ticker.baseVolume,
                change: ticker.change,
                percentage: ticker.percentage,
                timestamp: ticker.timestamp
            }
        });
    } catch (error) {
        logger.error(`Error getting price for ${req.params.symbol}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 获取多交易所价格对比
router.get('/prices/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const prices = await exchangeManager.getMultiExchangePrices(symbol);
        
        res.json({
            success: true,
            data: {
                symbol,
                prices,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        logger.error(`Error getting multi-exchange prices for ${req.params.symbol}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 获取K线数据
router.get('/ohlcv/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { 
            exchange = 'binance',
            timeframe = '1h',
            limit = 100
        } = req.query;
        
        const ohlcv = await exchangeManager.getOHLCV(exchange, symbol, timeframe, parseInt(limit));
        
        res.json({
            success: true,
            data: {
                symbol,
                exchange,
                timeframe,
                ohlcv: ohlcv.map(candle => ({
                    timestamp: candle[0],
                    open: candle[1],
                    high: candle[2],
                    low: candle[3],
                    close: candle[4],
                    volume: candle[5]
                }))
            }
        });
    } catch (error) {
        logger.error(`Error getting OHLCV for ${req.params.symbol}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 获取订单簿
router.get('/orderbook/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { exchange = 'binance', limit = 20 } = req.query;
        
        const orderBook = await exchangeManager.getOrderBook(exchange, symbol, parseInt(limit));
        
        res.json({
            success: true,
            data: {
                symbol,
                exchange,
                bids: orderBook.bids,
                asks: orderBook.asks,
                timestamp: orderBook.timestamp
            }
        });
    } catch (error) {
        logger.error(`Error getting order book for ${req.params.symbol}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 获取技术指标
router.get('/indicators/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const {
            exchange = 'binance',
            timeframe = '1h',
            limit = 100
        } = req.query;
        
        const ohlcv = await exchangeManager.getOHLCV(exchange, symbol, timeframe, parseInt(limit));
        
        if (!ohlcv || ohlcv.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No OHLCV data available'
            });
        }
        
        const indicators = await technicalIndicators.calculateAll(ohlcv);
        
        res.json({
            success: true,
            data: {
                symbol,
                exchange,
                timeframe,
                indicators
            }
        });
    } catch (error) {
        logger.error(`Error calculating indicators for ${req.params.symbol}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 获取交易信号
router.get('/signals/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const {
            exchange = 'binance',
            timeframe = '1h'
        } = req.query;
        
        const ohlcv = await exchangeManager.getOHLCV(exchange, symbol, timeframe, 100);
        
        if (!ohlcv || ohlcv.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No OHLCV data available'
            });
        }
        
        const indicators = await technicalIndicators.calculateAll(ohlcv);
        
        res.json({
            success: true,
            data: {
                symbol,
                exchange,
                timeframe,
                signals: indicators.signals,
                recommendations: generateTradeRecommendations(indicators, ohlcv)
            }
        });
    } catch (error) {
        logger.error(`Error getting signals for ${req.params.symbol}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 获取套利机会
router.get('/arbitrage/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const opportunities = await exchangeManager.calculateArbitrageOpportunities(symbol);
        
        res.json({
            success: true,
            data: {
                symbol,
                opportunities,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        logger.error(`Error calculating arbitrage for ${req.params.symbol}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 获取所有套利机会
router.get('/arbitrage', async (req, res) => {
    try {
        const symbols = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'ADA/USDT'];
        const allOpportunities = [];
        
        const promises = symbols.map(async (symbol) => {
            try {
                const opportunities = await exchangeManager.calculateArbitrageOpportunities(symbol);
                allOpportunities.push(...opportunities);
            } catch (error) {
                logger.error(`Error calculating arbitrage for ${symbol}:`, error);
            }
        });
        
        await Promise.all(promises);
        
        // 按收益率排序
        allOpportunities.sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage));
        
        res.json({
            success: true,
            data: {
                opportunities: allOpportunities.slice(0, 20), // 返回前20个最佳机会
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        logger.error('Error getting all arbitrage opportunities:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 获取账户余额
router.get('/balance/:exchange', async (req, res) => {
    try {
        const { exchange } = req.params;
        const balance = await exchangeManager.getBalance(exchange);
        
        res.json({
            success: true,
            data: {
                exchange,
                balance: balance.total,
                free: balance.free,
                used: balance.used,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        logger.error(`Error getting balance for ${req.params.exchange}:`, error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 创建订单（演示用）
router.post('/orders', async (req, res) => {
    try {
        const {
            exchange,
            symbol,
            type,
            side,
            amount,
            price
        } = req.body;
        
        if (!exchange || !symbol || !type || !side || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Missing required parameters'
            });
        }
        
        // 注意：这里只是演示，实际使用时需要更多安全检查
        const order = await exchangeManager.createOrder(
            exchange,
            symbol,
            type,
            side,
            parseFloat(amount),
            price ? parseFloat(price) : undefined
        );
        
        res.json({
            success: true,
            data: order
        });
    } catch (error) {
        logger.error('Error creating order:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 生成交易建议
function generateTradeRecommendations(indicators, ohlcv) {
    const currentPrice = ohlcv[ohlcv.length - 1][4];
    const recommendations = {
        action: 'HOLD',
        confidence: 0,
        entryPrice: currentPrice,
        stopLoss: null,
        takeProfit: null,
        riskLevel: 'MEDIUM',
        reasoning: []
    };
    
    const signals = indicators.signals;
    
    if (signals.overall === 'BULLISH') {
        recommendations.action = 'BUY';
        recommendations.confidence = signals.strength;
        recommendations.stopLoss = currentPrice * 0.95; // 5%止损
        recommendations.takeProfit = currentPrice * 1.1; // 10%止盈
        recommendations.reasoning.push('多个技术指标显示看涨信号');
        
        // 基于ATR设置更精确的止损
        if (indicators.atr && indicators.atr.length > 0) {
            const atr = indicators.atr[indicators.atr.length - 1];
            recommendations.stopLoss = currentPrice - (atr * 2);
        }
        
    } else if (signals.overall === 'BEARISH') {
        recommendations.action = 'SELL';
        recommendations.confidence = signals.strength;
        recommendations.reasoning.push('多个技术指标显示看跌信号');
    }
    
    // 基于RSI调整建议
    if (indicators.rsi && indicators.rsi.length > 0) {
        const rsi = indicators.rsi[indicators.rsi.length - 1];
        if (rsi > 80) {
            recommendations.riskLevel = 'HIGH';
            recommendations.reasoning.push('RSI超买，风险较高');
        } else if (rsi < 20) {
            recommendations.riskLevel = 'LOW';
            recommendations.reasoning.push('RSI超卖，可能是买入机会');
        }
    }
    
    return recommendations;
}

// 错误处理中间件
router.use((error, req, res, next) => {
    logger.error('API Error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

module.exports = router;
