import log4js from 'log4js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { hostname } from 'os'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 自定义单行 JSON 布局 - 简化版
log4js.addLayout('json', function (config) {
    return function (logEvent) {
        const data = logEvent.data[0]
        const extra = logEvent.data?.[1]

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

        // 如果数据是对象，则合并到日志对象中
        if (typeof data === 'object' && data !== null) {
            // 清理敏感信息并直接合并
            const sanitized = sanitizeData(data)
            sanitized.extra = extra ? sanitizeData(extra) : undefined
            // 移除一些冗余字段
            delete sanitized.service
            delete sanitized.env
            Object.assign(logObject, sanitized)
        } else {
            // 支持 logger.info('message', {details}) 格式
            logObject.msg = String(data)
            // 合并第二个参数中的详细信息
            if (extra && typeof extra === 'object') {
                const sanitized = sanitizeData(extra)
                delete sanitized.service
                delete sanitized.env
                Object.assign(logObject, sanitized)
            }
        }

        return JSON.stringify(logObject)
    }
})

// 清理敏感数据（添加循环引用检测）
function sanitizeData(data, seen = new WeakSet()) {
    // 检测循环引用
    if (data && typeof data === 'object') {
        if (seen.has(data)) {
            return '[Circular]'
        }
        seen.add(data)
    }

    // 处理数组
    if (Array.isArray(data)) {
        return data.map(item =>
            item && typeof item === 'object' ? sanitizeData(item, seen) : item
        )
    }

    const sensitiveKeys = ['password', 'token', 'cookie', 'authorization', 'api_key', 'secret']
    const cleaned = {}

    for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase()
        if (sensitiveKeys.some(k => lowerKey.includes(k))) {
            cleaned[key] = '[REDACTED]'
        } else if (value && typeof value === 'object') {
            cleaned[key] = sanitizeData(value, seen)
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

// 导出默认的单例 logger 实例，以保持向后兼容
const logger = log('default')
export default logger
