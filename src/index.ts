import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import cron from 'node-cron';

// Import configuration first
import { appConfig, tradingConfig, websocketConfig } from './config';
import logger from './utils/logger';
import { initDatabase } from './database';
import { ExchangeManager } from './exchanges/ExchangeManager';
import { TechnicalIndicators } from './indicators/TechnicalIndicators';
import { PriceMonitor } from './monitors/PriceMonitor';
import apiRoutes from './routes/api';
import { SubscriptionData } from './types';

// Import middleware and utilities
import { errorHandler, requestLogger, rateLimiter, healthCheck } from './middleware/validation';
import { performanceMiddleware, performanceMonitor } from './utils/performance';
import { cacheManager } from './utils/cache';
import { notificationManager } from './utils/notifications';

class TradingAnalyzer {
    private app: express.Application;
    private server: http.Server;
    private io: SocketIOServer;
    private exchangeManager: ExchangeManager;
    private technicalIndicators: TechnicalIndicators;
    private priceMonitor: PriceMonitor;
    
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = new SocketIOServer(this.server, {
            cors: websocketConfig.cors,
            maxHttpBufferSize: 1e6 // 1MB
        });
        
        this.exchangeManager = new ExchangeManager();
        this.technicalIndicators = new TechnicalIndicators();
        this.priceMonitor = new PriceMonitor(this.io);
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupSocketHandlers();
        this.setupCronJobs();
        this.setupPerformanceMonitoring();
    }
    
    private setupMiddleware(): void {
        // Basic middleware
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));
        this.app.use(express.static('public'));

        // Trust proxy for proper IP detection
        this.app.set('trust proxy', 1);

        // Security middleware
        this.app.use((req: Request, res: Response, next: NextFunction) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('X-Content-Type-Options', 'nosniff');
            res.header('X-Frame-Options', 'DENY');
            res.header('X-XSS-Protection', '1; mode=block');
            
            if (req.method === 'OPTIONS') {
                res.sendStatus(200);
                return;
            }
            next();
        });

        // Performance monitoring
        this.app.use(performanceMiddleware);
        
        // Request logging
        this.app.use(requestLogger);

        // Health check (before rate limiting)
        this.app.use(healthCheck);

        // Rate limiting
        this.app.use(rateLimiter.middleware());
    }
    
    private setupRoutes(): void {
        // API routes
        this.app.use('/api', apiRoutes);
        
        // Main endpoint
        this.app.get('/', (_: Request, res: Response) => {
            res.json({
                name: 'Crypto Trading Analyzer',
                version: '2.0.0',
                status: 'running',
                features: [
                    'Real-time price monitoring',
                    'Technical indicators analysis',
                    'Trading signals generation',
                    'Arbitrage opportunities detection',
                    'Price alerts system',
                    'Performance monitoring',
                    'Caching system',
                    'Notification system'
                ],
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                exchanges: this.exchangeManager.getAvailableExchanges(),
                watchedSymbols: this.priceMonitor.getWatchedSymbols()
            });
        });

        // Performance metrics endpoint
        this.app.get('/metrics', (_: Request, res: Response) => {
            res.json({
                performance: performanceMonitor.exportMetrics(),
                cache: cacheManager.getStats()
            });
        });

        // System status endpoint  
        this.app.get('/status', async (_: Request, res: Response) => {
            try {
                const systemStats = performanceMonitor.getSystemStats();
                const cacheStats = cacheManager.getStats();
                
                res.json({
                    status: 'healthy',
                    system: systemStats,
                    cache: cacheStats,
                    database: 'connected', // TODO: Add actual DB health check
                    exchanges: this.exchangeManager.getAvailableExchanges().length,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(503).json({
                    status: 'unhealthy',
                    error: (error as Error).message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Test notifications endpoint (for development)
        if (appConfig.nodeEnv === 'development') {
            this.app.post('/test/notification', async (_: Request, res: Response) => {
                try {
                    await notificationManager.testNotifications();
                    res.json({ success: true, message: 'Test notifications sent' });
                } catch (error) {
                    res.status(500).json({ success: false, error: (error as Error).message });
                }
            });
        }

        // Error handling middleware (must be last)
        this.app.use(errorHandler);
    }
    
    private setupSocketHandlers(): void {
        this.io.on('connection', (socket: Socket) => {
            logger.info(`Client connected: ${socket.id}`);
            
            socket.on('subscribe', (data: SubscriptionData) => {
                const { symbols } = data;
                logger.info(`Client ${socket.id} subscribed to: ${symbols.join(', ')}`);
                void socket.join('price_updates');
            });
            
            socket.on('unsubscribe', (data: SubscriptionData) => {
                const { symbols } = data;
                logger.info(`Client ${socket.id} unsubscribed from: ${symbols.join(', ')}`);
                void socket.leave('price_updates');
            });
            
            socket.on('disconnect', () => {
                logger.info(`Client disconnected: ${socket.id}`);
            });
        });
    }
    
    private setupCronJobs(): void {
        // Price monitoring (configurable interval)
        const priceInterval = Math.max(30, tradingConfig.monitoring.priceUpdateInterval / 1000);
        const priceSchedule = `*/${Math.ceil(priceInterval / 60)} * * * *`;
        
        cron.schedule(priceSchedule, async () => {
            try {
                await performanceMonitor.measureAsync('price_update', async () => {
                    await this.priceMonitor.updatePrices();
                });
            } catch (error) {
                logger.error('Price update error:', error);
                await notificationManager.notifySystemError(error as Error, 'price_monitor');
            }
        });

        // Technical indicators calculation (configurable interval) 
        const indicatorInterval = Math.max(300, tradingConfig.monitoring.indicatorsUpdateInterval / 1000);
        const indicatorSchedule = `*/${Math.ceil(indicatorInterval / 60)} * * * *`;
        
        cron.schedule(indicatorSchedule, async () => {
            try {
                await performanceMonitor.measureAsync('indicators_calculation', async () => {
                    await this.calculateIndicators();
                });
            } catch (error) {
                logger.error('Indicators calculation error:', error);
                await notificationManager.notifySystemError(error as Error, 'indicators');
            }
        });

        // Cache cleanup (every hour)
        cron.schedule('0 * * * *', async () => {
            try {
                await cacheManager.clear('price:*');
                await cacheManager.clear('ohlcv:*');
                performanceMonitor.optimize();
                logger.info('Hourly cache cleanup completed');
            } catch (error) {
                logger.error('Cache cleanup error:', error);
            }
        });

        // System health check (every 10 minutes)
        cron.schedule('*/10 * * * *', async () => {
            try {
                const stats = performanceMonitor.getSystemStats();
                
                // Check for memory usage warnings
                if (stats.memory.percentage > 85) {
                    logger.warn('High memory usage detected', {
                        percentage: `${stats.memory.percentage.toFixed(2)}%`,
                        used: `${(stats.memory.used / 1024 / 1024).toFixed(2)}MB`
                    });
                }
                
                // Log performance metrics
                const performanceStats = performanceMonitor.getStats('price_update', 600000); // Last 10 minutes
                if (performanceStats.count > 0) {
                    logger.service('monitoring').info('Performance metrics', {
                        priceUpdates: performanceStats,
                        memoryUsage: `${stats.memory.percentage.toFixed(2)}%`
                    });
                }
            } catch (error) {
                logger.error('Health check error:', error);
            }
        });

        logger.info('Scheduled jobs configured', {
            priceMonitoring: priceSchedule,
            indicators: indicatorSchedule,
            cacheCleanup: 'hourly',
            healthCheck: 'every 10 minutes'
        });
    }
    
    private async calculateIndicators(): Promise<void> {
        const symbols = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT'];
        
        for (const symbol of symbols) {
            try {
                const ohlcv = await this.exchangeManager.getOHLCV('binance', symbol, '1h', 100);
                if (ohlcv && ohlcv.length > 0) {
                    const indicators = await this.technicalIndicators.calculateAll(ohlcv);
                    
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

    private setupPerformanceMonitoring(): void {
        // Monitor memory usage warnings
        performanceMonitor.on('memoryWarning', (memoryStats) => {
            logger.warn('Memory usage warning', {
                percentage: `${memoryStats.percentage.toFixed(2)}%`,
                used: `${(memoryStats.used / 1024 / 1024).toFixed(2)}MB`,
                total: `${(memoryStats.total / 1024 / 1024).toFixed(2)}MB`
            });
        });

        // Monitor slow operations
        performanceMonitor.on('metric', (metric) => {
            if (metric.duration > 5000 && metric.metadata?.error) { // 5 seconds threshold for errors
                logger.error('Slow operation with error detected', {
                    operation: metric.name,
                    duration: `${metric.duration.toFixed(2)}ms`,
                    metadata: metric.metadata
                });
            }
        });

        logger.service('performance').info('Performance monitoring initialized');
    }
    
    public async start(): Promise<void> {
        try {
            logger.info('Starting Crypto Trading Analyzer v2.0...');
            
            // Initialize database
            await performanceMonitor.measureAsync('database_init', async () => {
                await initDatabase();
            });
            logger.info('Database initialized');
            
            // Initialize exchange connections
            await performanceMonitor.measureAsync('exchanges_init', async () => {
                await this.exchangeManager.initialize();
            });
            logger.info('Exchange connections initialized', {
                exchanges: this.exchangeManager.getAvailableExchanges()
            });
            
            // Start price monitoring
            await performanceMonitor.measureAsync('price_monitor_init', async () => {
                await this.priceMonitor.start();
            });
            logger.info('Price monitoring started', {
                symbols: this.priceMonitor.getWatchedSymbols()
            });
            
            // Start HTTP server
            const port = appConfig.port;
            this.server.listen(port, () => {
                logger.info('🚀 Trading Analyzer server started successfully', {
                    port,
                    environment: appConfig.nodeEnv,
                    features: [
                        'REST API',
                        'WebSocket',
                        'Performance monitoring',
                        'Caching system',
                        'Notification system',
                        'Rate limiting',
                        'Error handling'
                    ]
                });
            });
            
            // Log startup performance
            const systemStats = performanceMonitor.getSystemStats();
            logger.info('System status at startup', {
                memoryUsage: `${systemStats.memory.percentage.toFixed(2)}%`,
                uptime: `${systemStats.uptime.toFixed(2)}s`
            });
            
        } catch (error) {
            logger.error('Failed to start Trading Analyzer:', error);
            await notificationManager.notifySystemError(error as Error, 'startup');
            process.exit(1);
        }
    }
    
    public async stop(): Promise<void> {
        try {
            logger.info('Initiating graceful shutdown...');
            
            // Stop price monitoring
            await this.priceMonitor.stop();
            logger.info('Price monitoring stopped');
            
            // Stop performance monitoring
            performanceMonitor.stop();
            logger.info('Performance monitoring stopped');
            
            // Disconnect cache manager
            await cacheManager.disconnect();
            logger.info('Cache manager disconnected');
            
            // Close HTTP server
            this.server.close((error) => {
                if (error) {
                    logger.error('Error closing HTTP server:', error);
                } else {
                    logger.info('HTTP server closed');
                }
            });
            
            // Close WebSocket connections
            this.io.close();
            logger.info('WebSocket server closed');
            
            logger.info('✅ Trading Analyzer stopped gracefully');
            
        } catch (error) {
            logger.error('Error during graceful shutdown:', error);
        }
    }
}

const analyzer = new TradingAnalyzer();

void analyzer.start();

process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down gracefully...');
    await analyzer.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully...');
    await analyzer.stop();
    process.exit(0);
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});