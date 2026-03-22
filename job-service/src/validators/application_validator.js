/**
 * 申请管理验证规则
 * @module validators/application_validator
 */

import Joi from 'joi'
import { jobId, resumeId, applicationId, shadowApplicationId, userId, smartJobId, mongoObjectId } from './id_validators.js'
import { expectedSalary } from './common_validators.js'
import { APPLICATION_STATUS_VALUES } from '../constants/application_status.js'

/**
 * 创建申请验证规则
 */
export const createApplicationSchema = Joi.object({
    jobId: smartJobId().required(),
    candidateId: userId().required().messages({
        'string.pattern.base': '无效的候选人ID格式',
        'any.required': '候选人ID不能为空',
    }),
    resumeId: resumeId(),
    coverLetter: Joi.string().max(2000).messages({
        'string.max': '求职信不能超过2000个字符',
    }),
})

/**
 * 更新申请状态验证规则
 */
export const updateStatusSchema = Joi.object({
    status: Joi.string()
        .valid(...APPLICATION_STATUS_VALUES)
        .required()
        .messages({
            'any.only': '无效的申请状态',
            'any.required': '申请状态不能为空',
        }),
    note: Joi.string().max(500).messages({
        'string.max': '备注不能超过500个字符',
    }),
})

/**
 * 批量更新状态验证规则
 */
export const batchUpdateStatusSchema = Joi.object({
    applicationIds: Joi.array().items(applicationId()).min(1).required().messages({
        'array.base': '申请ID列表必须是数组',
        'array.min': '至少需要选择一个申请',
        'any.required': '申请ID列表不能为空',
    }),
    status: Joi.string()
        .valid(...APPLICATION_STATUS_VALUES)
        .required()
        .messages({
            'any.only': '无效的申请状态',
            'any.required': '申请状态不能为空',
        }),
    note: Joi.string().max(500).messages({
        'string.max': '备注不能超过500个字符',
    }),
})

/**
 * 获取申请列表查询参数验证规则
 */
export const getApplicationsQuerySchema = Joi.object({
    jobId: smartJobId(),
    status: Joi.alternatives()
        .try(
            // 支持单个状态值
            Joi.string()
                .valid(...APPLICATION_STATUS_VALUES)
                .messages({
                    'any.only': '无效的申请状态',
                }),
            // 支持逗号分隔的多个状态值
            Joi.string()
                .custom((value, helpers) => {
                    // 分割逗号分隔的状态值
                    const statuses = value.split(',').map(s => s.trim())
                    
                    // 验证每个状态值是否有效
                    for (const status of statuses) {
                        if (!APPLICATION_STATUS_VALUES.includes(status)) {
                            return helpers.error('any.invalid', { status })
                        }
                    }
                    
                    // 返回处理后的状态数组
                    return statuses
                }, 'multiple status validation')
                .messages({
                    'any.invalid': '无效的申请状态: {{#status}}',
                }),
        ),
    search: Joi.string().max(100).messages({
        'string.max': '搜索关键词不能超过100个字符',
    }),
    page: Joi.number().integer().min(1).default(1),
    pageSize: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().valid('appliedAt', 'updatedAt', 'screeningAt', 'candidateName', 'matchScore').default('appliedAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
    readStatus: Joi.string().valid('read', 'unread').optional(),
    hideExcluded: Joi.string().valid('true', 'false').default('true'),
})

/**
 * 申请ID参数验证规则
 */
export const applicationIdParamSchema = Joi.object({
    applicationId: applicationId().required(),
})

/**
 * 申请详情参数验证规则（支持普通申请ID和影子申请ID）
 */
export const applicationDetailParamSchema = Joi.object({
    applicationId: Joi.alternatives()
        .try(applicationId(), shadowApplicationId())
        .required()
        .messages({
            'alternatives.match': '无效的申请ID格式',
        }),
})

/**
 * 更新简历验证规则
 */
export const updateResumeSchema = Joi.object({
    resumeId: resumeId().required(),
})

/**
 * 撤回申请验证规则
 */
export const withdrawApplicationSchema = Joi.object({
    reason: Joi.string().max(500).messages({
        'string.max': '撤回原因不能超过500个字符',
    }),
})

/**
 * Job AI 评估回调验证规则
 */
export const jobAiEvaluationCallbackSchema = Joi.object({
    job_id: smartJobId()
        .required()
        .messages({
            'any.required': 'job_id 不能为空',
            'alternatives.match': 'job_id 格式无效',
        }),
    candidate_id: userId()
        .required()
        .messages({
            'any.required': 'candidate_id 不能为空',
            'string.pattern.base': 'candidate_id 必须是有效的 UUID',
        }),
    application_id: Joi.alternatives().try(applicationId(), mongoObjectId()).optional(),
    resume_id: Joi.alternatives().try(resumeId(), Joi.string().allow(null, '')).optional(),
    evaluation: Joi.object({
        id: Joi.alternatives().try(Joi.string(), Joi.number()).required(),
        status: Joi.string().required(),
        overall_matching_score: Joi.number(),
        match_score: Joi.number(),
        overall_score: Joi.number(),
        recommendation_tier: Joi.string().allow('', null),
        recommendation: Joi.string().allow('', null),
        brief_summary: Joi.string().allow('', null),
        summary: Joi.string().allow('', null),
        total_interviews: Joi.number().integer().min(0),
        completed_interviews: Joi.number().integer().min(0),
        created_at: Joi.alternatives().try(Joi.string(), Joi.date()),
        completed_at: Joi.alternatives().try(Joi.string(), Joi.date()),
        interview_evaluation: Joi.any(),
        metadata: Joi.object().unknown(true),
    })
        .unknown(true)
        .required()
        .messages({
            'any.required': 'evaluation 对象不能为空',
        }),
    metadata: Joi.object().unknown(true).optional(),
    trace_id: Joi.string().allow('', null),
    traceId: Joi.string().allow('', null),
    request_id: Joi.string().allow('', null),
    requestId: Joi.string().allow('', null),
})
    .unknown(true)

/**
 * 用户操作标记验证规则（已读/暂不考虑）
 */
export const userActionSchema = Joi.object({
    isRead: Joi.boolean().optional(),
    isExcluded: Joi.boolean().optional(),
    excludedReason: Joi.string().max(500).allow('', null).optional().messages({
        'string.max': '原因不能超过500个字符',
    }),
})
    .or('isRead', 'isExcluded')
    .messages({ 'object.missing': '至少需要传入 isRead 或 isExcluded' })

/**
 * 职位ID参数验证规则
 */
export const jobIdParamSchema = Joi.object({
    jobId: smartJobId().required(),
})

export default {
    createApplicationSchema,
    updateStatusSchema,
    batchUpdateStatusSchema,
    getApplicationsQuerySchema,
    applicationIdParamSchema,
    applicationDetailParamSchema,
    updateResumeSchema,
    withdrawApplicationSchema,
    userActionSchema,
    jobIdParamSchema,
    jobAiEvaluationCallbackSchema,
}
