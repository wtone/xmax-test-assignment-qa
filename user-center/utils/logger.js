import log4js from 'log4js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { hostname } from 'os'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 自定义单行 JSON 布局 - 简化版
log4js.addLayout('json', function (config) {
    return function (logEvent) {
        // 处理多个参数
        const dataArray = logEvent.data

        // 简化的日志结构 - 保留 Kibana 必需字段
        const logObject = {
            ts: new Date().toISOString(), // 简化时间戳字段名
            lvl: logEvent.level.levelStr.substring(0, 4), // INFO->INFO, ERROR->ERRO, WARN->WARN
            src: logEvent.categoryName.replace('.js', ''), // 移除 .js 后缀
        }

        // 只在生产环境添加服务信息
        if (process.env.NODE_ENV === 'production') {
            logObject.svc = process.env.APP_ID || 'unknown'
            logObject.host = hostname()
        }

        // 处理多个参数的情况
        if (dataArray.length === 1) {
            const data = dataArray[0]
            // 如果数据是对象，则合并到日志对象中
            if (typeof data === 'object' && data !== null) {
                // 清理敏感信息并直接合并
                const sanitized = sanitizeData(data)
                // 移除一些冗余字段
                delete sanitized.service
                delete sanitized.env
                Object.assign(logObject, sanitized)
            } else {
                logObject.msg = String(data)
            }
        } else if (dataArray.length > 1) {
            // 多个参数时的优化处理
            // 第一个参数作为消息，后续参数如果是对象则展开到顶层
            logObject.msg = String(dataArray[0])

            for (let i = 1; i < dataArray.length; i++) {
                const item = dataArray[i]
                if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
                    // 如果是对象，展开到顶层字段（添加前缀避免冲突）
                    const sanitized = sanitizeData(item)
                    Object.assign(logObject, sanitized)
                } else {
                    // 如果不是对象或是数组，添加到 data 字段
                    if (!logObject.data) {
                        logObject.data = []
                    }
                    logObject.data.push(typeof item === 'object' ? JSON.stringify(item) : String(item))
                }
            }

            // 如果有 data 数组，将其序列化为字符串
            if (logObject.data) {
                logObject.data = JSON.stringify(logObject.data)
            }
        }

        return JSON.stringify(logObject)
    }
})

// 清理敏感数据
function sanitizeData(data) {
    const sensitiveKeys = ['password', 'token', 'cookie', 'authorization', 'api_key', 'secret']
    const cleaned = {}

    for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase()
        if (sensitiveKeys.some(k => lowerKey.includes(k))) {
            cleaned[key] = '[REDACTED]'
        } else if (value && typeof value === 'object') {
            cleaned[key] = sanitizeData(value)
        } else {
            cleaned[key] = value
        }
    }

    return cleaned
}

// 配置log4js
log4js.configure({
    appenders: {
        console: {
            type: 'console',
            layout: {
                type: 'json',
            },
        },
        daily: {
            type: 'dateFile',
            filename: join(process.env.LOG_PATH || './logs', process.env.APP_ID || 'app'),
            pattern: '.yyyy-MM-dd.log',
            alwaysIncludePattern: true,
            keepFileExt: true,
            layout: {
                type: 'json',
            },
        },
    },
    categories: {
        default: {
            appenders: process.env.LOGGER === 'daily' ? ['console', 'daily'] : ['console'],
            level: process.env.LOG_LEVEL || 'info',
        },
    },
})

/**
 * 获取logger实例
 * @param {string} name - logger名称，通常使用 import.meta.url
 * @returns {Logger}
 */
export const log = name => {
    // 从文件路径中提取文件名作为logger名称
    if (name && name.startsWith('file://')) {
        const filename = fileURLToPath(name)
        name = filename.substring(filename.lastIndexOf('/') + 1)
    }
    return log4js.getLogger(name || 'default')
}

export default log
