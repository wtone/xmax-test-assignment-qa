# Gateway JWT 认证中间件 — OWASP 安全测试用例

**被测对象**: `gateway/jwt_auth.js`
**错误码定义**: `gateway/errors.js`
**JWT 配置**: 算法 HS256，issuer `xmax-user-center`，audience `xmax-services`
**参考标准**: OWASP Testing Guide v4.2 — OTG-AUTHN-006 / API Security Top 10

---

## TC-SEC-001 — Token 缺失（Missing Authorization Header）

### 场景描述

请求完全不携带 `Authorization` 请求头，或请求头格式不符合 `Bearer <token>` 规范（如仅传 `Token xxx`）。
中间件在第 79 行检查 `!authHeader || !authHeader.startsWith('Bearer ')`，任一条件成立即抛出 `TOKEN_MISSING` 错误。

**OWASP 对应**: API2:2023 — Broken Authentication

### 请求构造

**场景 A — 完全不带 Authorization 头**

```bash
curl -X GET https://api.xmax.com/api/v1/some-protected-resource \
  -H "Content-Type: application/json"
```

**场景 B — 格式错误的 Authorization 头（缺少 Bearer 前缀）**

```bash
curl -X GET https://api.xmax.com/api/v1/some-protected-resource \
  -H "Authorization: eyJhbGciOiJIUzI1NiJ9.xxxxx.yyyyy"
```

**场景 C — 空 Bearer 值**

```bash
curl -X GET https://api.xmax.com/api/v1/some-protected-resource \
  -H "Authorization: Bearer "
```

### 预期结果

| 属性 | 预期值 |
|------|--------|
| HTTP 状态码 | `401` |
| 响应体 `code` | `401001` |
| 响应体 `message` | `Access token is required` |

```json
{
  "code": 401001,
  "message": "Access token is required"
}
```

### 安全原理

未经认证的请求必须在中间件层被立即拒绝，不能透传到下游服务。
`startsWith('Bearer ')` 同时防止攻击者以非标准格式绕过前缀检查。
日志中应记录 `path` 和 `traceId` 但不记录任何凭据信息。

---

## TC-SEC-002 — Token 篡改 / 无效签名（Payload Tampering）

### 场景描述

攻击者截获一个合法的 JWT，对 Payload 部分（第二段）进行 Base64 解码后修改敏感字段（如 `userId`、`userType`、`roles`），再重新 Base64 编码后拼回原始头部和签名。
由于签名是对原始 Payload 计算的，篡改后签名与新 Payload 不匹配，`jwt.verify()` 会抛出 `JsonWebTokenError`，被中间件第 189 行捕获并转换为 `TOKEN_INVALID`。

**OWASP 对应**: API2:2023 — Broken Authentication；OWASP JWT Cheat Sheet — Signature Validation

### 请求构造

```python
import base64
import json

# 取一个已有的合法 JWT（三段：header.payload.signature）
original_jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxMDAxIiwidXNlclR5cGUiOiJDIiwiaXNzIjoieG1heC11c2VyLWNlbnRlciIsImF1ZCI6InhtYXgtc2VydmljZXMiLCJleHAiOjk5OTk5OTk5OTl9.ORIGINAL_SIGNATURE"

header, payload_b64, signature = original_jwt.split('.')

# Base64 解码 Payload（补充 padding）
payload_json = base64.urlsafe_b64decode(payload_b64 + '==').decode()
payload = json.loads(payload_json)

# 篡改：将 userId 改为其他用户的 ID，或将 userType 从 C 提升为 B
payload['userId'] = '9999'
payload['userType'] = 'B'

# 重新编码 Payload（但不重新计算签名）
tampered_payload = base64.urlsafe_b64encode(
    json.dumps(payload, separators=(',', ':')).encode()
).rstrip(b'=').decode()

# 组装篡改后的 JWT（签名仍为原来的，与新 Payload 不匹配）
tampered_jwt = f"{header}.{tampered_payload}.{signature}"
print(tampered_jwt)
```

```bash
# 使用篡改后的 JWT 发起请求
curl -X GET https://api.xmax.com/api/v1/some-protected-resource \
  -H "Authorization: Bearer <tampered_jwt>"
```

### 预期结果

| 属性 | 预期值 |
|------|--------|
| HTTP 状态码 | `401` |
| 响应体 `code` | `401002` |
| 响应体 `message` | `Invalid access token` |

```json
{
  "code": 401002,
  "message": "Invalid access token"
}
```

### 安全原理

JWT 的安全核心在于签名完整性验证（HMAC-SHA256）。只要密钥保密，任何对 Header 或 Payload 的修改都会导致签名校验失败。
`jwt.verify()` 在签名不匹配时抛出 `JsonWebTokenError`，中间件统一将其映射为 `TOKEN_INVALID`，不向客户端暴露具体的失败原因（防止信息泄露）。

---

## TC-SEC-003 — Token 过期（Expired Token）

### 场景描述

使用一个签名合法但 `exp`（过期时间）字段已是过去时间戳的 JWT。
`jwt.verify()` 在发现 `exp < Date.now()/1000` 时抛出 `TokenExpiredError`，被中间件第 186 行捕获并转换为 `TOKEN_EXPIRED`。

**OWASP 对应**: API2:2023 — Broken Authentication；OWASP JWT Cheat Sheet — Token Lifetime

### 请求构造

```javascript
// 使用 jsonwebtoken 库生成一个过去时间过期的 token（仅测试环境）
import jwt from 'jsonwebtoken'

const secret = process.env.JWT_SECRET // 测试环境密钥

const expiredToken = jwt.sign(
  {
    userId: '1001',
    username: 'testuser',
    userType: 'C',
    type: 'access',
    iss: 'xmax-user-center',
    aud: 'xmax-services'
  },
  secret,
  {
    algorithm: 'HS256',
    issuer: 'xmax-user-center',
    audience: 'xmax-services',
    expiresIn: -1  // 立即过期（exp 设为过去 1 秒）
  }
)

console.log(expiredToken)
```

```bash
# 使用已过期的 JWT 发起请求
curl -X GET https://api.xmax.com/api/v1/some-protected-resource \
  -H "Authorization: Bearer <expired_token>"
```

**补充场景 — 验证令牌时钟偏差处理**：可传入一个恰好在 1 秒前过期的 token，验证系统无时钟容差（clockTolerance）配置，即不允许过期 token 访问资源。

### 预期结果

| 属性 | 预期值 |
|------|--------|
| HTTP 状态码 | `401` |
| 响应体 `code` | `401003` |
| 响应体 `message` | `Access token has expired` |

```json
{
  "code": 401003,
  "message": "Access token has expired"
}
```

### 安全原理

设置合理的 Token 有效期是限制凭据泄露后攻击窗口的关键措施。
`TokenExpiredError` 与 `JsonWebTokenError` 应返回不同的错误码，方便客户端区分"需要刷新 Token"与"Token 完全非法"两种场景，同时不暴露额外的服务器内部信息。

---

## TC-SEC-004 — 权限越权：C 端用户访问 B 端资源

### 场景描述

C 端用户（`userType='C'`）的合法 JWT 携带正确签名且未过期，但被用于调用仅限 B 端商家（`userType='B'`）访问的管理接口（如公司管理、商品管理等）。
`jwt_auth.js` 本身只负责认证（Authentication）：验证 Token 合法性并将 `userType` 注入 `ctx.state.user.type`，**不负责授权（Authorization）**。
B/C 端资源隔离依赖下游服务的权限校验中间件来执行。

**OWASP 对应**: API5:2023 — Broken Function Level Authorization

### 请求构造

```javascript
// 生成 C 端用户合法 Token
import jwt from 'jsonwebtoken'

const cUserToken = jwt.sign(
  {
    userId: '2001',
    username: 'c-user',
    userType: 'C',      // C 端用户
    type: 'access',
    roles: [],
    permissions: []
  },
  process.env.JWT_SECRET,
  {
    algorithm: 'HS256',
    issuer: 'xmax-user-center',
    audience: 'xmax-services',
    expiresIn: '1h'
  }
)
```

```bash
# 使用 C 端 Token 尝试访问 B 端管理接口（如公司商品管理）
curl -X GET https://api.xmax.com/api/v1/company/products \
  -H "Authorization: Bearer <c_user_token>"

# 尝试访问 B 端订单管理接口
curl -X GET https://api.xmax.com/api/v1/merchant/orders \
  -H "Authorization: Bearer <c_user_token>"
```

### 预期结果

**jwt_auth.js 层（认证层）**：

| 属性 | 预期值 |
|------|--------|
| 行为 | 认证通过，`ctx.state.user.type` 被设为 `'C'` |
| HTTP 状态码（此层） | 不拦截，继续调用 `next()` |

**下游权限中间件层（授权层）**：

| 属性 | 预期值 |
|------|--------|
| HTTP 状态码 | `403` |
| 响应体 `code` | `403001` 或 `403003` |
| 响应体 `message` | `Permission denied` 或 `Access to this resource is forbidden` |

```json
{
  "code": 403001,
  "message": "Permission denied"
}
```

> **注意**：若下游服务未对 `ctx.state.user.type` 进行 B/C 隔离校验，C 端用户将能成功访问 B 端资源，属于授权漏洞，需在下游服务权限层修复，而非 `jwt_auth.js`。

### 安全原理

认证（Authentication）和授权（Authorization）是两个独立的安全层次，不能混淆。
`jwt_auth.js` 正确地只做认证并透传用户上下文，但系统整体安全性取决于下游服务是否正确读取并校验 `ctx.state.user.type`。
测试此用例的目的是验证整个请求链路的端到端授权逻辑，而非单独测试 JWT 中间件。

---

## TC-SEC-005 — 算法混淆攻击（Algorithm Confusion / alg:none）

### 场景描述

攻击者构造一个 JWT，将 Header 中的 `alg` 字段设为 `"none"` 并去掉签名部分，或将算法从 HS256 替换为 RS256 并尝试以公钥作为 HMAC 密钥签名（非对称 -> 对称混淆）。
中间件在 `jwt.verify()` 调用时通过 `algorithms: ['HS256']` 严格限制允许的算法，任何非 HS256 算法的 Token 会触发 `JsonWebTokenError`，被第 189 行捕获并返回 `TOKEN_INVALID`。

**OWASP 对应**: API2:2023 — Broken Authentication；CVE-2015-9235（JWT `alg:none` 漏洞）

### 请求构造

**攻击向量 A — `alg: none`（无签名绕过）**

```python
import base64
import json

# 构造 alg:none 的 Header
header = base64.urlsafe_b64encode(
    json.dumps({"alg": "none", "typ": "JWT"}).encode()
).rstrip(b'=').decode()

# 构造包含高权限字段的 Payload
payload = base64.urlsafe_b64encode(
    json.dumps({
        "userId": "admin",
        "userType": "B",
        "type": "access",
        "companyId": "1",
        "roles": ["admin"],
        "iss": "xmax-user-center",
        "aud": "xmax-services",
        "exp": 9999999999
    }, separators=(',', ':')).encode()
).rstrip(b'=').decode()

# alg:none 的 JWT 签名部分为空
none_alg_jwt = f"{header}.{payload}."
print(none_alg_jwt)
```

```bash
curl -X GET https://api.xmax.com/api/v1/some-protected-resource \
  -H "Authorization: Bearer <none_alg_jwt>"
```

**攻击向量 B — 算法替换为 RS256**

```python
import base64
import json

# 将 alg 改为 RS256（尝试混淆服务器以公钥作 HMAC 密钥）
header = base64.urlsafe_b64encode(
    json.dumps({"alg": "RS256", "typ": "JWT"}).encode()
).rstrip(b'=').decode()

payload = base64.urlsafe_b64encode(
    json.dumps({
        "userId": "1001",
        "userType": "B",
        "type": "access",
        "iss": "xmax-user-center",
        "aud": "xmax-services",
        "exp": 9999999999
    }, separators=(',', ':')).encode()
).rstrip(b'=').decode()

# 使用任意或泄露的公钥作为 HMAC 密钥伪造签名
import hmac, hashlib
fake_signature = base64.urlsafe_b64encode(
    hmac.new(b"public-key-content", f"{header}.{payload}".encode(), hashlib.sha256).digest()
).rstrip(b'=').decode()

rs256_confusion_jwt = f"{header}.{payload}.{fake_signature}"
print(rs256_confusion_jwt)
```

```bash
curl -X GET https://api.xmax.com/api/v1/some-protected-resource \
  -H "Authorization: Bearer <rs256_confusion_jwt>"
```

### 预期结果

两种攻击向量的预期结果相同：

| 属性 | 预期值 |
|------|--------|
| HTTP 状态码 | `401` |
| 响应体 `code` | `401002` |
| 响应体 `message` | `Invalid access token` |

```json
{
  "code": 401002,
  "message": "Invalid access token"
}
```

**防御有效性验证点**：确认 `jwt.verify()` 的 `algorithms: ['HS256']` 配置正确生效：

```javascript
// gateway/jwt_auth.js 第 94-98 行
const decoded = jwt.verify(token, publicKey, {
    issuer: process.env.JWT_ISSUER || 'xmax-user-center',
    audience: process.env.JWT_AUDIENCE || 'xmax-services',
    algorithms: ['HS256']  // 白名单限制，非 HS256 一律拒绝
})
```

### 安全原理

`alg:none` 漏洞（CVE-2015-9235）是 JWT 历史上影响最广的安全问题，部分早期库在未显式指定算法白名单时会接受 `alg:none` 的无签名 Token。
`jsonwebtoken` 库在调用 `verify()` 时传入 `algorithms` 选项可完全防御此类攻击：若 Token Header 中的算法不在白名单内，直接抛出 `JsonWebTokenError`。
RS256/HS256 混淆攻击依赖服务器错误地将公钥当作 HMAC 密钥，`algorithms: ['HS256']` 白名单同样可阻止此类攻击，因为 RS256 token 会在算法验证阶段被拒绝，不会进入密钥验证步骤。
