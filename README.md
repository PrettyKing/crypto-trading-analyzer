# 🚀 加密货币交易分析系统

一个基于Node.js和CCXT的综合性加密货币交易分析平台，集成AI预测和智能交易策略。

## ✨ 功能特性

- **🌐 多交易所支持**: 支持Binance、OKX等主流交易所
- **📊 实时数据监控**: WebSocket实时价格推送和市场数据
- **📈 技术指标分析**: 提供20多种常用技术指标（MA、RSI、MACD、布林带等）
- **🤖 智能信号生成**: 基于多指标综合分析的交易信号
- **💰 套利机会检测**: 自动检测跨交易所价格差异
- **⚠️ 价格预警系统**: 支持多种价格预警机制
- **🔍 市场异常检测**: 基于统计学的价格异动识别
- **💾 数据持久化**: MySQL数据存储和Redis缓存
- **📱 实时通知**: 支持多种通知方式
- **🎯 RESTful API**: 完整的API接口文档

## 🏗️ 系统架构

```
crypto-trading-analyzer/
├── src/
│   ├── index.js              # 主入口文件
│   ├── exchanges/            # 交易所管理
│   │   └── ExchangeManager.js
│   ├── indicators/           # 技术指标计算
│   │   └── TechnicalIndicators.js
│   ├── monitors/             # 价格监控
│   │   └── PriceMonitor.js
│   ├── routes/               # API路由
│   │   └── api.js
│   ├── database/             # 数据库操作
│   │   └── index.js
│   └── utils/                # 工具函数
│       └── logger.js
├── package.json
├── .env.example
└── README.md
```

## 📋 系统要求

- **Node.js**: >= 16.0.0
- **MySQL**: >= 8.0
- **Redis**: >= 6.0 (可选)
- **内存**: >= 2GB
- **存储**: >= 5GB

## 🛠️ 安装步骤

### 1. 克隆项目
```bash
git clone https://github.com/PrettyKing/crypto-trading-analyzer.git
cd crypto-trading-analyzer
```

### 2. 安装依赖
```bash
npm install
```

### 3. 环境配置
```bash
# 复制环境配置文件
cp .env.example .env

# 编辑配置文件
nano .env
```

**重要配置说明：**
```env
# 交易所API配置（必需）
BINANCE_API_KEY=your_binance_api_key
BINANCE_SECRET=your_binance_secret
OKX_API_KEY=your_okx_api_key
OKX_SECRET=your_okx_secret
OKX_PASSPHRASE=your_okx_passphrase

# 数据库配置（必需）
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=password
MYSQL_DATABASE=trading_analyzer

# 服务器配置
PORT=3000
NODE_ENV=development
```

### 4. 数据库初始化
确保MySQL服务正在运行，系统会自动创建所需的数据表。

### 5. 启动服务
```bash
# 开发模式（推荐）
npm run dev

# 生产模式
npm start
```

## 📊 API接口文档

### 基础信息
- **服务地址**: http://localhost:3000
- **WebSocket**: ws://localhost:3000
- **API前缀**: /api

### 核心API端点

#### 1. 获取实时价格
```http
GET /api/price/BTC/USDT?exchange=binance
```

#### 2. 获取多交易所价格对比
```http
GET /api/prices/BTC/USDT
```

#### 3. 获取K线数据
```http
GET /api/ohlcv/BTC/USDT?timeframe=1h&limit=100
```

#### 4. 获取技术指标
```http
GET /api/indicators/BTC/USDT?timeframe=1h
```

#### 5. 获取交易信号
```http
GET /api/signals/BTC/USDT
```

#### 6. 获取套利机会
```http
GET /api/arbitrage/BTC/USDT
GET /api/arbitrage  # 获取所有交易对的套利机会
```

### API响应格式
```json
{
  "success": true,
  "data": {
    "symbol": "BTC/USDT",
    "price": 45000,
    "timestamp": "2025-09-02T06:00:00.000Z"
  }
}
```

## 🔌 WebSocket事件

### 连接和订阅
```javascript
const socket = io('http://localhost:3000');

// 订阅价格更新
socket.emit('subscribe', { symbols: ['BTC/USDT', 'ETH/USDT'] });

// 监听价格更新
socket.on('price_update', (data) => {
  console.log('Price update:', data);
});

// 监听技术指标更新
socket.on('indicators_update', (data) => {
  console.log('Indicators update:', data);
});

// 监听套利机会
socket.on('arbitrage_opportunities', (data) => {
  console.log('Arbitrage opportunities:', data);
});

// 监听价格预警
socket.on('price_alert', (data) => {
  console.log('Price alert:', data);
});
```

## 📈 技术指标说明

系统支持以下技术指标：

### 趋势指标
- **SMA**: 简单移动平均线（20、50期）
- **EMA**: 指数移动平均线（12、26期）
- **MACD**: 移动平均收敛发散指标

### 振荡器指标
- **RSI**: 相对强弱指标（14期）
- **Stochastic**: 随机指标（K%、D%）
- **Williams %R**: 威廉指标
- **CCI**: 商品通道指数

### 波动性指标
- **Bollinger Bands**: 布林带（20期，2倍标准差）
- **ATR**: 平均真实波幅

### 支撑阻力
- **自动识别**: 基于局部极值的支撑阻力位检测

## 🤖 智能交易信号

### 信号等级
- **BULLISH**: 看涨信号，建议买入
- **BEARISH**: 看跌信号，建议卖出
- **NEUTRAL**: 中性信号，建议观望

### 信号强度
- **0.0-0.3**: 弱信号
- **0.3-0.6**: 中等信号
- **0.6-1.0**: 强信号

### 交易建议示例
```json
{
  "action": "BUY",
  "confidence": 0.85,
  "entryPrice": 45000,
  "stopLoss": 42750,
  "takeProfit": 49500,
  "riskLevel": "MEDIUM",
  "reasoning": [
    "RSI超卖，显示买入信号",
    "MACD金叉，趋势转强",
    "价格突破重要阻力位"
  ]
}
```

## 💰 套利机会检测

系统自动监控跨交易所价格差异，识别套利机会：

### 套利策略
1. **价差套利**: 同一交易对在不同交易所的价格差异
2. **三角套利**: 不同交易对之间的价格不平衡
3. **时间套利**: 利用价格更新的时间差

### 风险提示
- 考虑交易手续费
- 注意资金转移时间
- 关注流动性风险
- 市场波动风险

## 🚨 价格预警系统

### 预警类型
- **价格突破**: 价格突破设定阈值
- **百分比变动**: 价格涨跌幅超过设定值
- **成交量异常**: 成交量激增预警
- **技术指标**: 基于技术指标的预警

### 通知方式
- WebSocket实时推送
- Telegram机器人
- 邮件通知
- Webhook回调

## 📊 数据存储

### 数据表结构
- **price_history**: 价格历史数据
- **technical_indicators**: 技术指标数据
- **trading_signals**: 交易信号记录
- **arbitrage_opportunities**: 套利机会记录
- **price_alerts**: 价格预警配置

### 数据清理
系统自动清理30天以前的历史数据，保持数据库性能。

## 🔧 开发指南

### 项目结构说明
```
src/
├── index.js                 # 应用主入口
├── exchanges/               # 交易所接口封装
├── indicators/              # 技术指标算法
├── monitors/               # 监控服务
├── routes/                 # API路由定义
├── database/               # 数据库操作
└── utils/                  # 通用工具函数
```

### 添加新交易所
1. 在`ExchangeManager.js`中添加新交易所配置
2. 配置API密钥和特殊参数
3. 测试连接和数据获取
4. 更新文档

### 添加新技术指标
1. 在`TechnicalIndicators.js`中实现指标算法
2. 更新`calculateAll`方法
3. 添加数据库字段（如需要）
4. 编写测试用例

## 🧪 测试

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test -- --grep "技术指标"

# 查看测试覆盖率
npm run coverage
```

## 📈 性能优化

### 建议配置
- 使用Redis缓存频繁查询的数据
- 定期清理历史数据
- 合理设置API请求频率限制
- 使用连接池管理数据库连接

### 监控指标
- API响应时间
- 数据库查询性能
- WebSocket连接数
- 内存使用情况

## 🚀 部署指南

### Docker部署
```bash
# 构建镜像
docker build -t crypto-analyzer .

# 运行容器
docker run -d \
  --name crypto-analyzer \
  -p 3000:3000 \
  -e MYSQL_HOST=host.docker.internal \
  crypto-analyzer
```

### PM2部署
```bash
# 安装PM2
npm install -g pm2

# 启动应用
pm2 start src/index.js --name crypto-analyzer

# 查看状态
pm2 status

# 查看日志
pm2 logs crypto-analyzer
```

## 📚 开发路线图

- [x] 基础项目结构
- [x] 多交易所数据接入
- [x] 技术指标计算
- [x] 实时价格监控
- [x] 套利机会检测
- [ ] AI预测模型集成
- [ ] Web管理界面
- [ ] 移动端应用
- [ ] 回测系统
- [ ] 实盘交易接口
- [ ] 量化策略框架

## ⚠️ 风险提示

**重要声明：本项目仅用于教育和研究目的。**

- 加密货币交易存在高风险，可能导致资金损失
- 任何交易决策都应基于您自己的分析和判断
- 过往表现不代表未来结果
- 请在充分了解风险的情况下使用
- 作者不承担任何交易损失责任

## 🤝 贡献指南

欢迎提交Pull Request！请遵循以下规范：

1. Fork本项目
2. 创建功能分支: `git checkout -b feature/新功能`
3. 提交更改: `git commit -am '添加新功能'`
4. 推送到分支: `git push origin feature/新功能`
5. 提交Pull Request

### 代码规范
- 使用ESLint进行代码检查
- 遵循JavaScript Standard Style
- 添加适当的注释和文档
- 编写测试用例

## 📞 技术支持

- **GitHub Issues**: [提交问题](https://github.com/PrettyKing/crypto-trading-analyzer/issues)
- **文档**: [项目Wiki](https://github.com/PrettyKing/crypto-trading-analyzer/wiki)
- **讨论**: [GitHub Discussions](https://github.com/PrettyKing/crypto-trading-analyzer/discussions)

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源协议。

## 🙏 致谢

感谢以下开源项目的支持：
- [CCXT](https://github.com/ccxt/ccxt) - 加密货币交易库
- [Express.js](https://expressjs.com/) - Web应用框架
- [Socket.io](https://socket.io/) - 实时通信
- [Winston](https://github.com/winstonjs/winston) - 日志管理
- [MySQL2](https://github.com/sidorares/node-mysql2) - MySQL驱动

---

⭐ 如果这个项目对你有帮助，请给个Star支持一下！

📊 **免责声明**: 投资有风险，入市需谨慎。本工具仅供学习和研究使用。
