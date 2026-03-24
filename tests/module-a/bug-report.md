# Bug Report: Gateway 鉴权中间件缺陷分析

**模块**: `gateway/jwt_auth.js`, `gateway/gateway_auth.js`, `gateway/errors.js`
**报告日期**: 2026-03-24
**严重程度**: 包含1个严重安全漏洞、1个运行时崩溃、2个逻辑错误

---

## 摘要

对 XMAX 网关鉴权中间件的代码审查共发现 **4 个缺陷**，涵盖安全漏洞、运行时崩溃和业务逻辑错误。其中：

| # | 标题 | 文件 | 行号 | 严重程度 |
|---|------|------|------|----------|
| B1 | B端用户缺少 companyId 时使用错误的错误码 | `gateway/jwt_auth.js` | 137 | 中 |
| B2 | Debug 模式鉴权绕过 — token 验证被注释掉 | `gateway/gateway_auth.js` | 21 | 严重 |
| B3 | `internalAuth` 中 `const` 变量重新赋值导致运行时崩溃 | `gateway/gateway_auth.js` | 182–185 | 高 |
| B4 | user-center 返回数据完全覆盖网关已验证的用户信息 | `gateway/gateway_auth.js` | 59–65 | 中 |

---

## Bug B1：B端用户缺少 companyId 时使用了错误的错误码

### 问题描述

- **位置**: `gateway/jwt_auth.js` 第 137 行
- 当 B 端用户（`userType='B'`）的 JWT 中不含 `companyId`，且请求路径不在允许白名单（创建公司 / 查询公司）之内时，代码抛出的是 `errorCodes.TOKEN_EXPIRED`（code: `401003`，message: `"Access token has expired"`）。
- 该错误码在语义上表示"访问令牌已过期"，与实际情况（用户未关联公司）毫无关联。

### 影响分析

1. **无限刷新循环**：客户端通常在收到 `401003` 后会自动尝试刷新 token。由于 token 本身并未过期，刷新成功后再次发起请求仍然触发相同错误，导致客户端陷入无限刷新循环，产生大量无效请求。
2. **用户体验差**：前端无法向用户展示有意义的提示（如"请先关联公司"），只能错误地提示"登录已过期，请重新登录"，造成用户困惑。
3. **日志与监控误导**：运维人员在排查问题时会被大量虚假的 token 过期错误误导。

### 修复建议

新增专用错误码 `COMPANY_REQUIRED`（建议 code: `403002`），或复用已有的 `PERMISSION_DENIED`（code: `403001`），替换第 137 行的 `errorCodes.TOKEN_EXPIRED`。

```js
// Before (gateway/jwt_auth.js:137)
throw createError(errorCodes.TOKEN_EXPIRED);

// After
throw createError(errorCodes.COMPANY_REQUIRED);
// 并在 errors.js 中新增:
// COMPANY_REQUIRED: { code: 403002, message: 'Company association is required' }
```

---

## Bug B2：Debug 模式鉴权绕过 — token 验证被注释掉

### 问题描述

- **位置**: `gateway/gateway_auth.js` 第 21 行
- 原始逻辑应同时满足两个条件才允许使用 debug 身份：
  1. `config.debug.enabled === true`
  2. `ctx.headers['authorization'] === config.debug.token`（确保请求方持有 debug token）
- 但第 21 行对条件 2 的检查已被注释掉，当前代码只要 `config.debug.enabled` 为 `true` 且 `config.debug.userId` 存在，**任何不携带 `x-user-id` 请求头的请求**都会被自动赋予 debug 用户身份。

### 影响分析

1. **严重安全漏洞**：在任何开启了 `config.debug.enabled` 的环境（包括测试环境、预发布环境，乃至配置错误的生产环境）中，所有未认证的匿名请求均可冒充 debug 用户。若 debug 用户具有管理员或超级权限，攻击面极大。
2. **越权访问**：攻击者无需持有任何凭证，只需省略 `x-user-id` 请求头即可绕过全部鉴权逻辑。
3. **难以察觉**：被注释的代码不会产生任何运行时报错，安全测试若未覆盖 debug 模式路径则极易遗漏。

### 修复建议

恢复被注释的 token 验证，或在部署流程中强制保障生产环境的 `config.debug.enabled` 为 `false`（两者都应实施）。

```js
// Before (gateway/gateway_auth.js:21) — token check is commented out
if (config.debug.enabled && config.debug.userId /* && config.debug.token === ctx.headers['authorization'] */) {

// After
if (config.debug.enabled && config.debug.userId && config.debug.token === ctx.headers['authorization']) {
```

---

## Bug B3：`internalAuth` 中 `const` 变量重新赋值导致运行时崩溃

### 问题描述

- **位置**: `gateway/gateway_auth.js` 第 182–185 行
- 第 182 行使用 `const` 声明了变量 `userId`：
  ```js
  const userId = ctx.headers['x-user-id'];
  ```
- 第 185 行尝试对该 `const` 变量重新赋值：
  ```js
  userId = config.debug.userId;
  ```
- 在 JavaScript 中，对 `const` 变量重新赋值会直接抛出 `TypeError: Assignment to constant variable.`，属于运行时崩溃。

### 影响分析

1. **功能完全不可用**：`internalAuth` 中的 debug 回退逻辑永远无法正常执行，每次触发该分支都会导致服务崩溃。
2. **服务稳定性风险**：若该错误未被上层捕获，可能导致整个网关进程崩溃或请求挂起。
3. **静默失效风险**：如果有全局错误处理兜底，内部服务的 debug 身份回退会静默失败，使相关调试功能完全失效且无任何提示。

### 修复建议

将第 182 行的 `const` 改为 `let`，以允许后续条件赋值。

```js
// Before (gateway/gateway_auth.js:182)
const userId = ctx.headers['x-user-id'];

// After
let userId = ctx.headers['x-user-id'];
```

---

## Bug B4：user-center 返回数据完全覆盖网关已验证的用户信息

### 问题描述

- **位置**: `gateway/gateway_auth.js` 第 59–65 行
- 从 user-center 查询到用户数据后，代码用 user-center 的响应**完整替换**了 `userInfo` 对象，而非与网关已验证的数据合并。
- 存在两处具体问题：
  1. 网关通过解析 JWT 得到的 `companyId` 已注入 `x-company-id` 请求头，但 `gateway_auth.js` 从未读取该请求头，`companyId` 字段因此完全丢失。
  2. 如果 user-center 数据库中存储的 `type` 字段与 JWT 中声明的 `userType` 不一致，最终使用的将是数据库中未经 JWT 验证的值，可能被利用进行权限提升。

### 影响分析

1. **companyId 信息丢失**：下游服务通过 `userInfo.companyId` 判断租户归属；该字段缺失会导致多租户隔离失效，查询结果可能混用或返回空。
2. **用户类型可能被篡改**：JWT 是经过签名验证的可信数据来源，而数据库记录可能因数据迁移、手动修改等原因与 JWT 不一致。优先使用数据库值而非 JWT 值，会使恶意或异常的数据库记录能够绕过 JWT 所确立的身份约束。
3. **数据来源混乱**：合并策略不明确，后续维护者难以判断 `userInfo` 中各字段的来源与可信度。

### 修复建议

采用**合并策略**，以网关 JWT 验证数据为优先，用 user-center 数据仅补充缺失字段；同时显式读取 `x-company-id` 请求头。

```js
// Before (gateway/gateway_auth.js:59-65) — full replacement
userInfo = userCenterResponse.data;

// After — merge, with gateway-verified data taking precedence
const companyId = ctx.headers['x-company-id'];
userInfo = {
  ...userCenterResponse.data,   // user-center data as base
  type: userInfo.type,          // preserve JWT-verified userType
  companyId: companyId || userCenterResponse.data.companyId,
};
```

---

## 附：缺陷汇总与优先级

| # | 缺陷 | 严重程度 | 建议优先级 |
|---|------|----------|------------|
| B2 | Debug 模式鉴权绕过（安全漏洞） | 严重 | P0 — 立即修复 |
| B3 | `const` 变量重新赋值运行时崩溃 | 高 | P1 — 本迭代修复 |
| B1 | B端用户错误码误导客户端 | 中 | P2 — 下迭代修复 |
| B4 | user-center 数据覆盖已验证用户信息 | 中 | P2 — 下迭代修复 |
