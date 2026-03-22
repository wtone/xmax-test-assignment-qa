/**
 * 调度器统一管理模块
 * @module schedulers
 */

import EvaluationPollingService from '../services/EvaluationPollingService.js'
import AppointmentScheduler from './appointmentScheduler.js'
import InterviewReminderScheduler from './interviewReminderScheduler.js'
import JobExpirationScheduler from './jobExpirationScheduler.js'
import logger from '../../utils/logger.js'

/**
 * 启动所有调度器
 */
export function startSchedulers() {
    // 启动评估轮询服务
    try {
        EvaluationPollingService.start()
        logger.info('Evaluation polling service started')
        console.log('🔄 Evaluation polling service started')
    } catch (error) {
        logger.error('Failed to start polling service:', error)
        console.warn('⚠️  Evaluation polling service failed to start')
    }

    // 启动预约过期检查调度器（含即将超时提醒，每小时执行）
    try {
        AppointmentScheduler.start()
        logger.info('Appointment scheduler started')
        console.log('⏰ Appointment scheduler started')
    } catch (error) {
        logger.error('Failed to start appointment scheduler:', error)
        console.warn('⚠️  Appointment scheduler failed to start')
    }

    // 启动面试开始提醒调度器（每分钟执行）
    try {
        InterviewReminderScheduler.start()
        logger.info('Interview reminder scheduler started')
        console.log('📢 Interview reminder scheduler started')
    } catch (error) {
        logger.error('Failed to start interview reminder scheduler:', error)
        console.warn('⚠️  Interview reminder scheduler failed to start')
    }

    // 启动职位过期检查调度器（每天执行一次）
    try {
        JobExpirationScheduler.start()
        logger.info('Job expiration scheduler started')
        console.log('📋 Job expiration scheduler started')
    } catch (error) {
        logger.error('Failed to start job expiration scheduler:', error)
        console.warn('⚠️  Job expiration scheduler failed to start')
    }
}

/**
 * 停止所有调度器
 */
export function stopSchedulers() {
    EvaluationPollingService.stop()
    AppointmentScheduler.stop()
    InterviewReminderScheduler.stop()
    JobExpirationScheduler.stop()
    logger.info('All schedulers stopped')
}

export default {
    startSchedulers,
    stopSchedulers,
    // 导出各调度器实例，便于手动触发或状态查询
    JobExpirationScheduler,
    AppointmentScheduler,
    InterviewReminderScheduler,
}
