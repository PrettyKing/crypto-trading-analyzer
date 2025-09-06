import {
    TechnicalIndicators as ITechnicalIndicators,
    TradingSignals,
    SupportResistanceLevel,
    OHLCVArray,
    IndicatorError
} from '../types';

export class TechnicalIndicators {
    
    public calculateSMA(data: number[], period: number = 20): number[] {
        if (data.length < period) return [];
        
        const sma: number[] = [];
        for (let i = period - 1; i < data.length; i++) {
            const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
            sma.push(sum / period);
        }
        return sma;
    }
    
    public calculateEMA(data: number[], period: number = 20): number[] {
        if (data.length < period) return [];
        
        const multiplier = 2 / (period + 1);
        const ema: number[] = [data[0]];
        
        for (let i = 1; i < data.length; i++) {
            ema.push((data[i] * multiplier) + (ema[i - 1] * (1 - multiplier)));
        }
        
        return ema;
    }
    
    public calculateRSI(data: number[], period: number = 14): number[] {
        if (data.length < period + 1) return [];
        
        const changes: number[] = [];
        for (let i = 1; i < data.length; i++) {
            changes.push(data[i] - data[i - 1]);
        }
        
        const rsi: number[] = [];
        let gains = 0;
        let losses = 0;
        
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
    
    public calculateMACD(
        data: number[], 
        fastPeriod: number = 12, 
        slowPeriod: number = 26, 
        signalPeriod: number = 9
    ): { macd: number[]; signal: number[]; histogram: number[] } {
        const fastEMA = this.calculateEMA(data, fastPeriod);
        const slowEMA = this.calculateEMA(data, slowPeriod);
        
        if (fastEMA.length < slowEMA.length) {
            fastEMA.unshift(...Array(slowEMA.length - fastEMA.length).fill(fastEMA[0]));
        }
        
        const macdLine: number[] = [];
        for (let i = 0; i < Math.min(fastEMA.length, slowEMA.length); i++) {
            macdLine.push(fastEMA[i] - slowEMA[i]);
        }
        
        const signalLine = this.calculateEMA(macdLine, signalPeriod);
        const histogram: number[] = [];
        
        for (let i = 0; i < Math.min(macdLine.length, signalLine.length); i++) {
            histogram.push(macdLine[i] - signalLine[i]);
        }
        
        return {
            macd: macdLine,
            signal: signalLine,
            histogram: histogram
        };
    }
    
    public calculateBollingerBands(
        data: number[], 
        period: number = 20, 
        multiplier: number = 2
    ): { upper: number[]; middle: number[]; lower: number[] } {
        const sma = this.calculateSMA(data, period);
        const bands = {
            upper: [] as number[],
            middle: sma,
            lower: [] as number[]
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
    
    public calculateStochastic(
        high: number[], 
        low: number[], 
        close: number[], 
        kPeriod: number = 14, 
        dPeriod: number = 3
    ): { k: number[]; d: number[] } {
        const stochastic = {
            k: [] as number[],
            d: [] as number[]
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
    
    public calculateATR(high: number[], low: number[], close: number[], period: number = 14): number[] {
        const trueRanges: number[] = [];
        
        for (let i = 1; i < high.length; i++) {
            const tr1 = high[i] - low[i];
            const tr2 = Math.abs(high[i] - close[i - 1]);
            const tr3 = Math.abs(low[i] - close[i - 1]);
            
            trueRanges.push(Math.max(tr1, tr2, tr3));
        }
        
        return this.calculateSMA(trueRanges, period);
    }
    
    public calculateWilliamsR(
        high: number[], 
        low: number[], 
        close: number[], 
        period: number = 14
    ): number[] {
        const williamsR: number[] = [];
        
        for (let i = period - 1; i < close.length; i++) {
            const highestHigh = Math.max(...high.slice(i - period + 1, i + 1));
            const lowestLow = Math.min(...low.slice(i - period + 1, i + 1));
            
            const wr = ((highestHigh - close[i]) / (highestHigh - lowestLow)) * -100;
            williamsR.push(wr);
        }
        
        return williamsR;
    }
    
    public calculateCCI(high: number[], low: number[], close: number[], period: number = 20): number[] {
        const typicalPrices: number[] = [];
        for (let i = 0; i < high.length; i++) {
            typicalPrices.push((high[i] + low[i] + close[i]) / 3);
        }
        
        const sma = this.calculateSMA(typicalPrices, period);
        const cci: number[] = [];
        
        for (let i = period - 1; i < typicalPrices.length; i++) {
            const slice = typicalPrices.slice(i - period + 1, i + 1);
            const mean = sma[i - period + 1];
            const meanDeviation = slice.reduce((sum, tp) => sum + Math.abs(tp - mean), 0) / period;
            
            cci.push((typicalPrices[i] - mean) / (0.015 * meanDeviation));
        }
        
        return cci;
    }
    
    public detectSupportResistance(
        data: number[], 
        lookback: number = 20
    ): { support: SupportResistanceLevel[]; resistance: SupportResistanceLevel[] } {
        const levels = {
            support: [] as SupportResistanceLevel[],
            resistance: [] as SupportResistanceLevel[]
        };
        
        for (let i = lookback; i < data.length - lookback; i++) {
            const currentPrice = data[i];
            const leftPrices = data.slice(i - lookback, i);
            const rightPrices = data.slice(i + 1, i + lookback + 1);
            
            const isResistance = leftPrices.every(price => price <= currentPrice) &&
                               rightPrices.every(price => price <= currentPrice);
            
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
    
    public async calculateAll(ohlcv: OHLCVArray[]): Promise<ITechnicalIndicators> {
        try {
            const closes = ohlcv.map(candle => candle[4]);
            const highs = ohlcv.map(candle => candle[2]);
            const lows = ohlcv.map(candle => candle[3]);
            
            const indicators: ITechnicalIndicators = {
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
                signals: this.generateTradingSignals({} as ITechnicalIndicators, closes),
                timestamp: new Date().toISOString()
            };
            
            indicators.signals = this.generateTradingSignals(indicators, closes);
            
            return indicators;
            
        } catch (error) {
            throw new IndicatorError(`Error calculating indicators: ${(error as Error).message}`);
        }
    }
    
    public generateTradingSignals(indicators: ITechnicalIndicators, closes: number[]): TradingSignals {
        const signals: TradingSignals = {
            overall: 'NEUTRAL',
            strength: 0,
            signals: []
        };
        
        let bullishSignals = 0;
        let bearishSignals = 0;
        
        if (indicators.rsi && indicators.rsi.length > 0) {
            const lastRSI = indicators.rsi[indicators.rsi.length - 1];
            if (lastRSI < 30) {
                signals.signals.push({ type: 'RSI', signal: 'BUY', reason: 'RSI超卖' });
                bullishSignals++;
            } else if (lastRSI > 70) {
                signals.signals.push({ type: 'RSI', signal: 'SELL', reason: 'RSI超买' });
                bearishSignals++;
            }
        }
        
        if (indicators.macd && indicators.macd.histogram.length >= 2) {
            const currentHist = indicators.macd.histogram[indicators.macd.histogram.length - 1];
            const prevHist = indicators.macd.histogram[indicators.macd.histogram.length - 2];
            
            if (currentHist > 0 && prevHist <= 0) {
                signals.signals.push({ type: 'MACD', signal: 'BUY', reason: 'MACD金叉' });
                bullishSignals++;
            } else if (currentHist < 0 && prevHist >= 0) {
                signals.signals.push({ type: 'MACD', signal: 'SELL', reason: 'MACD死叉' });
                bearishSignals++;
            }
        }
        
        if (indicators.bollinger && indicators.bollinger.upper.length > 0) {
            const lastPrice = closes[closes.length - 1];
            const lastUpper = indicators.bollinger.upper[indicators.bollinger.upper.length - 1];
            const lastLower = indicators.bollinger.lower[indicators.bollinger.lower.length - 1];
            
            if (lastPrice <= lastLower) {
                signals.signals.push({ type: 'Bollinger', signal: 'BUY', reason: '价格触及下轨' });
                bullishSignals++;
            } else if (lastPrice >= lastUpper) {
                signals.signals.push({ type: 'Bollinger', signal: 'SELL', reason: '价格触及上轨' });
                bearishSignals++;
            }
        }
        
        const totalSignals = bullishSignals + bearishSignals;
        if (totalSignals > 0) {
            const bullishRatio = bullishSignals / totalSignals;
            signals.strength = Math.abs(bullishRatio - 0.5) * 2;
            
            if (bullishRatio > 0.6) {
                signals.overall = 'BULLISH';
            } else if (bullishRatio < 0.4) {
                signals.overall = 'BEARISH';
            }
        }
        
        return signals;
    }
}

export default TechnicalIndicators;