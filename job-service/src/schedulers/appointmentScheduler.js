/**
 * 面试预约定时任务调度器
 * @module schedulers/appointmentScheduler
 * @description 定期检查过期预约，自动更新状态
 */

import InterviewAppointmentService from '../services/InterviewAppointmentService.js'
import logger from '../../utils/logger.js'

class AppointmentScheduler {
    constructor() {
        this.isRunning = false
        this.pollingInterval = null
        // 默认 1 小时检查一次过期预约
        this.pollingIntervalMs = parseInt(process.env.APPOINTMENT_EXPIRE_CHECK_INTERVAL || '3600000', 10)
        this.enabled = process.env.APPOINTMENT_SCHEDULER_ENABLED !== 'false' // 默认启用
    }

    /**
     * 启动调度器
     */
    start() {
        if (!this.enabled) {
            logger.info('[AppointmentScheduler] Scheduler is disabled')
            return
        }

        if (this.isRunning) {
            logger.warn('[AppointmentScheduler] Scheduler is already running')
            return
        }

        logger.info('[AppointmentScheduler] Starting appointment scheduler', {
            intervalMs: this.pollingIntervalMs,
        })

        this.isRunning = true

        // 启动后延迟 1 分钟执行首次检查，避免启动时负载过高
        setTimeout(() => {
            if (this.isRunning) {
                this.checkExpiredAppointments().catch(error => {
                    logger.error('[AppointmentScheduler] Initial check failed', {
                        error: error.message,
                    })
                })
            }
        }, 60000)

        // 设置定时任务
        this.pollingInterval = setInterval(() => {
            this.checkExpiredAppointments().catch(error => {
                logger.error('[AppointmentScheduler] Check failed', {
                    error: error.message,
                })
            })
        }, this.pollingIntervalMs)

        logger.info('[AppointmentScheduler] Scheduler started successfully')
    }

    /**
     * 停止调度器
     */
    stop() {
        if (!this.isRunning) {
            logger.warn('[AppointmentScheduler] Scheduler is not running')
            return
        }

        if (this.pollingInterval) {
            clearInterval(this.pollingInterval)
            this.pollingInterval = null
        }

        this.isRunning = false
        logger.info('[AppointmentScheduler] Scheduler stopped')
    }

    /**
     * 检查并处理过期预约（C端超时 + B端超时 + 自动完成 + 自动缺席）以及即将超时提醒
     * @returns {Promise<Object>} 处理结果 { cSideCount, bSideCount, warningCount, autoCompleteCount, noShowCount }
     */
    async checkExpiredAppointments() {
        const startTime = Date.now()

        try {
            logger.info('[AppointmentScheduler] Starting expired appointments check')

            // 1. 处理 C 端超时（候选人未响应邀请）
            const cSideCount = await InterviewAppointmentService.processExpiredAppointments()

            // 2. 处理 B 端超时（企业未审批改期申请）
            const bSideCount = await InterviewAppointmentService.processExpiredRescheduleRequests()

            // 3. 发送即将超时提醒（还剩1天）
            const warningCount = await InterviewAppointmentService.processUpcomingExpirationReminders()

            // 4. 处理已扣费面试的自动完成（C端进入并扣费后超时未手动结束）
            const autoCompleteCount = await InterviewAppointmentService.processChargedAppointmentsAutoComplete()

            // 5. 处理未进入面试的自动缺席标记（面试时间已过 + C端未进入）
            const noShowCount = await InterviewAppointmentService.processNoShowAppointments()

            const duration = Date.now() - startTime
            logger.info('[AppointmentScheduler] Expired appointments check completed', {
                cSideCount,
                bSideCount,
                warningCount,
                autoCompleteCount,
                noShowCount,
                totalCount: cSideCount + bSideCount + warningCount + autoCompleteCount + noShowCount,
                durationMs: duration,
            })

            return { cSideCount, bSideCount, warningCount, autoCompleteCount, noShowCount }
        } catch (error) {
            logger.error('[AppointmentScheduler] Failed to process expired appointments', {
                error: error.message,
                stack: error.stack,
            })
            throw error
        }
    }

    /**
     * 手动触发过期预约检查（用于测试或紧急处理）
     * @returns {Promise<number>} 处理的预约数量
     */
    async triggerCheck() {
        logger.info('[AppointmentScheduler] Manually triggering expired appointments check')
        return this.checkExpiredAppointments()
    }
}

export default new AppointmentScheduler()
