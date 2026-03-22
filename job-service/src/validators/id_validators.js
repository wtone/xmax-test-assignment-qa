/**
 * ID验证器集合
 *
 * 本模块提供统一的ID格式验证规则，用于验证系统中各种实体的ID。
 * 支持多种ID格式：
 * - MongoDB ObjectId: 24位十六进制字符串
 * - UUID v4: 标准UUID格式
 * - 自定义格式: 如职位ID的特定格式
 *
 * @module validators/id_validators
 * @author xmax-job-service team
 * @since 1.0.0
 */

import Joi from 'joi'

/**
 * MongoDB ObjectId 验证器
 *
 * 验证MongoDB生成的ObjectId格式。
 * ObjectId是MongoDB的默认主键类型，由12字节组成，通常表示为24个十六进制字符。
 *
 * @function mongoObjectId
 * @returns {Joi.StringSchema} Joi字符串验证器
 *
 * @example
 * // 有效的MongoDB ObjectId
 * "507f1f77bcf86cd799439011"
 * "65c9e8a3b4567890abcdef12"
 *
 * @example
 * // 使用示例
 * const schema = Joi.object({
 *   id: mongoObjectId().required()
 * })
 */
export const mongoObjectId = () =>
    Joi.string()
        .regex(/^[0-9a-fA-F]{24}$/)
        .messages({
            'string.pattern.base': '无效的ID格式',
            'string.base': 'ID必须是字符串',
            'string.empty': 'ID不能为空',
            'any.required': 'ID不能为空',
        })

/**
 * UUID v4 验证器
 *
 * 验证标准的UUID version 4格式。
 * UUID (Universally Unique Identifier) 是一个128位的唯一标识符。
 * 主要用于外部系统的ID，如用户ID、公司ID等。
 *
 * @function uuid
 * @returns {Joi.StringSchema} Joi字符串验证器
 *
 * @example
 * // 有效的UUID v4
 * "c5b326f7-fa56-4380-a142-f1a1b869c81d"
 * "123e4567-e89b-12d3-a456-426614174000"
 *
 * @example
 * // 使用示例
 * const schema = Joi.object({
 *   userId: uuid().required()
 * })
 */
export const uuid = () =>
    Joi.string()
        .pattern(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i)
        .messages({
            'string.pattern.base': '无效的UUID格式',
            'string.base': 'UUID必须是字符串',
            'string.empty': 'UUID不能为空',
            'any.required': 'UUID不能为空',
        })

/**
 * 职位ID验证器
 *
 * 验证自定义的职位ID格式。
 * 格式规则：job_YYYYMMDD_xxxxxxxx
 * - job_: 固定前缀
 * - YYYYMMDD: 8位日期（年月日）
 * - xxxxxxxx: 8位十六进制字符串
 *
 * 这种格式便于按日期排序和查询。
 *
 * @function jobId
 * @returns {Joi.StringSchema} Joi字符串验证器
 *
 * @example
 * // 有效的职位ID
 * "job_20250806_e8e99862"
 * "job_20240101_abcdef12"
 *
 * @example
 * // 使用示例
 * const schema = Joi.object({
 *   jobId: jobId().required()
 * })
 */
export const jobId = () =>
    Joi.string()
        .pattern(/^job_\d{8}_[a-fA-F0-9]{8}$/)
        .messages({
            'string.pattern.base': '无效的职位ID格式',
            'string.base': '职位ID必须是字符串',
            'string.empty': '职位ID不能为空',
            'any.required': '职位ID不能为空',
        })

/**
 * 智能职位ID验证器
 *
 * 支持多种ID格式：
 * - MongoDB ObjectId: 24位十六进制字符串
 * - 自定义格式: job_YYYYMMDD_xxxxxxxx
 * - UUID格式: 标准UUID v4格式
 *
 * 这个验证器用于需要兼容多种ID格式的场景，
 * 如API接口需要同时支持新旧系统的ID格式。
 *
 * @function smartJobId
 * @returns {Joi.AlternativesSchema} Joi选择验证器
 *
 * @example
 * // 有效的智能职位ID
 * "job_20250806_e8e99862" // 自定义格式
 * "507f1f77bcf86cd799439011" // MongoDB ObjectId
 * "c5b326f7-fa56-4380-a142-f1a1b869c81d" // UUID
 *
 * @example
 * // 使用示例
 * const schema = Joi.object({
 *   jobId: smartJobId().required()
 * })
 */
export const smartJobId = () =>
    Joi.alternatives()
        .try(
            // MongoDB ObjectId格式
            Joi.string().regex(/^[0-9a-fA-F]{24}$/),
            // 自定义职位ID格式
            Joi.string().pattern(/^job_\d{8}_[a-fA-F0-9]{8}$/),
            // UUID格式
            Joi.string().pattern(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i),
        )
        .messages({
            'alternatives.match': '无效的职位ID格式（支持MongoDB ObjectId、自定义格式或UUID）',
            'string.base': '职位ID必须是字符串',
            'string.empty': '职位ID不能为空',
            'any.required': '职位ID不能为空',
        })

/**
 * 简历ID验证器
 *
 * 验证简历ID，使用UUID格式。
 * 简历ID来自Resume Service（外部系统），采用UUID标准格式。
 *
 * @function resumeId
 * @returns {Joi.StringSchema} Joi字符串验证器，继承自uuid验证器
 * @see {@link uuid} - 基础UUID验证器
 *
 * @example
 * // 有效的简历ID
 * "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 */
export const resumeId = () =>
    uuid().messages({
        'string.pattern.base': '无效的简历ID格式',
        'string.base': '简历ID必须是字符串',
        'string.empty': '简历ID不能为空',
        'any.required': '简历ID不能为空',
    })

/**
 * 申请ID验证器
 *
 * 验证自定义的申请ID格式。
 * 格式规则：app_YYYYMMDD_xxxxxxxx
 * - app_: 固定前缀
 * - YYYYMMDD: 8位日期（年月日）
 * - xxxxxxxx: 8位十六进制字符串
 *
 * @function applicationId
 * @returns {Joi.StringSchema} Joi字符串验证器
 *
 * @example
 * // 有效的申请ID
 * "app_20250809_42f5750e"
 * "app_20240101_abcdef12"
 */
export const applicationId = () =>
    Joi.string()
        .pattern(/^app_\d{8}_[a-fA-F0-9]{8}$/)
        .messages({
            'string.pattern.base': '无效的申请ID格式',
            'string.base': '申请ID必须是字符串',
            'string.empty': '申请ID不能为空',
            'any.required': '申请ID不能为空',
        })

/**
 * 影子申请ID验证器
 *
 * 验证影子候选人的申请ID格式。
 * 格式规则：shadow_YYYYMMDD_xxxxxxxx+
 * - shadow_: 固定前缀
 * - YYYYMMDD: 8位日期
 * - xxxxxxxx+: 十六进制字符串（长度可变）
 *
 * @function shadowApplicationId
 * @returns {Joi.StringSchema} Joi字符串验证器
 *
 * @example
 * // 有效的影子申请ID
 * "shadow_20260304_abc123ef"
 */
export const shadowApplicationId = () =>
    Joi.string()
        .pattern(/^shadow_\d{8}_[a-fA-F0-9]+$/)
        .messages({
            'string.pattern.base': '无效的影子申请ID格式',
            'string.base': '影子申请ID必须是字符串',
            'string.empty': '影子申请ID不能为空',
            'any.required': '影子申请ID不能为空',
        })

/**
 * 合同/Offer ID验证器
 *
 * 验证合同或Offer的ID，使用MongoDB ObjectId格式。
 * 合同/Offer记录存储在本地MongoDB中。
 *
 * @function contractId
 * @returns {Joi.StringSchema} Joi字符串验证器，继承自mongoObjectId验证器
 * @see {@link mongoObjectId} - 基础MongoDB ObjectId验证器
 *
 * @example
 * // 有效的合同ID
 * "507f1f77bcf86cd799439011"
 */
export const contractId = () =>
    mongoObjectId().messages({
        'string.pattern.base': '无效的合同ID格式',
        'string.base': '合同ID必须是字符串',
        'string.empty': '合同ID不能为空',
        'any.required': '合同ID不能为空',
    })

/**
 * 面试ID验证器
 *
 * 验证面试记录ID，使用MongoDB ObjectId格式。
 * 面试记录存储在本地MongoDB中。
 *
 * @function interviewId
 * @returns {Joi.StringSchema} Joi字符串验证器，继承自mongoObjectId验证器
 * @see {@link mongoObjectId} - 基础MongoDB ObjectId验证器
 *
 * @example
 * // 有效的面试ID
 * "65c9e8a3b4567890abcdef12"
 */
export const interviewId = () =>
    mongoObjectId().messages({
        'string.pattern.base': '无效的面试ID格式',
        'string.base': '面试ID必须是字符串',
        'string.empty': '面试ID不能为空',
        'any.required': '面试ID不能为空',
    })

/**
 * 公司ID验证器
 *
 * 验证公司ID，使用UUID格式。
 * 公司ID来自Company Service（外部系统），采用UUID标准格式。
 *
 * @function companyId
 * @returns {Joi.StringSchema} Joi字符串验证器，继承自uuid验证器
 * @see {@link uuid} - 基础UUID验证器
 *
 * @example
 * // 有效的公司ID
 * "f47ac10b-58cc-4372-a567-0e02b2c3d479"
 */
export const companyId = () =>
    uuid().messages({
        'string.pattern.base': '无效的公司ID格式',
        'string.base': '公司ID必须是字符串',
        'string.empty': '公司ID不能为空',
        'any.required': '公司ID不能为空',
    })

/**
 * 用户ID验证器
 *
 * 验证用户ID，使用UUID格式。
 * 用户ID来自User Center Service（外部系统），采用UUID标准格式。
 *
 * @function userId
 * @returns {Joi.StringSchema} Joi字符串验证器，继承自uuid验证器
 * @see {@link uuid} - 基础UUID验证器
 *
 * @example
 * // 有效的用户ID
 * "550e8400-e29b-41d4-a716-446655440000"
 */
export const userId = () =>
    uuid().messages({
        'string.pattern.base': '无效的用户ID格式',
        'string.base': '用户ID必须是字符串',
        'string.empty': '用户ID不能为空',
        'any.required': '用户ID不能为空',
    })

/**
 * ID验证器集合对象
 *
 * 提供所有ID验证器的统一访问接口。
 * 可以通过此对象快速访问所有定义的ID验证器。
 *
 * @constant {Object} idValidators
 * @property {Function} mongoObjectId - MongoDB ObjectId验证器
 * @property {Function} uuid - UUID v4验证器
 * @property {Function} jobId - 职位ID验证器
 * @property {Function} resumeId - 简历ID验证器
 * @property {Function} applicationId - 申请ID验证器
 * @property {Function} contractId - 合同ID验证器
 * @property {Function} interviewId - 面试ID验证器
 * @property {Function} companyId - 公司ID验证器
 * @property {Function} userId - 用户ID验证器
 *
 * @example
 * import { idValidators } from './id_validators.js'
 *
 * const schema = Joi.object({
 *   jobId: idValidators.jobId().required(),
 *   userId: idValidators.userId().required(),
 *   resumeId: idValidators.resumeId().optional()
 * })
 */
export const idValidators = {
    mongoObjectId,
    uuid,
    jobId,
    resumeId,
    applicationId,
    shadowApplicationId,
    contractId,
    interviewId,
    companyId,
    userId,
}

export default idValidators
