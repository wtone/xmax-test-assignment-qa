# 职位申请 API 文档（黑盒测试用）

> 本文档提供 API 的外部行为描述，用于黑盒测试设计。不包含内部实现细节。
>
> **注意**: 本文档仅包含 Module B 重点测试的核心 API。完整 API 列表可参考 `job-service/src/routes/` 目录下的路由定义。

## 基础信息

- **Base URL**: `http://localhost:3020`
- **认证方式**: 请求头传递用户信息（模拟网关鉴权后的内部调用）
  - `x-user-id`: 用户ID（必填）
  - `x-user-type`: 用户类型，`C`（求职者）或 `B`（企业用户）
  - `x-user-email`: 用户邮箱
- **Content-Type**: `application/json`

---

## 1. 提交职位申请

### `POST /api/v1/candidate/applications`

C端候选人提交职位申请。采用两步提交流程。

#### 请求头

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| x-user-id | string | 是 | 候选人用户ID |
| x-user-type | string | 否 | 默认 `C` |
| x-user-email | string | 否 | 候选人邮箱 |

#### 请求体

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| jobId | string | 是 | 职位业务ID（如 `job_20250806_e8e99862`） |
| coverLetter | string | 否 | 求职信，最大 2000 字符 |
| expectedSalary | object | 否 | 期望薪资 |
| expectedSalary.min | number | 否 | 最低薪资，>= 0 |
| expectedSalary.max | number | 否 | 最高薪资，>= 0 |
| expectedSalary.currency | string | 否 | 货币类型：`CNY` / `USD` / `EUR` |
| availableStartDate | string | 否 | 可入职日期，ISO 8601 格式 |

#### 两步提交流程

| 步骤 | 触发场景 | 结果状态 | 说明 |
|------|----------|----------|------|
| 第一次调用 | 候选人首次申请该职位 | `submitting` | 创建申请记录，候选人需完善简历 |
| 第二次调用 | 同一候选人同一职位再次调用 | `submitted` | 需满足条件：有简历且简历已就绪 |

#### 响应示例

**成功（201）**

```json
{
  "code": 0,
  "message": "Application submitted successfully",
  "data": {
    "_id": "65a1b2c3d4e5f6789012abcd",
    "applicationId": "app_20250806_abc12345",
    "jobId": "65a1b2c3d4e5f6789012efgh",
    "candidateId": "user-uuid-12345",
    "status": "submitting",
    "source": "direct",
    "appliedAt": "2025-08-06T10:30:00.000Z",
    "evaluationStatus": "pending",
    "evaluationId": null
  }
}
```

**第二次调用成功（201）— 状态变为 submitted**

```json
{
  "code": 0,
  "message": "Application submitted successfully",
  "data": {
    "_id": "65a1b2c3d4e5f6789012abcd",
    "applicationId": "app_20250806_abc12345",
    "status": "submitted",
    "evaluationStatus": "created",
    "evaluationId": "eval-uuid-67890"
  }
}
```

#### 错误响应

| HTTP 状态码 | 错误码 | 说明 |
|-------------|--------|------|
| 400 | 1006 | 参数验证失败（如 jobId 缺失、coverLetter 超长） |
| 400 | 3010 | 重复申请（已存在非 submitting 状态的申请） |
| 401 | 1002 | 未认证（缺少 x-user-id） |
| 404 | 2001 | 职位不存在 |
| 404 | 2001 | 职位未发布（status != published） |
| 503 | 6007 | 简历服务不可用 |

**错误响应示例**

```json
{
  "code": 3010,
  "message": "You have already applied for this job"
}
```

---

## 2. 更新申请状态

### `PUT /api/v1/applications/:applicationId/status`

B端用户更新候选人申请状态。需要 `application:update` 权限。

#### 路径参数

| 字段 | 类型 | 说明 |
|------|------|------|
| applicationId | string | 申请ID（MongoDB ObjectId 或业务ID） |

#### 请求头

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| x-user-id | string | 是 | 操作用户ID |
| x-user-type | string | 是 | 必须为 `B` |
| x-user-permissions | string | 是 | 需包含 `application:update` |
| x-company-id | string | 否 | 企业ID |

#### 请求体

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| status | string | 是 | 目标状态（见状态枚举） |
| note | string | 否 | 备注，最大 500 字符 |

#### 响应示例

**成功（200）**

```json
{
  "code": 0,
  "message": "Application status updated successfully",
  "data": {
    "applicationId": "app_20250806_abc12345",
    "previousStatus": "screening",
    "newStatus": "interview_inviting"
  }
}
```

#### 错误响应

| HTTP 状态码 | 错误码 | 说明 |
|-------------|--------|------|
| 400 | 1006 | 无效的状态值 |
| 400 | 3011 | 无效的状态转换（如 submitted -> hired） |
| 401 | 1002 | 未认证 |
| 403 | 1003 | 无权限 |
| 404 | 1004 | 申请不存在 |

---

## 3. 撤回申请

### `PUT /api/v1/candidate/applications/:applicationId/withdraw`

C端候选人撤回自己的申请。

#### 可撤回的状态

- `submitting`
- `submitted`
- `screening`
- `interview`
- `interview_inviting`
- `interview_scheduled`

> 注意：`interview_completed`、`offer`、`hired`、`rejected` 状态不可撤回。

---

## 状态枚举

### 完整状态列表

| 状态 | 中文名 | 说明 |
|------|--------|------|
| `submitting` | 申请中 | 初始状态，候选人未完善简历 |
| `submitted` | 已提交 | 候选人已完善信息并提交 |
| `screening` | 筛选中 | 进入HR筛选阶段 |
| `interview` | 面试阶段 | 兼容旧数据 |
| `interview_inviting` | 邀约中 | 已发起面试预约 |
| `interview_scheduled` | 待面试 | 双方确认面试时间 |
| `interview_completed` | 已面试 | 面试已完成 |
| `interview_terminated` | 已终止 | 面试流程异常终止 |
| `offer` | Offer阶段 | 发放Offer |
| `hired` | 已录用 | 候选人入职 |
| `rejected` | 已拒绝 | 申请被拒绝 |
| `withdrawn` | 已撤回 | 候选人撤回申请 |

### 合法状态流转

```
submitting ──→ submitted ──→ screening ──→ interview_inviting ──→ interview_scheduled ──→ interview_completed ──→ offer ──→ hired
    │              │              │              │                       │                                          │
    │              │              │              │                       │                                          │
    ▼              ▼              ▼              ▼                       ▼                                          ▼
withdrawn      withdrawn      withdrawn      withdrawn               withdrawn                                  withdrawn
               rejected       rejected     interview_terminated    interview_terminated                         rejected
                               interview       │
                              (兼容旧流程)       │
                                               ▼
                                          screening (重新发起)
                                          rejected

interview (旧) ──→ offer / rejected / withdrawn
interview_completed ──→ offer / rejected
interview_terminated ──→ screening / rejected

终态（不可再流转）: hired, rejected, withdrawn
```

---

## 错误码汇总

| 错误码 | 常量名 | 说明 |
|--------|--------|------|
| 1001 | INVALID_PARAMS | 无效参数 |
| 1002 | UNAUTHORIZED | 未认证 |
| 1003 | FORBIDDEN | 无权限 |
| 1004 | NOT_FOUND | 资源不存在 |
| 1006 | VALIDATION_ERROR | 参数验证失败 |
| 2001 | JOB_NOT_FOUND | 职位不存在 |
| 3010 | DUPLICATE_APPLICATION | 重复申请 |
| 3011 | INVALID_STATUS | 无效的状态转换 |
| 6007 | SERVICE_UNAVAILABLE | 外部服务不可用 |
