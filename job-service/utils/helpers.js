/**
 * 辅助工具函数
 */

import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc.js'
import timezone from 'dayjs/plugin/timezone.js'

dayjs.extend(utc)
dayjs.extend(timezone)

/**
 * 生成唯一ID
 */
export function generateId(prefix = '') {
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const random = Math.random().toString(36).slice(2, 8)
    return `${prefix}${timestamp}_${random}`
}

/**
 * 获取分页参数
 */
export function getPaginationParams(query = {}) {
    const page = parseInt(query.page) || 1
    const pageSize = Math.min(parseInt(query.pageSize) || 20, 100) // 最大100条
    const skip = (page - 1) * pageSize

    return { page, pageSize, skip }
}

/**
 * 构建分页响应
 */
export function buildPaginationResponse(data, total, { page, pageSize }) {
    return {
        data,
        pagination: {
            page,
            pageSize,
            total,
            totalPages: Math.ceil(total / pageSize),
            hasNext: page * pageSize < total,
            hasPrev: page > 1,
        },
    }
}

/**
 * 计算匹配分数
 */
export function calculateMatchScore(job, resume) {
    // 简单的匹配算法示例
    let score = 0

    // 技能匹配
    const jobSkills = job.skills || []
    const resumeSkills = resume.skills || []
    const matchedSkills = jobSkills.filter(skill => resumeSkills.some(rSkill => rSkill.toLowerCase().includes(skill.toLowerCase())))
    score += (matchedSkills.length / jobSkills.length) * 40

    // 经验匹配
    const jobExp = job.experience || {}
    const resumeExp = resume.yearsOfExperience || 0
    if (resumeExp >= jobExp.min && resumeExp <= jobExp.max) {
        score += 30
    } else if (resumeExp >= jobExp.min * 0.8) {
        score += 20
    }

    // 学历匹配
    if (job.education === resume.education) {
        score += 20
    }

    // 地点匹配
    if (job.location === resume.location || job.remote) {
        score += 10
    }

    return Math.round(score)
}

/**
 * 格式化错误响应
 */
export function formatError(error) {
    return {
        code: error.code || 50000,
        message: error.message || 'Internal Server Error',
        detail: error.detail || null,
        status: error.status || 500,
    }
}

/**
 * 转换时间为 UTC ISO 格式
 * @param {string|Date|number} timeStr - 时间字符串、Date 对象或时间戳
 * @returns {string|null} UTC ISO 格式字符串，无效输入返回 null
 */
export function toUTC(timeStr) {
    if (!timeStr) return null
    try {
        return new Date(timeStr).toISOString()
    } catch {
        return null
    }
}

/**
 * 格式化面试开始时间（北京时间 GMT+8）
 * @param {Date|string} date - 面试开始时间
 * @returns {string} 格式化后的时间字符串，如 "2024-01-15 14:30:00 (GMT+8)"
 */
export function formatInterviewTime(date) {
    return `${dayjs(date).tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss')} (GMT+8)`
}
