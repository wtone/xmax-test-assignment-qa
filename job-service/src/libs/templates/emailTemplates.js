/**
 * 邮件模板渲染工具
 * 用于将模板和数据渲染成完整的 HTML 邮件
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { LANGUAGES, ACTION_COMPONENTS } from './constants.js'
import { EMAIL_CONTENTS } from './contents/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * 读取基础模板
 */
let baseTemplate = null
function getBaseTemplate() {
    if (!baseTemplate) {
        const templatePath = path.join(__dirname, 'email_base.html')
        baseTemplate = fs.readFileSync(templatePath, 'utf-8')
    }
    return baseTemplate
}

/**
 * 替换模板中的占位符
 * @param {string} template - 模板字符串
 * @param {Object} data - 数据对象
 * @returns {string} 替换后的字符串
 */
function replacePlaceholders(template, data) {
    let result = template

    // 替换所有 {{KEY}} 格式的占位符
    Object.keys(data).forEach(key => {
        const placeholder = `{{${key}}}`
        const value = data[key] ?? ''
        result = result.replace(new RegExp(placeholder, 'g'), value)
    })

    return result
}

/**
 * 将数据对象的键转换为大写下划线格式
 * @param {Object} data - 原始数据对象
 * @returns {Object} 转换后的数据对象
 */
function convertKeysToUpperSnakeCase(data) {
    const result = {}
    Object.keys(data).forEach(key => {
        // 将 camelCase 转换为 UPPER_SNAKE_CASE
        const upperKey = key
            .replace(/([A-Z])/g, '_$1')
            .toUpperCase()
            .replace(/^_/, '')
        result[upperKey] = data[key]
    })
    return result
}

/**
 * 渲染邮件模板
 * @param {string} type - 邮件类型（例如：'interview_invitation'）
 * @param {Object} data - 数据对象
 * @param {string} [language='cn'] - 语言（'cn' 或 'en'）
 * @returns {Object} { subject, html, text } - 渲染结果
 */
export function renderEmailTemplate(type, data, language = LANGUAGES.CN) {
    // 获取模板配置
    const template = EMAIL_CONTENTS[type]
    if (!template) {
        throw new Error(`Email template not found: ${type}`)
    }

    const langConfig = template[language]
    if (!langConfig) {
        throw new Error(`Language not supported for template ${type}: ${language}`)
    }

    // 生成邮件主题
    const subject = typeof langConfig.subject === 'function' ? langConfig.subject(data) : langConfig.subject

    // 生成纯文本内容
    const text = typeof langConfig.text === 'function' ? langConfig.text(data) : langConfig.text

    // 将数据键转换为大写下划线格式（用于模板占位符）
    const upperData = convertKeysToUpperSnakeCase(data)

    // 渲染邮件正文（替换占位符）
    const body = replacePlaceholders(langConfig.body, upperData)

    // 渲染行动组件
    let actionHtml = ''
    if (langConfig.actionType && langConfig.actionType !== 'none') {
        const actionComponent = ACTION_COMPONENTS[langConfig.actionType]
        if (actionComponent) {
            actionHtml = actionComponent
            // 替换行动按钮的文本和链接
            actionHtml = actionHtml.replace(/{{ACTION_TEXT}}/g, langConfig.actionText || '')
            const actionUrl = langConfig.actionUrlKey ? data[langConfig.actionUrlKey] || '' : ''
            actionHtml = actionHtml.replace(/{{ACTION_URL}}/g, actionUrl)
        }
    }

    // 使用基础模板组装完整 HTML
    const baseHtml = getBaseTemplate()
    const html = baseHtml
        .replace(/{{EMAIL_TITLE}}/g, langConfig.title)
        .replace(/{{EMAIL_BODY}}/g, body)
        .replace(/{{EMAIL_ACTION}}/g, actionHtml)

    return {
        subject,
        html,
        text,
    }
}

/**
 * 批量渲染邮件模板
 * @param {Array<{type, data, language}>} templates - 模板数组
 * @returns {Array<{subject, html, text}>} 渲染结果数组
 */
export function renderEmailTemplates(templates) {
    return templates.map(({ type, data, language }) => renderEmailTemplate(type, data, language))
}

/**
 * 获取所有可用的模板类型
 */
export function getAvailableTemplates() {
    return Object.keys(EMAIL_CONTENTS)
}

/**
 * 检查模板是否存在
 */
export function hasTemplate(type) {
    return type in EMAIL_CONTENTS
}

export default {
    renderEmailTemplate,
    renderEmailTemplates,
    getAvailableTemplates,
    hasTemplate,
}
