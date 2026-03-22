import Joi from 'joi'
import { smartJobId } from './id_validators.js'

export const pushShadowCandidatesSchema = Joi.object({
    jobId: smartJobId().required().messages({
        'any.required': 'jobId 不能为空',
        'alternatives.match': 'jobId 格式无效',
    }),
    candidates: Joi.array()
        .items(
            Joi.object({
                email: Joi.string().email().lowercase().required().messages({
                    'string.email': '无效的邮箱格式',
                    'any.required': 'email 不能为空',
                }),
                name: Joi.string().required().messages({
                    'any.required': 'name 不能为空',
                }),
                phone: Joi.string().allow('', null),
                title: Joi.string().allow('', null),
                location: Joi.string().allow('', null),
                summary: Joi.string().allow('', null),
                skills: Joi.any(),
                experience: Joi.any(),
                education: Joi.any(),
                shadowResumeId: Joi.string().required().messages({
                    'any.required': 'shadowResumeId 不能为空',
                }),
                matchScore: Joi.number().min(0).max(100).required().messages({
                    'number.min': 'matchScore 最小为 0',
                    'number.max': 'matchScore 最大为 100',
                    'any.required': 'matchScore 不能为空',
                }),
                evaluation: Joi.object().unknown(true).allow(null),
            }),
        )
        .min(1)
        .max(100)
        .required()
        .messages({
            'array.min': '至少需要一个候选人',
            'array.max': '单次推送不能超过 100 个候选人',
            'any.required': 'candidates 不能为空',
        }),
})

export const revokeShadowCandidatesSchema = Joi.object({
    jobId: smartJobId().required().messages({
        'any.required': 'jobId 不能为空',
        'alternatives.match': 'jobId 格式无效',
    }),
    candidates: Joi.array()
        .items(
            Joi.object({
                shadowResumeId: Joi.string().required().messages({
                    'any.required': 'shadowResumeId 不能为空',
                }),
            }),
        )
        .min(1)
        .max(100)
        .required()
        .messages({
            'array.min': '至少需要一个候选人',
            'array.max': '单次撤回不能超过 100 个候选人',
            'any.required': 'candidates 不能为空',
        }),
})

export default { pushShadowCandidatesSchema, revokeShadowCandidatesSchema }
