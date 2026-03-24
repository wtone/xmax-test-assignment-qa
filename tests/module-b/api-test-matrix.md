# Module B — 黑盒 API 测试矩阵

> 目标接口：`POST /api/v1/candidate/applications`
> Base URL：`http://localhost:3020`
> 设计方法：等价类划分（ECP）、边界值分析（BVA）、错误推测（Error Guessing）

---

## 测试环境前提

| 项目 | 说明 |
|------|------|
| 服务启动 | `docker-compose up -d && npm start` |
| 测试用有效 jobId | 数据库中已存在且 `status = published` 的职位 ID |
| 测试用候选人 ID | 每条用例使用独立的 `x-user-id`，避免用例间状态污染 |
| Content-Type | `application/json` |

---

## 测试矩阵

| 编号 | 测试分类 | 测试场景 | 输入条件 | 预期 HTTP 状态码 | 预期业务码 | 测试方法 |
|------|----------|----------|----------|-----------------|-----------|----------|
| TC-01 | 正常流程 | 首次申请——创建 submitting 状态申请 | Headers: `x-user-id: user-A`, `x-user-type: C`; Body: `{ "jobId": "<valid_job_id>" }` | 201 | 0 | 等价类（正常输入域） |
| TC-02 | 正常流程 | 两步提交——相同 jobId + candidateId 第二次调用，状态升级为 submitted | 在 TC-01 之后，使用相同 `x-user-id: user-A` 和相同 `jobId` 再次调用（候选人已完善简历） | 201 | 0（`data.status = "submitted"`） | 等价类（正常流程第二步） |
| TC-03 | 正常流程 | 携带全部可选字段提交申请 | Headers: `x-user-id: user-B`; Body: `{ "jobId": "<valid_job_id>", "coverLetter": "求职信内容", "expectedSalary": { "min": 10000, "max": 20000, "currency": "CNY" }, "availableStartDate": "2025-09-01T00:00:00.000Z" }` | 201 | 0 | 等价类（完整参数） |
| TC-04 | 认证校验 | 缺少 x-user-id 请求头 | Headers: 无 `x-user-id`; Body: `{ "jobId": "<valid_job_id>" }` | 401 | 1002 | 等价类（无效认证域） |
| TC-05 | 认证校验 | x-user-type 为 B（企业端用户调用候选人接口） | Headers: `x-user-id: user-C`, `x-user-type: B`; Body: `{ "jobId": "<valid_job_id>" }` | 403 | 1003 | 错误推测（角色越权） |
| TC-06 | 参数验证 | 缺少必填字段 jobId | Headers: `x-user-id: user-D`; Body: `{}` | 400 | 1006 | 等价类（必填字段缺失域） |
| TC-07 | 参数验证 | jobId 为空字符串 | Headers: `x-user-id: user-E`; Body: `{ "jobId": "" }` | 400 | 1006 | 边界值（空字符串边界） |
| TC-08 | 参数验证 | coverLetter 长度恰好为 2000 字符（上边界） | Headers: `x-user-id: user-F`; Body: `{ "jobId": "<valid_job_id>", "coverLetter": "<2000个字符>" }` | 201 | 0 | 边界值（最大长度边界，合法） |
| TC-09 | 参数验证 | coverLetter 长度为 2001 字符（超出上边界） | Headers: `x-user-id: user-G`; Body: `{ "jobId": "<valid_job_id>", "coverLetter": "<2001个字符>" }` | 400 | 1006 | 边界值（超出最大长度，非法） |
| TC-10 | 参数验证 | availableStartDate 格式非 ISO 8601 | Headers: `x-user-id: user-H`; Body: `{ "jobId": "<valid_job_id>", "availableStartDate": "2025/09/01" }` | 400 | 1006 | 等价类（无效日期格式域） |
| TC-11 | 参数验证 | expectedSalary.currency 使用非法枚举值 | Headers: `x-user-id: user-I`; Body: `{ "jobId": "<valid_job_id>", "expectedSalary": { "min": 5000, "currency": "JPY" } }` | 400 | 1006 | 等价类（无效枚举域） |
| TC-12 | 参数验证 | expectedSalary.min 为负数 | Headers: `x-user-id: user-J`; Body: `{ "jobId": "<valid_job_id>", "expectedSalary": { "min": -1 } }` | 400 | 1006 | 边界值（负数边界） |
| TC-13 | 业务规则 | 申请不存在的 jobId | Headers: `x-user-id: user-K`; Body: `{ "jobId": "job_nonexistent_000000" }` | 404 | 2001 | 等价类（无效资源域） |
| TC-14 | 业务规则 | 重复申请——同一 candidateId 对同一 jobId 已存在非 submitting 状态的申请 | 预置数据：user-L 对该 jobId 已有 `screening` 状态申请; 再次调用 `POST /api/v1/candidate/applications` | 400 | 3010 | 等价类（业务约束违反域） |
| TC-15 | 业务规则 | 简历服务不可用时的降级行为 | 模拟 `ResumeService` 超时或返回 503; Headers: `x-user-id: user-M`; Body: `{ "jobId": "<valid_job_id>" }` | 503 | 6007 | 错误推测（外部依赖故障） |
| TC-16 | 边界值 | coverLetter 长度为 0（空字符串但字段存在） | Headers: `x-user-id: user-N`; Body: `{ "jobId": "<valid_job_id>", "coverLetter": "" }` | 400 | 1006 | 边界值（最小长度边界，Joi `string()` 默认拒绝空串） |
| TC-17 | 边界值 | expectedSalary.min 为 0（最小合法值） | Headers: `x-user-id: user-O`; Body: `{ "jobId": "<valid_job_id>", "expectedSalary": { "min": 0 } }` | 201 | 0 | 边界值（最小值边界，合法） |
| TC-18 | 边界值 | availableStartDate 为过去日期 | Headers: `x-user-id: user-P`; Body: `{ "jobId": "<valid_job_id>", "availableStartDate": "2000-01-01T00:00:00.000Z" }` | 201 | 0 | 边界值（历史日期，API 文档未限制；验证是否被业务层拦截） |

---

## 关键验证点说明

### TC-01 / TC-02：两步提交流程验证

TC-01 和 TC-02 必须按顺序执行（TC-02 依赖 TC-01 创建的申请记录）。

- TC-01 响应断言：`HTTP 201`，`data.status === "submitting"`，`data.applicationId` 非空
- TC-02 响应断言：`HTTP 201`，`data.status === "submitted"`，`data.evaluationStatus === "created"`（若简历已就绪）

### TC-14：重复申请拦截

需预先通过数据库操作或调用状态更新接口将申请推进至 `screening` 状态，确保 `existingApplication.status !== 'submitting'`，才能触发 `DUPLICATE_APPLICATION` 错误。若申请仍处于 `submitting` 状态，第二次调用会执行两步提交逻辑而非返回错误。

### TC-15：外部服务降级

需通过以下方式之一模拟：
- 关闭简历服务容器（`docker stop resume-service`）
- 在集成测试中 mock `ResumeService` 抛出网络异常
- 配置 `.env` 中的简历服务地址为不可达地址

### TC-16 / TC-17 / TC-18：边界值说明

- TC-16：Joi `Joi.string()` 默认情况下不允许空字符串，预期 400/1006；若服务端配置了 `allow('')`，则预期 201。以实际 API 行为为准。
- TC-18：API 文档未说明是否限制过去日期，本用例用于探测业务层是否有额外校验，结果可能为 201（允许）或 400（拒绝），记录实际行为即为测试目的。

---

## 等价类划分总结

| 参数 | 有效等价类 | 无效等价类 |
|------|-----------|-----------|
| `x-user-id` | 非空字符串（已注册用户 ID） | 缺失 |
| `x-user-type` | `C`、缺省（默认 C） | `B`（企业用户） |
| `jobId` | 已发布职位的合法 ID | 空字符串、不存在的 ID、未发布职位的 ID |
| `coverLetter` | 1–2000 字符的字符串、字段缺省 | 空字符串（0 字符）、2001 字符以上 |
| `expectedSalary.min` | `>= 0` 的数字、字段缺省 | `< 0` 的数字、非数字类型 |
| `expectedSalary.currency` | `CNY`、`USD`、`EUR`、字段缺省 | 其他字符串（如 `JPY`、`GBP`） |
| `availableStartDate` | ISO 8601 格式日期字符串、字段缺省 | 非标准日期格式（如 `2025/09/01`）、无效日期字符串 |
| 申请重复性 | 首次申请（无记录）、已有 `submitting` 状态记录（触发第二步） | 已有非 `submitting` 的活跃申请 |
