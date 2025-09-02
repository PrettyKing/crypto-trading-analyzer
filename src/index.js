const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cron = require('node-cron');
require('dotenv').config();

const logger = require('./utils/logger');
const { initDatabase } = require('./database');
const ExchangeManager = require('./exchanges/ExchangeManager');
const TechnicalIndicators = require('./indicators/TechnicalIndicators');
const PriceMonitor = require('./monitors/PriceMonitor');
const apiRoutes = require('./routes/api');

class TradingAnalyzer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        
        this.exchangeManager = new ExchangeManager();
        this.technicalIndicators = new TechnicalIndicators();
        this.priceMonitor = new PriceMonitor(this.io);
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketHandlers();
        this.setupCronJobs();
    }
    
    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.static('public'));
        
        // CORS
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            next();
        });
    }
    
    setupRoutes() {
        this.app.use('/api', apiRoutes);
        
        this.app.get('/', (req, res) => {
            res.json({
                name: 'Crypto Trading Analyzer',
                version: '1.0.0',
                status: 'running',
                timestamp: new Date().toISOString()
            });
        });
    }
    
    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            logger.info(`Client connected: ${socket.id}`);
            
            socket.on('subscribe', (data) => {
                const { symbols } = data;
                logger.info(`Client ${socket.id} subscribed to: ${symbols.join(', ')}`);
                socket.join('price_updates');
            });
            
            socket.on('unsubscribe', (data) => {
                const { symbols } = data;
                logger.info(`Client ${socket.id} unsubscribed from: ${symbols.join(', ')}`);
                socket.leave('price_updates');
            });
            
            socket.on('disconnect', () => {
                logger.info(`Client disconnected: ${socket.id}`);
            });
        });
    }
    
    setupCronJobs() {
        // 每分钟更新价格数据
        cron.schedule('*/1 * * * *', async () => {
            try {
                await this.priceMonitor.updatePrices();
            } catch (error) {
                logger.error('Price update error:', error);
            }
        });
        
        // 每5分钟计算技术指标
        cron.schedule('*/5 * * * *', async () => {
            try {
                await this.calculateIndicators();
            } catch (error) {
                logger.error('Indicators calculation error:', error);
            }
        });
    }
    
    async calculateIndicators() {
        const symbols = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT'];
        
        for (const symbol of symbols) {
            try {
                const ohlcv = await this.exchangeManager.getOHLCV('binance', symbol, '1h', 100);
                if (ohlcv && ohlcv.length > 0) {
                    const indicators = await this.technicalIndicators.calculateAll(ohlcv);
                    
                    // 广播技术指标更新
                    this.io.to('price_updates').emit('indicators_update', {
                        symbol,
                        indicators,
                        timestamp: new Date().toISOString()
                    });
                }
            } catch (error) {
                logger.error(`Error calculating indicators for ${symbol}:`, error);
            }
        }
    }
    
    async start() {
        try {
            // 初始化数据库
            await initDatabase();
            logger.info('Database initialized');
            
            // 初始化交易所连接
            await this.exchangeManager.initialize();
            logger.info('Exchange connections initialized');
            
            // 启动价格监控
            await this.priceMonitor.start();
            logger.info('Price monitoring started');
            
            // 启动服务器
            const port = process.env.PORT || 3000;
            this.server.listen(port, () => {
                logger.info(`Trading Analyzer server is running on port ${port}`);
                logger.info(`WebSocket server is ready for connections`);
            });
            
        } catch (error) {
            logger.error('Failed to start Trading Analyzer:', error);
            process.exit(1);
        }
    }
}

// 启动应用
const analyzer = new TradingAnalyzer();
analyzer.start();

// 优雅关闭
process.on('SIGINT', async () => {
    logger.info('Shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('Shutting down gracefully...');
    process.exit(0);
});
