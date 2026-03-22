/**
 * Notification Service Client
 * 调用 notification-service 发送邮件
 */
import axios from 'axios'
import { log } from '../../utils/logger.js'

const logger = log(import.meta.url)

class NotificationClient {
    constructor() {
        this.baseURL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3014'
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: 30000,
            headers: { 'Content-Type': 'application/json' },
        })

        logger.info(`NotificationClient 初始化完成，服务地址: ${this.baseURL}`)
    }

    /**
     * 发送邮件
     * @param {Object} options - 邮件选项
     * @param {string|string[]} options.to - 收件人邮箱
     * @param {string} options.subject - 邮件主题
     * @param {string} [options.html] - HTML内容
     * @param {string} [options.text] - 纯文本内容
     * @param {boolean} [options.async=false] - 是否异步发送
     * @returns {Promise<Object>} 发送结果
     */
    async sendEmail({ to, subject, html, text, async = false }) {
        try {
            const response = await this.client.post('/api/v1/notification/email', {
                to,
                subject,
                html,
                text,
                async,
            })

            logger.info({
                msg: 'Email sent via notification-service',
                to,
                subject: subject.substring(0, 30),
                async,
            })

            return {
                success: true,
                messageId: response.data.data?.messageId || response.data.data?.id,
                message: response.data.message || 'Email sent successfully',
            }
        } catch (error) {
            logger.error({
                msg: 'Failed to send email via notification-service',
                to,
                subject,
                err: error.message,
                response: error.response?.data,
            })
            throw new Error(`Failed to send email: ${error.message}`)
        }
    }

    /**
     * 批量发送邮件
     * @param {Array<Object>} emails - 邮件列表
     * @returns {Promise<Object>} 发送结果
     */
    async sendEmailBatch(emails) {
        try {
            // 使用 Promise.allSettled 并行发送，允许部分成功
            const settledResults = await Promise.allSettled(
                emails.map(email => this.sendEmail(email))
            )

            const results = settledResults.map((result, index) => ({
                email: emails[index].to,
                success: result.status === 'fulfilled',
                ...(result.status === 'fulfilled'
                    ? result.value
                    : { error: result.reason?.message || 'Unknown error' }),
            }))

            const successCount = results.filter(r => r.success).length
            const failCount = results.length - successCount

            logger.info({
                msg: 'Batch email send completed',
                total: emails.length,
                success: successCount,
                failed: failCount,
            })

            return {
                success: failCount === 0,
                successCount,
                failCount,
                results,
            }
        } catch (error) {
            logger.error({ msg: 'Failed to send batch emails', err: error.message })
            throw error
        }
    }

    /**
     * 发送验证码邮件
     * @param {string} to - 收件人邮箱
     * @param {string} code - 验证码
     * @param {number} [expiresInMinutes=10] - 过期时间（分钟）
     * @returns {Promise<Object>} 发送结果
     */
    async sendVerificationCode(to, code, expiresInMinutes = 10) {
        try {
            const response = await this.client.post('/api/v1/notification/email/verification-code', {
                to,
                code,
                expiresInMinutes,
            })

            logger.info({
                msg: 'Verification code email sent via notification-service',
                to,
                expiresInMinutes,
            })

            return {
                success: true,
                messageId: response.data.data?.messageId || response.data.data?.id,
                message: response.data.message || 'Verification code sent successfully',
            }
        } catch (error) {
            logger.error({
                msg: 'Failed to send verification code email',
                to,
                err: error.message,
            })
            throw new Error(`Failed to send verification code: ${error.message}`)
        }
    }

    /**
     * 发送面试邀请邮件
     * @param {Object} options - 面试邀请选项
     * @returns {Promise<Object>} 发送结果
     */
    async sendInterviewInvitation(options) {
        try {
            const response = await this.client.post('/api/v1/notification/email/interview-invitation', options)

            logger.info({
                msg: 'Interview invitation email sent via notification-service',
                to: options.to,
                position: options.position,
            })

            return {
                success: true,
                messageId: response.data.data?.messageId || response.data.data?.id,
                message: response.data.message || 'Interview invitation sent successfully',
            }
        } catch (error) {
            logger.error({
                msg: 'Failed to send interview invitation email',
                to: options.to,
                err: error.message,
            })
            throw new Error(`Failed to send interview invitation: ${error.message}`)
        }
    }
}

export const notificationClient = new NotificationClient()
export default notificationClient
