# Module A: 鉴权中间件测试（建议时间占比 ~30%）

## 背景

XMAX 平台采用**两层鉴权架构**：

1. **网关层（jwt_auth.js）**：API 网关统一处理 JWT 验证，解析 token 并将用户信息注入请求头（`x-user-id`、`x-user-type`、`x-company-id` 等）
2. **服务层（gateway_auth.js）**：各微服务从请求头读取用户信息，必要时从 user-center 数据库补充完整用户数据

### 鉴权流程

```
客户端请求 (Bearer Token)
       │
       ▼
┌──────────────┐
│  API 网关     │
│  jwt_auth.js │
│              │
│  1. 验证 JWT │
│  2. 解析 payload (userId, userType, companyId)
│  3. 注入 x-user-* 请求头
│  4. B端用户: 校验 companyId
│  5. 转发请求到下游服务
└──────┬───────┘
       │ x-user-id, x-user-type, x-company-id ...
       ▼
┌──────────────────┐
│  下游微服务        │
│  gateway_auth.js │
│                  │
│  1. 读取 x-user-* 请求头
│  2. 若信息缺失, 查询 user-center 补充
│  3. 设置 ctx.state.user
│  4. 转发到业务逻辑
└──────────────────┘
```

### 用户类型

| 类型 | 说明 | 特殊要求 |
|------|------|----------|
| C端 (userType='C') | 求职者/候选人 | 无特殊要求 |
| B端 (userType='B') | 企业用户/HR | 需要关联公司 (companyId) |
| Admin (userType='admin') | 管理员 | 最高权限 |

## 源码位置

- `gateway/jwt_auth.js` — 网关 JWT 鉴权中间件
- `gateway/gateway_auth.js` — 网关层用户信息补充中间件
- `gateway/errors.js` — 错误码定义

> **注意**: gateway/ 目录下的文件是从网关服务中提取的独立代码片段。这些文件依赖的部分外部模块（如 `logger`、`whitelist` 等）不在本仓库中，编写测试时需要 mock 这些依赖。

请仔细阅读以上文件的源码后，完成以下任务。

---

## 任务 1：代码审查（15%）

仔细阅读 `jwt_auth.js` 和 `gateway_auth.js` 的代码，找出其中的**安全漏洞**和**逻辑缺陷**。

### 要求
- 至少找出 **2 个**安全或逻辑问题
- 对每个问题说明：
  - **问题描述**：哪段代码有什么问题
  - **影响分析**：会导致什么后果（安全影响、用户体验等）
  - **修复建议**：如何修改代码解决问题

### 提示
- 关注用户类型（B端/C端）的处理逻辑
- 关注 user-center 返回数据与网关数据的合并方式
- 关注 B端用户缺少公司信息时的错误处理
- 关注错误码的语义是否正确

### 产出
在 `tests/module-a/` 目录下创建 `bug-report.md`，记录发现的问题。

---

## 任务 2：回归测试（10%）

为任务 1 中发现的问题编写**回归测试**，确保修复后不会再次出现。

### 要求
- 使用 Jest 编写单元测试
- 测试文件放在 `tests/module-a/` 目录下
- 合理 mock 外部依赖（如 user-center 接口、JWT 验证等）
- 每个 bug 至少 1 个测试用例
- 断言清晰，测试命名体现测试意图

### 产出
`tests/module-a/auth-regression.test.js`

---

## 任务 3：安全测试设计（15%）

基于 OWASP 认证安全最佳实践，设计 **5 个**安全测试用例。

### 可参考的测试场景
- Token 过期 / Token 篡改 / Token 缺失
- 无效签名
- 权限越权（C端访问B端接口）
- Token 注入攻击
- 并发 Token 刷新

### 要求
- 每个用例包含：场景描述、请求构造、预期结果
- 如有能力，编写可执行的测试代码

### 产出
`tests/module-a/security-test-cases.md` 或 `tests/module-a/security.test.js`

---

## AI Coding（60%）

全程允许并鼓励使用 AI 辅助工具。我们会评估：
- Prompt 的清晰度和上下文质量
- 对 AI 输出的筛选和修正能力
- AI 是否显著提升了工作效率
