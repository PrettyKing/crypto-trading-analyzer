# 🚀 加密货币交易分析系统 (TypeScript版本)

TypeScript版本的综合性加密货币交易分析平台，集成AI预测和智能交易策略。

## 🆕 TypeScript版本新特性

- **完整的类型安全**: 使用TypeScript强类型系统，减少运行时错误
- **优秀的开发体验**: IntelliSense代码补全、重构支持
- **严格的代码质量**: ESLint + TypeScript规则
- **模块化设计**: 清晰的类型定义和接口设计
- **编译时检查**: 在运行前捕获潜在错误

## 📋 系统要求

- **Node.js**: >= 18.0.0
- **TypeScript**: >= 5.0.0
- **MySQL**: >= 8.0
- **Redis**: >= 6.0 (可选)
- **内存**: >= 2GB
- **存储**: >= 5GB

## 🛠️ 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 环境配置

```bash
# 复制环境配置文件
cp .env.example .env

# 编辑配置文件
nano .env
```

### 3. 编译项目

```bash
# 开发模式 (带热重载)
npm run dev

# 构建生产版本
npm run build

# 运行生产版本
npm start
```

## 🏗️ TypeScript项目结构

```
src/
├── index.ts                    # 应用主入口
├── types/                      # TypeScript类型定义
│   └── index.ts               
├── exchanges/                  # 交易所接口封装
│   └── ExchangeManager.ts
├── indicators/                 # 技术指标算法
│   └── TechnicalIndicators.ts
├── monitors/                   # 监控服务
│   └── PriceMonitor.ts
├── routes/                     # API路由定义
│   └── api.ts
├── database/                   # 数据库操作
│   └── index.ts
└── utils/                      # 通用工具函数
    └── logger.ts
```

## 🎯 核心类型定义

### 技术指标类型
```typescript
interface TechnicalIndicators {
  sma: { sma20: number[]; sma50: number[] };
  ema: { ema12: number[]; ema26: number[] };
  rsi: number[];
  macd: { macd: number[]; signal: number[]; histogram: number[] };
  bollinger: { upper: number[]; middle: number[]; lower: number[] };
  // ... 更多指标
}
```

### 交易信号类型
```typescript
interface TradingSignals {
  overall: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  strength: number;
  signals: IndividualSignal[];
}
```

### 套利机会类型
```typescript
interface ArbitrageOpportunity {
  symbol: string;
  buyExchange: string;
  sellExchange: string;
  buyPrice: number;
  sellPrice: number;
  percentage: string;
  timestamp: string;
}
```

## 📦 开发脚本

```bash
# 开发模式
npm run dev              # ts-node-dev 热重载
npm run dev:watch        # nodemon + ts-node

# 构建和生产
npm run build            # 编译到dist/
npm start               # 运行编译后的代码

# 代码质量
npm run lint            # ESLint检查
npm run lint:fix        # 自动修复ESLint错误
npm run type-check      # TypeScript类型检查

# 清理和测试
npm run clean           # 清理dist目录
npm test               # 运行测试
```

## 🔧 TypeScript配置

### tsconfig.json 主要配置
- **target**: ES2020
- **module**: CommonJS
- **strict**: 严格模式
- **paths**: 路径别名支持
- **decorators**: 装饰器支持

### ESLint配置
- TypeScript专用规则
- 严格的类型检查
- 代码风格统一

## 🌟 TypeScript优势

### 1. 类型安全
```typescript
// 编译时就能发现错误
const price: number = "invalid"; // ❌ 类型错误

// 接口约束
interface TickerData {
  symbol: string;
  last: number;
  bid: number;
  ask: number;
}
```

### 2. 优秀的IDE支持
- 自动补全
- 重构支持
- 实时错误提示
- 跳转到定义

### 3. 更好的代码维护性
```typescript
class ExchangeManager {
  public async getTicker(
    exchangeName: string, 
    symbol: string
  ): Promise<ccxt.Ticker> {
    // 方法签名清晰，返回类型明确
  }
}
```

## 🚀 部署指南

### Docker部署
```bash
# 构建镜像
docker build -t crypto-analyzer-ts .

# 运行容器
docker run -d \
  --name crypto-analyzer-ts \
  -p 3000:3000 \
  crypto-analyzer-ts
```

### PM2部署
```bash
# 先构建项目
npm run build

# 使用PM2启动
pm2 start dist/index.js --name crypto-analyzer-ts

# 查看状态
pm2 status
```

## 🔍 API文档

所有API接口都有完整的TypeScript类型定义：

```typescript
// API响应类型
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// 获取价格响应
interface PriceResponse {
  symbol: string;
  exchange: string;
  price: number;
  bid: number;
  ask: number;
  volume: number;
  timestamp: number;
}
```

## 🧪 测试

```bash
# 运行所有测试
npm test

# 运行类型检查
npm run type-check

# 代码覆盖率
npm run coverage
```

## 🤝 开发规范

### Git提交规范
```
feat: 新功能
fix: 错误修复
docs: 文档更新
style: 代码格式
refactor: 代码重构
test: 测试相关
chore: 构建配置
```

### 代码风格
- 使用ESLint + Prettier
- 严格的TypeScript检查
- 统一的命名规范
- 完整的JSDoc注释

## 📚 学习资源

- [TypeScript官方文档](https://www.typescriptlang.org/)
- [Node.js TypeScript最佳实践](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
- [CCXT TypeScript指南](https://github.com/ccxt/ccxt/wiki/Manual#javascript)

## 🎉 主要改进

1. **类型安全**: 所有函数、变量都有明确类型
2. **接口定义**: 统一的数据结构定义
3. **错误处理**: 自定义异常类型
4. **开发体验**: 热重载、自动补全
5. **代码质量**: ESLint严格检查
6. **构建优化**: 编译到高效的JavaScript

---

⭐ 如果这个项目对你有帮助，请给个Star支持一下！

📊 **投资有风险，入市需谨慎。本工具仅供学习和研究使用。**