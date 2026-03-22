# XMAX 智能招聘平台 - 测试工程师编程面试题

## 项目背景
XMAX 是一个智能招聘 SaaS 平台，采用微服务架构（Node.js/Koa），包含用户中心、职位管理、简历服务、面试预约等核心模块。

本仓库包含 **xmax-job-service（职位服务）** 和 **xmax-user-center-service（用户中心）** 的完整源码（已脱敏），以及网关鉴权中间件代码。这是一个真实的生产项目代码，您需要基于此完成测试工程相关任务。

## 快速开始

### 环境要求
- Node.js >= 18
- Docker & Docker Compose（用于启动 MongoDB + Redis）

### 启动步骤
```bash
# 1. Fork 本仓库并 clone
git clone https://github.com/<your-username>/xmax-test-assignment.git
cd xmax-test-assignment

# 2. 启动数据库
docker-compose up -d
docker-compose ps  # 确认 MongoDB + Redis 正常运行

# 3. 启动用户中心（端口 3010）
cd user-center
cp .env.example .env
npm install
npm start &

# 4. 启动职位服务（端口 3020）
cd ../job-service
cp .env.example .env
npm install
npm start

# 5. 验证服务
curl http://localhost:3010/health   # 用户中心
curl http://localhost:3020/health   # 职位服务
```

> **提示**: 启动后可通过用户中心注册账号 → 登录获取 JWT Token → 携带 Token 调用职位服务 API

### 运行测试
```bash
npm test           # 运行所有测试
npm run test:a     # Module A 测试
npm run test:b     # Module B 测试
```

## 面试题

### Module A: 鉴权中间件（建议时间占比 ~30%）
**源码位置**: `gateway/jwt_auth.js` + `gateway/gateway_auth.js` + `gateway/errors.js`
**题目详情**: 见 `docs/module-a-assignment.md`
**考察重点**: 代码审查、安全测试、回归测试

### Module B: 职位申请流程（建议时间占比 ~70%）
**源码位置**: `job-service/src/services/ApplicationService.js` + `job-service/src/constants/application_status.js` + `job-service/src/controllers/candidateApplicationController.js`
**题目详情**: 见 `docs/module-b-assignment.md`
**黑盒 API 文档**: 见 `docs/api-spec.md`
**考察重点**: 状态分析、分支覆盖、黑盒测试

## 评分维度
| 维度 | 权重 | 说明 |
|------|------|------|
| AI Coding 能力 | 60% | AI 工具选择与熟练度、Prompt 工程质量、AI 输出的筛选与修正、AI 加速效果 |
| 白盒测试能力 | 25% | 代码阅读、分支分析、单元测试编写、问题发现 |
| 黑盒测试能力 | 15% | 测试用例设计、等价类划分、自动化实现 |

## 工具要求
- **编程语言**: Python (Pytest) 或 JavaScript (Jest/Mocha) 均可
- **AI 工具**: 鼓励使用 Claude Code / Cursor / GitHub Copilot 等 AI 辅助工具
- **注意**: 我们关注您如何使用 AI 工具，请保留关键 commit 记录

## 交付物
- [ ] Module A: Bug 分析报告 + 回归测试代码 + 安全测试用例
- [ ] Module B: 状态流转图 + 单元测试代码 + 黑盒自动化测试
- [ ] 可选加分: 测试覆盖率报告、CI 配置

## 提交方式
完成后提交 Pull Request，PR 描述中请说明：
1. 发现的主要问题
2. 测试策略和覆盖范围
3. AI 工具使用情况

## 项目结构
```
xmax-test-assignment/
├── docker-compose.yml               # 本地 MongoDB + Redis
├── gateway/                         # 🎯 Module A: 网关鉴权中间件
│   ├── jwt_auth.js
│   ├── gateway_auth.js
│   └── errors.js
├── job-service/                     # 🎯 Module B: 职位服务（完整源码）
│   ├── app.js                       # 服务入口
│   ├── .env.example                 # 环境变量模板
│   └── src/
│       ├── constants/               # 状态常量
│       ├── controllers/             # 控制器
│       ├── services/                # 核心业务逻辑
│       ├── models/                  # 数据模型
│       ├── routes/                  # 路由定义
│       └── validators/              # 请求验证
├── tests/                           # 在此编写你的测试
│   ├── module-a/
│   └── module-b/
├── user-center/                     # 用户中心服务（注册/登录/JWT）
│   ├── app.js
│   ├── .env.example
│   └── src/
├── docs/                            # 题目文档 + API 参考
└── README.md
```

---
建议总时长约 1 小时 | 如有疑问请联系面试官
