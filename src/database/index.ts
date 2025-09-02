import { MongoClient, Db, Collection } from 'mongodb';
import logger from '../utils/logger';
import {
    DatabaseConfig,
    PriceHistoryDocument,
    TechnicalIndicatorDocument,
    TradingSignalDocument,
    ArbitrageOpportunityDocument,
    OHLCVArray,
    TechnicalIndicators,
    TradingSignals,
    ArbitrageOpportunity,
    DatabaseError
} from '../types';

let client: MongoClient;
let db: Db;

// 数据库配置
const dbConfig: DatabaseConfig = {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    dbName: process.env.MONGODB_DB_NAME || 'trading_analyzer',
    options: {
        maxPoolSize: 10,
        minPoolSize: 2,
        maxIdleTimeMS: 30000,
        serverSelectionTimeoutMS: 5000
    }
};

// 集合名称常量
const COLLECTIONS = {
    PRICE_HISTORY: 'price_history',
    TECHNICAL_INDICATORS: 'technical_indicators',
    TRADING_SIGNALS: 'trading_signals',
    ARBITRAGE_OPPORTUNITIES: 'arbitrage_opportunities',
    PRICE_ALERTS: 'price_alerts',
    TRADING_HISTORY: 'trading_history'
} as const;

export async function initDatabase(): Promise<void> {
    try {
        client = new MongoClient(dbConfig.uri, dbConfig.options);
        await client.connect();
        
        db = client.db(dbConfig.dbName);
        
        // 测试连接
        await db.admin().ping();
        logger.info('MongoDB connection established');
        
        // 创建索引
        await createIndexes();
        logger.info('MongoDB indexes created');
        
    } catch (error) {
        logger.error('Database initialization failed:', error);
        throw new DatabaseError('Failed to initialize MongoDB', 'initDatabase');
    }
}

async function createIndexes(): Promise<void> {
    try {
        // 价格历史索引
        await db.collection(COLLECTIONS.PRICE_HISTORY).createIndexes([
            { key: { symbol: 1, exchange: 1, timestamp: 1 }, unique: true },
            { key: { symbol: 1, timestamp: -1 } },
            { key: { exchange: 1 } },
            { key: { timeframe: 1 } },
            { key: { createdAt: 1 }, expireAfterSeconds: 30 * 24 * 60 * 60 } // 30天后过期
        ]);

        // 技术指标索引
        await db.collection(COLLECTIONS.TECHNICAL_INDICATORS).createIndexes([
            { key: { symbol: 1, exchange: 1, timestamp: 1, timeframe: 1 }, unique: true },
            { key: { symbol: 1, timestamp: -1 } },
            { key: { createdAt: 1 }, expireAfterSeconds: 30 * 24 * 60 * 60 } // 30天后过期
        ]);

        // 交易信号索引
        await db.collection(COLLECTIONS.TRADING_SIGNALS).createIndexes([
            { key: { symbol: 1, timestamp: -1 } },
            { key: { signal_type: 1 } },
            { key: { createdAt: 1 }, expireAfterSeconds: 30 * 24 * 60 * 60 } // 30天后过期
        ]);

        // 套利机会索引
        await db.collection(COLLECTIONS.ARBITRAGE_OPPORTUNITIES).createIndexes([
            { key: { symbol: 1, timestamp: -1 } },
            { key: { percentage: -1 } },
            { key: { createdAt: 1 }, expireAfterSeconds: 7 * 24 * 60 * 60 } // 7天后过期
        ]);

        // 价格预警索引
        await db.collection(COLLECTIONS.PRICE_ALERTS).createIndexes([
            { key: { symbol: 1, status: 1 } },
            { key: { user_id: 1 } },
            { key: { status: 1 } }
        ]);

        // 交易历史索引
        await db.collection(COLLECTIONS.TRADING_HISTORY).createIndexes([
            { key: { symbol: 1, timestamp: -1 } },
            { key: { status: 1 } },
            { key: { order_id: 1 }, unique: true, sparse: true },
            { key: { createdAt: 1 }, expireAfterSeconds: 365 * 24 * 60 * 60 } // 365天后过期
        ]);

        logger.info('MongoDB indexes created successfully');
    } catch (error) {
        logger.error('Error creating indexes:', error);
        throw error;
    }
}

export async function savePriceHistory(
    symbol: string,
    exchange: string,
    ohlcv: OHLCVArray,
    timeframe: string = '1h'
): Promise<void> {
    try {
        const collection = db.collection<PriceHistoryDocument>(COLLECTIONS.PRICE_HISTORY);
        
        const document: PriceHistoryDocument = {
            symbol,
            exchange,
            timestamp: ohlcv[0],
            open: ohlcv[1],
            high: ohlcv[2],
            low: ohlcv[3],
            close: ohlcv[4],
            volume: ohlcv[5],
            timeframe,
            createdAt: new Date()
        };

        await collection.replaceOne(
            { symbol, exchange, timestamp: ohlcv[0], timeframe },
            document,
            { upsert: true }
        );
        
    } catch (error) {
        logger.error('Error saving price history:', error);
        throw new DatabaseError('Failed to save price history', 'savePriceHistory');
    }
}

export async function saveBulkPriceHistory(data: PriceHistoryDocument[]): Promise<void> {
    if (!data || data.length === 0) return;
    
    try {
        const collection = db.collection<PriceHistoryDocument>(COLLECTIONS.PRICE_HISTORY);
        
        const operations = data.map(doc => ({
            replaceOne: {
                filter: { symbol: doc.symbol, exchange: doc.exchange, timestamp: doc.timestamp, timeframe: doc.timeframe },
                replacement: { ...doc, createdAt: new Date() },
                upsert: true
            }
        }));

        await collection.bulkWrite(operations);
        
    } catch (error) {
        logger.error('Error saving bulk price history:', error);
        throw new DatabaseError('Failed to save bulk price history', 'saveBulkPriceHistory');
    }
}

export async function saveTechnicalIndicators(
    symbol: string,
    exchange: string,
    timestamp: number,
    indicators: TechnicalIndicators,
    timeframe: string = '1h'
): Promise<void> {
    try {
        const collection = db.collection<TechnicalIndicatorDocument>(COLLECTIONS.TECHNICAL_INDICATORS);
        
        const document: TechnicalIndicatorDocument = {
            symbol,
            exchange,
            timestamp,
            timeframe,
            rsi: indicators.rsi && indicators.rsi.length > 0 ? indicators.rsi[indicators.rsi.length - 1] : undefined,
            macd: indicators.macd ? indicators.macd.macd[indicators.macd.macd.length - 1] : undefined,
            macd_signal: indicators.macd ? indicators.macd.signal[indicators.macd.signal.length - 1] : undefined,
            macd_histogram: indicators.macd ? indicators.macd.histogram[indicators.macd.histogram.length - 1] : undefined,
            sma_20: indicators.sma ? indicators.sma.sma20[indicators.sma.sma20.length - 1] : undefined,
            sma_50: indicators.sma ? indicators.sma.sma50[indicators.sma.sma50.length - 1] : undefined,
            ema_12: indicators.ema ? indicators.ema.ema12[indicators.ema.ema12.length - 1] : undefined,
            ema_26: indicators.ema ? indicators.ema.ema26[indicators.ema.ema26.length - 1] : undefined,
            bb_upper: indicators.bollinger ? indicators.bollinger.upper[indicators.bollinger.upper.length - 1] : undefined,
            bb_middle: indicators.bollinger ? indicators.bollinger.middle[indicators.bollinger.middle.length - 1] : undefined,
            bb_lower: indicators.bollinger ? indicators.bollinger.lower[indicators.bollinger.lower.length - 1] : undefined,
            stoch_k: indicators.stochastic ? indicators.stochastic.k[indicators.stochastic.k.length - 1] : undefined,
            stoch_d: indicators.stochastic ? indicators.stochastic.d[indicators.stochastic.d.length - 1] : undefined,
            atr: indicators.atr && indicators.atr.length > 0 ? indicators.atr[indicators.atr.length - 1] : undefined,
            williams_r: indicators.williamsR && indicators.williamsR.length > 0 ? indicators.williamsR[indicators.williamsR.length - 1] : undefined,
            cci: indicators.cci && indicators.cci.length > 0 ? indicators.cci[indicators.cci.length - 1] : undefined,
            createdAt: new Date()
        };

        await collection.replaceOne(
            { symbol, exchange, timestamp, timeframe },
            document,
            { upsert: true }
        );
        
    } catch (error) {
        logger.error('Error saving technical indicators:', error);
        throw new DatabaseError('Failed to save technical indicators', 'saveTechnicalIndicators');
    }
}

export async function saveTradingSignal(
    symbol: string,
    exchange: string,
    signal: TradingSignals & { price?: number; reasoning?: string[] }
): Promise<void> {
    try {
        const collection = db.collection<TradingSignalDocument>(COLLECTIONS.TRADING_SIGNALS);
        
        const document: TradingSignalDocument = {
            symbol,
            exchange,
            signal_type: signal.overall === 'BULLISH' ? 'BUY' : signal.overall === 'BEARISH' ? 'SELL' : 'HOLD',
            signal_strength: signal.strength,
            price: signal.price || 0,
            indicators_used: signal.signals || [],
            reasoning: signal.reasoning ? signal.reasoning.join('; ') : undefined,
            timestamp: Date.now(),
            createdAt: new Date()
        };

        await collection.insertOne(document);
        
    } catch (error) {
        logger.error('Error saving trading signal:', error);
        throw new DatabaseError('Failed to save trading signal', 'saveTradingSignal');
    }
}

export async function saveArbitrageOpportunity(opportunity: ArbitrageOpportunity): Promise<void> {
    try {
        const collection = db.collection<ArbitrageOpportunityDocument>(COLLECTIONS.ARBITRAGE_OPPORTUNITIES);
        
        const document: ArbitrageOpportunityDocument = {
            symbol: opportunity.symbol,
            buy_exchange: opportunity.buyExchange,
            sell_exchange: opportunity.sellExchange,
            buy_price: opportunity.buyPrice,
            sell_price: opportunity.sellPrice,
            price_difference: opportunity.priceDifference,
            percentage: parseFloat(opportunity.percentage),
            timestamp: Date.now(),
            createdAt: new Date()
        };

        await collection.insertOne(document);
        
    } catch (error) {
        logger.error('Error saving arbitrage opportunity:', error);
        throw new DatabaseError('Failed to save arbitrage opportunity', 'saveArbitrageOpportunity');
    }
}

export async function getPriceHistory(
    symbol: string,
    exchange: string,
    timeframe: string = '1h',
    limit: number = 100
): Promise<PriceHistoryDocument[]> {
    try {
        const collection = db.collection<PriceHistoryDocument>(COLLECTIONS.PRICE_HISTORY);
        
        const documents = await collection
            .find({ symbol, exchange, timeframe })
            .sort({ timestamp: -1 })
            .limit(limit)
            .toArray();
        
        return documents.reverse(); // 返回时间升序
        
    } catch (error) {
        logger.error('Error getting price history:', error);
        throw new DatabaseError('Failed to get price history', 'getPriceHistory');
    }
}

export async function getLatestTradingSignals(symbol: string, limit: number = 10): Promise<TradingSignalDocument[]> {
    try {
        const collection = db.collection<TradingSignalDocument>(COLLECTIONS.TRADING_SIGNALS);
        
        return await collection
            .find({ symbol })
            .sort({ timestamp: -1 })
            .limit(limit)
            .toArray();
        
    } catch (error) {
        logger.error('Error getting latest trading signals:', error);
        throw new DatabaseError('Failed to get latest trading signals', 'getLatestTradingSignals');
    }
}

export async function getArbitrageHistory(
    symbol: string,
    hours: number = 24,
    limit: number = 100
): Promise<ArbitrageOpportunityDocument[]> {
    try {
        const sinceTimestamp = Date.now() - (hours * 60 * 60 * 1000);
        const collection = db.collection<ArbitrageOpportunityDocument>(COLLECTIONS.ARBITRAGE_OPPORTUNITIES);
        
        return await collection
            .find({ 
                symbol, 
                timestamp: { $gte: sinceTimestamp } 
            })
            .sort({ percentage: -1, timestamp: -1 })
            .limit(limit)
            .toArray();
        
    } catch (error) {
        logger.error('Error getting arbitrage history:', error);
        throw new DatabaseError('Failed to get arbitrage history', 'getArbitrageHistory');
    }
}

export async function cleanupOldData(daysToKeep: number = 30): Promise<void> {
    try {
        const cutoffDate = new Date(Date.now() - (daysToKeep * 24 * 60 * 60 * 1000));
        
        const collections = [
            COLLECTIONS.PRICE_HISTORY,
            COLLECTIONS.TECHNICAL_INDICATORS,
            COLLECTIONS.TRADING_SIGNALS,
            COLLECTIONS.ARBITRAGE_OPPORTUNITIES
        ];
        
        for (const collectionName of collections) {
            const result = await db.collection(collectionName).deleteMany({
                createdAt: { $lt: cutoffDate }
            });
            logger.info(`Cleaned up ${result.deletedCount} old records from ${collectionName}`);
        }
        
    } catch (error) {
        logger.error('Error cleaning up old data:', error);
        throw new DatabaseError('Failed to cleanup old data', 'cleanupOldData');
    }
}

export async function getDatabaseStats(): Promise<Record<string, number>> {
    try {
        const stats: Record<string, number> = {};
        
        const collections = [
            COLLECTIONS.PRICE_HISTORY,
            COLLECTIONS.TECHNICAL_INDICATORS,
            COLLECTIONS.TRADING_SIGNALS,
            COLLECTIONS.ARBITRAGE_OPPORTUNITIES
        ];
        
        for (const collectionName of collections) {
            const count = await db.collection(collectionName).countDocuments();
            stats[collectionName] = count;
        }
        
        return stats;
        
    } catch (error) {
        logger.error('Error getting database stats:', error);
        throw new DatabaseError('Failed to get database stats', 'getDatabaseStats');
    }
}

export async function closeDatabase(): Promise<void> {
    try {
        if (client) {
            await client.close();
            logger.info('MongoDB connection closed');
        }
    } catch (error) {
        logger.error('Error closing database:', error);
        throw new DatabaseError('Failed to close database', 'closeDatabase');
    }
}

// 辅助函数：获取集合
export function getCollection(name: keyof typeof COLLECTIONS): Collection {
    if (!db) {
        throw new DatabaseError('Database not initialized', 'getCollection');
    }
    return db.collection(COLLECTIONS[name]);
}

// 导出数据库实例和客户端
export { db, client, COLLECTIONS };