/**
 * 外部系统ID Schema定义
 * @module models/schemas/external_id_schema
 *
 * 统一处理来自外部系统的ID格式，支持：
 * - MongoDB ObjectId
 * - UUID v4
 * - 自定义格式的ID
 */

import { Schema } from 'mongoose'

/**
 * 创建外部系统ID的Schema类型
 * @param {Object} options - 配置选项
 * @param {boolean} options.required - 是否必填
 * @param {boolean} options.index - 是否创建索引
 * @param {string} options.ref - 引用的模型名称
 * @param {string} options.description - 字段描述
 * @returns {Object} Schema定义对象
 */
export const createExternalIdSchema = (options = {}) => {
    const { required = false, index = false, ref = null, description = '外部系统ID' } = options

    const schemaDefinition = {
        type: String, // 使用String类型以支持各种ID格式
        required,
        index,
        validate: {
            validator: function (value) {
                if (!value) return !required

                // 验证ID格式（支持MongoDB ObjectId、UUID、自定义格式）
                const mongoObjectIdPattern = /^[0-9a-fA-F]{24}$/
                const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
                const customIdPattern = /^[a-zA-Z0-9_-]{1,100}$/ // 支持字母数字下划线连字符，最长100字符

                return mongoObjectIdPattern.test(value) || uuidPattern.test(value) || customIdPattern.test(value)
            },
            message: `${description}格式无效，支持MongoDB ObjectId、UUID或自定义格式（字母数字下划线连字符）`,
        },
    }

    if (ref) {
        schemaDefinition.ref = ref
    }

    return schemaDefinition
}

/**
 * 创建内部系统ID的Schema类型（MongoDB ObjectId）
 * @param {Object} options - 配置选项
 * @param {boolean} options.required - 是否必填
 * @param {boolean} options.index - 是否创建索引
 * @param {string} options.ref - 引用的模型名称
 * @param {string} options.description - 字段描述
 * @returns {Object} Schema定义对象
 */
export const createInternalIdSchema = (options = {}) => {
    const { required = false, index = false, ref = null, description = '内部系统ID' } = options

    const schemaDefinition = {
        type: Schema.Types.ObjectId,
        required,
        index,
    }

    if (ref) {
        schemaDefinition.ref = ref
    }

    return schemaDefinition
}

/**
 * 预定义的外部系统ID Schema
 */
export const ExternalIdSchemas = {
    // 用户ID（来自User Center Service）
    userId: createExternalIdSchema({
        required: true,
        index: true,
        description: '用户ID',
    }),

    // 候选人ID（来自User Center Service）
    candidateId: createExternalIdSchema({
        required: true,
        index: true,
        description: '候选人ID',
    }),

    // 公司ID（来自Company Service）
    companyId: createExternalIdSchema({
        required: true,
        index: true,
        description: '公司ID',
    }),

    // 简历ID（来自Resume Service）
    resumeId: createExternalIdSchema({
        required: true,
        index: true,
        description: '简历ID',
    }),

    // 发布者ID
    publisherId: createExternalIdSchema({
        required: true,
        index: true,
        description: '发布者ID',
    }),
}

/**
 * 预定义的内部系统ID Schema
 */
export const InternalIdSchemas = {
    // 职位ID（内部MongoDB ObjectId）
    jobId: createInternalIdSchema({
        required: true,
        index: true,
        ref: 'JobPost',
        description: '职位ID',
    }),

    // 申请ID（内部MongoDB ObjectId）
    applicationId: createInternalIdSchema({
        required: true,
        index: true,
        ref: 'JobApplication',
        description: '申请ID',
    }),

    // 合同/Offer ID（内部MongoDB ObjectId）
    contractId: createInternalIdSchema({
        required: true,
        index: true,
        ref: 'ContractOffer',
        description: '合同ID',
    }),

    // 面试ID（内部MongoDB ObjectId）
    interviewId: createInternalIdSchema({
        required: true,
        index: true,
        ref: 'Interview',
        description: '面试ID',
    }),
}

/**
 * ID格式验证器
 */
export const IdValidators = {
    /**
     * 验证MongoDB ObjectId格式
     * @param {string} id - 待验证的ID
     * @returns {boolean} 是否为有效的MongoDB ObjectId
     */
    isMongoObjectId(id) {
        return /^[0-9a-fA-F]{24}$/.test(id)
    },

    /**
     * 验证UUID格式
     * @param {string} id - 待验证的ID
     * @returns {boolean} 是否为有效的UUID
     */
    isUUID(id) {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    },

    /**
     * 验证自定义ID格式
     * @param {string} id - 待验证的ID
     * @returns {boolean} 是否为有效的自定义ID
     */
    isCustomId(id) {
        return /^[a-zA-Z0-9_-]{1,100}$/.test(id)
    },

    /**
     * 验证外部系统ID（支持多种格式）
     * @param {string} id - 待验证的ID
     * @returns {boolean} 是否为有效的外部系统ID
     */
    isExternalId(id) {
        return this.isMongoObjectId(id) || this.isUUID(id) || this.isCustomId(id)
    },
}

export default {
    createExternalIdSchema,
    createInternalIdSchema,
    ExternalIdSchemas,
    InternalIdSchemas,
    IdValidators,
}
