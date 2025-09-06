import logger from './logger';
import { EventEmitter } from 'events';

export interface PerformanceMetric {
    name: string;
    duration: number;
    timestamp: number;
    metadata?: Record<string, any>;
}

export interface MemoryStats {
    used: number;
    free: number;
    total: number;
    percentage: number;
}

export interface SystemStats {
    memory: MemoryStats;
    uptime: number;
    cpu: NodeJS.CpuUsage;
    eventLoopDelay: number;
}

class PerformanceMonitor extends EventEmitter {
    private metrics: PerformanceMetric[] = [];
    private maxMetrics = 1000;
    private memoryThreshold = 80; // percentage
    private performanceThreshold = 5000; // ms
    private intervals: Map<string, NodeJS.Timeout> = new Map();

    constructor() {
        super();
        this.startSystemMonitoring();
    }

    // Measure function execution time
    public async measureAsync<T>(
        name: string, 
        fn: () => Promise<T>, 
        metadata?: Record<string, any>
    ): Promise<T> {
        const start = process.hrtime.bigint();
        
        try {
            const result = await fn();
            const end = process.hrtime.bigint();
            const duration = Number(end - start) / 1000000; // Convert to milliseconds
            
            this.recordMetric(name, duration, metadata);
            return result;
        } catch (error) {
            const end = process.hrtime.bigint();
            const duration = Number(end - start) / 1000000;
            
            this.recordMetric(name, duration, { ...metadata, error: true });
            throw error;
        }
    }

    // Measure synchronous function execution time
    public measure<T>(
        name: string, 
        fn: () => T, 
        metadata?: Record<string, any>
    ): T {
        const start = process.hrtime.bigint();
        
        try {
            const result = fn();
            const end = process.hrtime.bigint();
            const duration = Number(end - start) / 1000000;
            
            this.recordMetric(name, duration, metadata);
            return result;
        } catch (error) {
            const end = process.hrtime.bigint();
            const duration = Number(end - start) / 1000000;
            
            this.recordMetric(name, duration, { ...metadata, error: true });
            throw error;
        }
    }

    // Create a timer for manual measurement
    public createTimer(name: string, metadata?: Record<string, any>) {
        const start = process.hrtime.bigint();
        
        return {
            end: () => {
                const end = process.hrtime.bigint();
                const duration = Number(end - start) / 1000000;
                this.recordMetric(name, duration, metadata);
                return duration;
            }
        };
    }

    private recordMetric(name: string, duration: number, metadata?: Record<string, any>) {
        const metric: PerformanceMetric = {
            name,
            duration,
            timestamp: Date.now(),
            metadata
        };

        this.metrics.push(metric);
        
        // Keep only the last N metrics
        if (this.metrics.length > this.maxMetrics) {
            this.metrics = this.metrics.slice(-this.maxMetrics);
        }

        // Log slow operations
        if (duration > this.performanceThreshold) {
            logger.warn(`Slow operation detected: ${name}`, {
                duration: `${duration.toFixed(2)}ms`,
                threshold: `${this.performanceThreshold}ms`,
                metadata
            });
        }

        // Emit metric event
        this.emit('metric', metric);
    }

    // Get metrics statistics
    public getStats(name?: string, timeWindow?: number): {
        count: number;
        avg: number;
        min: number;
        max: number;
        p50: number;
        p95: number;
        p99: number;
    } {
        const now = Date.now();
        const windowStart = timeWindow ? now - timeWindow : 0;
        
        let filteredMetrics = this.metrics.filter(m => m.timestamp >= windowStart);
        
        if (name) {
            filteredMetrics = filteredMetrics.filter(m => m.name === name);
        }

        if (filteredMetrics.length === 0) {
            return { count: 0, avg: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0 };
        }

        const durations = filteredMetrics.map(m => m.duration).sort((a, b) => a - b);
        
        return {
            count: durations.length,
            avg: durations.reduce((sum, d) => sum + d, 0) / durations.length,
            min: durations[0],
            max: durations[durations.length - 1],
            p50: durations[Math.floor(durations.length * 0.5)],
            p95: durations[Math.floor(durations.length * 0.95)],
            p99: durations[Math.floor(durations.length * 0.99)]
        };
    }

    // Get system statistics
    public getSystemStats(): SystemStats {
        const memUsage = process.memoryUsage();
        const totalMemory = memUsage.heapTotal + memUsage.external;
        const usedMemory = memUsage.heapUsed + memUsage.external;
        const freeMemory = totalMemory - usedMemory;

        return {
            memory: {
                used: usedMemory,
                free: freeMemory,
                total: totalMemory,
                percentage: (usedMemory / totalMemory) * 100
            },
            uptime: process.uptime(),
            cpu: process.cpuUsage(),
            eventLoopDelay: this.getEventLoopDelay()
        };
    }

    // Measure event loop delay
    private getEventLoopDelay(): number {
        const start = process.hrtime.bigint();
        return new Promise<number>((resolve) => {
            setImmediate(() => {
                const delay = Number(process.hrtime.bigint() - start) / 1000000;
                resolve(delay);
            });
        }) as any; // Type hack for synchronous usage
    }

    // Start system monitoring
    private startSystemMonitoring() {
        // Memory monitoring
        const memoryInterval = setInterval(() => {
            const stats = this.getSystemStats();
            
            if (stats.memory.percentage > this.memoryThreshold) {
                logger.warn('High memory usage detected', {
                    percentage: `${stats.memory.percentage.toFixed(2)}%`,
                    used: `${(stats.memory.used / 1024 / 1024).toFixed(2)}MB`,
                    total: `${(stats.memory.total / 1024 / 1024).toFixed(2)}MB`
                });
                
                this.emit('memoryWarning', stats.memory);
            }
            
            this.emit('systemStats', stats);
        }, 30000); // Check every 30 seconds

        this.intervals.set('memory', memoryInterval);
    }

    // Get recent metrics for specific operations
    public getRecentMetrics(name: string, timeWindow: number = 300000): PerformanceMetric[] {
        const now = Date.now();
        const windowStart = now - timeWindow;
        
        return this.metrics.filter(m => 
            m.name === name && 
            m.timestamp >= windowStart
        );
    }

    // Export metrics for monitoring systems
    public exportMetrics(): {
        timestamp: number;
        metrics: Record<string, any>;
        system: SystemStats;
    } {
        const metricsByName: Record<string, any> = {};
        
        // Group metrics by name
        const uniqueNames = [...new Set(this.metrics.map(m => m.name))];
        
        for (const name of uniqueNames) {
            metricsByName[name] = this.getStats(name, 300000); // Last 5 minutes
        }

        return {
            timestamp: Date.now(),
            metrics: metricsByName,
            system: this.getSystemStats()
        };
    }

    // Clear old metrics
    public clearMetrics(olderThan?: number) {
        if (olderThan) {
            const cutoff = Date.now() - olderThan;
            this.metrics = this.metrics.filter(m => m.timestamp >= cutoff);
        } else {
            this.metrics = [];
        }
    }

    // Stop monitoring
    public stop() {
        for (const [, interval] of this.intervals) {
            clearInterval(interval);
        }
        this.intervals.clear();
    }

    // Memory usage optimization
    public optimize() {
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }

        // Clear old metrics
        this.clearMetrics(3600000); // Keep only last hour

        logger.info('Performance optimization completed', {
            metricsCount: this.metrics.length,
            memory: this.getSystemStats().memory
        });
    }
}

// Decorator for automatic performance measurement
export function measure(name?: string) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        const metricName = name || `${target.constructor.name}.${propertyKey}`;

        descriptor.value = async function (...args: any[]) {
            return performanceMonitor.measureAsync(metricName, () => originalMethod.apply(this, args));
        };

        return descriptor;
    };
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Performance middleware for Express
export function performanceMiddleware(req: any, res: any, next: any) {
    const timer = performanceMonitor.createTimer('http_request', {
        method: req.method,
        path: req.path
    });

    res.on('finish', () => {
        timer.end();
    });

    next();
}

export default performanceMonitor;