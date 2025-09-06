import { Socket } from 'socket.io';

// CCXT相关类型
export interface OHLCVData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type OHLCVArray = [number, number, number, number, number, number];

export interface TickerData {
  symbol: string;
  last: number;
  bid: number;
  ask: number;
  baseVolume: number;
  quoteVolume: number;
  change: number;
  percentage: number;
  timestamp: number;
}

export interface OrderBookData {
  symbol: string;
  bids: [number, number][];
  asks: [number, number][];
  timestamp: number;
}

export interface TradeData {
  id: string;
  timestamp: number;
  symbol: string;
  side: 'buy' | 'sell';
  amount: number;
  price: number;
}

// 技术指标类型
export interface TechnicalIndicators {
  sma: {
    sma20: number[];
    sma50: number[];
  };
  ema: {
    ema12: number[];
    ema26: number[];
  };
  rsi: number[];
  macd: {
    macd: number[];
    signal: number[];
    histogram: number[];
  };
  bollinger: {
    upper: number[];
    middle: number[];
    lower: number[];
  };
  stochastic: {
    k: number[];
    d: number[];
  };
  atr: number[];
  williamsR: number[];
  cci: number[];
  supportResistance: {
    support: SupportResistanceLevel[];
    resistance: SupportResistanceLevel[];
  };
  signals: TradingSignals;
  timestamp: string;
}

export interface SupportResistanceLevel {
  price: number;
  index: number;
  strength: number;
}

// 交易信号类型
export interface TradingSignals {
  overall: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  strength: number;
  signals: IndividualSignal[];
}

export interface IndividualSignal {
  type: string;
  signal: 'BUY' | 'SELL' | 'HOLD';
  reason: string;
}

export interface TradeRecommendation {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  entryPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  reasoning: string[];
}

// 套利机会类型
export interface ArbitrageOpportunity {
  symbol: string;
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  priceDifference: number;
  percentage: string;
  timestamp: string;
}

// 价格预警类型
export interface PriceAlert {
  id: string;
  symbol: string;
  targetPrice: number;
  type: 'above' | 'below';
  callback?: ((data: PriceAlertData) => Promise<void>) | undefined;
  createdAt: string;
  triggered: boolean;
}

export interface PriceAlertData {
  id: string;
  symbol: string;
  currentPrice: number;
  targetPrice: number;
  type: 'above' | 'below';
  timestamp: string;
}

// 价格监控类型
export interface PriceUpdateData {
  timestamp: string;
  prices: Record<string, ExchangePriceData>;
}

export interface ExchangePriceData {
  price: number;
  bid: number;
  ask: number;
  volume: number;
  timestamp: number;
}

export interface PriceChangeStats {
  symbol: string;
  timeframe: string;
  currentPrice: number;
  startPrice: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
  timestamp: string;
}

export interface PriceAnomaly {
  symbol: string;
  currentPrice: number;
  avgPrice: number;
  zScore: number;
  threshold: number;
  type: 'SPIKE' | 'DROP';
  severity: 'HIGH' | 'MEDIUM';
  timestamp: string;
}

// MongoDB数据库相关类型
export interface DatabaseConfig {
  uri: string;
  dbName: string;
  options?: {
    maxPoolSize?: number;
    minPoolSize?: number;
    maxIdleTimeMS?: number;
    serverSelectionTimeoutMS?: number;
  };
}

// MongoDB文档接口
export interface PriceHistoryDocument {
  _id?: string;
  symbol: string;
  exchange: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timeframe: string;
  createdAt: Date;
}

export interface TechnicalIndicatorDocument {
  _id?: string;
  symbol: string;
  exchange: string;
  timestamp: number;
  timeframe: string;
  rsi?: number;
  macd?: number;
  macd_signal?: number;
  macd_histogram?: number;
  sma_20?: number;
  sma_50?: number;
  ema_12?: number;
  ema_26?: number;
  bb_upper?: number;
  bb_middle?: number;
  bb_lower?: number;
  stoch_k?: number;
  stoch_d?: number;
  atr?: number;
  williams_r?: number;
  cci?: number;
  createdAt: Date;
}

export interface TradingSignalDocument {
  _id?: string;
  symbol: string;
  exchange: string;
  signal_type: 'BUY' | 'SELL' | 'HOLD';
  signal_strength: number;
  price: number;
  indicators_used: any;
  reasoning?: string;
  timestamp: number;
  createdAt: Date;
}

export interface ArbitrageOpportunityDocument {
  _id?: string;
  symbol: string;
  buy_exchange: string;
  sell_exchange: string;
  buy_price: number;
  sell_price: number;
  price_difference: number;
  percentage: number;
  timestamp: number;
  createdAt: Date;
}

export interface PriceAlertDocument {
  _id?: string;
  symbol: string;
  target_price: number;
  alert_type: 'above' | 'below';
  status: 'active' | 'triggered' | 'cancelled';
  user_id?: string;
  notification_method?: 'websocket' | 'telegram' | 'email';
  createdAt: Date;
  triggeredAt?: Date;
}

export interface TradingHistoryDocument {
  _id?: string;
  symbol: string;
  exchange: string;
  order_type: 'market' | 'limit' | 'stop';
  side: 'buy' | 'sell';
  amount: number;
  price: number;
  filled_amount: number;
  status: 'pending' | 'filled' | 'cancelled' | 'failed';
  order_id?: string;
  timestamp: number;
  createdAt: Date;
}

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: any; // For validation errors and additional error information
  retryAfter?: number; // For rate limiting
}

export interface ExchangeInfo {
  name: string;
  markets: number;
  symbols: string[];
  fees: any;
  limits: any;
  capabilities: any;
}

// Socket.IO事件类型
export interface CustomSocketIOServer {
  // 添加自定义事件类型
}

export interface ClientSocket extends Socket {
  // 添加自定义属性
}

export interface SubscriptionData {
  symbols: string[];
}

// 交易所相关类型
export interface ExchangeCredentials {
  apiKey: string;
  secret: string;
  password?: string; // OKX需要
  sandbox?: boolean;
  enableRateLimit?: boolean;
}

export interface OrderData {
  id: string;
  symbol: string;
  type: 'market' | 'limit' | 'stop';
  side: 'buy' | 'sell';
  amount: number;
  price?: number;
  filled: number;
  status: 'open' | 'closed' | 'canceled';
  timestamp: number;
}

export interface BalanceData {
  total: Record<string, number>;
  free: Record<string, number>;
  used: Record<string, number>;
}

// 配置类型
export interface AppConfig {
  port: number;
  nodeEnv: string;
  mongodb: DatabaseConfig;
  exchanges: {
    binance?: ExchangeCredentials;
    okx?: ExchangeCredentials;
  };
}

// 错误类型
export class ExchangeError extends Error {
  constructor(message: string, public exchange?: string, public symbol?: string) {
    super(message);
    this.name = 'ExchangeError';
  }
}

export class DatabaseError extends Error {
  constructor(message: string, public operation?: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class IndicatorError extends Error {
  constructor(message: string, public indicator?: string) {
    super(message);
    this.name = 'IndicatorError';
  }
}

// 枚举类型
export enum SignalType {
  BUY = 'BUY',
  SELL = 'SELL',
  HOLD = 'HOLD'
}

export enum AlertType {
  ABOVE = 'above',
  BELOW = 'below'
}

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH'
}

export enum TimeFrame {
  ONE_MINUTE = '1m',
  FIVE_MINUTES = '5m',
  FIFTEEN_MINUTES = '15m',
  THIRTY_MINUTES = '30m',
  ONE_HOUR = '1h',
  FOUR_HOURS = '4h',
  ONE_DAY = '1d'
}

export enum ExchangeName {
  BINANCE = 'binance',
  OKX = 'okx',
  HUOBI = 'huobi'
}