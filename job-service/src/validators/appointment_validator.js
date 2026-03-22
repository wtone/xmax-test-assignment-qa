/**
 * 面试预约验证规则
 * @module validators/appointment_validator
 */

import Joi from 'joi'
import { jobId, userId, applicationId, smartJobId } from './id_validators.js'
import { APPOINTMENT_STATUS_VALUES, APPOINTMENT_DEFAULTS } from '../constants/appointment_status.js'

/**
 * 预约 ID 验证器
 * 格式规则：appt_YYYYMMDD_xxxxxxxx
 */
export const appointmentId = () =>
    Joi.string()
        .pattern(/^appt_\d{8}_[a-fA-F0-9]{8}$/)
        .messages({
            'string.pattern.base': '无效的预约ID格式',
            'string.base': '预约ID必须是字符串',
            'string.empty': '预约ID不能为空',
            'any.required': '预约ID不能为空',
        })

/**
 * 时间段验证
 */
const timeSlotSchema = Joi.object({
    startTime: Joi.date().iso().required().messages({
        'date.base': '开始时间格式无效',
        'any.required': '开始时间不能为空',
    }),
    endTime: Joi.date().iso().greater(Joi.ref('startTime')).required().messages({
        'date.base': '结束时间格式无效',
        'date.greater': '结束时间必须大于开始时间',
        'any.required': '结束时间不能为空',
    }),
})

/**
 * 创建预约验证规则（B 端发起）
 */
export const createAppointmentSchema = Joi.object({
    candidateId: userId().required().messages({
        'any.required': '候选人ID不能为空',
    }),
    jobId: smartJobId().required().messages({
        'any.required': '职位ID不能为空',
    }),
    applicationId: applicationId().messages({
        'string.pattern.base': '无效的申请ID格式',
    }),
    proposedTimeSlots: Joi.array()
        .items(timeSlotSchema)
        .min(1)
        .max(APPOINTMENT_DEFAULTS.MAX_TIME_SLOTS)
        .required()
        .messages({
            'array.min': '至少需要提供一个时间段',
            'array.max': `最多只能提供${APPOINTMENT_DEFAULTS.MAX_TIME_SLOTS}个时间段`,
            'any.required': '时间段列表不能为空',
        }),
    duration: Joi.number().integer().min(15).max(180).default(APPOINTMENT_DEFAULTS.DEFAULT_DURATION_MINUTES).messages({
        'number.min': '面试时长至少为15分钟',
        'number.max': '面试时长不能超过180分钟',
    }),
    timezone: Joi.string().default('Asia/Shanghai').messages({
        'string.base': '时区必须是字符串',
    }),
    notes: Joi.string().max(2000).allow('').messages({
        'string.max': '备注不能超过2000个字符',
    }),
    payment: Joi.object({
        orderId: Joi.string().required().messages({
            'any.required': '订单ID不能为空',
            'string.base': '订单ID必须是字符串',
        }),
    }).optional(),
})

/**
 * 选择时间段验证规则（C 端）
 */
export const selectTimeSlotSchema = Joi.object({
    slotIndex: Joi.number().integer().min(0).required().messages({
        'number.base': '时间段索引必须是数字',
        'number.min': '时间段索引不能为负数',
        'any.required': '请选择一个时间段',
    }),
})

/**
 * 申请改期验证规则（C 端）
 */
export const requestRescheduleSchema = Joi.object({
    proposedSlots: Joi.array().items(timeSlotSchema).min(1).max(APPOINTMENT_DEFAULTS.MAX_TIME_SLOTS).required().messages({
        'array.min': '至少需要提供一个建议时间段',
        'array.max': `最多只能提供${APPOINTMENT_DEFAULTS.MAX_TIME_SLOTS}个建议时间段`,
        'any.required': '建议时间段列表不能为空',
    }),
    reason: Joi.string().max(500).required().messages({
        'string.max': '改期原因不能超过500个字符',
        'any.required': '请填写改期原因',
    }),
})

/**
 * B端选择改期时间验证规则（同意改期，选择C端提议的时间）
 */
export const selectRescheduleTimeSchema = Joi.object({
    slotIndex: Joi.number().integer().min(0).required().messages({
        'number.base': '时间段索引必须是数字',
        'number.min': '时间段索引不能为负数',
        'any.required': '请选择一个时间段',
    }),
    responseNote: Joi.string().max(500).allow('').messages({
        'string.max': '回复备注不能超过500个字符',
    }),
})

/**
 * B端响应改期验证规则（拒绝改期，提供新时间段进行循环协商）
 */
export const respondToRescheduleSchema = Joi.object({
    proposedSlots: Joi.array().items(timeSlotSchema).min(1).max(APPOINTMENT_DEFAULTS.MAX_TIME_SLOTS).required().messages({
        'array.min': '请提供至少一个新的时间段',
        'array.max': `最多只能提供${APPOINTMENT_DEFAULTS.MAX_TIME_SLOTS}个时间段`,
        'any.required': '请提供新的时间段',
    }),
    responseNote: Joi.string().max(500).allow('').messages({
        'string.max': '回复备注不能超过500个字符',
    }),
})

/**
 * 拒绝面试验证规则（C 端）
 */
export const rejectAppointmentSchema = Joi.object({
    reason: Joi.string().max(500).allow('').messages({
        'string.max': '拒绝原因不能超过500个字符',
    }),
})

/**
 * 取消预约验证规则
 */
export const cancelAppointmentSchema = Joi.object({
    reason: Joi.string().max(500).allow('').messages({
        'string.max': '取消原因不能超过500个字符',
    }),
})

/**
 * 完成面试验证规则（B 端）
 */
export const completeAppointmentSchema = Joi.object({
    feedback: Joi.string().max(2000).allow('').messages({
        'string.max': '反馈不能超过2000个字符',
    }),
})

/**
 * 标记缺席验证规则（B 端）
 */
export const markNoShowSchema = Joi.object({
    note: Joi.string().max(500).allow('').messages({
        'string.max': '备注不能超过500个字符',
    }),
})

/**
 * 获取预约列表查询参数验证规则
 */
export const getAppointmentsQuerySchema = Joi.object({
    jobId: smartJobId(),
    candidateId: userId(),
    interviewerId: userId(),
    status: Joi.alternatives().try(
        Joi.string()
            .valid(...APPOINTMENT_STATUS_VALUES)
            .messages({
                'any.only': '无效的预约状态',
            }),
        Joi.string().custom((value, helpers) => {
            const statuses = value.split(',').map(s => s.trim())
            for (const status of statuses) {
                if (!APPOINTMENT_STATUS_VALUES.includes(status)) {
                    return helpers.error('any.invalid', { status })
                }
            }
            return statuses
        }, 'multiple status validation'),
    ),
    dateFrom: Joi.date().iso().messages({
        'date.base': '开始日期格式无效',
    }),
    dateTo: Joi.date().iso().greater(Joi.ref('dateFrom')).messages({
        'date.base': '结束日期格式无效',
        'date.greater': '结束日期必须大于开始日期',
    }),
    page: Joi.number().integer().min(1).default(1),
    pageSize: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().valid('createdAt', 'updatedAt', 'meeting.scheduledStartTime').default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
})

/**
 * 预约 ID 参数验证规则
 */
export const appointmentIdParamSchema = Joi.object({
    appointmentId: appointmentId().required(),
})

/**
 * 邀请 Token 参数验证规则
 */
export const inviteTokenParamSchema = Joi.object({
    token: Joi.string().length(64).hex().required().messages({
        'string.length': '无效的邀请链接',
        'string.hex': '无效的邀请链接',
        'any.required': '邀请链接不能为空',
    }),
})

/**
 * 获取面试官日程查询参数验证规则
 */
export const getScheduleQuerySchema = Joi.object({
    startDate: Joi.date().iso().required().messages({
        'date.base': '开始日期格式无效',
        'any.required': '开始日期不能为空',
    }),
    endDate: Joi.date().iso().greater(Joi.ref('startDate')).required().messages({
        'date.base': '结束日期格式无效',
        'date.greater': '结束日期必须大于开始日期',
        'any.required': '结束日期不能为空',
    }),
})

/**
 * C 端获取预约列表查询参数验证规则
 */
export const getCandidateAppointmentsQuerySchema = Joi.object({
    status: Joi.alternatives().try(
        Joi.string()
            .valid(...APPOINTMENT_STATUS_VALUES)
            .messages({
                'any.only': '无效的预约状态',
            }),
        Joi.string().custom((value, helpers) => {
            const statuses = value.split(',').map(s => s.trim())
            for (const status of statuses) {
                if (!APPOINTMENT_STATUS_VALUES.includes(status)) {
                    return helpers.error('any.invalid', { status })
                }
            }
            return statuses
        }, 'multiple status validation'),
    ),
    page: Joi.number().integer().min(1).default(1),
    pageSize: Joi.number().integer().min(1).max(100).default(20),
    sortBy: Joi.string().valid('createdAt', 'updatedAt', 'meeting.scheduledStartTime').default('createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
})

export default {
    appointmentId,
    createAppointmentSchema,
    selectTimeSlotSchema,
    requestRescheduleSchema,
    respondToRescheduleSchema,
    rejectAppointmentSchema,
    cancelAppointmentSchema,
    completeAppointmentSchema,
    markNoShowSchema,
    getAppointmentsQuerySchema,
    getCandidateAppointmentsQuerySchema,
    appointmentIdParamSchema,
    inviteTokenParamSchema,
    getScheduleQuerySchema,
}
