const mysql = require('mysql2/promise');
const logger = require('./utils/logger');

let connection = null;

// 数据库配置
const dbConfig = {
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'password',
    database: process.env.MYSQL_DATABASE || 'trading_analyzer',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// 创建连接池
const pool = mysql.createPool(dbConfig);

// 初始化数据库
async function initDatabase() {
    try {
        // 测试连接
        const testConnection = await pool.getConnection();
        await testConnection.ping();
        testConnection.release();
        logger.info('Database connection established');
        
        // 创建表结构
        await createTables();
        logger.info('Database tables initialized');
        
    } catch (error) {
        logger.error('Database initialization failed:', error);
        throw error;
    }
}

// 创建数据表
async function createTables() {
    const tables = [
        // 价格历史表
        `CREATE TABLE IF NOT EXISTS price_history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            symbol VARCHAR(20) NOT NULL,
            exchange VARCHAR(20) NOT NULL,
            timestamp BIGINT NOT NULL,
            open DECIMAL(20,8) NOT NULL,
            high DECIMAL(20,8) NOT NULL,
            low DECIMAL(20,8) NOT NULL,
            close DECIMAL(20,8) NOT NULL,
            volume DECIMAL(20,8) NOT NULL,
            timeframe VARCHAR(10) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_symbol_exchange_timestamp (symbol, exchange, timestamp),
            INDEX idx_timestamp (timestamp),
            UNIQUE KEY unique_candle (symbol, exchange, timestamp, timeframe)
        )`,
        
        // 技术指标表
        `CREATE TABLE IF NOT EXISTS technical_indicators (
            id INT AUTO_INCREMENT PRIMARY KEY,
            symbol VARCHAR(20) NOT NULL,
            exchange VARCHAR(20) NOT NULL,
            timestamp BIGINT NOT NULL,
            timeframe VARCHAR(10) NOT NULL,
            rsi DECIMAL(10,4),
            macd DECIMAL(20,8),
            macd_signal DECIMAL(20,8),
            macd_histogram DECIMAL(20,8),
            sma_20 DECIMAL(20,8),
            sma_50 DECIMAL(20,8),
            ema_12 DECIMAL(20,8),
            ema_26 DECIMAL(20,8),
            bb_upper DECIMAL(20,8),
            bb_middle DECIMAL(20,8),
            bb_lower DECIMAL(20,8),
            stoch_k DECIMAL(10,4),
            stoch_d DECIMAL(10,4),
            atr DECIMAL(20,8),
            williams_r DECIMAL(10,4),
            cci DECIMAL(10,4),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_symbol_exchange_timestamp (symbol, exchange, timestamp),
            UNIQUE KEY unique_indicator (symbol, exchange, timestamp, timeframe)
        )`,
        
        // 交易信号表
        `CREATE TABLE IF NOT EXISTS trading_signals (
            id INT AUTO_INCREMENT PRIMARY KEY,
            symbol VARCHAR(20) NOT NULL,
            exchange VARCHAR(20) NOT NULL,
            signal_type ENUM('BUY', 'SELL', 'HOLD') NOT NULL,
            signal_strength DECIMAL(5,4) NOT NULL,
            price DECIMAL(20,8) NOT NULL,
            indicators_used JSON,
            reasoning TEXT,
            timestamp BIGINT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_symbol_timestamp (symbol, timestamp),
            INDEX idx_signal_type (signal_type)
        )`,
        
        // 套利机会表
        `CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
            id INT AUTO_INCREMENT PRIMARY KEY,
            symbol VARCHAR(20) NOT NULL,
            buy_exchange VARCHAR(20) NOT NULL,
            sell_exchange VARCHAR(20) NOT NULL,
            buy_price DECIMAL(20,8) NOT NULL,
            sell_price DECIMAL(20,8) NOT NULL,
            price_difference DECIMAL(20,8) NOT NULL,
            percentage DECIMAL(10,4) NOT NULL,
            timestamp BIGINT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_symbol_timestamp (symbol, timestamp),
            INDEX idx_percentage (percentage DESC)
        )`,
        
        // 价格预警表
        `CREATE TABLE IF NOT EXISTS price_alerts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            symbol VARCHAR(20) NOT NULL,
            target_price DECIMAL(20,8) NOT NULL,
            alert_type ENUM('above', 'below') NOT NULL,
            status ENUM('active', 'triggered', 'cancelled') DEFAULT 'active',
            user_id VARCHAR(100),
            notification_method ENUM('websocket', 'telegram', 'email'),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            triggered_at TIMESTAMP NULL,
            INDEX idx_symbol_status (symbol, status),
            INDEX idx_user_id (user_id)
        )`,
        
        // 交易历史表（用于模拟交易记录）
        `CREATE TABLE IF NOT EXISTS trading_history (
            id INT AUTO_INCREMENT PRIMARY KEY,
            symbol VARCHAR(20) NOT NULL,
            exchange VARCHAR(20) NOT NULL,
            order_type ENUM('market', 'limit', 'stop') NOT NULL,
            side ENUM('buy', 'sell') NOT NULL,
            amount DECIMAL(20,8) NOT NULL,
            price DECIMAL(20,8) NOT NULL,
            filled_amount DECIMAL(20,8) DEFAULT 0,
            status ENUM('pending', 'filled', 'cancelled', 'failed') DEFAULT 'pending',
            order_id VARCHAR(100),
            timestamp BIGINT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_symbol_timestamp (symbol, timestamp),
            INDEX idx_status (status),
            INDEX idx_order_id (order_id)
        )`
    ];
    
    for (const tableSQL of tables) {
        try {
            await pool.execute(tableSQL);
        } catch (error) {
            logger.error('Error creating table:', error);
            throw error;
        }
    }
}

// 保存价格历史数据
async function savePriceHistory(symbol, exchange, ohlcv, timeframe = '1h') {
    try {
        const query = `
            INSERT INTO price_history 
            (symbol, exchange, timestamp, open, high, low, close, volume, timeframe)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            open = VALUES(open),
            high = VALUES(high),
            low = VALUES(low),
            close = VALUES(close),
            volume = VALUES(volume)
        `;
        
        const values = [symbol, exchange, ohlcv[0], ohlcv[1], ohlcv[2], ohlcv[3], ohlcv[4], ohlcv[5], timeframe];
        await pool.execute(query, values);
        
    } catch (error) {
        logger.error('Error saving price history:', error);
        throw error;
    }
}

// 批量保存价格历史数据
async function saveBulkPriceHistory(data) {
    if (!data || data.length === 0) return;
    
    try {
        const query = `
            INSERT INTO price_history 
            (symbol, exchange, timestamp, open, high, low, close, volume, timeframe)
            VALUES ?
            ON DUPLICATE KEY UPDATE
            open = VALUES(open),
            high = VALUES(high),
            low = VALUES(low),
            close = VALUES(close),
            volume = VALUES(volume)
        `;
        
        await pool.query(query, [data]);
        
    } catch (error) {
        logger.error('Error saving bulk price history:', error);
        throw error;
    }
}

// 保存技术指标
async function saveTechnicalIndicators(symbol, exchange, timestamp, indicators, timeframe = '1h') {
    try {
        const query = `
            INSERT INTO technical_indicators 
            (symbol, exchange, timestamp, timeframe, rsi, macd, macd_signal, macd_histogram,
             sma_20, sma_50, ema_12, ema_26, bb_upper, bb_middle, bb_lower,
             stoch_k, stoch_d, atr, williams_r, cci)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            rsi = VALUES(rsi),
            macd = VALUES(macd),
            macd_signal = VALUES(macd_signal),
            macd_histogram = VALUES(macd_histogram),
            sma_20 = VALUES(sma_20),
            sma_50 = VALUES(sma_50),
            ema_12 = VALUES(ema_12),
            ema_26 = VALUES(ema_26),
            bb_upper = VALUES(bb_upper),
            bb_middle = VALUES(bb_middle),
            bb_lower = VALUES(bb_lower),
            stoch_k = VALUES(stoch_k),
            stoch_d = VALUES(stoch_d),
            atr = VALUES(atr),
            williams_r = VALUES(williams_r),
            cci = VALUES(cci)
        `;
        
        const values = [
            symbol, exchange, timestamp, timeframe,
            indicators.rsi ? indicators.rsi[indicators.rsi.length - 1] : null,
            indicators.macd ? indicators.macd.macd[indicators.macd.macd.length - 1] : null,
            indicators.macd ? indicators.macd.signal[indicators.macd.signal.length - 1] : null,
            indicators.macd ? indicators.macd.histogram[indicators.macd.histogram.length - 1] : null,
            indicators.sma ? indicators.sma.sma20[indicators.sma.sma20.length - 1] : null,
            indicators.sma ? indicators.sma.sma50[indicators.sma.sma50.length - 1] : null,
            indicators.ema ? indicators.ema.ema12[indicators.ema.ema12.length - 1] : null,
            indicators.ema ? indicators.ema.ema26[indicators.ema.ema26.length - 1] : null,
            indicators.bollinger ? indicators.bollinger.upper[indicators.bollinger.upper.length - 1] : null,
            indicators.bollinger ? indicators.bollinger.middle[indicators.bollinger.middle.length - 1] : null,
            indicators.bollinger ? indicators.bollinger.lower[indicators.bollinger.lower.length - 1] : null,
            indicators.stochastic ? indicators.stochastic.k[indicators.stochastic.k.length - 1] : null,
            indicators.stochastic ? indicators.stochastic.d[indicators.stochastic.d.length - 1] : null,
            indicators.atr ? indicators.atr[indicators.atr.length - 1] : null,
            indicators.williamsR ? indicators.williamsR[indicators.williamsR.length - 1] : null,
            indicators.cci ? indicators.cci[indicators.cci.length - 1] : null
        ];
        
        await pool.execute(query, values);
        
    } catch (error) {
        logger.error('Error saving technical indicators:', error);
        throw error;
    }
}

// 保存交易信号
async function saveTradingSignal(symbol, exchange, signal) {
    try {
        const query = `
            INSERT INTO trading_signals 
            (symbol, exchange, signal_type, signal_strength, price, indicators_used, reasoning, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const values = [
            symbol,
            exchange,
            signal.overall,
            signal.strength,
            signal.price || 0,
            JSON.stringify(signal.signals || []),
            signal.reasoning ? signal.reasoning.join('; ') : null,
            Date.now()
        ];
        
        await pool.execute(query, values);
        
    } catch (error) {
        logger.error('Error saving trading signal:', error);
        throw error;
    }
}

// 保存套利机会
async function saveArbitrageOpportunity(opportunity) {
    try {
        const query = `
            INSERT INTO arbitrage_opportunities 
            (symbol, buy_exchange, sell_exchange, buy_price, sell_price, price_difference, percentage, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const values = [
            opportunity.symbol,
            opportunity.buyExchange,
            opportunity.sellExchange,
            opportunity.buyPrice,
            opportunity.sellPrice,
            opportunity.priceDifference,
            opportunity.percentage,
            Date.now()
        ];
        
        await pool.execute(query, values);
        
    } catch (error) {
        logger.error('Error saving arbitrage opportunity:', error);
        throw error;
    }
}

// 获取价格历史
async function getPriceHistory(symbol, exchange, timeframe = '1h', limit = 100) {
    try {
        const query = `
            SELECT timestamp, open, high, low, close, volume
            FROM price_history
            WHERE symbol = ? AND exchange = ? AND timeframe = ?
            ORDER BY timestamp DESC
            LIMIT ?
        `;
        
        const [rows] = await pool.execute(query, [symbol, exchange, timeframe, limit]);
        return rows.reverse(); // 返回时间升序
        
    } catch (error) {
        logger.error('Error getting price history:', error);
        throw error;
    }
}

// 获取最新交易信号
async function getLatestTradingSignals(symbol, limit = 10) {
    try {
        const query = `
            SELECT *
            FROM trading_signals
            WHERE symbol = ?
            ORDER BY timestamp DESC
            LIMIT ?
        `;
        
        const [rows] = await pool.execute(query, [symbol, limit]);
        return rows;
        
    } catch (error) {
        logger.error('Error getting latest trading signals:', error);
        throw error;
    }
}

// 获取套利机会历史
async function getArbitrageHistory(symbol, hours = 24, limit = 100) {
    try {
        const sinceTimestamp = Date.now() - (hours * 60 * 60 * 1000);
        const query = `
            SELECT *
            FROM arbitrage_opportunities
            WHERE symbol = ? AND timestamp >= ?
            ORDER BY percentage DESC, timestamp DESC
            LIMIT ?
        `;
        
        const [rows] = await pool.execute(query, [symbol, sinceTimestamp, limit]);
        return rows;
        
    } catch (error) {
        logger.error('Error getting arbitrage history:', error);
        throw error;
    }
}

// 清理旧数据
async function cleanupOldData(daysToKeep = 30) {
    try {
        const cutoffTimestamp = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
        
        const tables = ['price_history', 'technical_indicators', 'trading_signals', 'arbitrage_opportunities'];
        
        for (const table of tables) {
            const query = `DELETE FROM ${table} WHERE timestamp < ?`;
            const [result] = await pool.execute(query, [cutoffTimestamp]);
            logger.info(`Cleaned up ${result.affectedRows} old records from ${table}`);
        }
        
    } catch (error) {
        logger.error('Error cleaning up old data:', error);
        throw error;
    }
}

// 获取数据库统计
async function getDatabaseStats() {
    try {
        const stats = {};
        
        const tables = ['price_history', 'technical_indicators', 'trading_signals', 'arbitrage_opportunities'];
        
        for (const table of tables) {
            const [rows] = await pool.execute(`SELECT COUNT(*) as count FROM ${table}`);
            stats[table] = rows[0].count;
        }
        
        return stats;
        
    } catch (error) {
        logger.error('Error getting database stats:', error);
        throw error;
    }
}

// 关闭数据库连接
async function closeDatabase() {
    try {
        await pool.end();
        logger.info('Database connection pool closed');
    } catch (error) {
        logger.error('Error closing database:', error);
        throw error;
    }
}

module.exports = {
    initDatabase,
    savePriceHistory,
    saveBulkPriceHistory,
    saveTechnicalIndicators,
    saveTradingSignal,
    saveArbitrageOpportunity,
    getPriceHistory,
    getLatestTradingSignals,
    getArbitrageHistory,
    cleanupOldData,
    getDatabaseStats,
    closeDatabase,
    pool
};
