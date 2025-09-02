import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import cron from 'node-cron';
import { config } from 'dotenv';

config();

import logger from './utils/logger';
import { initDatabase } from './database';
import { ExchangeManager } from './exchanges/ExchangeManager';
import { TechnicalIndicators } from './indicators/TechnicalIndicators';
import { PriceMonitor } from './monitors/PriceMonitor';
import apiRoutes from './routes/api';
import { SubscriptionData } from './types';

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
    
    private setupMiddleware(): void {
        this.app.use(express.json());
        this.app.use(express.static('public'));
        
        this.app.use((_: Request, res: Response, next: NextFunction) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
            next();
        });
    }
    
    private setupRoutes(): void {
        this.app.use('/api', apiRoutes);
        
        this.app.get('/', (_: Request, res: Response) => {
            res.json({
                name: 'Crypto Trading Analyzer',
                version: '1.0.0',
                status: 'running',
                timestamp: new Date().toISOString()
            });
        });
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
        cron.schedule('*/1 * * * *', async () => {
            try {
                await this.priceMonitor.updatePrices();
            } catch (error) {
                logger.error('Price update error:', error);
            }
        });
        
        cron.schedule('*/5 * * * *', async () => {
            try {
                await this.calculateIndicators();
            } catch (error) {
                logger.error('Indicators calculation error:', error);
            }
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
    
    public async start(): Promise<void> {
        try {
            await initDatabase();
            logger.info('Database initialized');
            
            await this.exchangeManager.initialize();
            logger.info('Exchange connections initialized');
            
            await this.priceMonitor.start();
            logger.info('Price monitoring started');
            
            const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
            this.server.listen(port, () => {
                logger.info(`Trading Analyzer server is running on port ${port}`);
                logger.info('WebSocket server is ready for connections');
            });
            
        } catch (error) {
            logger.error('Failed to start Trading Analyzer:', error);
            process.exit(1);
        }
    }
    
    public async stop(): Promise<void> {
        try {
            await this.priceMonitor.stop();
            this.server.close();
            logger.info('Trading Analyzer stopped gracefully');
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