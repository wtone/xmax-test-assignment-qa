/**
 * MailGun 邮件服务
 * 提供邮件发送功能
 */

import FormData from 'form-data'
import Mailgun from 'mailgun.js'
import 'dotenv/config'
import { log } from '../../utils/logger.js'
import { BRAND } from './constants.js'

const logger = log(import.meta.url)

class MailGunService {
    constructor() {
        this.apiKey = process.env.MAILGUN_API_KEY
        this.domain = process.env.MAILGUN_DOMAIN || 'example.com'
        this.url = process.env.MAILGUN_URL || 'https://api.mailgun.net' // 默认美国地区，如果是欧盟域名需要设置为 https://api.eu.mailgun.net

        if (!this.apiKey) {
            throw new Error('MAILGUN_API_KEY 环境变量未设置')
        }

        // 初始化 MailGun 客户端
        const mailgun = new Mailgun(FormData)
        this.mg = mailgun.client({
            username: 'api',
            key: this.apiKey,
            url: this.url,
        })

        logger.info(`MailGun 服务初始化完成，域名: ${this.domain}`)
    }

    /**
     * 发送简单文本邮件
     * @param {Object} options - 邮件选项
     * @param {string|string[]} options.to - 收件人邮箱
     * @param {string} options.subject - 邮件主题
     * @param {string} options.text - 邮件文本内容
     * @param {string} [options.from] - 发件人邮箱，默认使用 postmaster@域名
     * @returns {Promise<Object>} 发送结果
     */
    async sendTextEmail(options) {
        const { to, subject, text, from } = options

        if (!to || !subject || !text) {
            throw new Error('缺少必要参数：to, subject, text')
        }

        const fromEmail = from || `${BRAND.OFFICIAL_NAME} <postmaster@${this.domain}>`

        try {
            logger.info(`准备发送文本邮件到: ${Array.isArray(to) ? to.join(', ') : to}`)

            const data = await this.mg.messages.create(this.domain, {
                from: fromEmail,
                to: Array.isArray(to) ? to : [to],
                subject,
                text,
            })

            logger.info('邮件发送成功', { messageId: data.id })
            return {
                success: true,
                messageId: data.id,
                message: '邮件发送成功',
            }
        } catch (error) {
            logger.error('邮件发送失败', error)
            throw new Error(`邮件发送失败: ${error.message}`)
        }
    }

    /**
     * 发送 HTML 邮件
     * @param {Object} options - 邮件选项
     * @param {string|string[]} options.to - 收件人邮箱
     * @param {string} options.subject - 邮件主题
     * @param {string} options.html - 邮件 HTML 内容
     * @param {string} [options.text] - 邮件文本内容（作为备用）
     * @param {string} [options.from] - 发件人邮箱，默认使用 postmaster@域名
     * @returns {Promise<Object>} 发送结果
     */
    async sendHtmlEmail(options) {
        const { to, subject, html, text, from } = options

        if (!to || !subject || !html) {
            throw new Error('缺少必要参数：to, subject, html')
        }

        const fromEmail = from || `${BRAND.OFFICIAL_NAME} <postmaster@${this.domain}>`

        try {
            logger.info(`准备发送 HTML 邮件到: ${Array.isArray(to) ? to.join(', ') : to}`)

            const messageData = {
                from: fromEmail,
                to: Array.isArray(to) ? to : [to],
                subject,
                html,
            }

            if (text) {
                messageData.text = text
            }

            const data = await this.mg.messages.create(this.domain, messageData)

            logger.info('HTML 邮件发送成功', { messageId: data.id })
            return {
                success: true,
                messageId: data.id,
                message: 'HTML 邮件发送成功',
            }
        } catch (error) {
            logger.error('HTML 邮件发送失败', error)
            throw new Error(`HTML 邮件发送失败: ${error.message}`)
        }
    }

    /**
     * 发送模板邮件（带变量替换）
     * @param {Object} options - 邮件选项
     * @param {string|string[]} options.to - 收件人邮箱
     * @param {string} options.template - 模板名称
     * @param {Object} [options.variables] - 模板变量
     * @param {string} [options.from] - 发件人邮箱
     * @returns {Promise<Object>} 发送结果
     */
    async sendTemplateEmail(options) {
        const { to, template, variables = {}, from } = options

        if (!to || !template) {
            throw new Error('缺少必要参数：to, template')
        }

        const fromEmail = from || `${BRAND.OFFICIAL_NAME} <postmaster@${this.domain}>`

        try {
            logger.info(`准备发送模板邮件到: ${Array.isArray(to) ? to.join(', ') : to}`)

            const data = await this.mg.messages.create(this.domain, {
                from: fromEmail,
                to: Array.isArray(to) ? to : [to],
                template,
                'h:X-Mailgun-Variables': JSON.stringify(variables),
            })

            logger.info('模板邮件发送成功', { messageId: data.id })
            return {
                success: true,
                messageId: data.id,
                message: '模板邮件发送成功',
            }
        } catch (error) {
            logger.error('模板邮件发送失败', error)
            throw new Error(`模板邮件发送失败: ${error.message}`)
        }
    }

    /**
     * 发送验证码邮件
     * @param {string} email - 收件人邮箱
     * @param {string} code - 验证码
     * @param {string} [purpose] - 验证码用途
     * @returns {Promise<Object>} 发送结果
     */
    async sendVerificationCode(email, code, purpose = '验证') {
        const subject = `${BRAND.OFFICIAL_NAME} ${purpose}验证码`
        const text = `
您好！

您的${purpose}验证码是：${code}

该验证码将在10分钟内有效，请及时使用。

如果您没有请求此验证码，请忽略此邮件。

${BRAND.NAME} 团队
        `.trim()

        return this.sendTextEmail({
            to: email,
            subject,
            text,
        })
    }

    /**
     * 发送欢迎邮件
     * @param {string} email - 收件人邮箱
     * @param {string} username - 用户名
     * @returns {Promise<Object>} 发送结果
     */
    // NOTE: sendWelcomeEmail and sendPasswordResetEmail methods have been removed
    // These email types are no longer supported per requirements
    // Use EmailService for supported email types:
    // - REGISTRATION, REGISTRATION_C_END, REGISTRATION_B_END
    // - LOGIN_VERIFICATION, PASSWORD_CHANGED

    /**
     * 测试邮件发送功能
     * @param {string} testEmail - 测试邮箱
     * @returns {Promise<Object>} 发送结果
     */
    async sendTestEmail(testEmail) {
        const subject = `${BRAND.OFFICIAL_NAME} MailGun 测试邮件`
        const text = `
这是一封来自 ${BRAND.OFFICIAL_NAME} 的测试邮件！

如果您收到了这封邮件，说明 MailGun 服务配置正确，邮件发送功能正常。

发送时间：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}

${BRAND.NAME} 团队
        `.trim()

        return this.sendTextEmail({
            to: testEmail,
            subject,
            text,
        })
    }
}

export default MailGunService
