# 快速启动指南

## 前置条件检查

```bash
# 检查 Node.js 版本（需要 20+）
node --version

# 检查 pnpm（需要 10+）
pnpm --version

# 如果没有 pnpm，安装它
npm install -g pnpm
```

## 启动步骤

### 1. 安装依赖
```bash
cd /Volumes/T7/coding/trading
pnpm install
```

### 2. 启动开发环境

#### 选项 A：仅启动前端（图表可用，但无实时数据）
```bash
pnpm dev:web
```
访问 http://localhost:3000

#### 选项 B：启动完整服务（推荐）
```bash
# 启动 BFF + 前端
pnpm dev:all
```
- 前端: http://localhost:3000
- BFF API: http://localhost:3001
- BFF Health: http://localhost:3001/health

### 3. 测试新功能

#### 测试 API 端点
```bash
# 基础信号
curl http://localhost:3001/api/signals/current?symbol=BTC/USDT

# FOMO 检测（S6 策略）
curl http://localhost:3001/api/signals/advanced/fomo?symbol=BTC/USDT

# 止损猎杀（S7 策略）
curl http://localhost:3001/api/signals/advanced/stop-hunt?symbol=BTC/USDT

# SME 指数（S8 策略）
curl http://localhost:3001/api/whale/sme?symbol=BTC/USDT

# 数据质量评分
curl http://localhost:3001/api/signals/quality?symbol=BTC/USDT

# 异常检测
curl http://localhost:3001/api/signals/anomalies?symbol=BTC/USDT

# 完整参与者分析
curl http://localhost:3001/api/whale/full-analysis?symbol=BTC/USDT
```

#### 访问前端页面
1. 打开 http://localhost:3000/dashboard
2. 点击左侧菜单 "Whale Tracker"
3. 查看新增的功能：
   - SME 指数卡片（左上角）
   - 数据质量评分（中上）
   - 财富流向总结（右上）
   - 5类参与者画像（左下）
   - 巨鲸活动监控（右下）

## 新增功能验证清单

### ✅ 后端 API
- [ ] `/api/signals/current` 返回 8 个策略（包含 S6, S7, S8）
- [ ] `/api/signals/advanced/fomo` 返回 FOMO 检测结果
- [ ] `/api/signals/advanced/stop-hunt` 返回止损猎杀检测
- [ ] `/api/signals/advanced/liquidation` 返回清算分析
- [ ] `/api/signals/advanced/oi-divergence` 返回 OI 背离检测
- [ ] `/api/signals/advanced/wyckoff` 返回 Wyckoff 阶段
- [ ] `/api/signals/quality` 返回 DQS 评分
- [ ] `/api/signals/anomalies` 返回异常检测结果
- [ ] `/api/whale/profiles` 返回 5 类参与者画像
- [ ] `/api/whale/sme` 返回 SME 指数

### ✅ 前端 UI
- [ ] Whale Tracker 页面显示 SME 指数
- [ ] 显示数据质量评分（DQS）
- [ ] 显示财富流向总结
- [ ] 参与者画像显示 5 类分类
- [ ] 多空比数据正确显示

## 常见问题

### Q1: BFF 启动失败
**检查**:
```bash
# 查看 BFF 日志
cd /Volumes/T7/coding/trading
pnpm --filter=@whale-tracker/bff dev
```

### Q2: 前端无法连接 BFF
**检查环境变量**:
```bash
# 确认 .env 文件存在
cat /Volumes/T7/coding/trading/.env

# 应该包含:
NEXT_PUBLIC_BFF_URL=http://localhost:3001
```

### Q3: Binance API 访问失败
**可能原因**: 地区限制

**解决方案**:
1. 使用 VPN/代理
2. 或者系统会自动降级到 CoinGecko API

### Q4: 数据显示 (demo)
**说明**: 这是正常的，表示使用模拟数据

**原因**:
- Binance API 暂时不可用
- 或者数据量不足

**不影响功能测试**

## 生产部署

### 构建
```bash
# 构建前端
pnpm --filter=@whale-tracker/web build

# 构建 BFF
pnpm --filter=@whale-tracker/bff build
```

### 运行
```bash
# 前端（standalone）
node apps/web/.next/standalone/apps/web/server.js

# BFF
node apps/bff/dist/index.js
```

## 下一步

1. **测试所有新功能** - 按照上面的验证清单逐项测试
2. **集成外部数据源** - CoinGlass 和 Glassnode（可选）
3. **调整策略权重** - 根据实际表现优化
4. **添加更多交易对** - ETH, SOL, BNB 等

## 技术支持

如遇问题，请检查：
1. `IMPLEMENTATION_SUMMARY.md` - 完整实施文档
2. `README.md` - 项目总览
3. BFF 日志输出
4. 浏览器控制台错误

---

**实施完成日期**: 2026-03-08  
**版本**: V2 Supplement - Market Participant Analysis
