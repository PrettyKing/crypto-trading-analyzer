import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import logger from '../utils/logger';
import { ApiResponse } from '../types';

// Zod schemas for validation
export const symbolSchema = z.string().regex(/^[A-Z]+\/[A-Z]+$/, 'Invalid trading pair format (e.g., BTC/USDT)');
export const exchangeSchema = z.enum(['binance', 'okx', 'huobi'], { message: 'Unsupported exchange' });
export const timeframeSchema = z.enum(['1m', '5m', '15m', '30m', '1h', '4h', '1d'], { message: 'Invalid timeframe' });
export const limitSchema = z.coerce.number().int().min(1).max(1000).default(100);
export const priceSchema = z.coerce.number().positive();

// Parameter validation schemas
export const priceParamsSchema = z.object({
    symbol: symbolSchema
});

export const priceQuerySchema = z.object({
    exchange: exchangeSchema.optional().default('binance')
});

export const ohlcvParamsSchema = z.object({
    symbol: symbolSchema
});

export const ohlcvQuerySchema = z.object({
    exchange: exchangeSchema.optional().default('binance'),
    timeframe: timeframeSchema.optional().default('1h'),
    limit: limitSchema.optional()
});

export const indicatorsParamsSchema = z.object({
    symbol: symbolSchema
});

export const indicatorsQuerySchema = z.object({
    exchange: exchangeSchema.optional().default('binance'),
    timeframe: timeframeSchema.optional().default('1h'),
    limit: limitSchema.optional()
});

export const orderBodySchema = z.object({
    exchange: exchangeSchema,
    symbol: symbolSchema,
    type: z.enum(['market', 'limit', 'stop']),
    side: z.enum(['buy', 'sell']),
    amount: z.coerce.number().positive(),
    price: z.coerce.number().positive().optional()
}).refine(data => {
    // Limit orders must have a price
    if (data.type === 'limit' && !data.price) {
        return false;
    }
    return true;
}, {
    message: "Limit orders must include a price"
});

export const alertBodySchema = z.object({
    symbol: symbolSchema,
    targetPrice: priceSchema,
    type: z.enum(['above', 'below']).default('above'),
    notificationMethod: z.enum(['websocket', 'telegram', 'email']).optional().default('websocket')
});

// Generic validation middleware factory
export function validateRequest<T extends z.ZodSchema>(schema: T, property: 'body' | 'params' | 'query' = 'body') {
    return (req: Request, res: Response<ApiResponse>, next: NextFunction) => {
        try {
            const data = req[property];
            const validated = schema.parse(data);
            
            // Replace the original data with validated data
            (req as any)[property] = validated;
            
            next();
        } catch (error) {
            if (error instanceof z.ZodError) {
                const validationErrors = error.issues.map((issue: any) => ({
                    field: issue.path.join('.'),
                    message: issue.message,
                    received: issue.received
                }));

                logger.warn('Validation error:', {
                    path: req.path,
                    method: req.method,
                    errors: validationErrors,
                    data: req[property]
                });

                res.status(400).json({
                    success: false,
                    error: 'Validation error',
                    details: validationErrors
                });
                return;
            }
            
            logger.error('Unexpected validation error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    };
}

// Specific validation middlewares
export const validatePriceParams = validateRequest(priceParamsSchema, 'params');
export const validatePriceQuery = validateRequest(priceQuerySchema, 'query');
export const validateOHLCVParams = validateRequest(ohlcvParamsSchema, 'params');
export const validateOHLCVQuery = validateRequest(ohlcvQuerySchema, 'query');
export const validateIndicatorsParams = validateRequest(indicatorsParamsSchema, 'params');
export const validateIndicatorsQuery = validateRequest(indicatorsQuerySchema, 'query');
export const validateOrderBody = validateRequest(orderBodySchema, 'body');
export const validateAlertBody = validateRequest(alertBodySchema, 'body');

// Error handling middleware
export function errorHandler(error: Error, req: Request, res: Response<ApiResponse>, _next: NextFunction) {
    logger.error('API Error:', {
        path: req.path,
        method: req.method,
        error: error.message,
        stack: error.stack,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });

    // Handle specific error types
    if (error.name === 'ExchangeError') {
        res.status(502).json({
            success: false,
            error: 'Exchange service error',
            details: error.message
        });
        return;
    }

    if (error.name === 'DatabaseError') {
        res.status(503).json({
            success: false,
            error: 'Database service error'
        });
        return;
    }

    if (error.name === 'IndicatorError') {
        res.status(422).json({
            success: false,
            error: 'Technical indicator calculation error',
            details: error.message
        });
        return;
    }

    // Handle validation errors that weren't caught earlier
    if (error instanceof z.ZodError) {
        res.status(400).json({
            success: false,
            error: 'Invalid request data',
            details: error.issues
        });
        return;
    }

    // Handle network/timeout errors
    if (error.message.includes('timeout') || error.message.includes('ECONNREFUSED')) {
        res.status(503).json({
            success: false,
            error: 'Service temporarily unavailable'
        });
        return;
    }

    // Generic error response
    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : error.message
    });
}

// Request logging middleware
export function requestLogger(req: Request, res: Response, _next: NextFunction) {
    const start = Date.now();
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        const logData = {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        };

        if (res.statusCode >= 400) {
            logger.warn('HTTP request completed with error', logData);
        } else {
            logger.info('HTTP request completed', logData);
        }
    });

    _next();
}

// Rate limiting middleware (simple in-memory implementation)
class SimpleRateLimiter {
    private requests: Map<string, { count: number; resetTime: number }> = new Map();
    
    constructor(
        private windowMs: number = 60000, // 1 minute
        private maxRequests: number = 100
    ) {
        // Clean up expired entries every minute
        setInterval(() => this.cleanup(), windowMs);
    }

    private cleanup() {
        const now = Date.now();
        for (const [key, data] of this.requests) {
            if (now > data.resetTime) {
                this.requests.delete(key);
            }
        }
    }

    public middleware() {
        return (req: Request, res: Response, next: NextFunction) => {
            const key = req.ip || 'unknown';
            const now = Date.now();
            
            let requestData = this.requests.get(key);
            
            if (!requestData || now > requestData.resetTime) {
                requestData = {
                    count: 0,
                    resetTime: now + this.windowMs
                };
            }
            
            requestData.count++;
            this.requests.set(key, requestData);
            
            if (requestData.count > this.maxRequests) {
                logger.warn('Rate limit exceeded', {
                    ip: req.ip || 'unknown',
                    path: req.path,
                    count: requestData.count
                });
                
                res.status(429).json({
                    success: false,
                    error: 'Too many requests',
                    retryAfter: Math.ceil((requestData.resetTime - now) / 1000)
                });
                return;
            }
            
            // Add rate limit headers
            res.setHeader('X-RateLimit-Limit', this.maxRequests);
            res.setHeader('X-RateLimit-Remaining', Math.max(0, this.maxRequests - requestData.count));
            res.setHeader('X-RateLimit-Reset', Math.ceil(requestData.resetTime / 1000));
            
            next();
        };
    }
}

export const rateLimiter = new SimpleRateLimiter();

// Health check middleware
export function healthCheck(req: Request, res: Response, next: NextFunction) {
    if (req.path === '/health' || req.path === '/ping') {
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: process.env.npm_package_version || '1.0.0'
        });
        return;
    }
    next();
}