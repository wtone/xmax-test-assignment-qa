/**
 * 通用提醒频控中间件
 * @module middlewares/reminder-rate-limit
 * @description 检查提醒发送次数和冷却间隔，防止过度骚扰
 * @requires loadApplication → ctx.state.application
 * @provides ctx.state.reminders
 */

import { sendError } from '../../utils/response.js'
import { ERROR_CODES } from '../constants/error_codes.js'

/**
 * @param {Object} options
 * @param {string} options.field - ctx.state.application 上的提醒记录字段名
 * @param {number} [options.maxCount=2] - 最大提醒次数
 * @param {number} [options.cooldownMs=86400000] - 冷却时间（毫秒），默认 24h
 */
export const reminderRateLimit = ({ field, maxCount = 2, cooldownMs = 24 * 60 * 60 * 1000 }) => {
    return async (ctx, next) => {
        const reminders = ctx.state.application[field] || []

        if (reminders.length >= maxCount) {
            return sendError(ctx, ERROR_CODES.REMINDER_LIMIT_EXCEEDED, `已达到提醒上限（最多${maxCount}次）`, 429)
        }

        const lastReminder = reminders[reminders.length - 1]
        if (lastReminder && Date.now() - new Date(lastReminder.sentAt).getTime() < cooldownMs) {
            return sendError(ctx, ERROR_CODES.REMINDER_COOLDOWN, '24小时内已发送过提醒，请稍后再试', 429)
        }

        ctx.state.reminders = reminders
        await next()
    }
}
