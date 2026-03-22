/**
 * 职位申请状态枚举
 * @module constants/application_status
 */

/**
 * 申请状态枚举
 *
 * 面试阶段细分状态说明：
 * - screening: 待邀请（进入筛选阶段，尚未发起面试预约）
 * - interview_inviting: 邀约中（已发起预约，等待候选人响应）
 * - interview_scheduled: 待面试（双方已确认时间，等待面试）
 * - interview_completed: 已面试（面试已完成）
 * - interview_terminated: 已终止（流程异常终止：拒绝/过期/取消/缺席）
 *
 * @see docs/online-interview-appointment-scheduling/appointment_requirement_analysis.md
 */
export const APPLICATION_STATUS = {
    SUBMITTING: 'submitting', // 申请中（用户未完善简历或面试评估时的初始状态）
    SUBMITTED: 'submitted', // 已提交（用户完善简历和面试评估后的状态）
    SCREENING: 'screening', // 筛选中 / 待邀请
    // 面试阶段细分状态
    INTERVIEW: 'interview', // 面试阶段（兼容旧数据）
    INTERVIEW_INVITING: 'interview_inviting', // 邀约中
    INTERVIEW_SCHEDULED: 'interview_scheduled', // 待面试
    INTERVIEW_COMPLETED: 'interview_completed', // 已面试
    INTERVIEW_TERMINATED: 'interview_terminated', // 已终止
    // 后续阶段
    OFFER: 'offer', // Offer阶段
    HIRED: 'hired', // 已录用
    REJECTED: 'rejected', // 已拒绝
    WITHDRAWN: 'withdrawn', // 已撤回
}

/**
 * 获取所有激活的申请状态值数组
 */
export const APPLICATION_STATUS_VALUES = [
    APPLICATION_STATUS.SUBMITTING,
    APPLICATION_STATUS.SUBMITTED,
    APPLICATION_STATUS.SCREENING,
    APPLICATION_STATUS.INTERVIEW,
    APPLICATION_STATUS.INTERVIEW_INVITING,
    APPLICATION_STATUS.INTERVIEW_SCHEDULED,
    APPLICATION_STATUS.INTERVIEW_COMPLETED,
    APPLICATION_STATUS.INTERVIEW_TERMINATED,
    APPLICATION_STATUS.OFFER,
    APPLICATION_STATUS.HIRED,
    APPLICATION_STATUS.REJECTED,
    APPLICATION_STATUS.WITHDRAWN,
]

/**
 * 面试阶段的所有细分状态
 */
export const INTERVIEW_STAGE_STATUSES = [
    APPLICATION_STATUS.INTERVIEW,
    APPLICATION_STATUS.INTERVIEW_INVITING,
    APPLICATION_STATUS.INTERVIEW_SCHEDULED,
    APPLICATION_STATUS.INTERVIEW_COMPLETED,
    APPLICATION_STATUS.INTERVIEW_TERMINATED,
]

/**
 * 判断是否为面试阶段状态
 * @param {string} status - 申请状态
 * @returns {boolean} 是否为面试阶段
 */
export const isInterviewStageStatus = status => {
    return INTERVIEW_STAGE_STATUSES.includes(status)
}

/**
 * 申请状态中文名称映射
 */
export const APPLICATION_STATUS_NAMES = {
    [APPLICATION_STATUS.SUBMITTING]: '申请中',
    [APPLICATION_STATUS.SUBMITTED]: '已提交',
    [APPLICATION_STATUS.SCREENING]: '筛选中',
    [APPLICATION_STATUS.INTERVIEW]: '面试阶段',
    [APPLICATION_STATUS.INTERVIEW_INVITING]: '邀约中',
    [APPLICATION_STATUS.INTERVIEW_SCHEDULED]: '待面试',
    [APPLICATION_STATUS.INTERVIEW_COMPLETED]: '已面试',
    [APPLICATION_STATUS.INTERVIEW_TERMINATED]: '已终止',
    [APPLICATION_STATUS.OFFER]: 'Offer阶段',
    [APPLICATION_STATUS.HIRED]: '已录用',
    [APPLICATION_STATUS.REJECTED]: '已拒绝',
    [APPLICATION_STATUS.WITHDRAWN]: '已撤回',
}

/**
 * 申请来源枚举
 */
export const APPLICATION_SOURCE = {
    PLATFORM: 'platform', // 平台投递
    REFERRAL: 'referral', // 内推
    HEADHUNTER: 'headhunter', // 猎头推荐
    CAMPUS: 'campus', // 校园招聘
    SOCIAL: 'social', // 社交媒体
    WEBSITE: 'website', // 公司官网
    JOB_FAIR: 'job_fair', // 招聘会
    OTHER: 'other', // 其他
}

/**
 * 申请来源中文名称映射
 */
export const APPLICATION_SOURCE_NAMES = {
    [APPLICATION_SOURCE.PLATFORM]: '平台投递',
    [APPLICATION_SOURCE.REFERRAL]: '内推',
    [APPLICATION_SOURCE.HEADHUNTER]: '猎头推荐',
    [APPLICATION_SOURCE.CAMPUS]: '校园招聘',
    [APPLICATION_SOURCE.SOCIAL]: '社交媒体',
    [APPLICATION_SOURCE.WEBSITE]: '公司官网',
    [APPLICATION_SOURCE.JOB_FAIR]: '招聘会',
    [APPLICATION_SOURCE.OTHER]: '其他',
}

/**
 * 面试类型枚举
 */
export const INTERVIEW_TYPE = {
    PHONE: 'phone', // 电话面试
    VIDEO: 'video', // 视频面试
    ONSITE: 'onsite', // 现场面试
    TECHNICAL: 'technical', // 技术面试
    HR: 'hr', // HR面试
    PANEL: 'panel', // 群面
    ASSESSMENT: 'assessment', // 测评
}

/**
 * 面试类型中文名称映射
 */
export const INTERVIEW_TYPE_NAMES = {
    [INTERVIEW_TYPE.PHONE]: '电话面试',
    [INTERVIEW_TYPE.VIDEO]: '视频面试',
    [INTERVIEW_TYPE.ONSITE]: '现场面试',
    [INTERVIEW_TYPE.TECHNICAL]: '技术面试',
    [INTERVIEW_TYPE.HR]: 'HR面试',
    [INTERVIEW_TYPE.PANEL]: '群面',
    [INTERVIEW_TYPE.ASSESSMENT]: '测评',
}

/**
 * 面试结果枚举
 */
export const INTERVIEW_RESULT = {
    PASS: 'pass', // 通过
    FAIL: 'fail', // 未通过
    PENDING: 'pending', // 待定
    NO_SHOW: 'no_show', // 未出席
    CANCELLED: 'cancelled', // 已取消
}

/**
 * 面试结果中文名称映射
 */
export const INTERVIEW_RESULT_NAMES = {
    [INTERVIEW_RESULT.PASS]: '通过',
    [INTERVIEW_RESULT.FAIL]: '未通过',
    [INTERVIEW_RESULT.PENDING]: '待定',
    [INTERVIEW_RESULT.NO_SHOW]: '未出席',
    [INTERVIEW_RESULT.CANCELLED]: '已取消',
}

/**
 * 判断申请状态是否有效
 * @param {string} status - 申请状态
 * @returns {boolean} 是否有效
 */
export const isValidApplicationStatus = status => {
    return Object.values(APPLICATION_STATUS).includes(status)
}

/**
 * 判断申请是否可以撤回
 * @param {string} status - 申请状态
 * @returns {boolean} 是否可以撤回
 */
export const canWithdrawApplication = status => {
    return [
        APPLICATION_STATUS.SUBMITTING,
        APPLICATION_STATUS.SUBMITTED,
        APPLICATION_STATUS.SCREENING,
        APPLICATION_STATUS.INTERVIEW,
        APPLICATION_STATUS.INTERVIEW_INVITING,
        APPLICATION_STATUS.INTERVIEW_SCHEDULED,
    ].includes(status)
}

/**
 * 判断申请是否已结束
 * @param {string} status - 申请状态
 * @returns {boolean} 是否已结束
 */
export const isApplicationFinished = status => {
    return [APPLICATION_STATUS.HIRED, APPLICATION_STATUS.REJECTED, APPLICATION_STATUS.WITHDRAWN].includes(status)
}

/**
 * 判断申请是否可以从 SUBMITTING 更新为 SUBMITTED
 * @param {string} status - 申请状态
 * @param {Object} candidateInfo - 候选人信息
 * @returns {boolean} 是否可以提交
 */
export const canSubmitApplication = (status, candidateInfo = {}) => {
    // 只有 SUBMITTING 状态可以更新为 SUBMITTED
    if (status !== APPLICATION_STATUS.SUBMITTING) {
        return false
    }

    // 检查候选人是否已完善简历和面试评估
    const hasResume = candidateInfo.hasResume || false
    const hasAssessment = candidateInfo.hasAssessment || false

    return hasResume && hasAssessment
}

/**
 * 获取下一个可能的状态
 * @param {string} currentStatus - 当前状态
 * @returns {Array<string>} 可能的下一个状态列表
 */
export const getNextPossibleStatuses = currentStatus => {
    const statusFlow = {
        [APPLICATION_STATUS.SUBMITTING]: [APPLICATION_STATUS.SUBMITTED, APPLICATION_STATUS.WITHDRAWN],
        [APPLICATION_STATUS.SUBMITTED]: [APPLICATION_STATUS.SCREENING, APPLICATION_STATUS.REJECTED, APPLICATION_STATUS.WITHDRAWN],
        // screening（待邀请）-> interview_inviting（邀约中）
        [APPLICATION_STATUS.SCREENING]: [
            APPLICATION_STATUS.INTERVIEW, // 兼容旧流程
            APPLICATION_STATUS.INTERVIEW_INVITING, // 新流程：发起面试预约
            APPLICATION_STATUS.REJECTED,
            APPLICATION_STATUS.WITHDRAWN,
        ],
        // 兼容旧的 interview 状态
        [APPLICATION_STATUS.INTERVIEW]: [APPLICATION_STATUS.OFFER, APPLICATION_STATUS.REJECTED, APPLICATION_STATUS.WITHDRAWN],
        // interview_inviting（邀约中）-> interview_scheduled（待面试）或 interview_terminated（已终止）
        [APPLICATION_STATUS.INTERVIEW_INVITING]: [
            APPLICATION_STATUS.INTERVIEW_SCHEDULED, // 候选人确认时间
            APPLICATION_STATUS.INTERVIEW_TERMINATED, // 拒绝/过期/取消
            APPLICATION_STATUS.WITHDRAWN,
        ],
        // interview_scheduled（待面试）-> interview_completed（已面试）或 interview_terminated（已终止）
        [APPLICATION_STATUS.INTERVIEW_SCHEDULED]: [
            APPLICATION_STATUS.INTERVIEW_COMPLETED, // 面试完成
            APPLICATION_STATUS.INTERVIEW_TERMINATED, // 取消/缺席
            APPLICATION_STATUS.WITHDRAWN,
        ],
        // interview_completed（已面试）-> offer 或 rejected
        [APPLICATION_STATUS.INTERVIEW_COMPLETED]: [
            APPLICATION_STATUS.OFFER,
            APPLICATION_STATUS.REJECTED,
        ],
        // interview_terminated（已终止）-> 可以回到 screening 重新发起预约
        [APPLICATION_STATUS.INTERVIEW_TERMINATED]: [
            APPLICATION_STATUS.SCREENING, // 重新发起预约
            APPLICATION_STATUS.REJECTED,
        ],
        [APPLICATION_STATUS.OFFER]: [APPLICATION_STATUS.HIRED, APPLICATION_STATUS.REJECTED, APPLICATION_STATUS.WITHDRAWN],
        [APPLICATION_STATUS.HIRED]: [],
        [APPLICATION_STATUS.REJECTED]: [],
        [APPLICATION_STATUS.WITHDRAWN]: [],
    }

    return statusFlow[currentStatus] || []
}

/**
 * 判断申请状态是否应该计入 stats.applications 统计
 * 只有 screening 及之后的状态才计入统计（不包括 withdrawn）
 * @param {string} status - 申请状态
 * @returns {boolean} 是否应该计入统计
 */
export const shouldCountInStats = status => {
    // 排除 submitting, submitted 和 withdrawn
    // 只统计真正进入筛选流程的申请
    return [
        APPLICATION_STATUS.SCREENING,
        APPLICATION_STATUS.INTERVIEW,
        APPLICATION_STATUS.INTERVIEW_INVITING,
        APPLICATION_STATUS.INTERVIEW_SCHEDULED,
        APPLICATION_STATUS.INTERVIEW_COMPLETED,
        APPLICATION_STATUS.INTERVIEW_TERMINATED,
        APPLICATION_STATUS.OFFER,
        APPLICATION_STATUS.HIRED,
        APPLICATION_STATUS.REJECTED,
    ].includes(status)
}

export default {
    APPLICATION_STATUS,
    APPLICATION_STATUS_VALUES,
    APPLICATION_STATUS_NAMES,
    INTERVIEW_STAGE_STATUSES,
    isInterviewStageStatus,
    APPLICATION_SOURCE,
    APPLICATION_SOURCE_NAMES,
    INTERVIEW_TYPE,
    INTERVIEW_TYPE_NAMES,
    INTERVIEW_RESULT,
    INTERVIEW_RESULT_NAMES,
    isValidApplicationStatus,
    canWithdrawApplication,
    isApplicationFinished,
    canSubmitApplication,
    getNextPossibleStatuses,
    shouldCountInStats,
}
