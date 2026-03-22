/**
 * 职位过期定时任务调度器
 * @module schedulers/jobExpirationScheduler
 * @description 定期检查申请截止日期已过的职位，自动更新状态为 expired
 */

import JobPost from '../models/JobPost.js'
import { JOB_STATUS } from '../constants/job_status.js'
import NotificationService from '../services/integration/NotificationService.js'
import UserCenterService from '../services/integration/UserCenterService.js'
import { renderEmailTemplate } from '../libs/templates/emailTemplates.js'
import { EMAIL_TYPES } from '../libs/templates/constants.js'
import logger from '../../utils/logger.js'

const EMAIL_ASYNC_MODE = process.env.EMAIL_ASYNC_MODE === 'true'

class JobExpirationScheduler {
    constructor() {
        this.isRunning = false
        this.pollingInterval = null
        // 默认每天检查一次（86400000ms = 24小时）
        // 可通过环境变量调整，开发环境可设置更短的间隔
        this.pollingIntervalMs = parseInt(process.env.JOB_EXPIRE_CHECK_INTERVAL || '86400000', 10)
        // 是否发送过期通知给 B 端用户
        this.notifyOnExpiration = process.env.JOB_EXPIRE_NOTIFY !== 'false' // 默认启用
    }

    /**
     * 启动调度器
     */
    start() {
        if (this.isRunning) {
            logger.warn('[JobExpirationScheduler] Scheduler is already running')
            return
        }

        logger.info('[JobExpirationScheduler] Starting job expiration scheduler', {
            intervalMs: this.pollingIntervalMs,
            notifyOnExpiration: this.notifyOnExpiration,
        })

        this.isRunning = true

        // 启动后延迟 2 分钟执行首次检查，避免启动时负载过高
        setTimeout(() => {
            if (this.isRunning) {
                this.checkExpiredJobs().catch(error => {
                    logger.error('[JobExpirationScheduler] Initial check failed', {
                        error: error.message,
                    })
                })
            }
        }, 120000)

        // 设置定时任务
        this.pollingInterval = setInterval(() => {
            this.checkExpiredJobs().catch(error => {
                logger.error('[JobExpirationScheduler] Check failed', {
                    error: error.message,
                })
            })
        }, this.pollingIntervalMs)

        logger.info('[JobExpirationScheduler] Scheduler started successfully')
    }

    /**
     * 停止调度器
     */
    stop() {
        if (!this.isRunning) {
            logger.warn('[JobExpirationScheduler] Scheduler is not running')
            return
        }

        if (this.pollingInterval) {
            clearInterval(this.pollingInterval)
            this.pollingInterval = null
        }

        this.isRunning = false
        logger.info('[JobExpirationScheduler] Scheduler stopped')
    }

    /**
     * 检查并处理过期职位
     * @returns {Promise<Object>} 处理结果 { expiredCount, notifiedCount }
     */
    async checkExpiredJobs() {
        const startTime = Date.now()

        try {
            logger.info('[JobExpirationScheduler] Starting expired jobs check')

            const now = new Date()

            // 查找需要过期的职位：
            // 1. 状态为 published
            // 2. applicationDeadline 存在且已过期
            const expiredJobs = await JobPost.find({
                status: JOB_STATUS.PUBLISHED,
                applicationDeadline: {
                    $exists: true,
                    $ne: null,
                    $lt: now,
                },
            }).select('_id jobId title companyId companyName publisherId applicationDeadline')

            if (expiredJobs.length === 0) {
                logger.info('[JobExpirationScheduler] No expired jobs found')
                return { expiredCount: 0, notifiedCount: 0 }
            }

            logger.info('[JobExpirationScheduler] Found expired jobs', {
                count: expiredJobs.length,
                jobIds: expiredJobs.map(j => j.jobId),
            })

            // 批量更新状态为 expired
            const jobIds = expiredJobs.map(j => j._id)
            const updateResult = await JobPost.updateMany(
                { _id: { $in: jobIds } },
                {
                    $set: {
                        status: JOB_STATUS.EXPIRED,
                        expiredAt: now,
                    },
                }
            )

            const expiredCount = updateResult.modifiedCount

            logger.info('[JobExpirationScheduler] Jobs status updated to expired', {
                expectedCount: expiredJobs.length,
                actualCount: expiredCount,
            })

            // 发送通知给 B 端用户
            let notifiedCount = 0
            if (this.notifyOnExpiration) {
                notifiedCount = await this._sendExpirationNotifications(expiredJobs)
            }

            const duration = Date.now() - startTime
            logger.info('[JobExpirationScheduler] Expired jobs check completed', {
                expiredCount,
                notifiedCount,
                durationMs: duration,
            })

            return { expiredCount, notifiedCount }
        } catch (error) {
            logger.error('[JobExpirationScheduler] Failed to process expired jobs', {
                error: error.message,
                stack: error.stack,
            })
            throw error
        }
    }

    /**
     * 发送职位过期通知给 B 端用户
     * @param {Array} expiredJobs - 过期的职位列表
     * @returns {Promise<number>} 发送成功的通知数量
     * @private
     */
    async _sendExpirationNotifications(expiredJobs) {
        let notifiedCount = 0

        for (const job of expiredJobs) {
            try {
                // 发送站内消息
                const baseUrl = process.env.JOB_APPOINTMENT_URL_B || 'https://example.com'
                await NotificationService.sendInAppMessage({
                    userId: job.publisherId,
                    title: '职位已过期',
                    content: `您发布的职位「${job.title}」已到达申请截止日期，已自动转为历史岗位。`,
                    type: 'JOB',
                    priority: 'NORMAL',
                    referenceId: job.jobId,
                    referenceType: 'Job',
                    actionUrl: `${baseUrl}/#/redirect?type=job&utype=B&id=${job.jobId}&jobStatus=expired`,
                    metadata: {
                        jobStatus: 'expired',
                        jobTitle: job.title,
                    },
                })

                // 发送邮件通知
                try {
                    const publisherInfo = await UserCenterService.getUserProfile(job.publisherId)
                    if (publisherInfo?.email) {
                        const emailResult = renderEmailTemplate(EMAIL_TYPES.JOB_EXPIRED, {
                            jobTitle: job.title,
                            actionUrl: `${baseUrl}/#/redirect?type=job&utype=B&id=${job.jobId}&jobStatus=expired`,
                        })
                        await NotificationService.sendEmail({
                            to: publisherInfo.email,
                            subject: emailResult.subject,
                            html: emailResult.html,
                            async: EMAIL_ASYNC_MODE,
                        })
                    }
                } catch (emailError) {
                    logger.error('[JobExpirationScheduler] Failed to send expiration email', {
                        jobId: job.jobId,
                        publisherId: job.publisherId,
                        error: emailError.message,
                    })
                }

                notifiedCount++

                logger.info('[JobExpirationScheduler] Expiration notification sent', {
                    jobId: job.jobId,
                    publisherId: job.publisherId,
                })
            } catch (error) {
                // 通知失败不影响整体流程
                logger.error('[JobExpirationScheduler] Failed to send expiration notification', {
                    jobId: job.jobId,
                    publisherId: job.publisherId,
                    error: error.message,
                })
            }
        }

        return notifiedCount
    }

    /**
     * 手动触发过期检查（用于测试或紧急处理）
     * @returns {Promise<Object>} 处理结果
     */
    async triggerCheck() {
        logger.info('[JobExpirationScheduler] Manually triggering expired jobs check')
        return this.checkExpiredJobs()
    }

    /**
     * 获取调度器状态
     * @returns {Object} 调度器状态信息
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            pollingIntervalMs: this.pollingIntervalMs,
            notifyOnExpiration: this.notifyOnExpiration,
        }
    }
}

export default new JobExpirationScheduler()
