# 🍃 MongoDB 数据库架构文档

本项目已完全迁移至MongoDB，提供更好的可扩展性和灵活性。

## 🏗️ 数据库结构

### 集合（Collections）

#### 1. `price_history` - 价格历史数据
```typescript
interface PriceHistoryDocument {
  _id?: string;
  symbol: string;        // 交易对，如 "BTC/USDT"
  exchange: string;      // 交易所名称，如 "binance"
  timestamp: number;     // 时间戳
  open: number;          // 开盘价
  high: number;          // 最高价
  low: number;           // 最低价
  close: number;         // 收盘价
  volume: number;        // 成交量
  timeframe: string;     // 时间周期，如 "1h", "1d"
  createdAt: Date;       // 创建时间
}
```

**索引：**
- `{ symbol: 1, exchange: 1, timestamp: 1 }` (唯一索引)
- `{ symbol: 1, timestamp: -1 }`
- `{ exchange: 1 }`
- `{ timeframe: 1 }`
- TTL索引：30天后自动删除

#### 2. `technical_indicators` - 技术指标数据
```typescript
interface TechnicalIndicatorDocument {
  _id?: string;
  symbol: string;
  exchange: string;
  timestamp: number;
  timeframe: string;
  rsi?: number;          // RSI指标
  macd?: number;         // MACD主线
  macd_signal?: number;  // MACD信号线
  macd_histogram?: number; // MACD柱状图
  sma_20?: number;       // 20期简单移动平均线
  sma_50?: number;       // 50期简单移动平均线
  ema_12?: number;       // 12期指数移动平均线
  ema_26?: number;       // 26期指数移动平均线
  bb_upper?: number;     // 布林带上轨
  bb_middle?: number;    // 布林带中轨
  bb_lower?: number;     // 布林带下轨
  stoch_k?: number;      // 随机指标K值
  stoch_d?: number;      // 随机指标D值
  atr?: number;          // 平均真实波幅
  williams_r?: number;   // 威廉指标
  cci?: number;          // 商品通道指数
  createdAt: Date;
}
```

**索引：**
- `{ symbol: 1, exchange: 1, timestamp: 1, timeframe: 1 }` (唯一索引)
- `{ symbol: 1, timestamp: -1 }`
- TTL索引：30天后自动删除

#### 3. `trading_signals` - 交易信号记录
```typescript
interface TradingSignalDocument {
  _id?: string;
  symbol: string;
  exchange: string;
  signal_type: 'BUY' | 'SELL' | 'HOLD';
  signal_strength: number;     // 信号强度 0-1
  price: number;              // 当时价格
  indicators_used: any;       // 使用的指标数组
  reasoning?: string;         // 信号理由
  timestamp: number;
  createdAt: Date;
}
```

**索引：**
- `{ symbol: 1, timestamp: -1 }`
- `{ signal_type: 1 }`
- TTL索引：30天后自动删除

#### 4. `arbitrage_opportunities` - 套利机会记录
```typescript
interface ArbitrageOpportunityDocument {
  _id?: string;
  symbol: string;
  buy_exchange: string;       // 买入交易所
  sell_exchange: string;      // 卖出交易所
  buy_price: number;          // 买入价格
  sell_price: number;         // 卖出价格
  price_difference: number;   // 价格差异
  percentage: number;         // 套利百分比
  timestamp: number;
  createdAt: Date;
}
```

**索引：**
- `{ symbol: 1, timestamp: -1 }`
- `{ percentage: -1 }`
- TTL索引：7天后自动删除

#### 5. `price_alerts` - 价格预警配置
```typescript
interface PriceAlertDocument {
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
```

**索引：**
- `{ symbol: 1, status: 1 }`
- `{ user_id: 1 }`
- `{ status: 1 }`

#### 6. `trading_history` - 交易历史记录
```typescript
interface TradingHistoryDocument {
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
```

**索引：**
- `{ symbol: 1, timestamp: -1 }`
- `{ status: 1 }`
- `{ order_id: 1 }` (唯一索引，稀疏)
- TTL索引：365天后自动删除

## ⚙️ 配置说明

### 环境变量
```env
# MongoDB数据库配置（必需）
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=trading_analyzer

# 集群配置示例
# MONGODB_URI=mongodb://user:password@host1:27017,host2:27017/database?replicaSet=rs0

# MongoDB Atlas配置示例
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
```

### 连接选项
- **maxPoolSize**: 10 (最大连接池大小)
- **minPoolSize**: 2 (最小连接池大小)
- **maxIdleTimeMS**: 30000 (最大空闲时间)
- **serverSelectionTimeoutMS**: 5000 (服务器选择超时)

## 🚀 MongoDB优势

### 1. **灵活的文档模型**
- 无需预定义严格的表结构
- 支持嵌套文档和数组
- 易于添加新字段

### 2. **高性能**
- 内存映射存储引擎
- 高效的索引系统
- 支持分片和复制集

### 3. **自动数据过期**
- TTL索引自动清理旧数据
- 减少存储成本
- 提高查询性能

### 4. **横向扩展**
- 支持分片集群
- 高可用性复制集
- 自动故障转移

## 📊 数据操作示例

### 查询价格历史
```typescript
import { getCollection, COLLECTIONS } from './database';

const priceHistory = await getCollection(COLLECTIONS.PRICE_HISTORY)
  .find({
    symbol: 'BTC/USDT',
    exchange: 'binance',
    timestamp: { $gte: Date.now() - 24 * 60 * 60 * 1000 }
  })
  .sort({ timestamp: -1 })
  .limit(100)
  .toArray();
```

### 查询最新交易信号
```typescript
const signals = await getCollection(COLLECTIONS.TRADING_SIGNALS)
  .find({ symbol: 'BTC/USDT' })
  .sort({ timestamp: -1 })
  .limit(10)
  .toArray();
```

### 聚合查询套利机会
```typescript
const topArbitrage = await getCollection(COLLECTIONS.ARBITRAGE_OPPORTUNITIES)
  .aggregate([
    { $match: { percentage: { $gt: 1 } } },
    { $sort: { percentage: -1 } },
    { $limit: 10 }
  ])
  .toArray();
```

## 🛠️ 数据库管理

### 手动创建索引
```javascript
// 连接MongoDB后执行
db.price_history.createIndex({ symbol: 1, timestamp: -1 });
db.trading_signals.createIndex({ signal_type: 1, timestamp: -1 });
```

### 查看集合统计
```javascript
db.price_history.stats();
db.trading_signals.countDocuments();
```

### 数据清理
```javascript
// 删除30天前的数据
db.price_history.deleteMany({
  createdAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
});
```

## 🔧 性能优化建议

### 1. **索引优化**
- 为常用查询字段创建索引
- 使用复合索引优化多字段查询
- 定期分析索引使用情况

### 2. **查询优化**
- 使用投影只返回需要的字段
- 合理使用limit限制返回数量
- 利用MongoDB的聚合管道

### 3. **存储优化**
- 使用TTL索引自动清理旧数据
- 合理设置文档结构避免冗余
- 考虑数据压缩选项

### 4. **监控指标**
- 连接池使用情况
- 查询执行时间
- 索引命中率
- 存储使用量

## 🔒 安全最佳实践

1. **认证和授权**
   - 启用MongoDB认证
   - 使用最小权限原则
   - 定期轮换密码

2. **网络安全**
   - 绑定到特定IP
   - 使用防火墙限制访问
   - 启用TLS/SSL加密

3. **数据备份**
   - 定期进行数据备份
   - 测试备份恢复流程
   - 考虑增量备份策略

## 📚 相关资源

- [MongoDB官方文档](https://docs.mongodb.com/)
- [MongoDB Node.js驱动](https://mongodb.github.io/node-mongodb-native/)
- [MongoDB索引最佳实践](https://docs.mongodb.com/manual/applications/indexes/)
- [MongoDB性能调优](https://docs.mongodb.com/manual/administration/analyzing-mongodb-performance/)

---

🎉 **MongoDB迁移完成！** 现在项目具备了更好的扩展性和性能表现。