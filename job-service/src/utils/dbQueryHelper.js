/**
 * 数据库查询辅助函数
 * @module utils/dbQueryHelper
 * @description 提供统一的查询方法来处理不同格式的ID
 */

import mongoose from 'mongoose'
import { AppError } from '../../utils/response.js'
import { ERROR_CODES } from '../constants/error_codes.js'

/**
 * 检查是否为有效的MongoDB ObjectId
 * @param {string} id - 待检查的ID
 * @returns {boolean} 是否为有效的ObjectId
 */
export const isMongoObjectId = id => {
    if (!id || typeof id !== 'string') return false
    return /^[a-fA-F0-9]{24}$/.test(id) && mongoose.Types.ObjectId.isValid(id)
}

/**
 * 检查是否为UUID格式
 * @param {string} id - 待检查的ID
 * @returns {boolean} 是否为UUID格式
 */
export const isUUID = id => {
    if (!id || typeof id !== 'string') return false
    return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id)
}

/**
 * 检查是否为自定义业务ID格式
 * @param {string} id - 待检查的ID
 * @returns {object|null} 返回ID类型和字段名，如果不匹配返回null
 */
export const getCustomIdType = id => {
    if (!id || typeof id !== 'string') return null

    const patterns = [
        { pattern: /^job_\d{8}_[a-fA-F0-9]{8}$/, type: 'job', field: 'jobId' },
        { pattern: /^app_\d{8}_[a-fA-F0-9]{8}$/, type: 'application', field: 'applicationId' },
        { pattern: /^offer_\d{8}_[a-fA-F0-9]{8}$/, type: 'offer', field: 'offerId' },
        { pattern: /^interview_\d{8}_[a-fA-F0-9]{8}$/, type: 'interview', field: 'interviewId' },
        { pattern: /^contract_\d{8}_[a-fA-F0-9]{8}$/, type: 'contract', field: 'contractId' },
        { pattern: /^appt_\d{8}_[a-fA-F0-9]{8}$/, type: 'appointment', field: 'appointmentId' },
    ]

    for (const { pattern, type, field } of patterns) {
        if (pattern.test(id)) {
            return { type, field }
        }
    }

    return null
}

/**
 * 智能查询单个文档
 * @param {Model} model - Mongoose模型
 * @param {string} id - 查询的ID
 * @param {object} options - 查询选项
 * @param {string} options.idField - 自定义ID字段名（如果已知）
 * @param {boolean} options.lean - 是否返回普通对象
 * @param {string|object} options.populate - 需要填充的字段
 * @param {string|object} options.select - 需要选择的字段
 * @returns {Promise<object|null>} 查询结果
 */
export const findBySmartId = async (model, id, options = {}) => {
    const { idField, lean = false, populate, select } = options

    let query

    // 1. 如果明确指定了ID字段名，直接使用
    if (idField) {
        query = model.findOne({ [idField]: id })
    }
    // 2. 如果是MongoDB ObjectId格式，使用findById
    else if (isMongoObjectId(id)) {
        query = model.findById(id)
    }
    // 3. 如果是自定义格式，根据格式类型查询
    else {
        const customType = getCustomIdType(id)
        if (customType) {
            query = model.findOne({ [customType.field]: id })
        }
        // 4. 如果是UUID，尝试常见的UUID字段
        else if (isUUID(id)) {
            // 尝试多个可能的字段名
            const possibleFields = ['userId', 'candidateId', 'companyId', 'resumeId']
            for (const field of possibleFields) {
                const result = await model.findOne({ [field]: id })
                if (result) {
                    query = model.findOne({ [field]: id })
                    break
                }
            }
            if (!query) {
                query = model.findOne({ _id: id })
            }
        }
        // 5. 最后尝试作为字符串ID查询（需要是有效的ObjectId）
        else {
            // 如果不是有效的ObjectId格式，直接返回null，避免Cast错误
            if (!isMongoObjectId(id)) {
                return null
            }
            query = model.findOne({ _id: id })
        }
    }

    // 应用查询选项
    if (populate) query = query.populate(populate)
    if (select) query = query.select(select)
    if (lean) query = query.lean()

    return await query
}

/**
 * 智能更新单个文档
 * @param {Model} model - Mongoose模型
 * @param {string} id - 查询的ID
 * @param {object} update - 更新内容
 * @param {object} options - 更新选项
 * @param {string} options.idField - 自定义ID字段名（如果已知）
 * @param {boolean} options.new - 是否返回更新后的文档
 * @param {boolean} options.runValidators - 是否运行验证器
 * @returns {Promise<object|null>} 更新结果
 */
export const updateBySmartId = async (model, id, update, options = {}) => {
    const { idField, new: returnNew = true, runValidators = true } = options

    const updateOptions = {
        new: returnNew,
        runValidators,
    }

    // 1. 如果明确指定了ID字段名，直接使用
    if (idField) {
        return await model.findOneAndUpdate({ [idField]: id }, update, updateOptions)
    }
    // 2. 如果是MongoDB ObjectId格式，使用findByIdAndUpdate
    else if (isMongoObjectId(id)) {
        return await model.findByIdAndUpdate(id, update, updateOptions)
    }
    // 3. 如果是自定义格式，根据格式类型更新
    else {
        const customType = getCustomIdType(id)
        if (customType) {
            return await model.findOneAndUpdate({ [customType.field]: id }, update, updateOptions)
        }
        // 4. 最后尝试作为字符串ID更新
        else {
            return await model.findByIdAndUpdate(id, update, updateOptions)
        }
    }
}

/**
 * 智能删除单个文档
 * @param {Model} model - Mongoose模型
 * @param {string} id - 查询的ID
 * @param {object} options - 删除选项
 * @param {string} options.idField - 自定义ID字段名（如果已知）
 * @returns {Promise<object|null>} 删除结果
 */
export const deleteBySmartId = async (model, id, options = {}) => {
    const { idField } = options

    // 1. 如果明确指定了ID字段名，直接使用
    if (idField) {
        return await model.findOneAndDelete({ [idField]: id })
    }
    // 2. 如果是MongoDB ObjectId格式，使用findByIdAndDelete
    else if (isMongoObjectId(id)) {
        return await model.findByIdAndDelete(id)
    }
    // 3. 如果是自定义格式，根据格式类型删除
    else {
        const customType = getCustomIdType(id)
        if (customType) {
            return await model.findOneAndDelete({ [customType.field]: id })
        }
        // 4. 最后尝试作为字符串ID删除
        else {
            return await model.findByIdAndDelete(id)
        }
    }
}

/**
 * 批量智能查询
 * @param {Model} model - Mongoose模型
 * @param {Array<string>} ids - ID数组
 * @param {object} options - 查询选项
 * @returns {Promise<Array>} 查询结果数组
 */
export const findBySmartIds = async (model, ids, options = {}) => {
    if (!Array.isArray(ids) || ids.length === 0) {
        return []
    }

    const { lean = false, populate, select } = options

    // 按ID类型分组
    const objectIds = []
    const customIds = {}

    for (const id of ids) {
        if (isMongoObjectId(id)) {
            objectIds.push(id)
        } else {
            const customType = getCustomIdType(id)
            if (customType) {
                if (!customIds[customType.field]) {
                    customIds[customType.field] = []
                }
                customIds[customType.field].push(id)
            }
        }
    }

    // 构建查询条件
    const orConditions = []

    if (objectIds.length > 0) {
        orConditions.push({ _id: { $in: objectIds } })
    }

    for (const [field, fieldIds] of Object.entries(customIds)) {
        orConditions.push({ [field]: { $in: fieldIds } })
    }

    if (orConditions.length === 0) {
        return []
    }

    let query = model.find({ $or: orConditions })

    if (populate) query = query.populate(populate)
    if (select) query = query.select(select)
    if (lean) query = query.lean()

    return await query
}

/**
 * 确保文档存在，如果不存在则抛出错误
 * @param {Model} model - Mongoose模型
 * @param {string} id - 查询的ID
 * @param {object} options - 查询选项
 * @param {string} options.errorMessage - 自定义错误消息
 * @returns {Promise<object>} 查询结果
 * @throws {AppError} 如果文档不存在
 */
export const findBySmartIdOrThrow = async (model, id, options = {}) => {
    const { errorMessage = 'Document not found', ...queryOptions } = options

    const document = await findBySmartId(model, id, queryOptions)

    if (!document) {
        throw new AppError(errorMessage, ERROR_CODES.NOT_FOUND)
    }

    return document
}

/**
 * 根据 applicationId 前缀推断应用类型
 * @param {string} applicationId - app_xxx 或 shadow_xxx
 * @returns {'shadow' | 'application'}
 */
export const getApplicationType = applicationId =>
    applicationId?.startsWith('shadow_') ? 'shadow' : 'application'

export default {
    isMongoObjectId,
    isUUID,
    getCustomIdType,
    findBySmartId,
    updateBySmartId,
    deleteBySmartId,
    findBySmartIds,
    findBySmartIdOrThrow,
    getApplicationType,
}
