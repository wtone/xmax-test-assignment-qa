/**
 * 工具函数模块入口
 * @module utils
 */

export * from './response.js'
export * from './id_generator.js'

/**
 * 延迟执行
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise} Promise
 */
export const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

/**
 * 重试函数
 * @param {Function} fn - 要执行的函数
 * @param {number} retries - 重试次数
 * @param {number} interval - 重试间隔（毫秒）
 * @returns {Promise} 执行结果
 */
export const retry = async (fn, retries = 3, interval = 1000) => {
    try {
        return await fn()
    } catch (error) {
        if (retries > 0) {
            await delay(interval)
            return retry(fn, retries - 1, interval)
        }
        throw error
    }
}

/**
 * 深度克隆对象
 * @param {*} obj - 要克隆的对象
 * @returns {*} 克隆后的对象
 */
export const deepClone = obj => {
    if (obj === null || typeof obj !== 'object') return obj
    if (obj instanceof Date) return new Date(obj.getTime())
    if (obj instanceof Array) return obj.map(item => deepClone(item))
    if (obj instanceof Object) {
        const clonedObj = {}
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                clonedObj[key] = deepClone(obj[key])
            }
        }
        return clonedObj
    }
}

/**
 * 安全获取嵌套对象属性
 * @param {Object} obj - 对象
 * @param {string} path - 属性路径
 * @param {*} defaultValue - 默认值
 * @returns {*} 属性值
 */
export const get = (obj, path, defaultValue = undefined) => {
    const keys = path.split('.')
    let result = obj

    for (const key of keys) {
        result = result?.[key]
        if (result === undefined) {
            return defaultValue
        }
    }

    return result
}

/**
 * 安全设置嵌套对象属性
 * @param {Object} obj - 对象
 * @param {string} path - 属性路径
 * @param {*} value - 值
 * @returns {Object} 修改后的对象
 */
export const set = (obj, path, value) => {
    const keys = path.split('.')
    const lastKey = keys.pop()
    let current = obj

    for (const key of keys) {
        if (!current[key] || typeof current[key] !== 'object') {
            current[key] = {}
        }
        current = current[key]
    }

    current[lastKey] = value
    return obj
}

/**
 * 对象数组去重
 * @param {Array} array - 数组
 * @param {string} key - 去重依据的键
 * @returns {Array} 去重后的数组
 */
export const uniqueBy = (array, key) => {
    const seen = new Set()
    return array.filter(item => {
        const val = item[key]
        if (seen.has(val)) {
            return false
        }
        seen.add(val)
        return true
    })
}

/**
 * 分块处理数组
 * @param {Array} array - 数组
 * @param {number} size - 块大小
 * @returns {Array} 分块后的数组
 */
export const chunk = (array, size) => {
    const chunks = []
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size))
    }
    return chunks
}

/**
 * 格式化文件大小
 * @param {number} bytes - 字节数
 * @param {number} decimals - 小数位数
 * @returns {string} 格式化后的文件大小
 */
export const formatFileSize = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes'

    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']

    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

/**
 * 解析查询参数
 * @param {Object} query - 查询对象
 * @param {Object} defaults - 默认值
 * @returns {Object} 解析后的参数
 */
export const parseQueryParams = (query, defaults = {}) => {
    const params = { ...defaults }

    // 分页参数
    if (query.page) {
        params.page = Math.max(1, parseInt(query.page) || defaults.page || 1)
    }
    if (query.pageSize || query.page_size) {
        params.pageSize = Math.max(1, parseInt(query.pageSize || query.page_size) || defaults.pageSize || 20)
    }

    // 排序参数
    if (query.sort || query.sortField || query.sort_field) {
        params.sortField = query.sort || query.sortField || query.sort_field
    }
    if (query.order || query.sortOrder || query.sort_order) {
        const order = (query.order || query.sortOrder || query.sort_order).toLowerCase()
        params.sortOrder = ['asc', 'desc'].includes(order) ? order : 'desc'
    }

    // 搜索参数
    if (query.q || query.search || query.keyword) {
        params.search = query.q || query.search || query.keyword
    }

    // 过滤参数
    if (query.status) params.status = query.status
    if (query.type) params.type = query.type
    if (query.from) params.from = query.from
    if (query.to) params.to = query.to

    return params
}

/**
 * 清理对象中的空值
 * @param {Object} obj - 对象
 * @returns {Object} 清理后的对象
 */
export const cleanObject = obj => {
    const cleaned = {}

    Object.entries(obj).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '') {
            if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
                const cleanedValue = cleanObject(value)
                if (Object.keys(cleanedValue).length > 0) {
                    cleaned[key] = cleanedValue
                }
            } else {
                cleaned[key] = value
            }
        }
    })

    return cleaned
}

/**
 * 计算分页信息
 * @param {number} total - 总数
 * @param {number} page - 当前页
 * @param {number} pageSize - 每页大小
 * @returns {Object} 分页信息
 */
export const calculatePagination = (total, page, pageSize) => {
    const totalPages = Math.ceil(total / pageSize)
    const hasNext = page < totalPages
    const hasPrev = page > 1
    const start = (page - 1) * pageSize
    const end = Math.min(start + pageSize, total)

    return {
        total,
        page,
        pageSize,
        totalPages,
        hasNext,
        hasPrev,
        start,
        end,
    }
}

/**
 * 验证邮箱格式
 * @param {string} email - 邮箱
 * @returns {boolean} 是否有效
 */
export const isValidEmail = email => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
}

/**
 * 验证手机号格式（中国）
 * @param {string} phone - 手机号
 * @returns {boolean} 是否有效
 */
export const isValidPhone = phone => {
    const phoneRegex = /^1[3-9]\d{9}$/
    return phoneRegex.test(phone)
}

/**
 * 验证URL格式
 * @param {string} url - URL
 * @returns {boolean} 是否有效
 */
export const isValidUrl = url => {
    try {
        new URL(url)
        return true
    } catch {
        return false
    }
}

export default {
    delay,
    retry,
    deepClone,
    get,
    set,
    uniqueBy,
    chunk,
    formatFileSize,
    parseQueryParams,
    cleanObject,
    calculatePagination,
    isValidEmail,
    isValidPhone,
    isValidUrl,
}
