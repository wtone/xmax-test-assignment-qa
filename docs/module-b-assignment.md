# Module B: 职位申请流程测试（建议时间占比 ~70%）

## 背景

XMAX 平台的职位申请采用**两步提交流程**：

1. **第一步（"解锁"）**：候选人点击"开始申请"，创建 `submitting` 状态的申请记录
2. **第二步（"提交"）**：候选人完善简历后点击"提交申请"，状态更新为 `submitted`，系统创建 AI 评估任务

提交后，申请进入筛选、面试、Offer 等后续阶段。

### 核心文件

| 文件 | 说明 |
|------|------|
| `job-service/src/constants/application_status.js` | 申请状态枚举 + 状态流转规则 |
| `job-service/src/services/ApplicationService.js` | 核心业务逻辑（`createApplication` 方法） |
| `job-service/src/controllers/candidateApplicationController.js` | C端控制器（HTTP 请求处理） |
| `job-service/src/validators/application_validator.js` | Joi 请求验证规则 |

---

## 任务 1：状态流转图（10%）

阅读 `job-service/src/constants/application_status.js`，画出完整的申请状态机。

### 要求
- 列出所有 12 个状态
- 标注每个状态之间的合法流转路径
- 特别标注：
  - 两步提交流程（SUBMITTING <-> SUBMITTED）
  - 面试阶段的细分状态
  - 终态（不可再流转的状态）
- 格式不限（文本图、Mermaid、draw.io 等均可）

### 产出
`tests/module-b/state-diagram.md`（或图片文件）

---

## 任务 2：分支覆盖测试（10%）

阅读 `ApplicationService.createApplication()` 方法（约 170 行），编写 Jest 单元测试覆盖核心分支。

### 需要覆盖的关键路径

1. **正常两步提交流程**
   - 第一次调用：创建新申请，状态为 `submitting`
   - 第二次调用（同一 jobId + candidateId）：状态从 `submitting` 更新为 `submitted`

2. **重复申请拦截**
   - 已存在非 `submitting` 状态的申请时，应抛出 `DUPLICATE_APPLICATION` 错误

3. **resolvedHasResume 推导逻辑**
   - 当 `hasResume=false` 但 `resumeId` 存在时，`resolvedHasResume` 应为 `true`
   - 当 `hasResume=false` 且 `resumeId` 不存在时，申请应保持 `submitting`

4. **评估创建失败降级**
   - `EvaluationService` 异常时，申请本身仍应成功创建（非阻塞）

5. **Stats 计数逻辑**
   - `SUBMITTING -> SUBMITTED` 不增加 `stats.applications` 计数
   - 只有进入 `SCREENING` 及之后状态才计入统计

### 要求
- 合理 mock `JobPost`、`JobApplication`、`ShadowApplication` 等 Mongoose 模型
- 合理 mock `EvaluationService`、`ResumeService` 等外部服务
- 测试命名清晰，体现测试意图
- 边界条件覆盖完整

### 产出
`tests/module-b/application-service.test.js`

---

## 任务 3：代码审查（5%）

阅读 `ApplicationService.createApplication()` 和 `candidateApplicationController.submitApplication`，找出至少 **1 个**代码问题或改进点。

### 提示方向
- 关注 Joi validator 对请求参数的处理行为
- 关注控制器传参与服务层接收参数的一致性
- 关注并发安全性
- 关注错误处理的完整性

### 产出
在 `tests/module-b/code-review.md` 中记录发现的问题，包含：
- 问题描述
- 影响分析
- 修复建议

---

## 任务 4：黑盒 API 测试（15%）

基于 `docs/api-spec.md` 中的 API 文档，设计测试矩阵并编写自动化测试。

### 要求
1. **测试矩阵设计**
   - 使用等价类划分和边界值分析
   - 覆盖正常流程、异常输入、权限校验
   - 包含至少 8 个测试用例

2. **自动化实现**
   - 使用 HTTP 请求测试实际 API（需先 `docker-compose up -d` + `npm start`）
   - 或者使用 supertest 等工具模拟请求
   - 断言 HTTP 状态码和响应体结构

### 产出
- `tests/module-b/api-test-matrix.md` — 测试矩阵
- `tests/module-b/api-blackbox.test.js` — 自动化测试代码

---

## AI Coding（60%）

全程允许并鼓励使用 AI 辅助工具。我们会评估：
- Prompt 的清晰度和上下文质量
- 对 AI 输出的筛选和修正能力
- AI 是否显著提升了工作效率
- 工具选择是否合理（代码补全 vs 对话式）
