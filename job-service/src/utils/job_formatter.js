/**
 * 职位数据格式化工具
 */

import {
    CONTRACT_TYPE_LABEL,
    EDUCATION_LEVEL_LABEL,
    WORK_MODE_LABEL,
    TIME_UNIT_LABEL,
    SALARY_PERIOD_LABEL,
    EXPERIENCE_OPTIONS,
    JOB_DESCRIPTION_MAX_LENGTH,
} from '../constants/job_constants.js'

/**
 * 格式化职位数据，添加中文标签
 * @param {Object} job - 职位对象
 * @returns {Object} 格式化后的职位对象
 */
export function formatJobResponse(job, options = {}) {
    const { includeInternalFields = false } = options
    if (!job) return null

    const formatted = job.toObject ? job.toObject() : { ...job }

    // 添加中文标签
    if (formatted.contractType) {
        formatted.contractTypeLabel = CONTRACT_TYPE_LABEL[formatted.contractType] || formatted.contractType
    }

    if (formatted.education) {
        formatted.educationLabel = EDUCATION_LEVEL_LABEL[formatted.education] || formatted.education
    }

    if (formatted.workMode) {
        formatted.workModeLabel = WORK_MODE_LABEL[formatted.workMode] || formatted.workMode
    }

    if (formatted.salaryRange?.period) {
        formatted.salaryRange.periodLabel = SALARY_PERIOD_LABEL[formatted.salaryRange.period] || formatted.salaryRange.period
    }

    // 添加薪资月数标签
    if (formatted.salaryRange?.months) {
        formatted.salaryRange.monthsLabel = `${formatted.salaryRange.months}薪`
    }

    // 格式化经验要求
    if (formatted.experience) {
        const exp = formatted.experience
        if (exp.min === 0 && exp.max >= 50) {
            formatted.experienceLabel = '经验不限'
        } else if (exp.max === 1) {
            formatted.experienceLabel = '1年以下'
        } else if (exp.min >= 10) {
            formatted.experienceLabel = '10年以上'
        } else {
            formatted.experienceLabel = `${exp.min}-${exp.max}年`
        }
    }

    // 格式化薪资范围显示（包含N薪信息）
    if (formatted.salaryRange) {
        const { min, max, period, months } = formatted.salaryRange
        const periodLabel = SALARY_PERIOD_LABEL[period] || period
        const monthsText = months && months !== 12 ? ` · ${months}薪` : ''
        formatted.salaryRangeText = `${min}-${max} ${periodLabel}${monthsText}`
        // 添加 periodLabel 和 monthsLabel 到 salaryRange 对象
        formatted.salaryRange.periodLabel = periodLabel
        if (months) {
            formatted.salaryRange.monthsLabel = `${months}薪`
        }
    }

    // 格式化合同时长显示
    if (formatted.contractDuration) {
        const { value, unit } = formatted.contractDuration
        const unitLabel = TIME_UNIT_LABEL[unit] || unit
        // 使用专门的时间单位标签
        formatted.contractDurationText = `${value} ${unitLabel}`
        // 添加单位标签，用于前端显示
        formatted.contractDuration.unitLabel = unitLabel
    }

    // 添加职位状态中文
    const statusMap = {
        draft: '草稿',
        published: '已发布',
        paused: '已暂停',
        closed: '已关闭',
        archived: '已归档',
    }
    if (formatted.status) {
        formatted.statusLabel = statusMap[formatted.status] || formatted.status
    }

    // 处理公司名称显示
    console.log('[formatJobResponse] Processing company display:', {
        showCompanyName: formatted.showCompanyName,
        companyAlias: formatted.companyAlias,
        companyName: formatted.companyName,
    })

    if (formatted.showCompanyName === false) {
        // 匿名展示时：使用公司代称，并移除真实公司名
        formatted.displayCompanyName = formatted.companyAlias || '匿名公司'
        delete formatted.companyName // 不返回真实公司名给前端
        console.log('[formatJobResponse] Anonymous display, using alias:', formatted.displayCompanyName)
    } else {
        // 正常展示时：显示真实公司名
        formatted.displayCompanyName = formatted.companyName
        delete formatted.companyAlias // 不需要返回代称
        console.log('[formatJobResponse] Normal display, using real name:', formatted.displayCompanyName)
    }

    // 添加描述字符计数
    if (formatted.description) {
        formatted.descriptionLength = formatted.description.length
        formatted.descriptionLimit = 1000
    }

    if (!includeInternalFields) {
        delete formatted.otherRequirements
    }

    return formatted
}

/**
 * 批量格式化职位列表
 * @param {Array} jobs - 职位数组
 * @returns {Array} 格式化后的职位数组
 */
export function formatJobListResponse(jobs, options = {}) {
    if (!Array.isArray(jobs)) return []
    return jobs.map(job => formatJobResponse(job, options))
}

/**
 * 解析经验选项值
 * @param {string} experienceValue - 经验选项值 (如 '3-5')
 * @returns {Object} { min, max, unit }
 */
export function parseExperienceOption(experienceValue) {
    const option = EXPERIENCE_OPTIONS.find(opt => opt.value === experienceValue)
    if (option) {
        return {
            min: option.min,
            max: option.max,
            unit: 'years',
        }
    }

    // 默认值
    return {
        min: 0,
        max: 50,
        unit: 'years',
    }
}

/**
 * 验证并格式化创建职位的请求数据
 * @param {Object} data - 请求数据
 * @returns {Object} 格式化后的数据
 */
export function formatCreateJobRequest(data) {
    const formatted = { ...data }

    // 处理经验要求
    if (data.experienceOption) {
        formatted.experience = parseExperienceOption(data.experienceOption)
        delete formatted.experienceOption
    }

    // 确保薪资范围格式正确
    if (data.salaryMin !== undefined && data.salaryMax !== undefined) {
        formatted.salaryRange = {
            min: Number(data.salaryMin),
            max: Number(data.salaryMax),
            currency: data.currency || 'CNY',
            period: data.salaryPeriod || 'day',
        }
        // 处理独立传入的薪资月数
        if (data.salaryMonths !== undefined) {
            formatted.salaryRange.months = Number(data.salaryMonths)
        }
        delete formatted.salaryMin
        delete formatted.salaryMax
        delete formatted.currency
        delete formatted.salaryPeriod
        delete formatted.salaryMonths
    }

    // 处理独立传入的薪资月数（当 salaryRange 对象已存在时）
    if (data.salaryMonths !== undefined && formatted.salaryRange && !formatted.salaryRange.months) {
        formatted.salaryRange.months = Number(data.salaryMonths)
        delete formatted.salaryMonths
    }

    // 处理要求列表
    if (data.requirements) {
        if (typeof data.requirements === 'string') {
            formatted.requirements = data.requirements
                .split('\n')
                .map(req => req.trim())
                .filter(Boolean)
        } else if (typeof data.requirements === 'object' && !Array.isArray(data.requirements)) {
            // 处理错误传入的对象格式，转换为数组
            formatted.requirements = Object.values(data.requirements)
        } else if (Array.isArray(data.requirements)) {
            // 已经是数组，保持不变
            formatted.requirements = data.requirements
        }
    }

    if (Object.prototype.hasOwnProperty.call(data, 'otherRequirements')) {
        if (typeof data.otherRequirements === 'string') {
            const trimmed = data.otherRequirements.trim()
            if (trimmed.length > 0) {
                formatted.otherRequirements = trimmed
            } else {
                delete formatted.otherRequirements
            }
        } else {
            delete formatted.otherRequirements
        }
    }

    // 处理合同时长
    if (data.contractDurationValue !== undefined && data.contractDurationUnit) {
        formatted.contractDuration = {
            value: Number(data.contractDurationValue),
            unit: data.contractDurationUnit,
        }
        delete formatted.contractDurationValue
        delete formatted.contractDurationUnit
    } else if (data.contractHours !== undefined) {
        // 兼容旧格式
        formatted.contractDuration = {
            value: Number(data.contractHours),
            unit: 'hour',
        }
        delete formatted.contractHours
    }

    // 处理公司名称显示设置
    if (data.showCompanyName !== undefined) {
        formatted.showCompanyName = Boolean(data.showCompanyName)
    }

    // 处理公司代称（用于匿名展示）
    if (data.companyAlias !== undefined && data.companyAlias !== null && data.companyAlias !== '') {
        console.log('[formatCreateJobRequest] Processing companyAlias:', {
            input: data.companyAlias,
            trimmed: data.companyAlias.trim(),
        })
        formatted.companyAlias = data.companyAlias.trim()
    } else if (data.showCompanyName === false && !formatted.companyAlias) {
        // 如果是匿名展示但没有提供 companyAlias，使用默认值
        console.log('[formatCreateJobRequest] Anonymous mode without companyAlias, using default')
        formatted.companyAlias = '匿名公司'
    } else {
        console.log('[formatCreateJobRequest] No companyAlias processing needed:', {
            hasCompanyAlias: 'companyAlias' in data,
            companyAliasValue: data.companyAlias,
            showCompanyName: data.showCompanyName,
        })
    }

    // 验证描述长度
    if (data.description && data.description.length > JOB_DESCRIPTION_MAX_LENGTH) {
        throw new Error(
            `职位描述长度超出限制：当前${data.description.length}个字符，最大允许${JOB_DESCRIPTION_MAX_LENGTH}个字符`,
        )
    }

    // 处理面试类型
    if (data.interviewTypes !== undefined) {
        // 处理被转换成对象的数组（如 {0: 'value1', 1: 'value2'}）
        let interviewTypesArray = data.interviewTypes
        if (!Array.isArray(interviewTypesArray) && typeof interviewTypesArray === 'object') {
            interviewTypesArray = Object.values(interviewTypesArray)
        }

        // 确保是数组格式
        if (!Array.isArray(interviewTypesArray)) {
            throw new Error('面试类型必须是数组格式')
        }
        // 确保数组中的每个元素都是字符串
        if (!interviewTypesArray.every(item => typeof item === 'string')) {
            throw new Error('面试类型数组中的每个元素都必须是字符串')
        }
        formatted.interviewTypes = interviewTypesArray
    }

    return formatted
}
