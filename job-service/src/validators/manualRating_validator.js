/**
 * 人工面试评分验证规则
 * @module validators/manualRating_validator
 */

import Joi from 'joi'

const tagRatingItemSchema = Joi.object({
    tagId: Joi.string().required().messages({
        'string.base': 'tagId 必须是字符串',
        'any.required': 'tagId 不能为空',
    }),
    label: Joi.string().required().messages({
        'string.base': 'label 必须是字符串',
        'any.required': 'label 不能为空',
    }),
    category: Joi.string().required().messages({
        'string.base': 'category 必须是字符串',
        'any.required': 'category 不能为空',
    }),
    score: Joi.number().integer().min(1).max(3).required().messages({
        'number.base': 'score 必须是数字',
        'number.integer': 'score 必须是整数',
        'number.min': 'score 最小值为 1',
        'number.max': 'score 最大值为 3',
        'any.required': 'score 不能为空',
    }),
})

/**
 * 提交/更新评分请求体验证
 */
export const updateManualRatingSchema = Joi.object({
    jobId: Joi.string().required().messages({
        'string.base': 'jobId 必须是字符串',
        'string.empty': 'jobId 不能为空',
        'any.required': 'jobId 不能为空',
    }),
    candidateId: Joi.string().required().messages({
        'string.base': 'candidateId 必须是字符串',
        'string.empty': 'candidateId 不能为空',
        'any.required': 'candidateId 不能为空',
    }),
    rating: Joi.number().integer().min(1).max(10).required().messages({
        'number.base': 'rating 必须是数字',
        'number.integer': 'rating 必须是整数',
        'number.min': 'rating 最小值为 1',
        'number.max': 'rating 最大值为 10',
        'any.required': 'rating 不能为空',
    }),
    tagRatings: Joi.array().items(tagRatingItemSchema).optional().messages({
        'array.base': 'tagRatings 必须是数组',
    }),
    comment: Joi.string().max(500).allow('').messages({
        'string.max': '补充评价最多 500 个字符',
    }),
})

/**
 * 查询评分 query 参数验证
 */
export const getManualRatingQuerySchema = Joi.object({
    jobId: Joi.string().required().messages({
        'string.base': 'jobId 必须是字符串',
        'string.empty': 'jobId 不能为空',
        'any.required': 'jobId 不能为空',
    }),
    candidateId: Joi.string().required().messages({
        'string.base': 'candidateId 必须是字符串',
        'string.empty': 'candidateId 不能为空',
        'any.required': 'candidateId 不能为空',
    }),
})
