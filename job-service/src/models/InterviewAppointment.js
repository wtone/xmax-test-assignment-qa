import mongoose from 'mongoose'
import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'
import { APPOINTMENT_STATUS, APPOINTMENT_STATUS_VALUES, RESCHEDULE_STATUS, APPOINTMENT_DEFAULTS, getNextPossibleStatuses, APPOINTMENT_STATUS_NAMES, REQUESTER_TYPE } from '../constants/appointment_status.js'

const { Schema } = mongoose

// 时间段 Schema
const timeSlotSchema = new Schema(
    {
        startTime: {
            type: Date,
            required: true,
        },
        endTime: {
            type: Date,
            required: true,
        },
        isSelected: {
            type: Boolean,
            default: false,
        },
    },
    { _id: false },
)

// veRTC 会议信息 Schema
const meetingSchema = new Schema(
    {
        appId: {
            type: String,
            trim: true,
        },
        roomId: {
            type: String,
            trim: true,
        },
        joinUrl: {
            type: String,
            trim: true,
        },
        bToken: {
            type: String,
            trim: true,
        },
        cToken: {
            type: String,
            trim: true,
        },
        scheduledStartTime: Date,
        scheduledEndTime: Date,
        actualStartTime: Date,
        actualEndTime: Date,
    },
    { _id: false },
)

// 改期历史 Schema
const rescheduleHistorySchema = new Schema(
    {
        requestedBy: {
            type: String,
            enum: ['B', 'C'],
            required: true,
        },
        requestedAt: {
            type: Date,
            default: Date.now,
        },
        proposedSlots: [timeSlotSchema],
        status: {
            type: String,
            enum: Object.values(RESCHEDULE_STATUS),
            default: RESCHEDULE_STATUS.PENDING,
        },
        respondedAt: Date,
        reason: {
            type: String,
            maxlength: 500,
        },
        responseNote: {
            type: String,
            maxlength: 500,
        },
    },
    { _id: false },
)

// 状态历史 Schema
const statusHistorySchema = new Schema(
    {
        status: {
            type: String,
            required: true,
        },
        timestamp: {
            type: Date,
            default: Date.now,
        },
        operator: {
            type: Schema.Types.Mixed,
        },
        note: {
            type: String,
            maxlength: 500,
        },
    },
    { _id: false },
)

// 支付信息 Schema
const paymentSchema = new Schema(
    {
        amount: {
            type: Number,
            default: 0,
            min: 0,
        },
        currency: {
            type: String,
            default: 'CNY',
            trim: true,
        },
        status: {
            type: String,
            enum: ['UNPAID', 'FROZEN', 'CHARGED', 'REFUNDED', 'FAILED'],
            default: 'UNPAID',
        },
        orderId: {
            type: String,
            default: null, // payment-service 订单ID
        },
        channel: {
            type: String,
            default: null, // 支付渠道 (balance_points, wechat, alipay...)
        },
        transactionId: {
            type: String,
            default: null, // 交易记录ID
        },
        frozenAt: {
            type: Date,
            default: null,
        },
        chargedAt: {
            type: Date,
            default: null,
        },
        refundedAt: {
            type: Date,
            default: null,
        },
        refundAmount: {
            type: Number,
            default: null,
        },
        refundReason: {
            type: String,
            maxlength: 500,
            default: null,
        },
        failReason: {
            type: String,
            maxlength: 500,
            default: null,
        },
    },
    { _id: false },
)

// 面试预约模型
const interviewAppointmentSchema = new Schema(
    {
        // 业务标识
        appointmentId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },

        // 关联信息
        candidateId: {
            type: String, // 支持 UUID 格式
            required: true,
            index: true,
        },
        jobId: {
            type: Schema.Types.ObjectId,
            ref: 'JobPost',
            required: true,
            index: true,
        },
        applicationId: {
            type: String, // 关联申请 ID
            index: true,
        },
        companyId: {
            type: String, // 支持 UUID 格式
            required: true,
            index: true,
        },
        interviewerId: {
            type: String, // 面试官 ID
            required: true,
            index: true,
        },

        // 时间相关
        proposedTimeSlots: {
            type: [timeSlotSchema],
            validate: {
                validator: function (slots) {
                    return slots.length > 0 && slots.length <= APPOINTMENT_DEFAULTS.MAX_TIME_SLOTS
                },
                message: `时间段数量必须在 1-${APPOINTMENT_DEFAULTS.MAX_TIME_SLOTS} 之间`,
            },
        },
        selectedTimeSlot: timeSlotSchema,
        duration: {
            type: Number, // 分钟
            default: APPOINTMENT_DEFAULTS.DEFAULT_DURATION_MINUTES,
            min: 15,
            max: 180,
        },
        timezone: {
            type: String,
            default: 'Asia/Shanghai',
            trim: true,
        },

        // 状态
        status: {
            type: String,
            required: true,
            enum: APPOINTMENT_STATUS_VALUES,
            default: APPOINTMENT_STATUS.INITIATED,
            index: true,
        },

        // veRTC 会议信息
        meeting: meetingSchema,

        // 改期记录
        rescheduleHistory: [rescheduleHistorySchema],

        // 状态历史
        statusHistory: [statusHistorySchema],

        // 邀请链接
        inviteToken: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },
        inviteExpireAt: {
            type: Date,
            required: true,
            index: true,
        },

        // 附加信息
        notes: {
            type: String,
            maxlength: 2000,
        },
        feedback: {
            type: String,
            maxlength: 2000,
        },
        rejectionReason: {
            type: String,
            maxlength: 500,
        },
        cancellationReason: {
            type: String,
            maxlength: 500,
        },
        cancelledBy: {
            type: String,
            enum: ['B', 'C', 'system'],
        },
        rejectedBy: {
            type: String,
            enum: ['B', 'C'], // B端拒绝改期 / C端拒绝邀请
        },
        expiredBy: {
            type: String,
            enum: ['B', 'C'], // B端超时未审批 / C端超时未响应
        },

        // 通知发送状态追踪
        expirationWarningNotified: {
            type: Boolean,
            default: false, // 是否已发送即将超时提醒（情况1）
        },
        twentyFourHourReminderSent: {
            type: Boolean,
            default: false, // 是否已发送24小时前提醒
        },
        thirtyMinuteReminderSent: {
            type: Boolean,
            default: false, // 是否已发送30分钟前提醒
        },
        startReminderSent: {
            type: Boolean,
            default: false, // 是否已发送开始提醒（仅通知未进入房间方）
        },

        // 候选人信息缓存（用于通知展示）
        candidateInfo: {
            name: String,
            email: String,
            phone: String,
        },

        // 面试官信息缓存
        interviewerInfo: {
            name: String,
            email: String,
            title: String,
        },

        // 职位信息快照（仅用于通知展示，前端请使用关联查询的 job 字段）
        _jobSnapshot: {
            title: String,
            companyName: String,
        },

        // 支付信息（B端预约面试时的预付费）
        payment: paymentSchema,
    },
    {
        timestamps: true,
        collection: 'interview_appointments',
    },
)

// 虚拟字段：是否已过期
interviewAppointmentSchema.virtual('isExpired').get(function () {
    if (this.status === APPOINTMENT_STATUS.EXPIRED) return true
    if (this.status === APPOINTMENT_STATUS.INITIATED && new Date() > this.inviteExpireAt) return true
    // B端超时未审批改期：最后一条改期申请的 requestedAt 超过 7 天
    if (this.status === APPOINTMENT_STATUS.RESCHEDULE_REQUESTED) {
        const lastReschedule = this.rescheduleHistory?.[this.rescheduleHistory.length - 1]
        if (lastReschedule) {
            const expireDate = new Date(lastReschedule.requestedAt)
            expireDate.setDate(expireDate.getDate() + APPOINTMENT_DEFAULTS.INVITE_EXPIRE_DAYS)
            return new Date() > expireDate
        }
    }
    return false
})

// 虚拟字段：是否可以加入会议
interviewAppointmentSchema.virtual('canJoin').get(function () {
    if (this.status !== APPOINTMENT_STATUS.SCHEDULE_CONFIRMED) return false
    if (!this.meeting || !this.meeting.roomId) return false
    return true
})

// 虚拟字段：状态中文名称
interviewAppointmentSchema.virtual('statusText').get(function () {
    return APPOINTMENT_STATUS_NAMES[this.status] || this.status
})

// 虚拟字段：待处理的改期申请
interviewAppointmentSchema.virtual('pendingReschedule').get(function () {
    if (!this.rescheduleHistory || this.rescheduleHistory.length === 0) return null
    const pending = this.rescheduleHistory.find(r => r.status === RESCHEDULE_STATUS.PENDING)
    return pending || null
})

// 虚拟字段：职位快照（兼容新旧字段名）
// 新字段名为 _jobSnapshot，旧数据库文档使用 jobInfo
interviewAppointmentSchema.virtual('jobSnapshot').get(function () {
    // 优先使用新字段，回退到旧字段（通过 _doc 访问原始数据）
    return this._jobSnapshot || this._doc?.jobInfo || null
})

// 索引定义
interviewAppointmentSchema.index({ companyId: 1, status: 1, createdAt: -1 })
interviewAppointmentSchema.index({ candidateId: 1, status: 1, createdAt: -1 })
interviewAppointmentSchema.index({ jobId: 1, status: 1 })
interviewAppointmentSchema.index({ interviewerId: 1, 'meeting.scheduledStartTime': 1 })
interviewAppointmentSchema.index({ inviteExpireAt: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { status: APPOINTMENT_STATUS.INITIATED } })

// 中间件：生成 appointmentId 和 inviteToken
interviewAppointmentSchema.pre('validate', async function (next) {
    if (this.isNew) {
        if (!this.appointmentId) {
            const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
            const sequence = uuidv4().slice(0, 8)
            this.appointmentId = `appt_${date}_${sequence}`
        }
        if (!this.inviteToken) {
            this.inviteToken = crypto.randomBytes(32).toString('hex')
        }
        if (!this.inviteExpireAt) {
            const expireDate = new Date()
            expireDate.setDate(expireDate.getDate() + APPOINTMENT_DEFAULTS.INVITE_EXPIRE_DAYS)
            this.inviteExpireAt = expireDate
        }
    }
    next()
})

// 中间件：记录状态变更
interviewAppointmentSchema.pre('save', function (next) {
    if (this.isModified('status')) {
        const lastStatus = this.statusHistory.length > 0 ? this.statusHistory[this.statusHistory.length - 1].status : null

        if (lastStatus !== this.status) {
            this.statusHistory.push({
                status: this.status,
                timestamp: new Date(),
                operator: 'system',
                note: lastStatus ? `状态变更: ${lastStatus} → ${this.status}` : `初始状态: ${this.status}`,
            })
        }
    }
    next()
})

// 实例方法：更新状态
interviewAppointmentSchema.methods.updateStatus = async function (newStatus, operator, note) {
    const { default: logger } = await import('../../utils/logger.js')

    const oldStatus = this.status
    const possibleStatuses = getNextPossibleStatuses(oldStatus)

    if (!possibleStatuses.includes(newStatus)) {
        const error = new Error(`Invalid status transition from ${oldStatus} to ${newStatus}`)
        logger.error('[InterviewAppointment] Invalid status transition', {
            appointmentId: this.appointmentId,
            currentStatus: oldStatus,
            attemptedStatus: newStatus,
            validStatuses: possibleStatuses,
        })
        throw error
    }

    logger.info('[InterviewAppointment] Status transition', {
        appointmentId: this.appointmentId,
        from: oldStatus,
        fromName: APPOINTMENT_STATUS_NAMES[oldStatus],
        to: newStatus,
        toName: APPOINTMENT_STATUS_NAMES[newStatus],
        operator: operator || 'system',
        note,
    })

    this.status = newStatus

    const lastHistory = this.statusHistory[this.statusHistory.length - 1]
    if (lastHistory && lastHistory.status === newStatus) {
        if (operator) lastHistory.operator = operator
        if (note) lastHistory.note = note
    }

    try {
        const result = await this.save()
        logger.info('[InterviewAppointment] Save successful', {
            appointmentId: this.appointmentId,
            newStatus: this.status,
        })
        return result
    } catch (saveError) {
        logger.error('[InterviewAppointment] Save failed', {
            appointmentId: this.appointmentId,
            attemptedStatus: this.status,
            errorMessage: saveError.message,
            errorName: saveError.name,
            errorCode: saveError.code,
            validationErrors: saveError.errors
                ? Object.keys(saveError.errors).map((key) => ({
                      field: key,
                      message: saveError.errors[key].message,
                      kind: saveError.errors[key].kind,
                  }))
                : undefined,
            isVersionError: saveError.name === 'VersionError',
            documentVersion: this.__v,
        })
        throw saveError
    }
}

// 实例方法：候选人选择时间段
interviewAppointmentSchema.methods.selectTimeSlot = async function (slotIndex, operator) {
    const { default: logger } = await import('../../utils/logger.js')

    if (this.status !== APPOINTMENT_STATUS.INITIATED) {
        throw new Error('只有在已发起状态下才能选择时间')
    }

    if (slotIndex < 0 || slotIndex >= this.proposedTimeSlots.length) {
        throw new Error('无效的时间段索引')
    }

    const selectedSlot = this.proposedTimeSlots[slotIndex]
    this.selectedTimeSlot = {
        startTime: selectedSlot.startTime,
        endTime: selectedSlot.endTime,
        isSelected: true,
    }

    // 标记已选择的时间段
    this.proposedTimeSlots[slotIndex].isSelected = true

    logger.info('[InterviewAppointment] Time slot selected', {
        appointmentId: this.appointmentId,
        selectedSlot: this.selectedTimeSlot,
        operator,
    })

    return this.updateStatus(APPOINTMENT_STATUS.SCHEDULE_CONFIRMED, operator, '候选人已确认时间')
}

// 实例方法：申请改期
interviewAppointmentSchema.methods.requestReschedule = async function (proposedSlots, reason, requestedBy) {
    const { default: logger } = await import('../../utils/logger.js')

    if (this.status !== APPOINTMENT_STATUS.INITIATED && this.status !== APPOINTMENT_STATUS.SCHEDULE_CONFIRMED) {
        throw new Error('当前状态不允许申请改期')
    }

    this.rescheduleHistory.push({
        requestedBy,
        requestedAt: new Date(),
        proposedSlots,
        status: RESCHEDULE_STATUS.PENDING,
        reason,
    })

    logger.info('[InterviewAppointment] Reschedule requested', {
        appointmentId: this.appointmentId,
        requestedBy,
        reason,
        proposedSlotsCount: proposedSlots.length,
    })

    return this.updateStatus(APPOINTMENT_STATUS.RESCHEDULE_REQUESTED, requestedBy, `${requestedBy === 'C' ? '候选人' : '企业'}申请改期`)
}

// 实例方法：审批改期申请
interviewAppointmentSchema.methods.respondToReschedule = async function (approved, responseNote, operator, newTimeSlots, selectedSlotIndex = 0) {
    const { default: logger } = await import('../../utils/logger.js')

    if (this.status !== APPOINTMENT_STATUS.RESCHEDULE_REQUESTED) {
        throw new Error('当前状态没有待审批的改期申请')
    }

    const pendingIndex = this.rescheduleHistory.findIndex(r => r.status === RESCHEDULE_STATUS.PENDING)
    if (pendingIndex === -1) {
        throw new Error('未找到待审批的改期申请')
    }

    this.rescheduleHistory[pendingIndex].status = approved ? RESCHEDULE_STATUS.APPROVED : RESCHEDULE_STATUS.REJECTED
    this.rescheduleHistory[pendingIndex].respondedAt = new Date()
    this.rescheduleHistory[pendingIndex].responseNote = responseNote

    logger.info('[InterviewAppointment] Reschedule response', {
        appointmentId: this.appointmentId,
        approved,
        responseNote,
        operator,
        selectedSlotIndex,
    })

    if (approved) {
        // 使用 B 端选择的时间段
        const approvedSlots = this.rescheduleHistory[pendingIndex].proposedSlots
        if (approvedSlots && approvedSlots.length > 0) {
            // 验证索引有效性
            if (selectedSlotIndex < 0 || selectedSlotIndex >= approvedSlots.length) {
                throw new Error(`无效的时间段索引: ${selectedSlotIndex}，有效范围: 0-${approvedSlots.length - 1}`)
            }
            const selectedSlot = approvedSlots[selectedSlotIndex]
            this.selectedTimeSlot = {
                startTime: selectedSlot.startTime,
                endTime: selectedSlot.endTime,
                isSelected: true,
            }
        }
        return this.updateStatus(APPOINTMENT_STATUS.SCHEDULE_CONFIRMED, operator, '改期申请已同意')
    } else {
        // 拒绝改期，返回到已发起状态，更新可选时间段（B 端提供新时间供 C 端选择）
        if (newTimeSlots && newTimeSlots.length > 0) {
            this.proposedTimeSlots = newTimeSlots
        }
        return this.updateStatus(APPOINTMENT_STATUS.INITIATED, operator, '改期申请已拒绝，B端提供新时间段')
    }
}

// 实例方法：B端主动发起改期（从 SCHEDULE_CONFIRMED 状态）
interviewAppointmentSchema.methods.initiateRescheduleByB = async function (proposedSlots, note) {
    const { default: logger } = await import('../../utils/logger.js')

    if (this.status !== APPOINTMENT_STATUS.SCHEDULE_CONFIRMED) {
        throw new Error('只有在已确认状态下才能由B端主动改期')
    }

    // 更新可选时间段
    this.proposedTimeSlots = proposedSlots

    // 记录到改期历史（B端发起即生效，状态为 APPROVED）
    this.rescheduleHistory.push({
        requestedBy: 'B',
        requestedAt: new Date(),
        respondedAt: new Date(), // B端发起即响应
        proposedSlots,
        status: RESCHEDULE_STATUS.APPROVED, // B端主动发起，直接生效
        reason: note || 'B端主动发起改期',
    })

    logger.info('[InterviewAppointment] B initiated reschedule from confirmed', {
        appointmentId: this.appointmentId,
        proposedSlotsCount: proposedSlots.length,
    })

    // B端改期直接流转到 INITIATED，等待 C端选择时间
    return this.updateStatus(APPOINTMENT_STATUS.INITIATED, 'B', 'B端主动发起改期')
}

// 实例方法：拒绝面试邀请
interviewAppointmentSchema.methods.reject = async function (reason, rejectedBy, operator) {
    const { default: logger } = await import('../../utils/logger.js')

    if (this.status !== APPOINTMENT_STATUS.INITIATED) {
        throw new Error('只有在已发起状态下才能拒绝')
    }

    this.rejectionReason = reason
    this.rejectedBy = rejectedBy

    const rejectorText = rejectedBy === REQUESTER_TYPE.C_SIDE ? '候选人' : '企业'

    logger.info('[InterviewAppointment] Appointment rejected', {
        appointmentId: this.appointmentId,
        reason,
        rejectedBy,
        operator,
    })

    return this.updateStatus(APPOINTMENT_STATUS.REJECTED, operator, `${rejectorText}拒绝: ${reason || '无原因'}`)
}

// 实例方法：取消预约
interviewAppointmentSchema.methods.cancel = async function (reason, cancelledBy) {
    const { default: logger } = await import('../../utils/logger.js')

    const cancellableStatuses = [APPOINTMENT_STATUS.INITIATED, APPOINTMENT_STATUS.RESCHEDULE_REQUESTED, APPOINTMENT_STATUS.SCHEDULE_CONFIRMED]
    if (!cancellableStatuses.includes(this.status)) {
        throw new Error('当前状态不允许取消')
    }

    this.cancellationReason = reason
    this.cancelledBy = cancelledBy

    logger.info('[InterviewAppointment] Appointment cancelled', {
        appointmentId: this.appointmentId,
        reason,
        cancelledBy,
    })

    return this.updateStatus(APPOINTMENT_STATUS.CANCELLED, cancelledBy, `${cancelledBy === 'C' ? '候选人' : '企业'}取消: ${reason || '无原因'}`)
}

// 实例方法：标记完成
interviewAppointmentSchema.methods.complete = async function (feedback, operator) {
    const { default: logger } = await import('../../utils/logger.js')

    if (this.status !== APPOINTMENT_STATUS.SCHEDULE_CONFIRMED) {
        throw new Error('只有在已确认状态下才能标记完成')
    }

    if (feedback) {
        this.feedback = feedback
    }

    if (this.meeting) {
        this.meeting.actualEndTime = new Date()
    }

    logger.info('[InterviewAppointment] Appointment completed', {
        appointmentId: this.appointmentId,
        operator,
    })

    return this.updateStatus(APPOINTMENT_STATUS.COMPLETED, operator, '面试已完成')
}

// 实例方法：标记缺席
interviewAppointmentSchema.methods.markNoShow = async function (note, operator) {
    const { default: logger } = await import('../../utils/logger.js')

    if (this.status !== APPOINTMENT_STATUS.SCHEDULE_CONFIRMED) {
        throw new Error('只有在已确认状态下才能标记缺席')
    }

    logger.info('[InterviewAppointment] Appointment marked as no-show', {
        appointmentId: this.appointmentId,
        note,
        operator,
    })

    return this.updateStatus(APPOINTMENT_STATUS.NO_SHOW, operator, note || '参会方缺席')
}

// 实例方法：设置会议信息
interviewAppointmentSchema.methods.setMeetingInfo = async function (meetingInfo) {
    this.meeting = {
        ...this.meeting,
        ...meetingInfo,
        scheduledStartTime: this.selectedTimeSlot?.startTime,
        scheduledEndTime: this.selectedTimeSlot?.endTime,
    }
    return this.save()
}

// 静态方法：查找已过期的预约（C端超时未响应）
interviewAppointmentSchema.statics.findExpiredAppointments = async function () {
    return this.find({
        status: APPOINTMENT_STATUS.INITIATED,
        inviteExpireAt: { $lt: new Date() },
    })
}

// 静态方法：查找即将过期的预约（还剩1天，用于提前提醒 - 情况1）
interviewAppointmentSchema.statics.findUpcomingExpirationAppointments = async function () {
    const now = new Date()
    const oneDayLater = new Date(now.getTime() + 24 * 60 * 60 * 1000)

    // 查找：状态为 INITIATED，过期时间在 now 到 24小时后之间，且未发送过提醒
    const initiatedAppointments = await this.find({
        status: APPOINTMENT_STATUS.INITIATED,
        inviteExpireAt: { $gt: now, $lte: oneDayLater },
        expirationWarningNotified: { $ne: true },
    })

    // 查找：状态为 RESCHEDULE_REQUESTED，创建时间在 6-7 天前，且未发送过提醒
    const sixDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000)
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const rescheduleAppointments = await this.find({
        status: APPOINTMENT_STATUS.RESCHEDULE_REQUESTED,
        expirationWarningNotified: { $ne: true },
    })

    // 过滤出最后一个改期申请在 6-7 天前的
    const filteredReschedule = rescheduleAppointments.filter(appointment => {
        const lastReschedule = appointment.rescheduleHistory?.[appointment.rescheduleHistory.length - 1]
        if (!lastReschedule) return false
        const requestedAt = new Date(lastReschedule.requestedAt)
        return requestedAt < sixDaysAgo && requestedAt > sevenDaysAgo
    })

    return [...initiatedAppointments, ...filteredReschedule]
}

// 静态方法：查找需要24小时提醒的面试（23h58min ~ 24h 窗口）
interviewAppointmentSchema.statics.findInterviewsFor24HourReminder = async function () {
    const now = new Date()
    const windowStart = new Date(now.getTime() + (24 * 60 - 2) * 60 * 1000) // 23h58min后
    const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24h后

    return this.find({
        status: APPOINTMENT_STATUS.SCHEDULE_CONFIRMED,
        'selectedTimeSlot.startTime': {
            $gt: windowStart,
            $lte: windowEnd,
        },
        twentyFourHourReminderSent: { $ne: true },
    })
}

// 静态方法：查找即将开始的面试（28min ~ 30min 窗口）
interviewAppointmentSchema.statics.findUpcomingInterviews = async function (minutesBefore = 30, windowMinutes = 2) {
    const now = new Date()
    const windowStart = new Date(now.getTime() + (minutesBefore - windowMinutes) * 60 * 1000) // 28min后
    const windowEnd = new Date(now.getTime() + minutesBefore * 60 * 1000) // 30min后

    return this.find({
        status: APPOINTMENT_STATUS.SCHEDULE_CONFIRMED,
        'selectedTimeSlot.startTime': {
            $gt: windowStart,
            $lte: windowEnd,
        },
        thirtyMinuteReminderSent: { $ne: true },
    })
}

// 静态方法：查找正在开始的面试（开始时间在过去2分钟内，增加容错）
interviewAppointmentSchema.statics.findStartingInterviews = async function () {
    const now = new Date()
    const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000)

    return this.find({
        status: APPOINTMENT_STATUS.SCHEDULE_CONFIRMED,
        'selectedTimeSlot.startTime': {
            $gte: twoMinutesAgo,
            $lte: now,
        },
        startReminderSent: { $ne: true },
    })
}

// 静态方法：查找B端超时未审批的改期申请
interviewAppointmentSchema.statics.findExpiredRescheduleRequests = async function (expireDays = 7) {
    const expireDate = new Date()
    expireDate.setDate(expireDate.getDate() - expireDays)

    // 查找状态为 RESCHEDULE_REQUESTED 且最后一个改期申请超过 expireDays 天的预约
    const appointments = await this.find({
        status: APPOINTMENT_STATUS.RESCHEDULE_REQUESTED,
    })

    // 过滤出超时的预约
    return appointments.filter(appointment => {
        const lastReschedule = appointment.rescheduleHistory?.[appointment.rescheduleHistory.length - 1]
        if (!lastReschedule) return false
        return new Date(lastReschedule.requestedAt) < expireDate
    })
}

// 静态方法：按企业统计
interviewAppointmentSchema.statics.countByCompany = async function (companyId) {
    return this.aggregate([
        { $match: { companyId } },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
            },
        },
    ])
}

// 静态方法：按候选人统计
interviewAppointmentSchema.statics.countByCandidate = async function (candidateId) {
    return this.aggregate([
        { $match: { candidateId } },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
            },
        },
    ])
}

// 静态方法：获取面试官日程
interviewAppointmentSchema.statics.getInterviewerSchedule = async function (interviewerId, startDate, endDate) {
    return this.find({
        interviewerId,
        status: APPOINTMENT_STATUS.SCHEDULE_CONFIRMED,
        'meeting.scheduledStartTime': {
            $gte: startDate,
            $lte: endDate,
        },
    })
        .select('appointmentId candidateInfo jobId jobInfo _jobSnapshot meeting')
        .sort({ 'meeting.scheduledStartTime': 1 })
}

// 静态方法：根据邀请 token 查找
interviewAppointmentSchema.statics.findByInviteToken = async function (token) {
    return this.findOne({ inviteToken: token })
}

/**
 * 静态方法：查找已扣费超过指定时间且未完成的面试预约
 * 用于自动完成调度器：C端进入面试并扣费后，超时自动流转到 COMPLETED 状态
 * @param {number} delayMs - 扣费后延迟时间（毫秒），默认 2 小时
 * @returns {Promise<Array>} 符合条件的预约列表
 */
interviewAppointmentSchema.statics.findChargedAppointmentsForAutoComplete = async function (
    delayMs = 2 * 60 * 60 * 1000,
) {
    const cutoffTime = new Date(Date.now() - delayMs)

    return this.find({
        status: APPOINTMENT_STATUS.SCHEDULE_CONFIRMED,
        'payment.status': 'CHARGED',
        'payment.chargedAt': {
            $ne: null,
            $lt: cutoffTime,
        },
    })
}

/**
 * 静态方法：查找面试时间已过但C端未进入的预约（用于自动标记缺席）
 * 条件：状态=已确认，面试结束时间+宽限时间<当前时间，未扣费
 * @param {number} delayMs - 面试结束后延迟时间（毫秒），默认 2 小时
 * @returns {Promise<Array>} 符合条件的预约列表
 */
interviewAppointmentSchema.statics.findNoShowAppointments = async function (delayMs = 2 * 60 * 60 * 1000) {
    const cutoffTime = new Date(Date.now() - delayMs)

    return this.find({
        status: APPOINTMENT_STATUS.SCHEDULE_CONFIRMED,
        'meeting.scheduledEndTime': { $lt: cutoffTime },
        $or: [{ payment: null }, { 'payment.status': { $ne: 'CHARGED' } }],
    })
}

// toJSON 转换
interviewAppointmentSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        delete ret._id
        delete ret.__v
        // 隐藏敏感信息
        delete ret.inviteToken
        delete ret.meeting?.bToken
        delete ret.meeting?.cToken
        // 移除内部字段，前端应使用关联查询的 job 字段
        delete ret.jobInfo // 旧字段（数据库历史数据）
        delete ret._jobSnapshot // 新字段（内部通知用）
        return ret
    },
})

const InterviewAppointment = mongoose.model('InterviewAppointment', interviewAppointmentSchema)

export default InterviewAppointment
