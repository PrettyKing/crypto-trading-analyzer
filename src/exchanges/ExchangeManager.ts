import ccxt from 'ccxt';
import logger from '../utils/logger';
import {
    OHLCVArray,
    ArbitrageOpportunity,
    ExchangePriceData,
    ExchangeInfo,
    ExchangeError
} from '../types';

export class ExchangeManager {
    private exchanges: Record<string, any> = {};
    // Supported exchanges list for reference
    // private readonly supportedExchanges: string[] = ['binance', 'okx', 'huobi'];
    
    public async initialize(): Promise<void> {
        try {
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
            
            await this.testConnections();
            
        } catch (error) {
            logger.error('Failed to initialize exchanges:', error);
            throw error;
        }
    }
    
    private async testConnections(): Promise<void> {
        for (const [name, exchange] of Object.entries(this.exchanges)) {
            try {
                await exchange.loadMarkets();
                logger.info(`${name} connection test successful`);
            } catch (error) {
                logger.warn(`${name} connection test failed:`, (error as Error).message);
            }
        }
    }
    
    public getExchange(exchangeName: string): any {
        const exchange = this.exchanges[exchangeName.toLowerCase()];
        if (!exchange) {
            throw new ExchangeError(`Exchange ${exchangeName} not available`, exchangeName);
        }
        return exchange;
    }
    
    public async getTicker(exchangeName: string, symbol: string): Promise<any> {
        try {
            const exchange = this.getExchange(exchangeName);
            return await exchange.fetchTicker(symbol);
        } catch (error) {
            logger.error(`Error fetching ticker for ${symbol} on ${exchangeName}:`, error);
            throw new ExchangeError(
                `Error fetching ticker: ${(error as Error).message}`,
                exchangeName,
                symbol
            );
        }
    }
    
    public async getOHLCV(
        exchangeName: string, 
        symbol: string, 
        timeframe: string = '1h', 
        limit: number = 100
    ): Promise<OHLCVArray[]> {
        try {
            const exchange = this.getExchange(exchangeName);
            return await exchange.fetchOHLCV(symbol, timeframe, undefined, limit) as OHLCVArray[];
        } catch (error) {
            logger.error(`Error fetching OHLCV for ${symbol} on ${exchangeName}:`, error);
            throw new ExchangeError(
                `Error fetching OHLCV: ${(error as Error).message}`,
                exchangeName,
                symbol
            );
        }
    }
    
    public async getOrderBook(
        exchangeName: string, 
        symbol: string, 
        limit: number = 20
    ): Promise<any> {
        try {
            const exchange = this.getExchange(exchangeName);
            return await exchange.fetchOrderBook(symbol, limit);
        } catch (error) {
            logger.error(`Error fetching order book for ${symbol} on ${exchangeName}:`, error);
            throw new ExchangeError(
                `Error fetching order book: ${(error as Error).message}`,
                exchangeName,
                symbol
            );
        }
    }
    
    public async getTrades(
        exchangeName: string, 
        symbol: string, 
        limit: number = 50
    ): Promise<any[]> {
        try {
            const exchange = this.getExchange(exchangeName);
            return await exchange.fetchTrades(symbol, undefined, limit);
        } catch (error) {
            logger.error(`Error fetching trades for ${symbol} on ${exchangeName}:`, error);
            throw new ExchangeError(
                `Error fetching trades: ${(error as Error).message}`,
                exchangeName,
                symbol
            );
        }
    }
    
    public async getBalance(exchangeName: string): Promise<any> {
        try {
            const exchange = this.getExchange(exchangeName);
            return await exchange.fetchBalance();
        } catch (error) {
            logger.error(`Error fetching balance on ${exchangeName}:`, error);
            throw new ExchangeError(
                `Error fetching balance: ${(error as Error).message}`,
                exchangeName
            );
        }
    }
    
    public async createOrder(
        exchangeName: string,
        symbol: string,
        type: string,
        side: string,
        amount: number,
        price?: number,
        params: any = {}
    ): Promise<any> {
        try {
            const exchange = this.getExchange(exchangeName);
            return await exchange.createOrder(symbol, type, side, amount, price, params);
        } catch (error) {
            logger.error(`Error creating order on ${exchangeName}:`, error);
            throw new ExchangeError(
                `Error creating order: ${(error as Error).message}`,
                exchangeName,
                symbol
            );
        }
    }
    
    public async cancelOrder(
        exchangeName: string, 
        orderId: string, 
        symbol: string
    ): Promise<any> {
        try {
            const exchange = this.getExchange(exchangeName);
            return await exchange.cancelOrder(orderId, symbol);
        } catch (error) {
            logger.error(`Error canceling order on ${exchangeName}:`, error);
            throw new ExchangeError(
                `Error canceling order: ${(error as Error).message}`,
                exchangeName,
                symbol
            );
        }
    }
    
    public async getOrder(
        exchangeName: string, 
        orderId: string, 
        symbol: string
    ): Promise<any> {
        try {
            const exchange = this.getExchange(exchangeName);
            return await exchange.fetchOrder(orderId, symbol);
        } catch (error) {
            logger.error(`Error fetching order on ${exchangeName}:`, error);
            throw new ExchangeError(
                `Error fetching order: ${(error as Error).message}`,
                exchangeName,
                symbol
            );
        }
    }
    
    public async getMultiExchangePrices(symbol: string): Promise<Record<string, ExchangePriceData | null>> {
        const prices: Record<string, ExchangePriceData | null> = {};
        const promises: Promise<void>[] = [];
        
        for (const [name] of Object.entries(this.exchanges)) {
            promises.push(
                this.getTicker(name, symbol)
                    .then(ticker => {
                        prices[name] = {
                            price: ticker.last!,
                            bid: ticker.bid!,
                            ask: ticker.ask!,
                            volume: ticker.baseVolume!,
                            timestamp: ticker.timestamp!
                        };
                    })
                    .catch(error => {
                        logger.warn(`Failed to get price from ${name}: ${(error as Error).message}`);
                        prices[name] = null;
                    })
            );
        }
        
        await Promise.all(promises);
        return prices;
    }
    
    public async calculateArbitrageOpportunities(symbol: string): Promise<ArbitrageOpportunity[]> {
        const prices = await this.getMultiExchangePrices(symbol);
        const opportunities: ArbitrageOpportunity[] = [];
        
        const validPrices = Object.entries(prices).filter(([, data]) => data !== null) as [string, ExchangePriceData][];
        
        for (let i = 0; i < validPrices.length; i++) {
            for (let j = i + 1; j < validPrices.length; j++) {
                const [exchange1, data1] = validPrices[i];
                const [exchange2, data2] = validPrices[j];
                
                const priceDiff = Math.abs(data1.price - data2.price);
                const avgPrice = (data1.price + data2.price) / 2;
                const percentage = (priceDiff / avgPrice) * 100;
                
                if (percentage > 0.1) {
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
        
        return opportunities.sort((a, b) => parseFloat(b.percentage) - parseFloat(a.percentage));
    }
    
    public getAvailableExchanges(): string[] {
        return Object.keys(this.exchanges);
    }
    
    public async getExchangeInfo(exchangeName: string): Promise<ExchangeInfo> {
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
            throw new ExchangeError(
                `Error getting exchange info: ${(error as Error).message}`,
                exchangeName
            );
        }
    }
}

export default ExchangeManager;