# Module B — 代码审查报告

> 审查范围：职位申请流程（`POST /api/v1/candidate/applications`）
> 涉及文件：
> - `job-service/src/controllers/candidateApplicationController.js`
> - `job-service/src/services/ApplicationService.js`
> - `job-service/src/routes/candidate-application.routes.js`
> - `job-service/src/constants/application_status.js`

---

## Issue 1：`withdrawApplication` 使用了错误的状态检查列表

### 问题描述

`candidateApplicationController.js` 第 601 行，`withdrawApplication` 控制器通过硬编码列表判断申请是否可撤回：

```js
// 第 601 行（问题代码）
if (!['pending', 'screening'].includes(application.status)) {
    throw new AppError('Cannot withdraw application in current status', ERROR_CODES.INVALID_STATUS)
}
```

该判断存在两处明确错误：

1. **`'pending'` 不是合法的申请状态值。** 查阅 `application_status.js` 可知，`APPLICATION_STATUS` 枚举中不存在 `pending` 值（`pending` 仅出现于面试结果枚举 `INTERVIEW_RESULT.PENDING`）。这个字符串永远不会与任何申请状态匹配，属于无效判断。

2. **可撤回状态列表不完整，遗漏了五个合法状态。** 按照 `application_status.js` 第 181–190 行的 `canWithdrawApplication()` 函数定义，可撤回状态应为：

   ```
   SUBMITTING, SUBMITTED, SCREENING, INTERVIEW, INTERVIEW_INVITING, INTERVIEW_SCHEDULED
   ```

   当前硬编码列表 `['pending', 'screening']` 实际有效覆盖仅 `screening` 一个状态，遗漏了 `submitting`、`submitted`、`interview`、`interview_inviting`、`interview_scheduled`。

3. **项目中已有现成的工具函数 `canWithdrawApplication()` 未被使用。** 该函数位于 `application_status.js` 第 181 行，正确维护了可撤回状态列表，控制器完全忽略了它。

### 代码位置

| 文件 | 行号 |
|------|------|
| `job-service/src/controllers/candidateApplicationController.js` | 第 601 行 |
| `job-service/src/constants/application_status.js` | 第 181–190 行（`canWithdrawApplication` 函数） |

### 影响分析

| 受影响状态 | 期望行为 | 实际行为 |
|------------|----------|----------|
| `submitting` | 可撤回 | 被错误拦截，抛出 `INVALID_STATUS` |
| `submitted` | 可撤回 | 被错误拦截，抛出 `INVALID_STATUS` |
| `interview` | 可撤回 | 被错误拦截，抛出 `INVALID_STATUS` |
| `interview_inviting` | 可撤回 | 被错误拦截，抛出 `INVALID_STATUS` |
| `interview_scheduled` | 可撤回 | 被错误拦截，抛出 `INVALID_STATUS` |
| `screening` | 可撤回 | 正常（唯一正确覆盖的状态） |

对用户的直接影响：候选人在申请提交阶段（`submitting`/`submitted`）或面试邀约阶段（`interview_inviting`/`interview_scheduled`）均无法撤回申请，功能失效范围超过 80%。

### 修复建议

使用项目已有的 `canWithdrawApplication()` 工具函数替代硬编码列表，消除魔法字符串，保持单一事实来源（Single Source of Truth）：

```js
// 修复后
import { canWithdrawApplication } from '../constants/application_status.js'

// 第 600–603 行替换为：
if (!canWithdrawApplication(application.status)) {
    throw new AppError('Cannot withdraw application in current status', ERROR_CODES.INVALID_STATUS)
}
```

---

## Issue 2：`createApplication` 存在并发竞争条件（Race Condition）

### 问题描述

`ApplicationService.js` 第 306–370 行，`createApplication` 方法通过 **check-then-act** 模式检查申请是否已存在：

```js
// 第 306–310 行（问题代码）
const existingApplication = await JobApplication.findOne({
    jobId: jobPost._id,
    candidateId: candidateId,
    status: { $ne: APPLICATION_STATUS.WITHDRAWN },
})

// ... 若不存在则新建
const application = new JobApplication({ ... })
await application.save()
```

`findOne` 与 `new JobApplication().save()` 是两个独立的数据库操作，二者之间不具备原子性。在高并发场景下（例如用户快速双击"申请"按钮，或网络重试导致请求重发），两个请求可能在时间窗口内同时通过 `findOne` 的存在性检查，随后各自执行 `save()`，最终在数据库中生成同一候选人对同一职位的两条 `submitting` 状态申请记录。

### 代码位置

| 文件 | 行号 |
|------|------|
| `job-service/src/services/ApplicationService.js` | 第 306–311 行（`findOne` 检查） |
| `job-service/src/services/ApplicationService.js` | 第 379–400 行（`new JobApplication().save()` 创建） |

### 影响分析

- **数据完整性破坏**：同一候选人对同一职位存在多条活跃申请，导致后续状态流转（SUBMITTING -> SUBMITTED）行为不确定——不同请求可能操作不同的申请记录。
- **业务逻辑错误**：重复申请检测（第 312–370 行）依赖申请唯一性假设，若该假设被并发破坏，重复检测逻辑本身也会失效。
- **统计数据偏差**：`stats.applications` 计数可能出现多次计入的情况。
- **复现难度**：该问题在正常顺序访问下不会触发，仅在并发或网络抖动时出现，难以在测试中稳定复现，风险往往被低估。

### 修复建议

**方案一（推荐）：数据库层唯一索引兜底**

在 `JobApplication` 的 Mongoose Schema 中为 `(jobId, candidateId)` 添加唯一复合索引（配合 `partialFilterExpression` 排除 `withdrawn` 状态）：

```js
// JobApplication Schema
JobApplicationSchema.index(
    { jobId: 1, candidateId: 1 },
    {
        unique: true,
        partialFilterExpression: { status: { $ne: 'withdrawn' } },
        name: 'unique_active_application',
    }
)
```

数据库层的约束是最可靠的并发安全保证，即使应用层逻辑存在竞争，MongoDB 也会拒绝第二次插入并抛出 `E11000 duplicate key error`，Service 层捕获后转换为 `DUPLICATE_APPLICATION` 错误即可。

**方案二：使用 `findOneAndUpdate` + `upsert` 实现原子操作**

```js
const application = await JobApplication.findOneAndUpdate(
    {
        jobId: jobPost._id,
        candidateId: candidateId,
        status: { $ne: APPLICATION_STATUS.WITHDRAWN },
    },
    {
        $setOnInsert: {
            jobId: jobPost._id,
            candidateId,
            status: APPLICATION_STATUS.SUBMITTING,
            // ... 其余初始字段
        },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
)
```

`findOneAndUpdate` 在 MongoDB 层面是原子操作，可将查找和创建合并为单次数据库调用，从根本上消除竞争窗口。两个方案可配合使用，互为补充。

---

## Issue 3：Joi validator 与控制器传参的隐式耦合（注释误导性）

### 问题描述

`candidate-application.routes.js` 第 194 行的 Joi schema 只声明了四个来自请求体的字段：

```js
// 路由层 Joi schema（第 194–203 行）
body: Joi.object({
    jobId: validators.jobId().required(),
    coverLetter: Joi.string().max(2000),
    expectedSalary: Joi.object({ ... }),
    availableStartDate: Joi.date().iso(),
})
```

而 `candidateApplicationController.js` 第 254–266 行向 `ApplicationService.createApplication()` 传递了额外的参数：

```js
// 控制器传参（第 254–266 行）
await ApplicationService.createApplication({
    jobId: job._id.toString(),
    candidateId,
    candidateEmail: ctx.state.user?.email,
    resumeId: hasResume ? finalResumeId : undefined,
    coverLetter,
    expectedSalary,
    availableStartDate,
    source: 'direct',
    hasResume,        // 由控制器内部调用 ResumeService + ResumeAiService 推导
    hasAssessment,    // 由控制器内部硬编码为 true（第 222 行）
    metadata: applicationMetadata,
})
```

`hasResume`、`hasAssessment`、`source`、`metadata` 这四个参数均由控制器内部逻辑产生，**从未来自请求体**。然而 `ApplicationService.js` 第 295 行的注释却写道：

```js
// hasResume 被 Joi validator 的 stripUnknown 移除，从 resumeId 推导
const resolvedHasResume = hasResume || !!resumeId
```

这个注释在描述上是错误的：`hasResume` 不是被 `stripUnknown` 移除的——它根本从未出现在请求体中，而是由控制器通过 `ResumeService.getResumeByUserId()` 和 `ResumeAiService.getJobSubmissionReadiness()` 调用结果计算得出，并作为参数显式传入 Service 层（第 263 行）。

### 代码位置

| 文件 | 行号 | 说明 |
|------|------|------|
| `job-service/src/routes/candidate-application.routes.js` | 第 194–203 行 | Joi schema 定义 |
| `job-service/src/controllers/candidateApplicationController.js` | 第 254–266 行 | 控制器向 Service 传参 |
| `job-service/src/services/ApplicationService.js` | 第 295 行 | 误导性注释 |

### 影响分析

- **可维护性风险**：后续开发者若依赖该注释理解 `hasResume` 的来源，可能误以为只需在 Joi schema 中加入 `hasResume` 字段（允许客户端传入），便能控制申请的简历状态，从而引入安全隐患——客户端可能通过伪造 `hasResume: true` 绕过简历就绪检查，将申请从 `submitting` 强制推进到 `submitted`。
- **调试困难**：当 `hasResume` 行为异常时，开发者会优先检查 Joi 配置而非 `ResumeService` 调用链，增加排障成本。
- **功能本身目前正确**：`hasResume` 确实由控制器内部逻辑可靠生成，Service 层的 `resolvedHasResume = hasResume || !!resumeId` 也提供了额外兜底，问题仅在于注释与实现的描述不符。

### 修复建议

更新 `ApplicationService.js` 第 295 行注释，准确描述 `hasResume` 的实际来源：

```js
// 修复前（第 295 行）
// hasResume 被 Joi validator 的 stripUnknown 移除，从 resumeId 推导

// 修复后
// hasResume 由控制器内部逻辑推导（ResumeService + ResumeAiService 调用结果），
// 不来自请求体。此处额外用 resumeId 兜底，以防控制器未能正确传递 hasResume。
const resolvedHasResume = hasResume || !!resumeId
```

同时建议在 `ApplicationService.createApplication()` 的 JSDoc 中补充参数说明，明确 `hasResume` 由调用方（控制器）负责提供，Service 层不直接访问简历服务。

---

## 问题汇总

| # | 严重程度 | 问题类型 | 位置 | 核心影响 |
|---|----------|----------|------|----------|
| 1 | **高** | 功能性 Bug | `candidateApplicationController.js:601` | 候选人在绝大多数状态下无法撤回申请 |
| 2 | **中** | 并发安全 | `ApplicationService.js:306–400` | 高并发下可能产生重复申请记录 |
| 3 | **低** | 代码可维护性 | `ApplicationService.js:295` | 注释误导，存在未来引入安全 Bug 的隐患 |
