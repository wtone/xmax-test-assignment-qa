/**
 * 职位状态枚举
 * @module constants/job_status
 */

/**
 * 职位状态枚举
 */
export const JOB_STATUS = {
    DRAFT: 'draft', // 草稿
    PENDING: 'pending', // 待审核
    PUBLISHED: 'published', // 已发布
    PAUSED: 'paused', // 暂停招聘
    CLOSED: 'closed', // 已关闭
    EXPIRED: 'expired', // 已过期
    ARCHIVED: 'archived', // 已归档
}

/**
 * 职位状态中文名称映射
 */
export const JOB_STATUS_NAMES = {
    [JOB_STATUS.DRAFT]: '草稿',
    [JOB_STATUS.PENDING]: '待审核',
    [JOB_STATUS.PUBLISHED]: '已发布',
    [JOB_STATUS.PAUSED]: '暂停招聘',
    [JOB_STATUS.CLOSED]: '已关闭',
    [JOB_STATUS.EXPIRED]: '已过期',
    [JOB_STATUS.ARCHIVED]: '已归档',
}

/**
 * 职位类型枚举
 */
export const JOB_TYPE = {
    FULL_TIME: 'full_time', // 全职
    PART_TIME: 'part_time', // 兼职
    CONTRACT: 'contract', // 合同制
    INTERNSHIP: 'internship', // 实习
    TEMPORARY: 'temporary', // 临时
    FREELANCE: 'freelance', // 自由职业
}

/**
 * 职位类型中文名称映射
 */
export const JOB_TYPE_NAMES = {
    [JOB_TYPE.FULL_TIME]: '全职',
    [JOB_TYPE.PART_TIME]: '兼职',
    [JOB_TYPE.CONTRACT]: '合同制',
    [JOB_TYPE.INTERNSHIP]: '实习',
    [JOB_TYPE.TEMPORARY]: '临时',
    [JOB_TYPE.FREELANCE]: '自由职业',
}

/**
 * 工作经验要求枚举
 */
export const EXPERIENCE_LEVEL = {
    ENTRY: 'entry', // 入门级（0-1年）
    JUNIOR: 'junior', // 初级（1-3年）
    INTERMEDIATE: 'intermediate', // 中级（3-5年）
    SENIOR: 'senior', // 高级（5-10年）
    EXPERT: 'expert', // 专家级（10年以上）
    NO_REQUIREMENT: 'no_requirement', // 不限
}

/**
 * 工作经验要求中文名称映射
 */
export const EXPERIENCE_LEVEL_NAMES = {
    [EXPERIENCE_LEVEL.ENTRY]: '入门级（0-1年）',
    [EXPERIENCE_LEVEL.JUNIOR]: '初级（1-3年）',
    [EXPERIENCE_LEVEL.INTERMEDIATE]: '中级（3-5年）',
    [EXPERIENCE_LEVEL.SENIOR]: '高级（5-10年）',
    [EXPERIENCE_LEVEL.EXPERT]: '专家级（10年以上）',
    [EXPERIENCE_LEVEL.NO_REQUIREMENT]: '不限',
}

/**
 * 学历要求枚举
 */
export const EDUCATION_LEVEL = {
    HIGH_SCHOOL: 'high_school', // 高中
    ASSOCIATE: 'associate', // 大专
    BACHELOR: 'bachelor', // 本科
    MASTER: 'master', // 硕士
    DOCTORATE: 'doctorate', // 博士
    NO_REQUIREMENT: 'no_requirement', // 不限
}

/**
 * 学历要求中文名称映射
 */
export const EDUCATION_LEVEL_NAMES = {
    [EDUCATION_LEVEL.HIGH_SCHOOL]: '高中',
    [EDUCATION_LEVEL.ASSOCIATE]: '大专',
    [EDUCATION_LEVEL.BACHELOR]: '本科',
    [EDUCATION_LEVEL.MASTER]: '硕士',
    [EDUCATION_LEVEL.DOCTORATE]: '博士',
    [EDUCATION_LEVEL.NO_REQUIREMENT]: '不限',
}

/**
 * 薪资类型枚举
 */
export const SALARY_TYPE = {
    MONTHLY: 'monthly', // 月薪
    YEARLY: 'yearly', // 年薪
    HOURLY: 'hourly', // 时薪
    DAILY: 'daily', // 日薪
    NEGOTIABLE: 'negotiable', // 面议
}

/**
 * 薪资类型中文名称映射
 */
export const SALARY_TYPE_NAMES = {
    [SALARY_TYPE.MONTHLY]: '月薪',
    [SALARY_TYPE.YEARLY]: '年薪',
    [SALARY_TYPE.HOURLY]: '时薪',
    [SALARY_TYPE.DAILY]: '日薪',
    [SALARY_TYPE.NEGOTIABLE]: '面议',
}

/**
 * 判断职位状态是否有效
 * @param {string} status - 职位状态
 * @returns {boolean} 是否有效
 */
export const isValidJobStatus = status => {
    return Object.values(JOB_STATUS).includes(status)
}

/**
 * 判断职位是否可以接受申请
 * @param {string} status - 职位状态
 * @returns {boolean} 是否可以申请
 */
export const canApplyJob = status => {
    return status === JOB_STATUS.PUBLISHED
}

/**
 * 判断职位是否可以编辑
 * @param {string} status - 职位状态
 * @returns {boolean} 是否可以编辑
 */
export const canEditJob = status => {
    return [JOB_STATUS.DRAFT, JOB_STATUS.PENDING, JOB_STATUS.PUBLISHED, JOB_STATUS.PAUSED, JOB_STATUS.EXPIRED].includes(status)
}

export default {
    JOB_STATUS,
    JOB_STATUS_NAMES,
    JOB_TYPE,
    JOB_TYPE_NAMES,
    EXPERIENCE_LEVEL,
    EXPERIENCE_LEVEL_NAMES,
    EDUCATION_LEVEL,
    EDUCATION_LEVEL_NAMES,
    SALARY_TYPE,
    SALARY_TYPE_NAMES,
    isValidJobStatus,
    canApplyJob,
    canEditJob,
}
