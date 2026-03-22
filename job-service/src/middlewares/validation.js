/**
 * 请求数据验证中间件
 * @module middlewares/validation
 * @description 使用 Joi 进行请求数据验证，支持 body、query、params 验证
 */

import Joi from 'joi'
import { ERROR_CODES } from '../constants/error_codes.js'
import { sendError, createValidationErrorResponse, getTraceId } from '../../utils/response.js'
import idValidators from '../validators/id_validators.js'

/**
 * 默认验证选项
 */
const DEFAULT_OPTIONS = {
    abortEarly: false, // 不在第一个错误时停止验证
    allowUnknown: false, // 不允许未知字段
    stripUnknown: true, // 移除未知字段
}

/**
 * 格式化验证错误
 * @param {Object} error - Joi验证错误对象
 * @returns {Array} 格式化的错误数组
 */
const formatValidationErrors = error => {
    if (!error || !error.details) return []

    return error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        type: detail.type,
        value: detail.context.value,
    }))
}

/**
 * 创建验证中间件
 * @param {Object|Joi.Schema} schemaOrSchemas - 验证模式对象或单个验证模式
 * @param {string} [source] - 验证来源 ('body', 'query', 'params')，当第一个参数是单个模式时使用
 * @param {Object} [options] - 验证选项
 * @returns {Function} Koa中间件函数
 */
export const validate = (schemaOrSchemas, source = null, options = {}) => {
    // 兼容两种调用方式：
    // 1. validate(schema, 'body') - 单个模式
    // 2. validate({ body: schema, query: schema }) - 多个模式
    let schemas = {}

    if (source && typeof source === 'string') {
        // 单个模式调用方式
        schemas[source] = schemaOrSchemas
    } else {
        // 多个模式调用方式
        schemas = schemaOrSchemas
        options = source || {} // 如果source不是字符串，则它是options
    }

    const validationOptions = { ...DEFAULT_OPTIONS, ...options }

    return async (ctx, next) => {
        const errors = []

        try {
            // 验证请求体
            if (schemas.body) {
                const { error, value } = schemas.body.validate(ctx.request.body, validationOptions)
                if (error) {
                    errors.push(...formatValidationErrors(error))
                } else {
                    ctx.request.body = value
                }
            }

            // 验证查询参数
            if (schemas.query) {
                const { error, value } = schemas.query.validate(ctx.query, validationOptions)
                if (error) {
                    errors.push(...formatValidationErrors(error))
                } else {
                    ctx.query = value
                }
            }

            // 验证路径参数
            if (schemas.params) {
                const { error, value } = schemas.params.validate(ctx.params, validationOptions)
                if (error) {
                    errors.push(...formatValidationErrors(error))
                } else {
                    ctx.params = value
                }
            }

            // 如果有验证错误，返回错误响应
            if (errors.length > 0) {
                ctx.status = 400
                const response = createValidationErrorResponse(errors)
                // 添加 traceId
                response.traceId = getTraceId(ctx)
                ctx.body = response
                return
            }

            await next()
        } catch (error) {
            // 记录详细错误到日志
            if (ctx.logger) {
                ctx.logger.error('[validation] 验证中间件内部错误', {
                    error: error.message,
                    stack: error.stack,
                    path: ctx.path,
                    method: ctx.method,
                    body: ctx.request.body,
                    query: ctx.query,
                    params: ctx.params,
                    schemas: Object.keys(schemas),
                })
            } else {
                console.error('验证中间件错误:', error)
            }
            sendError(ctx, ERROR_CODES.INTERNAL_ERROR, '请求验证失败', 500)
        }
    }
}

/**
 * 常用验证规则
 */
export const validators = {
    /**
     * MongoDB ObjectId 验证
     * @deprecated 请使用 mongoObjectId 或特定的ID验证器
     */
    objectId: () =>
        Joi.string()
            .regex(/^[0-9a-fA-F]{24}$/)
            .message('无效的ID格式'),

    // ID验证器
    mongoObjectId: idValidators.mongoObjectId,
    uuid: idValidators.uuid,
    jobId: idValidators.jobId,
    resumeId: idValidators.resumeId,
    applicationId: idValidators.applicationId,
    contractId: idValidators.contractId,
    interviewId: idValidators.interviewId,
    companyId: idValidators.companyId,
    userId: idValidators.userId,

    /**
     * 分页参数验证
     */
    pagination: () =>
        Joi.object({
            page: Joi.number().integer().min(1).default(1),
            pageSize: Joi.number().integer().min(1).max(100).default(20),
        }),

    /**
     * 排序参数验证
     * @param {Array<string>} allowedFields - 允许排序的字段
     */
    sorting: (allowedFields = []) =>
        Joi.object({
            sortBy: Joi.string()
                .valid(...allowedFields)
                .default('createdAt'),
            sortOrder: Joi.string().valid('asc', 'desc', '1', '-1').default('desc'),
        }),

    /**
     * 日期范围验证
     */
    dateRange: () =>
        Joi.object({
            startDate: Joi.date().iso(),
            endDate: Joi.date().iso().min(Joi.ref('startDate')),
        }),

    /**
     * 手机号验证
     */
    mobile: () =>
        Joi.string()
            .regex(/^1[3-9]\d{9}$/)
            .message('无效的手机号格式'),

    /**
     * 邮箱验证
     */
    email: () => Joi.string().email().lowercase(),

    /**
     * URL验证
     */
    url: () =>
        Joi.string().uri({
            scheme: ['http', 'https'],
        }),

    /**
     * 工作经验年限验证
     */
    experience: () => Joi.number().integer().min(0).max(50),

    /**
     * 薪资范围验证
     */
    salaryRange: () =>
        Joi.object({
            min: Joi.number().integer().min(0),
            max: Joi.number().integer().min(Joi.ref('min')),
        }),

    /**
     * 地址验证
     */
    address: () =>
        Joi.object({
            province: Joi.string().required(),
            city: Joi.string().required(),
            district: Joi.string(),
            detail: Joi.string(),
        }),
}

/**
 * 预定义的验证模式
 */
export const schemas = {
    /**
     * ID参数验证（通用MongoDB ObjectId）
     */
    idParam: Joi.object({
        id: validators.mongoObjectId().required(),
    }),

    /**
     * 分页查询验证
     */
    paginationQuery: validators.pagination(),

    /**
     * 带排序的分页查询验证
     * @param {Array<string>} sortFields - 允许排序的字段
     */
    paginationWithSort: sortFields =>
        Joi.object({
            ...validators.pagination().describe(),
            ...validators.sorting(sortFields).describe(),
        }),

    /**
     * 批量操作验证（通用MongoDB ObjectId）
     */
    batchOperation: Joi.object({
        ids: Joi.array().items(validators.mongoObjectId()).min(1).max(100).required(),
    }),

    /**
     * 状态更新验证
     * @param {Array<string>} validStatuses - 有效的状态值
     */
    statusUpdate: validStatuses =>
        Joi.object({
            status: Joi.string()
                .valid(...validStatuses)
                .required(),
            reason: Joi.string().max(500),
        }),
}

/**
 * 创建自定义验证器
 * @param {Object} rules - 验证规则
 * @returns {Object} Joi验证模式
 */
export const createValidator = rules => {
    return Joi.object(rules)
}

/**
 * 验证单个值
 * @param {*} value - 要验证的值
 * @param {Object} schema - Joi验证模式
 * @param {Object} [options] - 验证选项
 * @returns {Object} 验证结果
 */
export const validateValue = (value, schema, options = {}) => {
    const validationOptions = { ...DEFAULT_OPTIONS, ...options }
    const { error, value: validatedValue } = schema.validate(value, validationOptions)

    if (error) {
        return {
            valid: false,
            errors: formatValidationErrors(error),
            value: null,
        }
    }

    return {
        valid: true,
        errors: [],
        value: validatedValue,
    }
}

export default {
    validate,
    validators,
    schemas,
    createValidator,
    validateValue,
}
