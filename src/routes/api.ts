import express, { Request, Response, NextFunction } from 'express';
import { ExchangeManager } from '../exchanges/ExchangeManager';
import { TechnicalIndicators } from '../indicators/TechnicalIndicators';
import logger from '../utils/logger';
import {
    ApiResponse,
    ExchangeInfo,
    OHLCVData,
    TechnicalIndicators as ITechnicalIndicators,
    TradingSignals,
    TradeRecommendation,
    ArbitrageOpportunity,
    OHLCVArray
} from '../types';

const router = express.Router();

const exchangeManager = new ExchangeManager();
const technicalIndicators = new TechnicalIndicators();

exchangeManager.initialize().catch(error => {
    logger.error('Failed to initialize exchange manager in API routes:', error);
});

router.get('/exchanges', async (_req: Request, res: Response<ApiResponse<string[]>>) => {
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
            error: (error as Error).message
        });
    }
});

router.get('/exchanges/:exchange', async (req: Request, res: Response<ApiResponse<ExchangeInfo>>) => {
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
            error: (error as Error).message
        });
    }
});

interface PriceResponse {
    symbol: string;
    exchange: string;
    price: number;
    bid: number;
    ask: number;
    volume: number;
    change: number;
    percentage: number;
    timestamp: number;
}

router.get('/price/:symbol', async (req: Request, res: Response<ApiResponse<PriceResponse>>) => {
    try {
        const { symbol } = req.params;
        const { exchange = 'binance' } = req.query as { exchange?: string };
        
        const ticker = await exchangeManager.getTicker(exchange, symbol);
        res.json({
            success: true,
            data: {
                symbol,
                exchange,
                price: ticker.last!,
                bid: ticker.bid!,
                ask: ticker.ask!,
                volume: ticker.baseVolume!,
                change: ticker.change!,
                percentage: ticker.percentage!,
                timestamp: ticker.timestamp!
            }
        });
    } catch (error) {
        logger.error(`Error getting price for ${req.params.symbol}:`, error);
        res.status(500).json({
            success: false,
            error: (error as Error).message
        });
    }
});

interface MultiExchangePriceResponse {
    symbol: string;
    prices: Record<string, any>;
    timestamp: string;
}

router.get('/prices/:symbol', async (req: Request, res: Response<ApiResponse<MultiExchangePriceResponse>>) => {
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
            error: (error as Error).message
        });
    }
});

interface OHLCVResponse {
    symbol: string;
    exchange: string;
    timeframe: string;
    ohlcv: OHLCVData[];
}

router.get('/ohlcv/:symbol', async (req: Request, res: Response<ApiResponse<OHLCVResponse>>) => {
    try {
        const { symbol } = req.params;
        const { 
            exchange = 'binance',
            timeframe = '1h',
            limit = '100'
        } = req.query as { exchange?: string; timeframe?: string; limit?: string };
        
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
            error: (error as Error).message
        });
    }
});

interface OrderBookResponse {
    symbol: string;
    exchange: string;
    bids: [number, number][];
    asks: [number, number][];
    timestamp: number;
}

router.get('/orderbook/:symbol', async (req: Request, res: Response<ApiResponse<OrderBookResponse>>) => {
    try {
        const { symbol } = req.params;
        const { exchange = 'binance', limit = '20' } = req.query as { exchange?: string; limit?: string };
        
        const orderBook = await exchangeManager.getOrderBook(exchange, symbol, parseInt(limit));
        
        res.json({
            success: true,
            data: {
                symbol,
                exchange,
                bids: orderBook.bids,
                asks: orderBook.asks,
                timestamp: orderBook.timestamp!
            }
        });
    } catch (error) {
        logger.error(`Error getting order book for ${req.params.symbol}:`, error);
        res.status(500).json({
            success: false,
            error: (error as Error).message
        });
    }
});

interface IndicatorsResponse {
    symbol: string;
    exchange: string;
    timeframe: string;
    indicators: ITechnicalIndicators;
}

router.get('/indicators/:symbol', async (req: Request, res: Response<ApiResponse<IndicatorsResponse>>) => {
    try {
        const { symbol } = req.params;
        const {
            exchange = 'binance',
            timeframe = '1h',
            limit = '100'
        } = req.query as { exchange?: string; timeframe?: string; limit?: string };
        
        const ohlcv = await exchangeManager.getOHLCV(exchange, symbol, timeframe, parseInt(limit));
        
        if (!ohlcv || ohlcv.length === 0) {
            res.status(404).json({
                success: false,
                error: 'No OHLCV data available'
            });
            return;
        }
        
        const calculatedIndicators = await technicalIndicators.calculateAll(ohlcv);
        
        res.json({
            success: true,
            data: {
                symbol,
                exchange,
                timeframe,
                indicators: calculatedIndicators
            }
        });
    } catch (error) {
        logger.error(`Error calculating indicators for ${req.params.symbol}:`, error);
        res.status(500).json({
            success: false,
            error: (error as Error).message
        });
    }
});

interface SignalsResponse {
    symbol: string;
    exchange: string;
    timeframe: string;
    signals: TradingSignals;
    recommendations: TradeRecommendation;
}

router.get('/signals/:symbol', async (req: Request, res: Response<ApiResponse<SignalsResponse>>) => {
    try {
        const { symbol } = req.params;
        const {
            exchange = 'binance',
            timeframe = '1h'
        } = req.query as { exchange?: string; timeframe?: string };
        
        const ohlcv = await exchangeManager.getOHLCV(exchange, symbol, timeframe, 100);
        
        if (!ohlcv || ohlcv.length === 0) {
            res.status(404).json({
                success: false,
                error: 'No OHLCV data available'
            });
            return;
        }
        
        const calculatedIndicators = await technicalIndicators.calculateAll(ohlcv);
        
        res.json({
            success: true,
            data: {
                symbol,
                exchange,
                timeframe,
                signals: calculatedIndicators.signals,
                recommendations: generateTradeRecommendations(calculatedIndicators, ohlcv)
            }
        });
    } catch (error) {
        logger.error(`Error getting signals for ${req.params.symbol}:`, error);
        res.status(500).json({
            success: false,
            error: (error as Error).message
        });
    }
});

interface ArbitrageResponse {
    symbol: string;
    opportunities: ArbitrageOpportunity[];
    timestamp: string;
}

router.get('/arbitrage/:symbol', async (req: Request, res: Response<ApiResponse<ArbitrageResponse>>) => {
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
            error: (error as Error).message
        });
    }
});

interface AllArbitrageResponse {
    opportunities: ArbitrageOpportunity[];
    timestamp: string;
}

router.get('/arbitrage', async (_: Request, res: Response<ApiResponse<AllArbitrageResponse>>) => {
    try {
        const symbols = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'ADA/USDT'];
        const allOpportunities: ArbitrageOpportunity[] = [];
        
        const promises = symbols.map(async (symbol) => {
            try {
                const opportunities = await exchangeManager.calculateArbitrageOpportunities(symbol);
                allOpportunities.push(...opportunities);
            } catch (error) {
                logger.error(`Error calculating arbitrage for ${symbol}:`, error);
            }
        });
        
        await Promise.all(promises);
        
        allOpportunities.sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage));
        
        res.json({
            success: true,
            data: {
                opportunities: allOpportunities.slice(0, 20),
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        logger.error('Error getting all arbitrage opportunities:', error);
        res.status(500).json({
            success: false,
            error: (error as Error).message
        });
    }
});

interface BalanceResponse {
    exchange: string;
    balance: Record<string, number>;
    free: Record<string, number>;
    used: Record<string, number>;
    timestamp: string;
}

router.get('/balance/:exchange', async (req: Request, res: Response<ApiResponse<BalanceResponse>>) => {
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
            error: (error as Error).message
        });
    }
});

interface CreateOrderRequest {
    exchange: string;
    symbol: string;
    type: string;
    side: string;
    amount: string;
    price?: string;
}

router.post('/orders', async (_: Request<{}, ApiResponse, CreateOrderRequest>, res: Response<ApiResponse>) => {
    try {
        const {
            exchange,
            symbol,
            type,
            side,
            amount,
            price
        } = _.body;
        
        if (!exchange || !symbol || !type || !side || !amount) {
            res.status(400).json({
                success: false,
                error: 'Missing required parameters'
            });
            return;
        }
        
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
            error: (error as Error).message
        });
    }
});

function generateTradeRecommendations(indicators: ITechnicalIndicators, ohlcv: OHLCVArray[]): TradeRecommendation {
    const currentPrice = ohlcv[ohlcv.length - 1][4];
    const recommendations: TradeRecommendation = {
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
        recommendations.stopLoss = currentPrice * 0.95;
        recommendations.takeProfit = currentPrice * 1.1;
        recommendations.reasoning.push('多个技术指标显示看涨信号');
        
        if (indicators.atr && indicators.atr.length > 0) {
            const atr = indicators.atr[indicators.atr.length - 1];
            recommendations.stopLoss = currentPrice - (atr * 2);
        }
        
    } else if (signals.overall === 'BEARISH') {
        recommendations.action = 'SELL';
        recommendations.confidence = signals.strength;
        recommendations.reasoning.push('多个技术指标显示看跌信号');
    }
    
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

router.use((error: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('API Error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

export default router;