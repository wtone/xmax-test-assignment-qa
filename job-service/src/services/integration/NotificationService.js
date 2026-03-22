import BaseService from './base_service.js'

class NotificationService extends BaseService {
    constructor() {
        super({
            serviceName: 'notification',
            baseURL: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3014',
            timeout: 30000,
            retries: 3,
            retryInterval: 1000,
        })
    }

    /**
     * 发送邮件通知（纯发送接口）
     * @param {Object} emailData - 邮件数据
     * @param {string|string[]} emailData.to - 收件人
     * @param {string} emailData.subject - 邮件主题
     * @param {string} emailData.html - HTML 内容
     * @param {string} [emailData.text] - 纯文本内容
     * @param {string} [emailData.from] - 发件人
     * @param {boolean} [emailData.async] - 是否异步发送
     */
    async sendEmail(emailData) {
        return this.post('/api/v1/notification/email', emailData)
    }

    /**
     * 批量发送邮件
     * @param {Array<Object>} emails - 邮件数组
     */
    async sendEmailBatch(emails) {
        return this.post('/api/v1/notification/email/batch', { emails })
    }

    /**
     * 发送站内消息 (In-App Message)
     * @param {Object} messageData - 消息数据
     * @param {string} messageData.userId - 接收者用户ID
     * @param {string} messageData.title - 消息标题 (max 200)
     * @param {string} messageData.content - 消息内容 (max 5000)
     * @param {string} [messageData.type] - 消息类型: SYSTEM | INTERVIEW | APPLICATION | OFFER | REMINDER
     * @param {string} [messageData.priority] - 优先级: LOW | NORMAL | HIGH | URGENT
     * @param {string} [messageData.referenceId] - 关联业务ID
     * @param {string} [messageData.referenceType] - 关联业务类型
     * @param {string} [messageData.actionUrl] - 前端跳转链接
     * @param {Object} [messageData.metadata] - 扩展元数据
     */
    async sendInAppMessage(messageData) {
        return this.post('/api/v1/notification/inapp-message', messageData)
    }

    /**
     * 批量发送站内消息 (In-App Message)
     * @param {Array<string>} userIds - 用户ID数组
     * @param {Object} messageData - 消息数据
     */
    async sendInAppMessageBatch(userIds, messageData) {
        return this.post('/api/v1/notification/inapp-message/batch', { userIds, ...messageData })
    }
}

export default new NotificationService()
