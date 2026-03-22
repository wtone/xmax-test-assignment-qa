/**
 * 面试开始提醒定时任务调度器
 * @module schedulers/interviewReminderScheduler
 * @description 定期检查即将开始和正在开始的面试，发送提醒通知
 */

import InterviewAppointmentService from '../services/InterviewAppointmentService.js'
import logger from '../../utils/logger.js'

class InterviewReminderScheduler {
    constructor() {
        this.isRunning = false
        this.pollingInterval = null
        // 默认 1 分钟检查一次（面试提醒需要较高频率）
        this.pollingIntervalMs = parseInt(process.env.INTERVIEW_REMINDER_CHECK_INTERVAL || '60000', 10)
        this.enabled = process.env.INTERVIEW_REMINDER_SCHEDULER_ENABLED !== 'false' // 默认启用
    }

    /**
     * 启动调度器
     */
    start() {
        if (!this.enabled) {
            logger.info('[InterviewReminderScheduler] Scheduler is disabled')
            return
        }

        if (this.isRunning) {
            logger.warn('[InterviewReminderScheduler] Scheduler is already running')
            return
        }

        logger.info('[InterviewReminderScheduler] Starting interview reminder scheduler', {
            intervalMs: this.pollingIntervalMs,
        })

        this.isRunning = true

        // 启动后延迟 30 秒执行首次检查
        setTimeout(() => {
            if (this.isRunning) {
                this.checkInterviewReminders().catch(error => {
                    logger.error('[InterviewReminderScheduler] Initial check failed', {
                        error: error.message,
                    })
                })
            }
        }, 30000)

        // 设置定时任务
        this.pollingInterval = setInterval(() => {
            this.checkInterviewReminders().catch(error => {
                logger.error('[InterviewReminderScheduler] Check failed', {
                    error: error.message,
                })
            })
        }, this.pollingIntervalMs)

        logger.info('[InterviewReminderScheduler] Scheduler started successfully')
    }

    /**
     * 停止调度器
     */
    stop() {
        if (!this.isRunning) {
            logger.warn('[InterviewReminderScheduler] Scheduler is not running')
            return
        }

        if (this.pollingInterval) {
            clearInterval(this.pollingInterval)
            this.pollingInterval = null
        }

        this.isRunning = false
        logger.info('[InterviewReminderScheduler] Scheduler stopped')
    }

    /**
     * 检查并发送面试提醒
     * - 节点1: 24小时前提醒
     * - 节点2: 30分钟前提醒
     * - 节点3: 开始时刻提醒（仅未进入房间方）
     * @returns {Promise<Object>} 处理结果
     */
    async checkInterviewReminders() {
        const startTime = Date.now()

        try {
            logger.debug('[InterviewReminderScheduler] Starting interview reminders check')

            // 节点1: 24小时前提醒
            const twentyFourHourCount = await InterviewAppointmentService.process24HourReminders()

            // 节点2: 30分钟前提醒
            const thirtyMinuteCount = await InterviewAppointmentService.process30MinuteReminders()

            // 节点3: 开始时刻提醒（仅未进入房间方）
            const startingCount = await InterviewAppointmentService.processStartingInterviewReminders()

            const duration = Date.now() - startTime
            const totalCount = twentyFourHourCount + thirtyMinuteCount + startingCount

            // 只有发送了提醒才记录 info 级别日志
            if (totalCount > 0) {
                logger.info('[InterviewReminderScheduler] Interview reminders check completed', {
                    twentyFourHourCount,
                    thirtyMinuteCount,
                    startingCount,
                    totalCount,
                    durationMs: duration,
                })
            } else {
                logger.debug('[InterviewReminderScheduler] Interview reminders check completed (no reminders sent)', {
                    durationMs: duration,
                })
            }

            return { twentyFourHourCount, thirtyMinuteCount, startingCount }
        } catch (error) {
            logger.error('[InterviewReminderScheduler] Failed to process interview reminders', {
                error: error.message,
                stack: error.stack,
            })
            throw error
        }
    }

    /**
     * 手动触发面试提醒检查（用于测试或紧急处理）
     * @returns {Promise<Object>} 处理结果
     */
    async triggerCheck() {
        logger.info('[InterviewReminderScheduler] Manually triggering interview reminders check')
        return this.checkInterviewReminders()
    }
}

export default new InterviewReminderScheduler()
