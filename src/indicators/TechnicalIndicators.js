const _ = require('lodash');

class TechnicalIndicators {
    constructor() {
        this.indicators = {};
    }
    
    // 简单移动平均线 (SMA)
    calculateSMA(data, period = 20) {
        if (data.length < period) return [];
        
        const sma = [];
        for (let i = period - 1; i < data.length; i++) {
            const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
            sma.push(sum / period);
        }
        return sma;
    }
    
    // 指数移动平均线 (EMA)
    calculateEMA(data, period = 20) {
        if (data.length < period) return [];
        
        const multiplier = 2 / (period + 1);
        const ema = [data[0]];
        
        for (let i = 1; i < data.length; i++) {
            ema.push((data[i] * multiplier) + (ema[i - 1] * (1 - multiplier)));
        }
        
        return ema;
    }
    
    // 相对强弱指标 (RSI)
    calculateRSI(data, period = 14) {
        if (data.length < period + 1) return [];
        
        const changes = [];
        for (let i = 1; i < data.length; i++) {
            changes.push(data[i] - data[i - 1]);
        }
        
        const rsi = [];
        let gains = 0, losses = 0;
        
        // 计算初始平均收益和损失
        for (let i = 0; i < period; i++) {
            if (changes[i] > 0) {
                gains += changes[i];
            } else {
                losses += Math.abs(changes[i]);
            }
        }
        
        let avgGain = gains / period;
        let avgLoss = losses / period;
        
        for (let i = period; i < changes.length; i++) {
            const change = changes[i];
            
            if (change > 0) {
                avgGain = ((avgGain * (period - 1)) + change) / period;
                avgLoss = (avgLoss * (period - 1)) / period;
            } else {
                avgGain = (avgGain * (period - 1)) / period;
                avgLoss = ((avgLoss * (period - 1)) + Math.abs(change)) / period;
            }
            
            const rs = avgGain / avgLoss;
            rsi.push(100 - (100 / (1 + rs)));
        }
        
        return rsi;
    }
    
    // MACD指标
    calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
        const fastEMA = this.calculateEMA(data, fastPeriod);
        const slowEMA = this.calculateEMA(data, slowPeriod);
        
        if (fastEMA.length < slowEMA.length) {
            fastEMA.unshift(...Array(slowEMA.length - fastEMA.length).fill(fastEMA[0]));
        }
        
        const macdLine = [];
        for (let i = 0; i < Math.min(fastEMA.length, slowEMA.length); i++) {
            macdLine.push(fastEMA[i] - slowEMA[i]);
        }
        
        const signalLine = this.calculateEMA(macdLine, signalPeriod);
        const histogram = [];
        
        for (let i = 0; i < Math.min(macdLine.length, signalLine.length); i++) {
            histogram.push(macdLine[i] - signalLine[i]);
        }
        
        return {
            macd: macdLine,
            signal: signalLine,
            histogram: histogram
        };
    }
    
    // 布林带 (Bollinger Bands)
    calculateBollingerBands(data, period = 20, multiplier = 2) {
        const sma = this.calculateSMA(data, period);
        const bands = {
            upper: [],
            middle: sma,
            lower: []
        };
        
        for (let i = period - 1; i < data.length; i++) {
            const slice = data.slice(i - period + 1, i + 1);
            const mean = slice.reduce((a, b) => a + b, 0) / period;
            const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
            const stdDev = Math.sqrt(variance);
            
            bands.upper.push(mean + (stdDev * multiplier));
            bands.lower.push(mean - (stdDev * multiplier));
        }
        
        return bands;
    }
    
    // 随机指标 (Stochastic)
    calculateStochastic(high, low, close, kPeriod = 14, dPeriod = 3) {
        const stochastic = {
            k: [],
            d: []
        };
        
        for (let i = kPeriod - 1; i < close.length; i++) {
            const highestHigh = Math.max(...high.slice(i - kPeriod + 1, i + 1));
            const lowestLow = Math.min(...low.slice(i - kPeriod + 1, i + 1));
            
            const k = ((close[i] - lowestLow) / (highestHigh - lowestLow)) * 100;
            stochastic.k.push(k);
        }
        
        stochastic.d = this.calculateSMA(stochastic.k, dPeriod);
        
        return stochastic;
    }
    
    // 平均真实波幅 (ATR)
    calculateATR(high, low, close, period = 14) {
        const trueRanges = [];
        
        for (let i = 1; i < high.length; i++) {
            const tr1 = high[i] - low[i];
            const tr2 = Math.abs(high[i] - close[i - 1]);
            const tr3 = Math.abs(low[i] - close[i - 1]);
            
            trueRanges.push(Math.max(tr1, tr2, tr3));
        }
        
        return this.calculateSMA(trueRanges, period);
    }
    
    // 威廉指标 (%R)
    calculateWilliamsR(high, low, close, period = 14) {
        const williamsR = [];
        
        for (let i = period - 1; i < close.length; i++) {
            const highestHigh = Math.max(...high.slice(i - period + 1, i + 1));
            const lowestLow = Math.min(...low.slice(i - period + 1, i + 1));
            
            const wr = ((highestHigh - close[i]) / (highestHigh - lowestLow)) * -100;
            williamsR.push(wr);
        }
        
        return williamsR;
    }
    
    // 商品通道指数 (CCI)
    calculateCCI(high, low, close, period = 20) {
        const typicalPrices = [];
        for (let i = 0; i < high.length; i++) {
            typicalPrices.push((high[i] + low[i] + close[i]) / 3);
        }
        
        const sma = this.calculateSMA(typicalPrices, period);
        const cci = [];
        
        for (let i = period - 1; i < typicalPrices.length; i++) {
            const slice = typicalPrices.slice(i - period + 1, i + 1);
            const mean = sma[i - period + 1];
            const meanDeviation = slice.reduce((sum, tp) => sum + Math.abs(tp - mean), 0) / period;
            
            cci.push((typicalPrices[i] - mean) / (0.015 * meanDeviation));
        }
        
        return cci;
    }
    
    // 支撑和阻力位检测
    detectSupportResistance(data, lookback = 20) {
        const levels = {
            support: [],
            resistance: []
        };
        
        for (let i = lookback; i < data.length - lookback; i++) {
            const currentPrice = data[i];
            const leftPrices = data.slice(i - lookback, i);
            const rightPrices = data.slice(i + 1, i + lookback + 1);
            
            // 检测阻力位（局部高点）
            const isResistance = leftPrices.every(price => price <= currentPrice) &&
                               rightPrices.every(price => price <= currentPrice);
            
            // 检测支撑位（局部低点）
            const isSupport = leftPrices.every(price => price >= currentPrice) &&
                             rightPrices.every(price => price >= currentPrice);
            
            if (isResistance) {
                levels.resistance.push({
                    price: currentPrice,
                    index: i,
                    strength: 1
                });
            }
            
            if (isSupport) {
                levels.support.push({
                    price: currentPrice,
                    index: i,
                    strength: 1
                });
            }
        }
        
        return levels;
    }
    
    // 计算所有指标
    async calculateAll(ohlcv) {
        try {
            const closes = ohlcv.map(candle => candle[4]); // 收盘价
            const highs = ohlcv.map(candle => candle[2]);   // 最高价
            const lows = ohlcv.map(candle => candle[3]);    // 最低价
            const volumes = ohlcv.map(candle => candle[5]); // 成交量
            
            const indicators = {
                sma: {
                    sma20: this.calculateSMA(closes, 20),
                    sma50: this.calculateSMA(closes, 50)
                },
                ema: {
                    ema12: this.calculateEMA(closes, 12),
                    ema26: this.calculateEMA(closes, 26)
                },
                rsi: this.calculateRSI(closes, 14),
                macd: this.calculateMACD(closes),
                bollinger: this.calculateBollingerBands(closes, 20, 2),
                stochastic: this.calculateStochastic(highs, lows, closes),
                atr: this.calculateATR(highs, lows, closes),
                williamsR: this.calculateWilliamsR(highs, lows, closes),
                cci: this.calculateCCI(highs, lows, closes),
                supportResistance: this.detectSupportResistance(closes),
                timestamp: new Date().toISOString()
            };
            
            // 添加交易信号
            indicators.signals = this.generateTradingSignals(indicators, closes);
            
            return indicators;
            
        } catch (error) {
            throw new Error(`Error calculating indicators: ${error.message}`);
        }
    }
    
    // 生成交易信号
    generateTradingSignals(indicators, closes) {
        const signals = {
            overall: 'NEUTRAL',
            strength: 0,
            signals: []
        };
        
        let bullishSignals = 0;
        let bearishSignals = 0;
        
        // RSI信号
        const lastRSI = indicators.rsi[indicators.rsi.length - 1];
        if (lastRSI < 30) {
            signals.signals.push({ type: 'RSI', signal: 'BUY', reason: 'RSI超卖' });
            bullishSignals++;
        } else if (lastRSI > 70) {
            signals.signals.push({ type: 'RSI', signal: 'SELL', reason: 'RSI超买' });
            bearishSignals++;
        }
        
        // MACD信号
        const macd = indicators.macd;
        if (macd.histogram.length >= 2) {
            const currentHist = macd.histogram[macd.histogram.length - 1];
            const prevHist = macd.histogram[macd.histogram.length - 2];
            
            if (currentHist > 0 && prevHist <= 0) {
                signals.signals.push({ type: 'MACD', signal: 'BUY', reason: 'MACD金叉' });
                bullishSignals++;
            } else if (currentHist < 0 && prevHist >= 0) {
                signals.signals.push({ type: 'MACD', signal: 'SELL', reason: 'MACD死叉' });
                bearishSignals++;
            }
        }
        
        // 布林带信号
        const bollinger = indicators.bollinger;
        if (bollinger.upper.length > 0) {
            const lastPrice = closes[closes.length - 1];
            const lastUpper = bollinger.upper[bollinger.upper.length - 1];
            const lastLower = bollinger.lower[bollinger.lower.length - 1];
            
            if (lastPrice <= lastLower) {
                signals.signals.push({ type: 'Bollinger', signal: 'BUY', reason: '价格触及下轨' });
                bullishSignals++;
            } else if (lastPrice >= lastUpper) {
                signals.signals.push({ type: 'Bollinger', signal: 'SELL', reason: '价格触及上轨' });
                bearishSignals++;
            }
        }
        
        // 计算综合信号
        const totalSignals = bullishSignals + bearishSignals;
        if (totalSignals > 0) {
            const bullishRatio = bullishSignals / totalSignals;
            signals.strength = Math.abs(bullishRatio - 0.5) * 2; // 0-1之间
            
            if (bullishRatio > 0.6) {
                signals.overall = 'BULLISH';
            } else if (bullishRatio < 0.4) {
                signals.overall = 'BEARISH';
            }
        }
        
        return signals;
    }
}

module.exports = TechnicalIndicators;
