/**
 * ID 生成器工具
 * @module utils/id_generator
 */

import { randomBytes } from 'crypto'

/**
 * 生成随机字符串
 * @param {number} length - 字符串长度
 * @returns {string} 随机字符串
 */
export const generateRandomString = (length = 16) => {
    return randomBytes(Math.ceil(length / 2))
        .toString('hex')
        .slice(0, length)
}

/**
 * 生成带前缀的唯一ID
 * @param {string} prefix - ID前缀
 * @param {number} length - 随机部分长度
 * @returns {string} 唯一ID
 */
export const generateUniqueId = (prefix = '', length = 16) => {
    const timestamp = Date.now().toString(36)
    const random = generateRandomString(length)
    return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`
}

/**
 * 生成职位ID
 * @returns {string} 职位ID
 */
export const generateJobId = () => {
    return generateUniqueId('job', 12)
}

/**
 * 生成申请ID
 * @returns {string} 申请ID
 */
export const generateApplicationId = () => {
    return generateUniqueId('app', 12)
}

/**
 * 生成公司ID
 * @returns {string} 公司ID
 */
export const generateCompanyId = () => {
    return generateUniqueId('com', 12)
}

/**
 * 生成面试ID
 * @returns {string} 面试ID
 */
export const generateInterviewId = () => {
    return generateUniqueId('int', 12)
}

/**
 * 生成任务ID
 * @returns {string} 任务ID
 */
export const generateTaskId = () => {
    return generateUniqueId('task', 16)
}

/**
 * 生成会话ID
 * @returns {string} 会话ID
 */
export const generateSessionId = () => {
    return generateUniqueId('sess', 20)
}

/**
 * 生成短码（用于分享链接等）
 * @param {number} length - 短码长度
 * @returns {string} 短码
 */
export const generateShortCode = (length = 8) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
    let code = ''
    const bytes = randomBytes(length)

    for (let i = 0; i < length; i++) {
        code += chars[bytes[i] % chars.length]
    }

    return code
}

/**
 * 生成数字验证码
 * @param {number} length - 验证码长度
 * @returns {string} 验证码
 */
export const generateNumericCode = (length = 6) => {
    let code = ''
    for (let i = 0; i < length; i++) {
        code += Math.floor(Math.random() * 10)
    }
    return code
}

/**
 * 生成UUID v4格式的ID
 * @returns {string} UUID
 */
export const generateUUID = () => {
    const bytes = randomBytes(16)

    // Set version (4) and variant bits
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80

    const hex = bytes.toString('hex')
    return [hex.substring(0, 8), hex.substring(8, 12), hex.substring(12, 16), hex.substring(16, 20), hex.substring(20, 32)].join('-')
}

/**
 * 生成基于时间戳的有序ID
 * @param {string} prefix - ID前缀
 * @returns {string} 有序ID
 */
export const generateOrderedId = (prefix = '') => {
    const timestamp = Date.now()
    const random = Math.floor(Math.random() * 1000000)
        .toString()
        .padStart(6, '0')
    const id = `${timestamp}${random}`
    return prefix ? `${prefix}_${id}` : id
}

/**
 * 验证ID格式
 * @param {string} id - 待验证的ID
 * @param {string} prefix - 期望的前缀
 * @returns {boolean} 是否有效
 */
export const isValidId = (id, prefix = '') => {
    if (!id || typeof id !== 'string') return false

    if (prefix) {
        const pattern = new RegExp(`^${prefix}_[a-z0-9]+_[a-z0-9]+$`)
        return pattern.test(id)
    }

    // 基本格式验证
    return /^[a-z0-9_-]+$/i.test(id)
}

/**
 * 从ID中提取时间戳
 * @param {string} id - ID
 * @returns {Date|null} 时间戳对应的日期
 */
export const extractTimestampFromId = id => {
    if (!id || typeof id !== 'string') return null

    const parts = id.split('_')
    if (parts.length < 2) return null

    const timestampPart = parts[parts.length - 2]
    const timestamp = parseInt(timestampPart, 36)

    if (isNaN(timestamp)) return null

    return new Date(timestamp)
}

export default {
    generateRandomString,
    generateUniqueId,
    generateJobId,
    generateApplicationId,
    generateCompanyId,
    generateInterviewId,
    generateTaskId,
    generateSessionId,
    generateShortCode,
    generateNumericCode,
    generateUUID,
    generateOrderedId,
    isValidId,
    extractTimestampFromId,
}
