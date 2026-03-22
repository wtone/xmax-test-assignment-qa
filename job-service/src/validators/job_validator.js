/**
 * 职位数据验证规则（更新版本）
 * @module validators/job_validator
 */

import Joi from 'joi'
import { TIME_UNIT_LABEL, JOB_DESCRIPTION_MAX_LENGTH, OTHER_REQUIREMENTS_MAX_LENGTH } from '../constants/job_constants.js'
import { jobId as jobIdValidator, smartJobId } from './id_validators.js'
import {
    salaryRange as salaryRangeValidator,
    experience as experienceValidator,
    contractDuration as contractDurationValidator,
} from './common_validators.js'

const enforceDescriptionMaxLength = (value, helpers) => {
    if (typeof value === 'string' && value.length > JOB_DESCRIPTION_MAX_LENGTH) {
        return helpers.error('string.max', {
            limit: JOB_DESCRIPTION_MAX_LENGTH,
            valueLength: value.length,
        })
    }
    return value
}

const buildDescriptionSchema = (required = false) => {
    let schema = Joi.string()
        .min(50)
        .custom(enforceDescriptionMaxLength)
        .messages({
            'string.base': '职位描述必须是字符串',
            'string.empty': '职位描述不能为空',
            'string.min': '职位描述至少需要50个字符',
            'string.max': '职位描述长度不能超过{{#limit}}个字符（当前长度为{{#valueLength}}个字符）',
            'any.required': '职位描述不能为空',
        })

    if (required) {
        schema = schema.required()
    }

    return schema
}

const buildRequirementsSchema = ({ defaultValue } = {}) => {
    let schema = Joi.any()
        .custom((value, helpers) => {
            if (value === undefined || value === null) {
                return defaultValue !== undefined ? defaultValue : value
            }

            if (Array.isArray(value)) {
                const invalidItem = value.find(item => typeof item !== 'string')
                if (invalidItem !== undefined) {
                    return helpers.error('any.custom', { message: '职位要求数组中的每项必须是字符串' })
                }
                return value.map(item => item.trim())
            }

            if (typeof value === 'object') {
                const objectValues = Object.values(value)
                if (objectValues.length === 0) {
                    return defaultValue !== undefined ? defaultValue : []
                }

                const invalidItem = objectValues.find(item => typeof item !== 'string')
                if (invalidItem !== undefined) {
                    return helpers.error('any.custom', { message: '职位要求对象的值必须是字符串' })
                }

                return objectValues.map(item => item.trim())
            }

            return helpers.error('any.custom', {
                message: '职位要求需为字符串数组；若无要求请移除该字段或传空数组',
            })
        })
        .messages({
            'any.custom': '{{#message}}',
        })

    if (defaultValue !== undefined) {
        schema = schema.default(defaultValue)
    }

    return schema
}

/**
 * 薪资范围验证规则（使用通用验证器）
 */
const salaryRangeSchema = salaryRangeValidator()

/**
 * 经验要求验证规则（使用通用验证器）
 */
const experienceSchema = experienceValidator()

/**
 * 合同时长验证规则（使用通用验证器）
 */
const contractDurationSchema = contractDurationValidator()

/**
 * 面试配置验证规则
 */
const interviewConfigSchema = Joi.object({
    enabled: Joi.boolean().default(true),
    processId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .messages({
            'string.pattern.base': '面试流程ID格式不正确',
        }),
    requiredModules: Joi.array()
        .items(Joi.string().valid('coding', 'system-design', 'communication', 'technical', 'behavioral'))
        .messages({
            'any.only': '面试模块类型不支持',
        }),
    estimatedDuration: Joi.number().min(0).messages({
        'number.min': '预计时长不能小于0',
    }),
})

/**
 * 创建职位验证规则
 */
export const createJobSchema = Joi.object({
    // 公司信息
    companyId: Joi.string().optional().messages({
        'string.base': '公司ID必须是字符串',
        'string.empty': '公司ID不能为空',
    }),
    companyName: Joi.string().trim().max(100).required().messages({
        'string.base': '公司名称必须是字符串',
        'string.empty': '公司名称不能为空',
        'string.max': '公司名称不能超过100个字符',
        'any.required': '公司名称不能为空',
    }),
    showCompanyName: Joi.boolean().default(true),
    companyAlias: Joi.string().trim().max(100).optional().messages({
        'string.base': '公司代称必须是字符串',
        'string.max': '公司代称不能超过100个字符',
    }),

    // 基本信息
    title: Joi.string().trim().min(2).max(200).required().messages({
        'string.base': '职位标题必须是字符串',
        'string.empty': '职位标题不能为空',
        'string.min': '职位标题至少需要2个字符',
        'string.max': '职位标题不能超过200个字符',
        'any.required': '职位标题不能为空',
    }),
    description: buildDescriptionSchema(true),
    requirements: buildRequirementsSchema({ defaultValue: [] }),
    otherRequirements: Joi.string()
        .trim()
        .max(OTHER_REQUIREMENTS_MAX_LENGTH)
        .allow('', null)
        .optional()
        .messages({
            'string.base': '其他要求必须是字符串',
            'string.max': `其他要求不能超过${OTHER_REQUIREMENTS_MAX_LENGTH}个字符`,
        }),

    // 工作条件（可选）
    location: Joi.string().trim().messages({
        'string.base': '工作地点必须是字符串',
    }),
    remote: Joi.boolean().default(false),
    workMode: Joi.string().valid('remote', 'onsite', 'hybrid').required().messages({
        'any.only': '工作模式不支持',
        'any.required': '办公方式不能为空',
    }),

    // 薪资和合同
    salaryRange: salaryRangeSchema.required().messages({
        'any.required': '薪资范围不能为空',
    }),
    contractType: Joi.string().valid('full-time', 'part-time', 'contract', 'internship').required().messages({
        'any.required': '合同类型不能为空',
        'any.only': '合同类型不支持',
    }),
    contractDuration: contractDurationSchema.required().messages({
        'any.required': '预计签约时长不能为空',
    }),

    // 要求条件（可选）
    experience: experienceSchema,
    education: Joi.string().valid('high-school', 'associate', 'bachelor', 'master', 'phd', 'none').default('none').messages({
        'any.only': '学历要求不支持',
    }),

    // 面试配置（可选）
    interviewConfig: interviewConfigSchema,

    // 面试类型（可选）
    interviewTypes: Joi.array().items(Joi.string()).default([]).messages({
        'array.base': '面试类型必须是数组',
    }),

    // 招聘信息
    maxApplicants: Joi.number().min(1).required().messages({
        'number.min': '招聘人数不能小于1',
        'any.required': '招聘人数不能为空',
    }),

    // 时间信息
    startDate: Joi.date().required().messages({
        'date.base': '工作开始时间格式不正确',
        'any.required': '工作开始时间不能为空',
    }),
    applicationDeadline: Joi.date().messages({
        'date.base': '申请截止日期格式不正确',
    }),
})
    .custom((value, helpers) => {
        // 如果设置了截止日期，截止日期不能晚于开始日期
        if (value.applicationDeadline && value.startDate && value.applicationDeadline > value.startDate) {
            return helpers.error('any.custom', { message: '申请截止时间不能晚于工作开始时间' })
        }
        return value
    })
    .custom((value, helpers) => {
        // 验证薪资范围
        if (value.salaryRange && value.salaryRange.min > value.salaryRange.max) {
            return helpers.error('any.custom', { message: '薪资最小值不能大于最大值' })
        }
        return value
    })
    .custom((value, helpers) => {
        // 验证经验要求
        if (value.experience && value.experience.min > value.experience.max) {
            return helpers.error('any.custom', { message: '经验最小值不能大于最大值' })
        }
        return value
    })
    .messages({
        'any.custom': '{{#message}}',
    })

/**
 * 更新职位验证规则（所有字段都是可选的）
 */
export const updateJobSchema = Joi.object({
    // 公司信息
    companyId: Joi.string(),
    companyName: Joi.string().trim().max(100),
    showCompanyName: Joi.boolean(),
    companyAlias: Joi.string().trim().max(100),

    // 基本信息
    title: Joi.string().trim().min(2).max(200),
    description: buildDescriptionSchema(),
    requirements: buildRequirementsSchema(),
    otherRequirements: Joi.string()
        .trim()
        .max(OTHER_REQUIREMENTS_MAX_LENGTH)
        .allow('', null)
        .messages({
            'string.base': '其他要求必须是字符串',
            'string.max': `其他要求不能超过${OTHER_REQUIREMENTS_MAX_LENGTH}个字符`,
        }),

    // 工作条件
    location: Joi.string().trim(),
    remote: Joi.boolean(),
    workMode: Joi.string().valid('remote', 'onsite', 'hybrid'),

    // 薪资和合同
    salaryRange: salaryRangeSchema,
    contractType: Joi.string().valid('full-time', 'part-time', 'contract', 'internship'),
    contractDuration: contractDurationSchema,

    // 要求条件
    experience: experienceSchema,
    education: Joi.string().valid('high-school', 'associate', 'bachelor', 'master', 'phd', 'none'),

    // 面试配置
    interviewConfig: interviewConfigSchema,

    // 面试类型
    interviewTypes: Joi.array().items(Joi.string()).messages({
        'array.base': '面试类型必须是数组',
    }),

    // 招聘信息
    maxApplicants: Joi.number().min(1),

    // 时间信息
    startDate: Joi.date(),
    applicationDeadline: Joi.date(),

    // 禁止直接修改状态
    status: Joi.forbidden().messages({
        'any.unknown': '不能通过更新接口修改职位状态',
    }),
})
    .min(1)
    .messages({
        'object.min': '至少需要更新一个字段',
    })

/**
 * 职位操作验证规则
 */
export const jobActionSchema = Joi.object({
    action: Joi.string().valid('pause', 'resume', 'close', 'delete').required().messages({
        'any.required': '操作类型不能为空',
        'any.only': '不支持的操作类型',
    }),
    reason: Joi.string().trim().max(500).messages({
        'string.max': '操作原因不能超过500个字符',
    }),
})

/**
 * 批量操作验证规则
 */
export const batchActionSchema = Joi.object({
    jobIds: Joi.array().items(jobIdValidator()).min(1).required().messages({
        'array.base': '职位ID列表必须是数组',
        'array.min': '至少需要选择一个职位',
        'any.required': '职位ID列表不能为空',
    }),
    action: Joi.string().valid('publish', 'pause', 'resume', 'close', 'delete').required().messages({
        'any.required': '操作类型不能为空',
        'any.only': '不支持的操作类型',
    }),
})

/**
 * 职位列表查询验证规则
 */
export const jobListQuerySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1).messages({
        'number.base': '页码必须是数字',
        'number.integer': '页码必须是整数',
        'number.min': '页码不能小于1',
    }),
    pageSize: Joi.number().integer().min(1).max(100).default(20).messages({
        'number.base': '每页数量必须是数字',
        'number.integer': '每页数量必须是整数',
        'number.min': '每页数量不能小于1',
        'number.max': '每页数量不能超过100',
    }),
    sortBy: Joi.string().valid('createdAt', 'updatedAt', 'publishedAt', 'title', 'salaryRange.min').default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
    status: Joi.alternatives()
        .try(
            Joi.string().valid('draft', 'published', 'paused', 'closed', 'expired'),
            Joi.string().pattern(/^(draft|published|paused|closed|expired)(,(draft|published|paused|closed|expired))*$/),
        )
        .messages({
            'any.only': '职位状态不正确',
        }),
    search: Joi.string().trim().allow(''),
    location: Joi.string().trim().allow(''),
    workMode: Joi.string().valid('remote', 'onsite', 'hybrid').allow(''),
    contractType: Joi.string().valid('full-time', 'part-time', 'contract', 'internship').allow(''),
    minSalary: Joi.number().min(0),
    maxSalary: Joi.number().min(0),
}).custom((value, helpers) => {
    // 如果同时设置了最低和最高薪资，最低不能大于最高
    if (value.minSalary && value.maxSalary && value.minSalary > value.maxSalary) {
        return helpers.error('any.custom', { message: '最低薪资不能大于最高薪资' })
    }
    return value
})

/**
 * 职位ID参数验证规则
 */
export const jobIdParamSchema = Joi.object({
    jobId: smartJobId().required(),
})

export default {
    createJobSchema,
    updateJobSchema,
    jobActionSchema,
    batchActionSchema,
    jobListQuerySchema,
    jobIdParamSchema,
}
