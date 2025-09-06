import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { logConfig } from '../config';

const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack, service, exchange, symbol, ...meta }) => {
        let metaStr = '';
        if (service) metaStr += `[${service}]`;
        if (exchange) metaStr += `[${exchange}]`;
        if (symbol) metaStr += `[${symbol}]`;
        
        const additionalMeta = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} ${metaStr} [${level.toUpperCase()}]: ${stack || message}${additionalMeta}`;
    })
);

// Create logs directory if it doesn't exist
const logsDir = path.dirname(logConfig.file.filename);
if (logConfig.file.enabled && !fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Base transports
const transports: winston.transport[] = [
    new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            logFormat
        )
    })
];

// Add file transports if enabled
if (logConfig.file.enabled) {
    // Combined log file
    transports.push(
        new winston.transports.File({
            filename: logConfig.file.filename,
            maxsize: logConfig.file.maxsize,
            maxFiles: logConfig.file.maxFiles,
        })
    );

    // Error log file
    transports.push(
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: logConfig.file.maxsize,
            maxFiles: logConfig.file.maxFiles,
        })
    );
}

const baseLogger = winston.createLogger({
    level: logConfig.level,
    format: logFormat,
    transports,
    exitOnError: false
});

// Create a simple logger object with proper methods
const logger = {
    debug: (message: string, meta?: any) => baseLogger.debug(message, meta),
    info: (message: string, meta?: any) => baseLogger.info(message, meta),
    warn: (message: string, meta?: any) => baseLogger.warn(message, meta),
    error: (message: string, meta?: any) => baseLogger.error(message, meta),
    
    // Service-specific logging
    service: (service: string) => ({
        debug: (message: string, meta?: any) => baseLogger.debug(message, { service, ...meta }),
        info: (message: string, meta?: any) => baseLogger.info(message, { service, ...meta }),
        warn: (message: string, meta?: any) => baseLogger.warn(message, { service, ...meta }),
        error: (message: string, meta?: any) => baseLogger.error(message, { service, ...meta })
    }),
    
    // Exchange-specific logging
    exchange: (exchange: string) => ({
        debug: (message: string, symbol?: string, meta?: any) => baseLogger.debug(message, { exchange, symbol, ...meta }),
        info: (message: string, symbol?: string, meta?: any) => baseLogger.info(message, { exchange, symbol, ...meta }),
        warn: (message: string, symbol?: string, meta?: any) => baseLogger.warn(message, { exchange, symbol, ...meta }),
        error: (message: string, symbol?: string, meta?: any) => baseLogger.error(message, { exchange, symbol, ...meta })
    }),
    
    // Trading-specific logging
    trading: {
        order: (action: string, exchange: string, symbol: string, meta?: any) => 
            baseLogger.info(`Order ${action}`, { service: 'trading', exchange, symbol, ...meta }),
        
        signal: (signal: string, symbol: string, confidence: number, meta?: any) =>
            baseLogger.info(`Trading signal: ${signal}`, { service: 'signals', symbol, confidence, ...meta }),
        
        arbitrage: (symbol: string, profit: string, meta?: any) =>
            baseLogger.info(`Arbitrage opportunity`, { service: 'arbitrage', symbol, profit, ...meta }),
        
        alert: (type: string, symbol: string, price: number, meta?: any) =>
            baseLogger.info(`Price alert triggered: ${type}`, { service: 'alerts', symbol, price, ...meta })
    }
};

export default logger;