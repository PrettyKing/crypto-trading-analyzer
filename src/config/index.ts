import { config } from 'dotenv';
import { AppConfig } from '../types';

// 加载环境变量
config();

// 配置验证函数
function validateConfig(): void {
    const requiredEnvVars = ['MONGODB_URI'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        console.warn(`Warning: Missing environment variables: ${missingVars.join(', ')}`);
        console.warn('Some features may not work properly.');
    }

    // 验证交易所配置
    const hasExchangeConfig = 
        (process.env.BINANCE_API_KEY && process.env.BINANCE_SECRET) ||
        (process.env.OKX_API_KEY && process.env.OKX_SECRET && process.env.OKX_PASSPHRASE);
    
    if (!hasExchangeConfig) {
        console.warn('Warning: No exchange API credentials found. Trading functionality will be limited.');
    }
}

// 应用配置
export const appConfig: AppConfig = {
    port: parseInt(process.env.PORT || '3000'),
    nodeEnv: process.env.NODE_ENV || 'development',
    
    mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
        dbName: process.env.MONGODB_DB_NAME || 'trading_analyzer',
        options: {
            maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || '10'),
            minPoolSize: parseInt(process.env.MONGODB_MIN_POOL_SIZE || '2'),
            maxIdleTimeMS: parseInt(process.env.MONGODB_MAX_IDLE_TIME_MS || '30000'),
            serverSelectionTimeoutMS: parseInt(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS || '5000')
        }
    },
    
    exchanges: {
        ...(process.env.BINANCE_API_KEY && process.env.BINANCE_SECRET && {
            binance: {
                apiKey: process.env.BINANCE_API_KEY,
                secret: process.env.BINANCE_SECRET,
                sandbox: process.env.NODE_ENV === 'development',
                enableRateLimit: true
            }
        }),
        
        ...(process.env.OKX_API_KEY && process.env.OKX_SECRET && process.env.OKX_PASSPHRASE && {
            okx: {
                apiKey: process.env.OKX_API_KEY,
                secret: process.env.OKX_SECRET,
                password: process.env.OKX_PASSPHRASE,
                sandbox: process.env.NODE_ENV === 'development',
                enableRateLimit: true
            }
        })
    }
};

// 其他配置选项
export const tradingConfig = {
    // 监控配置
    monitoring: {
        priceUpdateInterval: parseInt(process.env.PRICE_UPDATE_INTERVAL || '30000'), // 30秒
        indicatorsUpdateInterval: parseInt(process.env.INDICATORS_UPDATE_INTERVAL || '300000'), // 5分钟
        maxPriceHistoryLength: parseInt(process.env.MAX_PRICE_HISTORY_LENGTH || '1000'),
        priceAnomalyThreshold: parseFloat(process.env.PRICE_ANOMALY_THRESHOLD || '5'),
        watchedSymbols: (process.env.WATCHED_SYMBOLS || 'BTC/USDT,ETH/USDT,BNB/USDT,ADA/USDT,SOL/USDT').split(',')
    },
    
    // 技术指标配置
    indicators: {
        rsiPeriod: parseInt(process.env.RSI_PERIOD || '14'),
        smaPeriods: (process.env.SMA_PERIODS || '20,50').split(',').map(p => parseInt(p)),
        emaPeriods: (process.env.EMA_PERIODS || '12,26').split(',').map(p => parseInt(p)),
        macdFast: parseInt(process.env.MACD_FAST || '12'),
        macdSlow: parseInt(process.env.MACD_SLOW || '26'),
        macdSignal: parseInt(process.env.MACD_SIGNAL || '9'),
        bollingerPeriod: parseInt(process.env.BOLLINGER_PERIOD || '20'),
        bollingerMultiplier: parseFloat(process.env.BOLLINGER_MULTIPLIER || '2'),
        stochasticK: parseInt(process.env.STOCHASTIC_K || '14'),
        stochasticD: parseInt(process.env.STOCHASTIC_D || '3'),
        atrPeriod: parseInt(process.env.ATR_PERIOD || '14'),
        williamsRPeriod: parseInt(process.env.WILLIAMS_R_PERIOD || '14'),
        cciPeriod: parseInt(process.env.CCI_PERIOD || '20')
    },
    
    // 交易信号配置
    signals: {
        rsiBuyThreshold: parseInt(process.env.RSI_BUY_THRESHOLD || '30'),
        rsiSellThreshold: parseInt(process.env.RSI_SELL_THRESHOLD || '70'),
        bullishSignalThreshold: parseFloat(process.env.BULLISH_SIGNAL_THRESHOLD || '0.6'),
        bearishSignalThreshold: parseFloat(process.env.BEARISH_SIGNAL_THRESHOLD || '0.4')
    },
    
    // 套利配置
    arbitrage: {
        minProfitPercentage: parseFloat(process.env.MIN_PROFIT_PERCENTAGE || '0.5'),
        maxOpportunities: parseInt(process.env.MAX_OPPORTUNITIES || '20')
    },
    
    // 风险管理配置
    riskManagement: {
        defaultStopLossPercentage: parseFloat(process.env.DEFAULT_STOP_LOSS_PERCENTAGE || '5'),
        defaultTakeProfitPercentage: parseFloat(process.env.DEFAULT_TAKE_PROFIT_PERCENTAGE || '10'),
        maxPositionSize: parseFloat(process.env.MAX_POSITION_SIZE || '1000'),
        riskPerTrade: parseFloat(process.env.RISK_PER_TRADE || '2') // 2% risk per trade
    }
};

// 日志配置
export const logConfig = {
    level: process.env.LOG_LEVEL || 'info',
    file: {
        enabled: process.env.LOG_FILE_ENABLED === 'true',
        filename: process.env.LOG_FILENAME || 'logs/app.log',
        maxsize: parseInt(process.env.LOG_MAX_SIZE || '5242880'), // 5MB
        maxFiles: parseInt(process.env.LOG_MAX_FILES || '5')
    }
};

// 缓存配置 (Redis)
export const cacheConfig = {
    enabled: process.env.REDIS_ENABLED === 'true',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'trading:',
    ttl: {
        prices: parseInt(process.env.CACHE_PRICES_TTL || '30'), // 30秒
        indicators: parseInt(process.env.CACHE_INDICATORS_TTL || '300'), // 5分钟
        arbitrage: parseInt(process.env.CACHE_ARBITRAGE_TTL || '60') // 1分钟
    }
};

// API 配置
export const apiConfig = {
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'), // 1分钟
        max: parseInt(process.env.RATE_LIMIT_MAX || '100'), // 100 requests per minute
        message: process.env.RATE_LIMIT_MESSAGE || 'Too many requests from this IP'
    },
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
        credentials: process.env.CORS_CREDENTIALS === 'true'
    },
    swagger: {
        enabled: process.env.SWAGGER_ENABLED !== 'false',
        path: process.env.SWAGGER_PATH || '/api-docs'
    }
};

// WebSocket 配置
export const websocketConfig = {
    cors: {
        origin: process.env.WS_CORS_ORIGIN || '*',
        methods: ['GET', 'POST']
    },
    maxConnections: parseInt(process.env.WS_MAX_CONNECTIONS || '1000'),
    heartbeatInterval: parseInt(process.env.WS_HEARTBEAT_INTERVAL || '30000') // 30秒
};

// 通知配置
export const notificationConfig = {
    telegram: {
        enabled: process.env.TELEGRAM_BOT_ENABLED === 'true',
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        chatId: process.env.TELEGRAM_CHAT_ID
    },
    email: {
        enabled: process.env.EMAIL_ENABLED === 'true',
        service: process.env.EMAIL_SERVICE || 'gmail',
        user: process.env.EMAIL_USER,
        password: process.env.EMAIL_PASSWORD,
        from: process.env.EMAIL_FROM
    },
    webhook: {
        enabled: process.env.WEBHOOK_ENABLED === 'true',
        url: process.env.WEBHOOK_URL,
        secret: process.env.WEBHOOK_SECRET
    }
};

// 验证配置
validateConfig();

export default {
    app: appConfig,
    trading: tradingConfig,
    log: logConfig,
    cache: cacheConfig,
    api: apiConfig,
    websocket: websocketConfig,
    notification: notificationConfig
};