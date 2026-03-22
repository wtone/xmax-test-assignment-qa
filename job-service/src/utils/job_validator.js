/**
 * 职位数据验证工具
 */

import { ERROR_CODES } from '../constants/error_codes.js'
import { TIME_UNIT_LABEL, JOB_DESCRIPTION_MAX_LENGTH, OTHER_REQUIREMENTS_MAX_LENGTH } from '../constants/job_constants.js'

/**
 * 验证创建职位的数据
 * @param {Object} data - 职位数据
 * @returns {Object} 验证结果 { valid: boolean, errors: [] }
 */
export function validateJobData(data) {
    const errors = []

    // 验证必填字段
    const requiredFields = [
        { field: 'companyId', message: '公司ID不能为空' },
        { field: 'companyName', message: '公司名称不能为空' },
        { field: 'title', message: '职位名称不能为空' },
        { field: 'description', message: '职位描述不能为空' },
        { field: 'contractType', message: '职位类型不能为空' },
        { field: 'salaryRange', message: '薪资范围不能为空' },
        { field: 'contractDuration', message: '预计签约时长不能为空' },
        { field: 'maxApplicants', message: '招聘人数不能为空' },
        { field: 'startDate', message: '工作开始时间不能为空' },
        { field: 'workMode', message: '办公方式不能为空' },
    ]

    requiredFields.forEach(({ field, message }) => {
        if (!data[field]) {
            errors.push({ field, message })
        }
    })

    // 验证职位名称
    if (data.title) {
        if (data.title.length < 2 || data.title.length > 200) {
            errors.push({ field: 'title', message: '职位名称长度应在2-200个字符之间' })
        }
    }

    // 验证职位描述
    if (data.description) {
        if (data.description.length < 50) {
            errors.push({ field: 'description', message: '职位描述至少需要50个字符' })
        }
        if (data.description.length > JOB_DESCRIPTION_MAX_LENGTH) {
            errors.push({
                field: 'description',
                message: `职位描述长度超出限制：当前${data.description.length}个字符，最大允许${JOB_DESCRIPTION_MAX_LENGTH}个字符`,
            })
        }
    }

    if (data.otherRequirements && data.otherRequirements.length > OTHER_REQUIREMENTS_MAX_LENGTH) {
        errors.push({
            field: 'otherRequirements',
            message: `其他要求长度不能超过${OTHER_REQUIREMENTS_MAX_LENGTH}个字符`,
        })
    }

    // 验证薪资范围
    if (data.salaryRange) {
        if (!data.salaryRange.min || !data.salaryRange.max) {
            errors.push({ field: 'salaryRange', message: '薪资范围必须包含最小值和最大值' })
        } else if (data.salaryRange.min > data.salaryRange.max) {
            errors.push({ field: 'salaryRange', message: '薪资最小值不能大于最大值' })
        } else if (data.salaryRange.min < 0) {
            errors.push({ field: 'salaryRange', message: '薪资不能为负数' })
        }
    }

    // 验证工作经验
    if (data.experience) {
        if (!data.experience.min === undefined || data.experience.max === undefined) {
            errors.push({ field: 'experience', message: '工作经验必须包含最小值和最大值' })
        } else if (data.experience.min > data.experience.max) {
            errors.push({ field: 'experience', message: '经验最小值不能大于最大值' })
        }
    }

    // 验证合同时长
    if (data.contractDuration) {
        if (!data.contractDuration.value || !data.contractDuration.unit) {
            errors.push({ field: 'contractDuration', message: '合同时长必须包含数值和单位' })
        } else if (data.contractDuration.value < 0) {
            errors.push({ field: 'contractDuration', message: '合同时长不能为负数' })
        } else {
            // 根据单位验证合理范围
            const { value, unit } = data.contractDuration
            const maxValues = {
                hour: 8760, // 一年的小时数
                day: 365, // 一年的天数
                month: 60, // 5年
                year: 10, // 10年
            }
            if (maxValues[unit] && value > maxValues[unit]) {
                const unitLabel = TIME_UNIT_LABEL[unit] || unit
                errors.push({
                    field: 'contractDuration',
                    message: `合同时长超过合理范围（最大${maxValues[unit]}${unitLabel}）`,
                })
            }
        }
    }

    // 验证招聘人数
    if (data.maxApplicants !== undefined) {
        if (data.maxApplicants < 1 || data.maxApplicants > 1000) {
            errors.push({ field: 'maxApplicants', message: '招聘人数应在1-1000之间' })
        }
    }

    // 验证日期
    if (data.startDate) {
        const startDate = new Date(data.startDate)
        if (isNaN(startDate.getTime())) {
            errors.push({ field: 'startDate', message: '工作开始时间格式不正确' })
        }
    }

    if (data.applicationDeadline) {
        const deadline = new Date(data.applicationDeadline)
        if (isNaN(deadline.getTime())) {
            errors.push({ field: 'applicationDeadline', message: '申请截止时间格式不正确' })
        } else if (data.startDate) {
            const startDate = new Date(data.startDate)
            if (deadline > startDate) {
                errors.push({ field: 'applicationDeadline', message: '申请截止时间不能晚于工作开始时间' })
            }
        }
    }

    // 验证公司名称显示设置
    if (data.showCompanyName !== undefined && typeof data.showCompanyName !== 'boolean') {
        errors.push({ field: 'showCompanyName', message: '公司名称显示设置必须是布尔值' })
    }

    // 验证公司代称（用于匿名展示）
    if (data.companyAlias !== undefined && data.companyAlias !== null && data.companyAlias !== '') {
        if (typeof data.companyAlias !== 'string') {
            errors.push({ field: 'companyAlias', message: '公司代称必须是字符串' })
        } else if (data.companyAlias.length > 100) {
            errors.push({ field: 'companyAlias', message: '公司代称不能超过100个字符' })
        }
        // 如果传空字符串或不传，数据库会使用默认值'匿名公司'
    }

    // 验证面试类型
    if (data.interviewTypes !== undefined) {
        if (!Array.isArray(data.interviewTypes)) {
            errors.push({ field: 'interviewTypes', message: '面试类型必须是数组格式' })
        } else if (!data.interviewTypes.every(item => typeof item === 'string')) {
            errors.push({ field: 'interviewTypes', message: '面试类型数组中的每个元素都必须是字符串' })
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    }
}

/**
 * 构建验证错误响应
 * @param {Array} errors - 错误数组
 * @returns {Object} 错误响应对象
 */
export function buildValidationError(errors) {
    const errorMessages = errors.map(e => `${e.field}: ${e.message}`).join('; ')
    return {
        ...ERROR_CODES.VALIDATION_ERROR,
        detail: errorMessages,
        errors,
    }
}
