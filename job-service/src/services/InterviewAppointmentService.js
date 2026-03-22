/**
 * 面试预约服务
 * @module services/InterviewAppointmentService
 */

import InterviewAppointment from '../models/InterviewAppointment.js'
import JobPost from '../models/JobPost.js'
import JobApplication from '../models/JobApplication.js'
import UserCenterService from './integration/UserCenterService.js'
import NotificationService from './integration/NotificationService.js'
import JobNotificationService from './NotificationService.js'
import ResumeService from './integration/ResumeService.js'
import VerTCService from './integration/VerTCService.js'
import { getCandidateInfo } from './helpers/CandidateHelper.js'
import { AppError } from '../../utils/response.js'
import { ERROR_CODES } from '../constants/error_codes.js'
import { APPOINTMENT_STATUS, APPOINTMENT_STATUS_VALUES, APPOINTMENT_DEFAULTS, REQUESTER_TYPE, canCandidateRespond, canApproveReschedule, canCandidateRequestReschedule, canBSideReschedule, canCancelAppointment, getApplicationStatusFromAppointment } from '../constants/appointment_status.js'
import { APPLICATION_STATUS } from '../constants/application_status.js'
import logger from '../../utils/logger.js'
import { findBySmartId, findBySmartIdOrThrow } from '../utils/dbQueryHelper.js'
import { renderEmailTemplate } from '../libs/templates/emailTemplates.js'
import { EMAIL_TYPES } from '../libs/templates/constants.js'
import { formatInterviewTime } from '../../utils/helpers.js'
import PaymentService from './integration/PaymentService.js'
import JobCollaboratorService from './JobCollaboratorService.js'
import { PAYMENT_STATUS, ORDER_STATUS, REFUND_REASON, REFUND_REASON_DESCRIPTIONS, canCharge, canRefund, hasPayment } from '../constants/payment_status.js'

// 邮件发送模式：false=同步，true=异步（需要 notification-service 启动队列消费者）
const EMAIL_ASYNC_MODE = process.env.EMAIL_ASYNC_MODE === 'true'

const _resolveCandidate = info => {
    const name = info?.name?.trim()
    return (name && name !== 'Unknown') ? name : (info?.email || '未知')
}

// 角色常量：B端（面试官/企业）和 C端（候选人）
const ROLE_B = 'b'
const ROLE_C = 'c'

class InterviewAppointmentService {
    /**
     * 创建面试预约（B 端发起）
     * @param {Object} data - 预约数据
     * @param {string} data.candidateId - 候选人 ID
     * @param {string} data.jobId - 职位 ID
     * @param {string} data.applicationId - 申请 ID（可选）
     * @param {string} data.companyId - 企业 ID
     * @param {string} data.interviewerId - 面试官 ID
     * @param {Array} data.proposedTimeSlots - 建议的时间段列表
     * @param {number} data.duration - 面试时长（分钟）
     * @param {string} data.timezone - 时区
     * @param {string} data.notes - 备注
     * @param {Object} data.payment - 支付信息（可选）
     * @param {string} data.payment.orderId - payment-service 返回的订单ID
     * @param {number} data.payment.amount - 冻结金额
     * @returns {Promise<Object>} 创建的预约
     */
    async createAppointment(data) {
        const { candidateId, jobId, applicationId, companyId, interviewerId, proposedTimeSlots, duration, timezone, notes, payment } = data

        // 验证职位存在
        const jobPost = await findBySmartId(JobPost, jobId)
        if (!jobPost) {
            throw new AppError('Job not found', ERROR_CODES.NOT_FOUND)
        }

        // 验证时间段
        if (!proposedTimeSlots || proposedTimeSlots.length === 0) {
            throw new AppError('At least one time slot is required', ERROR_CODES.INVALID_PARAMS)
        }

        if (proposedTimeSlots.length > APPOINTMENT_DEFAULTS.MAX_TIME_SLOTS) {
            throw new AppError(`Maximum ${APPOINTMENT_DEFAULTS.MAX_TIME_SLOTS} time slots allowed`, ERROR_CODES.INVALID_PARAMS)
        }

        // 验证所有时间段都是未来时间
        const now = new Date()
        for (const slot of proposedTimeSlots) {
            if (new Date(slot.startTime) <= now) {
                throw new AppError('All time slots must be in the future', ERROR_CODES.INVALID_PARAMS)
            }
            if (new Date(slot.endTime) <= new Date(slot.startTime)) {
                throw new AppError('End time must be after start time', ERROR_CODES.INVALID_PARAMS)
            }
        }

        // 获取候选人信息（使用 CandidateHelper 统一逻辑）
        let resumeId = null
        if (applicationId) {
            try {
                const application = await findBySmartId(JobApplication, applicationId)
                resumeId = application?.resumeId
            } catch (error) {
                logger.warn('[InterviewAppointmentService] Failed to get application for resumeId', {
                    applicationId,
                    error: error.message,
                })
            }
        }
        const candidateInfo = await getCandidateInfo(candidateId, { resumeId, applicationId })

        // 获取面试官信息
        let interviewerInfo = {}
        try {
            const profile = await UserCenterService.getUserProfile(interviewerId)
            if (profile) {
                interviewerInfo = {
                    name: profile.name || 'Unknown',
                    email: profile.email,
                    title: profile.title,
                }
            }
        } catch (error) {
            logger.warn('[InterviewAppointmentService] Failed to get interviewer info', {
                interviewerId,
                error: error.message,
            })
        }

        // 构建支付信息（如果前端传递了订单信息）
        let paymentInfo = undefined
        if (payment && payment.orderId) {
            // 从 payment-service 获取订单详情（验证 orderId 有效性并获取金额）
            const orderInfo = await PaymentService.getOrderInfo(payment.orderId, interviewerId)
            if (orderInfo.status !== ORDER_STATUS.PAID) {
                throw new AppError('订单状态无效，无法创建预约', ERROR_CODES.INVALID_PARAMS)
            }
            paymentInfo = {
                orderId: payment.orderId,
                amount: Number(orderInfo.amount) || Number(orderInfo.paidAmount) || 0,
                channel: orderInfo.channel || null,
                status: PAYMENT_STATUS.FROZEN,
                frozenAt: new Date(),
            }
        }

        // 创建预约
        const appointment = new InterviewAppointment({
            candidateId,
            jobId: jobPost._id,
            applicationId,
            companyId,
            interviewerId,
            proposedTimeSlots: proposedTimeSlots.map(slot => ({
                startTime: new Date(slot.startTime),
                endTime: new Date(slot.endTime),
                isSelected: false,
            })),
            duration: duration || APPOINTMENT_DEFAULTS.DEFAULT_DURATION_MINUTES,
            timezone: timezone || 'Asia/Shanghai',
            notes,
            status: APPOINTMENT_STATUS.INITIATED,
            candidateInfo,
            interviewerInfo,
            _jobSnapshot: {
                title: jobPost.title,
                companyName: jobPost.companyName,
            },
            payment: paymentInfo,
        })

        await appointment.save()

        logger.info('[InterviewAppointmentService] Appointment created', {
            appointmentId: appointment.appointmentId,
            candidateId,
            jobId: jobPost._id.toString(),
            interviewerId,
            proposedSlotsCount: proposedTimeSlots.length,
            hasPayment: !!paymentInfo,
            orderId: paymentInfo?.orderId,
            paymentAmount: paymentInfo?.amount,
        })

        // 同步 Application 状态 → interview_inviting
        await this._syncApplicationStatus(appointment, APPOINTMENT_STATUS.INITIATED)

        // 发送通知给候选人
        try {
            await this._sendInviteNotification(appointment)
        } catch (error) {
            logger.error('[InterviewAppointmentService] Failed to send invite notification', {
                appointmentId: appointment.appointmentId,
                error: error.message,
            })
        }

        // 返回结果，包含邀请链接（供 B 端手动发送）
        const result = appointment.toJSON()
        result.inviteUrl = this._generateInviteUrl(appointment.inviteToken)

        return result
    }

    /**
     * 获取预约详情
     * @param {string} appointmentId - 预约 ID
     * @returns {Promise<Object>} 预约详情
     */
    async getAppointmentById(appointmentId) {
        const appointment = await findBySmartIdOrThrow(InterviewAppointment, appointmentId, {
            lean: true,
            errorMessage: 'Appointment not found',
        })

        // 移除内部字段
        delete appointment.jobInfo
        delete appointment._jobSnapshot

        // 关联查询职位信息
        if (appointment.jobId) {
            const jobPost = await JobPost.findById(appointment.jobId)
                .select('jobId title companyName location salaryRange')
                .lean()
            if (jobPost) {
                appointment.job = {
                    jobId: jobPost.jobId,
                    title: jobPost.title,
                    companyName: jobPost.companyName,
                    location: jobPost.location,
                    salaryRange: jobPost.salaryRange,
                }
            }
        }

        // 添加 createdBy 字段
        appointment.createdBy = appointment.interviewerId

        return appointment
    }

    /**
     * 根据邀请 token 获取预约（C 端使用）
     * @param {string} token - 邀请 token
     * @returns {Promise<Object>} 预约详情
     */
    async getAppointmentByToken(token) {
        const appointment = await InterviewAppointment.findByInviteToken(token)

        if (!appointment) {
            throw new AppError('Invalid or expired invite link', ERROR_CODES.NOT_FOUND)
        }

        // 检查是否过期
        if (appointment.status === APPOINTMENT_STATUS.INITIATED && new Date() > appointment.inviteExpireAt) {
            // 自动更新为过期状态
            appointment.status = APPOINTMENT_STATUS.EXPIRED
            await appointment.save()
        }

        return appointment
    }

    /**
     * 获取预约列表（B 端）
     * @param {Object} filters - 筛选条件
     * @param {Object} pagination - 分页参数
     * @param {Object} sort - 排序参数
     * @returns {Promise<Object>} 预约列表
     */
    async getAppointments(filters = {}, pagination = {}, sort = {}) {
        const { companyId, interviewerId, candidateId, jobId, status, dateFrom, dateTo } = filters

        const query = {}

        if (companyId) {
            query.companyId = companyId
        }

        if (interviewerId) {
            query.interviewerId = interviewerId
        }

        if (candidateId) {
            query.candidateId = candidateId
        }

        if (jobId) {
            const jobPost = await findBySmartId(JobPost, jobId)
            if (jobPost) {
                query.jobId = jobPost._id
            }
        }

        if (status) {
            if (Array.isArray(status)) {
                query.status = { $in: status }
            } else {
                query.status = status
            }
        }

        if (dateFrom || dateTo) {
            query.createdAt = {}
            if (dateFrom) query.createdAt.$gte = new Date(dateFrom)
            if (dateTo) query.createdAt.$lte = new Date(dateTo)
        }

        const { page = 1, pageSize = 20 } = pagination
        const skip = (page - 1) * pageSize

        const { sortBy = 'createdAt', sortOrder = 'desc' } = sort
        const sortOption = { [sortBy]: sortOrder === 'desc' ? -1 : 1 }

        const [data, total] = await Promise.all([InterviewAppointment.find(query).sort(sortOption).skip(skip).limit(pageSize).lean(), InterviewAppointment.countDocuments(query)])

        // 批量关联查询职位信息
        if (data.length > 0) {
            const jobIds = [...new Set(data.map(apt => apt.jobId?.toString()).filter(Boolean))]
            if (jobIds.length > 0) {
                const jobPosts = await JobPost.find({ _id: { $in: jobIds } })
                    .select('_id jobId title companyName location salaryRange')
                    .lean()

                const jobMap = jobPosts.reduce((map, job) => {
                    map[job._id.toString()] = job
                    return map
                }, {})

                data.forEach(apt => {
                    const job = jobMap[apt.jobId?.toString()]
                    if (job) {
                        apt.job = {
                            jobId: job.jobId,
                            title: job.title,
                            companyName: job.companyName,
                            location: job.location,
                            salaryRange: job.salaryRange,
                        }
                    }
                })
            }

            // 添加 createdBy 字段，语义上更清晰（当前预约由 interviewerId 创建）
            data.forEach(apt => {
                apt.createdBy = apt.interviewerId
            })
        }

        logger.info('[InterviewAppointmentService] Appointments retrieved', {
            filters,
            total,
            page,
            pageSize,
        })

        return {
            data,
            pagination: {
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
            },
        }
    }

    /**
     * 候选人选择时间段
     * @param {string} appointmentId - 预约 ID
     * @param {number} slotIndex - 选择的时间段索引
     * @param {string} operatorId - 操作者 ID（候选人）
     * @returns {Promise<Object>} 更新后的预约
     */
    async selectTimeSlot(appointmentId, slotIndex, operatorId) {
        const appointment = await findBySmartIdOrThrow(InterviewAppointment, appointmentId, {
            errorMessage: 'Appointment not found',
        })

        if (!canCandidateRespond(appointment.status)) {
            throw new AppError('Cannot select time slot in current status', ERROR_CODES.INVALID_STATUS)
        }

        // 创建 veRTC 会议信息（生成 Token）
        // 注意：如果 veRTC 未配置，会抛出错误
        const meetingInfo = VerTCService.createRoom({
            appointmentId: appointment.appointmentId,
            scheduledTime: appointment.proposedTimeSlots[slotIndex].startTime,
            duration: appointment.duration,
            participants: [
                { userId: appointment.interviewerId, role: 'interviewer' },
                { userId: appointment.candidateId, role: 'candidate' },
            ],
        })

        // 选择时间段并保存会议信息
        await appointment.selectTimeSlot(slotIndex, operatorId)
        await appointment.setMeetingInfo(meetingInfo)

        logger.info('[InterviewAppointmentService] Time slot selected and meeting info created', {
            appointmentId: appointment.appointmentId,
            roomId: meetingInfo.roomId,
        })

        // 同步 Application 状态 → interview_scheduled
        await this._syncApplicationStatus(appointment, APPOINTMENT_STATUS.SCHEDULE_CONFIRMED)

        // 发送确认通知给双方
        try {
            await this._sendConfirmationNotification(appointment)
        } catch (error) {
            logger.error('[InterviewAppointmentService] Failed to send confirmation notification', {
                appointmentId: appointment.appointmentId,
                error: error.message,
            })
        }

        return appointment
    }

    /**
     * 候选人申请改期
     * @param {string} appointmentId - 预约 ID
     * @param {Array} proposedSlots - 候选人提议的时间段
     * @param {string} reason - 改期原因
     * @param {string} operatorId - 操作者 ID（候选人）
     * @returns {Promise<Object>} 更新后的预约
     */
    async requestReschedule(appointmentId, proposedSlots, reason, operatorId) {
        const appointment = await findBySmartIdOrThrow(InterviewAppointment, appointmentId, {
            errorMessage: 'Appointment not found',
        })

        if (!canCandidateRequestReschedule(appointment.status)) {
            throw new AppError('Cannot request reschedule in current status', ERROR_CODES.INVALID_STATUS)
        }

        // 验证提议的时间段
        const now = new Date()
        for (const slot of proposedSlots) {
            if (new Date(slot.startTime) <= now) {
                throw new AppError('All proposed time slots must be in the future', ERROR_CODES.INVALID_PARAMS)
            }
        }

        await appointment.requestReschedule(
            proposedSlots.map(slot => ({
                startTime: new Date(slot.startTime),
                endTime: new Date(slot.endTime),
            })),
            reason,
            'C',
        )

        // 同步 Application 状态 → interview_inviting
        await this._syncApplicationStatus(appointment, APPOINTMENT_STATUS.RESCHEDULE_REQUESTED)

        // 通知 B 端收到改期申请
        try {
            await this._sendRescheduleRequestNotification(appointment, reason)
        } catch (error) {
            logger.error('[InterviewAppointmentService] Failed to send reschedule request notification', {
                appointmentId: appointment.appointmentId,
                error: error.message,
            })
        }

        return appointment
    }

    /**
     * B 端选择改期时间（同意改期）
     * @param {string} appointmentId - 预约 ID
     * @param {number} slotIndex - 选择的时间段索引
     * @param {string} responseNote - 回复备注
     * @param {string} operatorId - 操作者 ID
     * @returns {Promise<Object>} 更新后的预约
     */
    async selectRescheduleTime(appointmentId, slotIndex, responseNote, operatorId) {
        const appointment = await findBySmartIdOrThrow(InterviewAppointment, appointmentId, {
            errorMessage: 'Appointment not found',
        })

        if (!canApproveReschedule(appointment.status)) {
            throw new AppError('No pending reschedule request', ERROR_CODES.INVALID_STATUS)
        }

        // 获取 C 端提议的时间段
        const pendingReschedule = appointment.rescheduleHistory.find(r => r.status === 'pending')
        const proposedSlots = pendingReschedule?.proposedSlots || []

        // 验证时间段列表不为空
        if (!proposedSlots.length) {
            throw new AppError('没有可选的时间段', ERROR_CODES.INVALID_STATUS)
        }

        // 验证选择的时间段索引
        if (slotIndex < 0 || slotIndex >= proposedSlots.length) {
            throw new AppError(`无效的时间段索引: ${slotIndex}，有效范围: 0-${proposedSlots.length - 1}`, ERROR_CODES.INVALID_PARAMS)
        }

        const selectedSlot = proposedSlots[slotIndex]

        // 创建 veRTC 会议信息（生成 Token）
        const meetingInfo = VerTCService.createRoom({
            appointmentId: appointment.appointmentId,
            scheduledTime: selectedSlot.startTime,
            duration: appointment.duration,
            participants: [
                { userId: appointment.interviewerId, role: 'interviewer' },
                { userId: appointment.candidateId, role: 'candidate' },
            ],
        })

        await appointment.respondToReschedule(true, responseNote, operatorId, null, slotIndex)
        await appointment.setMeetingInfo(meetingInfo)

        logger.info('[InterviewAppointmentService] Reschedule time selected by B', {
            appointmentId: appointment.appointmentId,
            roomId: meetingInfo.roomId,
            slotIndex,
        })

        // 同步 Application 状态 → interview_scheduled
        await this._syncApplicationStatus(appointment, APPOINTMENT_STATUS.SCHEDULE_CONFIRMED)

        // 发送确认通知
        try {
            await this._sendRescheduleResponseNotification(appointment, true, responseNote)
        } catch (error) {
            logger.error('[InterviewAppointmentService] Failed to send reschedule confirmation notification', {
                appointmentId: appointment.appointmentId,
                error: error.message,
            })
        }

        return appointment
    }

    /**
     * B 端改期（响应C端改期或主动发起改期）
     * - 当前状态为 RESCHEDULE_REQUESTED：拒绝C端改期，提供新时间段（循环协商）
     * - 当前状态为 SCHEDULE_CONFIRMED：B端主动发起改期，提供新时间段
     * @param {string} appointmentId - 预约 ID
     * @param {Array} proposedSlots - B 端提供的新时间段
     * @param {string} responseNote - 回复备注
     * @param {string} operatorId - 操作者 ID
     * @returns {Promise<Object>} 更新后的预约
     */
    async respondToReschedule(appointmentId, proposedSlots, responseNote, operatorId) {
        const appointment = await findBySmartIdOrThrow(InterviewAppointment, appointmentId, {
            errorMessage: 'Appointment not found',
        })

        // 支持两种前置状态：RESCHEDULE_REQUESTED 或 SCHEDULE_CONFIRMED
        if (!canBSideReschedule(appointment.status)) {
            throw new AppError('Cannot reschedule in current status', ERROR_CODES.INVALID_STATUS)
        }

        const formattedSlots = proposedSlots.map(slot => ({
            startTime: new Date(slot.startTime),
            endTime: new Date(slot.endTime),
            isSelected: false,
        }))

        const previousStatus = appointment.status

        // 根据前置状态分流逻辑
        if (previousStatus === APPOINTMENT_STATUS.RESCHEDULE_REQUESTED) {
            // 响应 C端改期请求：拒绝并提供新时间
            await appointment.respondToReschedule(false, responseNote, operatorId, formattedSlots)
            logger.info('[InterviewAppointmentService] B rejected C reschedule, proposed new times', {
                appointmentId: appointment.appointmentId,
                previousStatus,
                proposedSlotsCount: formattedSlots.length,
            })
        } else {
            // B端主动发起改期（从 SCHEDULE_CONFIRMED 状态）
            await appointment.initiateRescheduleByB(formattedSlots, responseNote)
            logger.info('[InterviewAppointmentService] B initiated reschedule from confirmed', {
                appointmentId: appointment.appointmentId,
                previousStatus,
                proposedSlotsCount: formattedSlots.length,
            })
        }

        // 状态都会流转到 INITIATED，同步 Application 状态 → interview_inviting
        await this._syncApplicationStatus(appointment, APPOINTMENT_STATUS.INITIATED)

        // 发送通知给 C 端（根据场景区分通知内容）
        try {
            if (previousStatus === APPOINTMENT_STATUS.RESCHEDULE_REQUESTED) {
                // B端拒绝C端改期，提供新时间
                await this._sendRescheduleResponseNotification(appointment, false, responseNote)
            } else {
                // B端主动发起改期
                await this._sendBSideRescheduleNotification(appointment, responseNote)
            }
        } catch (error) {
            logger.error('[InterviewAppointmentService] Failed to send reschedule notification to C', {
                appointmentId: appointment.appointmentId,
                error: error.message,
            })
        }

        return appointment
    }

    /**
     * 候选人拒绝面试邀请
     * @param {string} appointmentId - 预约 ID
     * @param {string} reason - 拒绝原因
     * @param {string} operatorId - 操作者 ID
     * @returns {Promise<Object>} 更新后的预约
     */
    async rejectAppointment(appointmentId, reason, operatorId) {
        const appointment = await findBySmartIdOrThrow(InterviewAppointment, appointmentId, {
            errorMessage: 'Appointment not found',
        })

        if (!canCandidateRespond(appointment.status)) {
            throw new AppError('Cannot reject in current status', ERROR_CODES.INVALID_STATUS)
        }

        await appointment.reject(reason, REQUESTER_TYPE.C_SIDE, operatorId)

        // 同步 Application 状态 → interview_terminated
        await this._syncApplicationStatus(appointment, APPOINTMENT_STATUS.REJECTED)

        // 处理退款（C端拒绝）
        await this._processRefund(appointment, REFUND_REASON.CANDIDATE_REJECTED)

        // 通知 B 端
        try {
            await this._sendRejectionNotification(appointment, reason)
        } catch (error) {
            logger.error('[InterviewAppointmentService] Failed to send rejection notification', {
                appointmentId: appointment.appointmentId,
                error: error.message,
            })
        }

        return appointment
    }

    /**
     * 取消预约
     * @param {string} appointmentId - 预约 ID
     * @param {string} reason - 取消原因
     * @param {string} cancelledBy - 取消方（B/C/system）
     * @returns {Promise<Object>} 更新后的预约
     */
    async cancelAppointment(appointmentId, reason, cancelledBy) {
        const appointment = await findBySmartIdOrThrow(InterviewAppointment, appointmentId, {
            errorMessage: 'Appointment not found',
        })

        if (!canCancelAppointment(appointment.status)) {
            throw new AppError('Cannot cancel in current status', ERROR_CODES.INVALID_STATUS)
        }

        await appointment.cancel(reason, cancelledBy)

        // 同步 Application 状态 → interview_terminated
        await this._syncApplicationStatus(appointment, APPOINTMENT_STATUS.CANCELLED)

        // 处理退款（根据取消方确定退款原因）
        const refundReason = cancelledBy === 'B' ? REFUND_REASON.B_CANCELLED : REFUND_REASON.C_CANCELLED
        await this._processRefund(appointment, refundReason)

        // 如果有会议房间，销毁它
        if (appointment.meeting?.roomId) {
            try {
                await VerTCService.destroyRoom(appointment.meeting.roomId)
            } catch (error) {
                logger.error('[InterviewAppointmentService] Failed to destroy meeting room', {
                    appointmentId: appointment.appointmentId,
                    roomId: appointment.meeting.roomId,
                    error: error.message,
                })
            }
        }

        // 发送取消通知
        try {
            await this._sendCancellationNotification(appointment, reason, cancelledBy)
        } catch (error) {
            logger.error('[InterviewAppointmentService] Failed to send cancellation notification', {
                appointmentId: appointment.appointmentId,
                error: error.message,
            })
        }

        return appointment
    }

    /**
     * 标记面试完成
     * @param {string} appointmentId - 预约 ID
     * @param {string} feedback - 面试反馈
     * @param {string} operatorId - 操作者 ID
     * @returns {Promise<Object>} 更新后的预约
     */
    async completeAppointment(appointmentId, feedback, operatorId) {
        const appointment = await findBySmartIdOrThrow(InterviewAppointment, appointmentId, {
            errorMessage: 'Appointment not found',
        })

        await appointment.complete(feedback, operatorId)

        // 同步 Application 状态 → interview_completed
        await this._syncApplicationStatus(appointment, APPOINTMENT_STATUS.COMPLETED)

        // 销毁会议房间
        if (appointment.meeting?.roomId) {
            try {
                await VerTCService.destroyRoom(appointment.meeting.roomId)
            } catch (error) {
                logger.error('[InterviewAppointmentService] Failed to destroy meeting room after completion', {
                    appointmentId: appointment.appointmentId,
                    roomId: appointment.meeting.roomId,
                    error: error.message,
                })
            }
        }

        return appointment
    }

    /**
     * 标记缺席
     * @param {string} appointmentId - 预约 ID
     * @param {string} note - 备注
     * @param {string} operatorId - 操作者 ID
     * @returns {Promise<Object>} 更新后的预约
     */
    async markNoShow(appointmentId, note, operatorId) {
        const appointment = await findBySmartIdOrThrow(InterviewAppointment, appointmentId, {
            errorMessage: 'Appointment not found',
        })

        await appointment.markNoShow(note, operatorId)

        // 同步 Application 状态 → interview_terminated
        await this._syncApplicationStatus(appointment, APPOINTMENT_STATUS.NO_SHOW)

        // 处理退款（缺席场景 - 根据业务规则，缺席也退款）
        // 注意：如果业务规则是缺席不退款，可以注释掉这行
        await this._processRefund(appointment, REFUND_REASON.NO_SHOW)

        // 销毁会议房间
        if (appointment.meeting?.roomId) {
            try {
                await VerTCService.destroyRoom(appointment.meeting.roomId)
            } catch (error) {
                logger.error('[InterviewAppointmentService] Failed to destroy meeting room after no-show', {
                    appointmentId: appointment.appointmentId,
                    error: error.message,
                })
            }
        }

        return appointment
    }

    /**
     * 获取面试官日程
     * @param {string} interviewerId - 面试官 ID
     * @param {Date} startDate - 开始日期
     * @param {Date} endDate - 结束日期
     * @returns {Promise<Array>} 日程列表
     */
    async getInterviewerSchedule(interviewerId, startDate, endDate) {
        return InterviewAppointment.getInterviewerSchedule(interviewerId, startDate, endDate)
    }

    /**
     * 获取预约统计
     * @param {string} companyId - 企业 ID
     * @returns {Promise<Object>} 统计数据
     */
    async getAppointmentStats(companyId) {
        const stats = await InterviewAppointment.countByCompany(companyId)

        const result = {
            total: 0,
            byStatus: {},
        }

        stats.forEach(item => {
            result.byStatus[item._id] = item.count
            result.total += item.count
        })

        return result
    }

    /**
     * 获取候选人预约统计（C 端）
     * 返回每个 appointment status 的独立计数，前端自行做加法
     * @param {string} candidateId - 候选人 ID
     * @returns {Promise<Object>} 每个 appointment status 的计数
     */
    async getCandidateAppointmentStats(candidateId) {
        const stats = await InterviewAppointment.countByCandidate(candidateId)

        const result = {}
        for (const status of APPOINTMENT_STATUS_VALUES) {
            result[status] = 0
        }

        stats.forEach(item => {
            if (result[item._id] !== undefined) {
                result[item._id] = item.count
            }
        })

        return result
    }

    /**
     * 处理过期预约 - C端超时未响应（定时任务调用）
     * @returns {Promise<number>} 处理的预约数量
     */
    async processExpiredAppointments() {
        const expiredAppointments = await InterviewAppointment.findExpiredAppointments()

        let processedCount = 0
        for (const appointment of expiredAppointments) {
            try {
                // 设置超时方为 C 端
                appointment.expiredBy = REQUESTER_TYPE.C_SIDE
                await appointment.updateStatus(APPOINTMENT_STATUS.EXPIRED, 'system', '候选人超时未响应（超过7天）')
                processedCount++

                // 同步 Application 状态 → interview_terminated
                await this._syncApplicationStatus(appointment, APPOINTMENT_STATUS.EXPIRED)

                // 处理退款（邀请超时过期）
                await this._processRefund(appointment, REFUND_REASON.INVITE_EXPIRED)

                // 通知 B 端
                try {
                    await this._sendExpiredNotification(appointment)
                } catch (error) {
                    logger.error('[InterviewAppointmentService] Failed to send expired notification', {
                        appointmentId: appointment.appointmentId,
                        error: error.message,
                    })
                }
            } catch (error) {
                logger.error('[InterviewAppointmentService] Failed to process expired appointment', {
                    appointmentId: appointment.appointmentId,
                    error: error.message,
                })
            }
        }

        if (processedCount > 0) {
            logger.info('[InterviewAppointmentService] Processed expired appointments (C-side timeout)', {
                count: processedCount,
            })
        }

        return processedCount
    }

    /**
     * 处理过期的改期申请 - B端超时未审批（定时任务调用）
     * @returns {Promise<number>} 处理的预约数量
     */
    async processExpiredRescheduleRequests() {
        const expiredAppointments = await InterviewAppointment.findExpiredRescheduleRequests()

        let processedCount = 0
        for (const appointment of expiredAppointments) {
            try {
                // 设置超时方为 B 端
                appointment.expiredBy = REQUESTER_TYPE.B_SIDE
                await appointment.updateStatus(APPOINTMENT_STATUS.EXPIRED, 'system', '企业超时未审批改期申请（超过7天）')
                processedCount++

                // 同步 Application 状态 → interview_terminated
                await this._syncApplicationStatus(appointment, APPOINTMENT_STATUS.EXPIRED)

                // 处理退款（改期审批超时）
                await this._processRefund(appointment, REFUND_REASON.RESCHEDULE_EXPIRED)

                // 通知 C 端（B端超时，通知候选人）
                try {
                    await this._sendExpiredNotificationToCandidate(appointment)
                } catch (error) {
                    logger.error('[InterviewAppointmentService] Failed to send B-side expired notification', {
                        appointmentId: appointment.appointmentId,
                        error: error.message,
                    })
                }
            } catch (error) {
                logger.error('[InterviewAppointmentService] Failed to process expired reschedule request', {
                    appointmentId: appointment.appointmentId,
                    error: error.message,
                })
            }
        }

        if (processedCount > 0) {
            logger.info('[InterviewAppointmentService] Processed expired reschedule requests (B-side timeout)', {
                count: processedCount,
            })
        }

        return processedCount
    }

    /**
     * 处理已扣费的面试预约自动完成（定时任务调用）
     * 场景：C端进入面试并扣费后，超过指定时间自动流转到 COMPLETED 状态
     * @returns {Promise<number>} 处理的预约数量
     */
    async processChargedAppointmentsAutoComplete() {
        // 检查功能开关
        const enabled = process.env.APPOINTMENT_AUTO_COMPLETE_ENABLED !== 'false'
        if (!enabled) {
            logger.debug('[InterviewAppointmentService] Auto-complete feature is disabled')
            return 0
        }

        const delayMs = parseInt(process.env.APPOINTMENT_AUTO_COMPLETE_DELAY_MS || '7200000', 10)
        const chargedAppointments = await InterviewAppointment.findChargedAppointmentsForAutoComplete(delayMs)

        let processedCount = 0
        for (const appointment of chargedAppointments) {
            try {
                logger.info('[InterviewAppointmentService] Auto-completing charged appointment', {
                    appointmentId: appointment.appointmentId,
                    chargedAt: appointment.payment.chargedAt,
                    delayMs,
                })

                // 复用现有 complete 逻辑
                await appointment.complete('系统自动完成：扣费后超过指定时间未手动结束', 'system')

                // 同步 Application 状态 → interview_completed
                await this._syncApplicationStatus(appointment, APPOINTMENT_STATUS.COMPLETED)

                // 销毁会议房间
                if (appointment.meeting?.roomId) {
                    try {
                        await VerTCService.destroyRoom(appointment.meeting.roomId)
                        logger.info('[InterviewAppointmentService] Meeting room destroyed on auto-complete', {
                            appointmentId: appointment.appointmentId,
                            roomId: appointment.meeting.roomId,
                        })
                    } catch (error) {
                        logger.error('[InterviewAppointmentService] Failed to destroy room on auto-complete', {
                            appointmentId: appointment.appointmentId,
                            roomId: appointment.meeting.roomId,
                            error: error.message,
                        })
                    }
                }

                processedCount++
            } catch (error) {
                logger.error('[InterviewAppointmentService] Failed to auto-complete appointment', {
                    appointmentId: appointment.appointmentId,
                    errorMessage: error.message,
                    errorName: error.name,
                    errorCode: error.code,
                    // Mongoose ValidationError 特有属性
                    validationErrors: error.errors
                        ? Object.keys(error.errors).map((key) => ({
                              field: key,
                              message: error.errors[key].message,
                              kind: error.errors[key].kind,
                              value: error.errors[key].value,
                          }))
                        : undefined,
                    // Mongoose VersionError 检测
                    isVersionError: error.name === 'VersionError',
                    // 完整堆栈
                    stack: error.stack,
                })
            }
        }

        if (processedCount > 0) {
            logger.info('[InterviewAppointmentService] Auto-completed charged appointments', {
                count: processedCount,
                totalFound: chargedAppointments.length,
            })
        }

        return processedCount
    }

    /**
     * 处理未进入面试的预约自动标记缺席（定时任务调用）
     * 场景：面试时间已过，C端未进入（未扣费），自动标记为 NO_SHOW 并退款
     * @returns {Promise<number>} 处理的预约数量
     */
    async processNoShowAppointments() {
        // 检查功能开关
        const enabled = process.env.APPOINTMENT_AUTO_NO_SHOW_ENABLED !== 'false'
        if (!enabled) {
            logger.debug('[InterviewAppointmentService] Auto no-show feature is disabled')
            return 0
        }

        const delayMs = parseInt(process.env.APPOINTMENT_AUTO_NO_SHOW_DELAY_MS || '7200000', 10)
        const noShowAppointments = await InterviewAppointment.findNoShowAppointments(delayMs)

        let processedCount = 0
        for (const appointment of noShowAppointments) {
            try {
                logger.info('[InterviewAppointmentService] Auto marking no-show appointment', {
                    appointmentId: appointment.appointmentId,
                    scheduledEndTime: appointment.meeting?.scheduledEndTime,
                    delayMs,
                })

                // 调用模型方法更新状态为 NO_SHOW
                await appointment.markNoShow('系统自动标记：面试时间已过，候选人未进入', 'system')

                // 同步 Application 状态 → interview_terminated
                await this._syncApplicationStatus(appointment, APPOINTMENT_STATUS.NO_SHOW)

                // 处理退款（如果有冻结的款项）
                await this._processRefund(appointment, REFUND_REASON.NO_SHOW)

                // 销毁会议房间
                if (appointment.meeting?.roomId) {
                    try {
                        await VerTCService.destroyRoom(appointment.meeting.roomId)
                        logger.info('[InterviewAppointmentService] Meeting room destroyed on auto no-show', {
                            appointmentId: appointment.appointmentId,
                            roomId: appointment.meeting.roomId,
                        })
                    } catch (error) {
                        logger.error('[InterviewAppointmentService] Failed to destroy room on auto no-show', {
                            appointmentId: appointment.appointmentId,
                            roomId: appointment.meeting.roomId,
                            error: error.message,
                        })
                    }
                }

                processedCount++
            } catch (error) {
                logger.error('[InterviewAppointmentService] Failed to auto mark no-show', {
                    appointmentId: appointment.appointmentId,
                    error: error.message,
                    stack: error.stack,
                })
            }
        }

        if (processedCount > 0) {
            logger.info('[InterviewAppointmentService] Auto marked no-show appointments', {
                count: processedCount,
                totalFound: noShowAppointments.length,
            })
        }

        return processedCount
    }

    /**
     * 获取会议加入信息
     * @param {string} appointmentId - 预约 ID
     * @param {string} userId - 用户 ID
     * @param {string} role - 角色（interviewer/candidate）
     * @param {Object} options - 选项
     * @param {boolean} options.skipTimeCheck - 是否跳过时间检查（仅用于测试）
     * @returns {Promise<Object>} 加入信息
     */
    async getMeetingJoinInfo(appointmentId, userId, role, options = {}) {
        const appointment = await findBySmartIdOrThrow(InterviewAppointment, appointmentId, {
            errorMessage: 'Appointment not found',
        })

        if (appointment.status !== APPOINTMENT_STATUS.SCHEDULE_CONFIRMED) {
            throw new AppError('Meeting is not available', ERROR_CODES.INVALID_STATUS)
        }

        if (!appointment.meeting?.roomId) {
            throw new AppError('Meeting room not created', ERROR_CODES.NOT_FOUND)
        }

        // 验证用户是参与方（面试官 / 候选人 / 岗位协作者）
        const isInterviewer = appointment.interviewerId === userId
        const isCandidate = appointment.candidateId === userId
        let isCollaborator = false

        if (!isInterviewer && !isCandidate) {
            // 检查是否为该岗位的协作者
            const { hasAccess } = await JobCollaboratorService.hasJobAccess(userId, appointment.jobId)
            if (!hasAccess) {
                throw new AppError('Not authorized to join this meeting', ERROR_CODES.FORBIDDEN)
            }
            isCollaborator = true
        }

        // 时间窗口检查：只允许在会议开始前 30 分钟到会议结束后 2 小时内获取 token
        // 这可以防止 token 被提前泄露或在会议结束很久后被滥用
        if (!options.skipTimeCheck) {
            const now = new Date()
            const scheduledStart = new Date(appointment.meeting.scheduledStartTime)
            const scheduledEnd = new Date(appointment.meeting.scheduledEndTime)

            const earlyJoinWindow = 30 * 60 * 1000 // 30 分钟
            const lateJoinWindow = 2 * 60 * 60 * 1000 // 2 小时

            const windowStart = new Date(scheduledStart.getTime() - earlyJoinWindow)
            const windowEnd = new Date(scheduledEnd.getTime() + lateJoinWindow)

            if (now < windowStart) {
                const minutesUntilAvailable = Math.ceil((windowStart.getTime() - now.getTime()) / 60000)
                throw new AppError(`Meeting access will be available in ${minutesUntilAvailable} minutes`, ERROR_CODES.INVALID_STATUS)
            }

            if (now > windowEnd) {
                throw new AppError('Meeting access window has expired', ERROR_CODES.INVALID_STATUS)
            }
        }

        // C端进入时触发扣款（幂等）
        if (isCandidate) {
            await this._chargeOnCandidateJoin(appointment)
        }

        // 获取对应的 token（协作者与面试官共用 bToken）
        const token = isCandidate ? appointment.meeting.cToken : appointment.meeting.bToken
        const currentUserId = isCandidate ? appointment.candidateId : appointment.interviewerId

        const roleLabel = isInterviewer ? 'interviewer' : isCandidate ? 'candidate' : 'collaborator'

        logger.info('[InterviewAppointmentService] Meeting join info retrieved', {
            appointmentId: appointment.appointmentId,
            userId: currentUserId,
            actualUserId: isCollaborator ? userId : undefined,
            role: roleLabel,
        })

        // 返回前端 veRTC SDK 初始化所需的完整信息
        return {
            // veRTC SDK 必需参数
            appId: appointment.meeting.appId,
            roomId: appointment.meeting.roomId,
            userId: currentUserId,
            token,
            // 辅助信息
            joinUrl: appointment.meeting.joinUrl,
            scheduledStartTime: appointment.meeting.scheduledStartTime,
            scheduledEndTime: appointment.meeting.scheduledEndTime,
            duration: appointment.duration,
            role: roleLabel,
            // 参会人信息（用于 UI 展示）
            participants: {
                interviewer: {
                    userId: appointment.interviewerId,
                    name: appointment.interviewerInfo?.name || 'Interviewer',
                },
                candidate: {
                    userId: appointment.candidateId,
                    name: appointment.candidateInfo?.name || 'Candidate',
                },
            },
        }
    }

    // ============= 私有方法：状态同步 =============

    /**
     * 同步更新关联的 Application 状态
     * @param {Object} appointment - 预约对象
     * @param {string} newAppointmentStatus - 新的预约状态
     * @returns {Promise<void>}
     */
    async _syncApplicationStatus(appointment, newAppointmentStatus) {
        const targetApplicationStatus = getApplicationStatusFromAppointment(newAppointmentStatus)
        if (!targetApplicationStatus) {
            logger.warn('[InterviewAppointmentService] No mapping for appointment status', {
                appointmentId: appointment.appointmentId,
                appointmentStatus: newAppointmentStatus,
            })
            return
        }

        try {
            let application = null

            // 优先使用 applicationId 查找，否则通过 candidateId + jobId 查找
            if (appointment.applicationId) {
                application = await findBySmartId(JobApplication, appointment.applicationId)
            } else if (appointment.candidateId && appointment.jobId) {
                application = await JobApplication.findOne({
                    candidateId: appointment.candidateId,
                    jobId: appointment.jobId,
                })
                // 如果找到了，回填 applicationId 到 appointment
                if (application && !appointment.applicationId) {
                    appointment.applicationId = application.applicationId
                    await appointment.save()
                    logger.info('[InterviewAppointmentService] Backfilled applicationId to appointment', {
                        appointmentId: appointment.appointmentId,
                        applicationId: application.applicationId,
                    })
                }
            }

            if (!application) {
                logger.warn('[InterviewAppointmentService] Application not found for status sync', {
                    appointmentId: appointment.appointmentId,
                    applicationId: appointment.applicationId,
                    candidateId: appointment.candidateId,
                    jobId: appointment.jobId?.toString(),
                })
                return
            }

            // 只有状态不同时才更新
            if (application.status === targetApplicationStatus) {
                logger.debug('[InterviewAppointmentService] Application status already matches', {
                    applicationId: appointment.applicationId,
                    status: targetApplicationStatus,
                })
                return
            }

            application.status = targetApplicationStatus
            await application.save()

            logger.info('[InterviewAppointmentService] Application status synced', {
                appointmentId: appointment.appointmentId,
                applicationId: appointment.applicationId,
                appointmentStatus: newAppointmentStatus,
                applicationStatus: targetApplicationStatus,
            })
        } catch (error) {
            // 状态同步失败不应阻塞主流程
            logger.error('[InterviewAppointmentService] Failed to sync application status', {
                appointmentId: appointment.appointmentId,
                applicationId: appointment.applicationId,
                error: error.message,
            })
        }
    }

    // ============= 私有方法：通知发送 =============

    /**
     * 生成邀请链接
     * @param {string} inviteToken - 邀请 token
     * @returns {string} 完整的邀请链接
     */
    _generateInviteUrl(inviteToken) {
        const baseUrl = process.env.JOB_APPOINTMENT_URL_C || 'https://example.com'
        return `${baseUrl}/#/redirect?target=talent&type=interview_invite&utype=C&token=${inviteToken}`
    }

    /**
     * 生成面试详情链接
     * @param {string} appointmentId - 预约ID
     * @param {string} [role='c'] - 角色 'b' 或 'c'
     * @param {string} [appointmentStatus=''] - 预约状态
     * @param {string} [jobId=''] - 职位ID
     * @returns {string} 面试详情链接
     */
    _generateAppointmentUrl(appointmentId, role = ROLE_C, appointmentStatus = '', jobId = '') {
        // 根据角色选择不同的基础URL
        const baseUrl =
            role === ROLE_B
                ? process.env.JOB_APPOINTMENT_URL_B || 'https://example.com'
                : process.env.JOB_APPOINTMENT_URL_C || 'https://example.com'
        const utype = role === ROLE_B ? 'B' : 'C'
        let url = `${baseUrl}/#/redirect?type=interview&utype=${utype}&id=${appointmentId}`
        if (appointmentStatus) {
            url += `&appointmentStatus=${appointmentStatus}`
        }
        if (jobId) {
            url += `&jobId=${jobId}`
        }
        return url
    }

    /**
     * 确保候选人信息有效（如果 name 是 Unknown，重新获取）
     * @param {Object} appointment - 预约对象
     * @returns {Promise<Object>} 有效的候选人信息
     */
    async _ensureCandidateInfo(appointment) {
        const { candidateId, candidateInfo, applicationId } = appointment

        // 如果姓名已经有效，直接返回
        if (candidateInfo?.name && candidateInfo.name !== 'Unknown') {
            return candidateInfo
        }

        // 重新获取候选人信息
        logger.info('[InterviewAppointmentService] Candidate name is Unknown, re-fetching', {
            candidateId,
            appointmentId: appointment.appointmentId,
        })

        try {
            const freshInfo = await getCandidateInfo(candidateId, { applicationId })

            // 如果成功获取到有效姓名，更新数据库中的候选人信息
            if (freshInfo.name && freshInfo.name !== 'Unknown') {
                await InterviewAppointment.updateOne(
                    { _id: appointment._id },
                    { $set: { candidateInfo: freshInfo } }
                )
                logger.info('[InterviewAppointmentService] Candidate info updated in database', {
                    candidateId,
                    newName: freshInfo.name,
                })
                return freshInfo
            }

            return candidateInfo || { name: 'Unknown' }
        } catch (error) {
            logger.warn('[InterviewAppointmentService] Failed to re-fetch candidate info', {
                candidateId,
                error: error.message,
            })
            return candidateInfo || { name: 'Unknown' }
        }
    }

    /**
     * 确保面试官信息有效（如果 email 缺失，重新获取）
     * @param {Object} appointment - 预约对象
     * @returns {Promise<Object>} 有效的面试官信息
     */
    async _ensureInterviewerInfo(appointment) {
        const { interviewerId, interviewerInfo } = appointment

        // 如果邮箱已经有效，直接返回
        if (interviewerInfo?.email) {
            return interviewerInfo
        }

        // 重新获取面试官信息
        logger.info('[InterviewAppointmentService] Interviewer email is missing, re-fetching', {
            interviewerId,
            appointmentId: appointment.appointmentId,
        })

        try {
            const profile = await UserCenterService.getUserProfile(interviewerId)

            if (profile?.email) {
                const freshInfo = {
                    name: profile.name || interviewerInfo?.name || 'Unknown',
                    email: profile.email,
                    title: profile.title || interviewerInfo?.title,
                }
                // 更新数据库中的面试官信息
                await InterviewAppointment.updateOne(
                    { _id: appointment._id },
                    { $set: { interviewerInfo: freshInfo } }
                )
                logger.info('[InterviewAppointmentService] Interviewer info updated in database', {
                    interviewerId,
                    email: profile.email,
                })
                return freshInfo
            }

            return interviewerInfo || { name: 'Unknown' }
        } catch (error) {
            logger.warn('[InterviewAppointmentService] Failed to re-fetch interviewer info', {
                interviewerId,
                error: error.message,
            })
            return interviewerInfo || { name: 'Unknown' }
        }
    }

    /**
     * 1. 面试邀请通知 (B端创建预约 → 通知C端)
     */
    async _sendInviteNotification(appointment) {
        const { candidateId, candidateInfo, jobSnapshot, inviteToken, appointmentId } = appointment
        const companyName = jobSnapshot?.companyName || '企业'
        const jobTitle = jobSnapshot?.title || '职位'
        const inviteUrl = this._generateInviteUrl(inviteToken)

        // 站内消息（简短）
        try {
            await NotificationService.sendInAppMessage({
                userId: candidateId,
                title: '面试邀约',
                content: '您有新的面试邀约，快去确认吧',
                type: 'INTERVIEW',
                priority: 'HIGH',
                referenceId: appointmentId,
                referenceType: 'Appointment',
                actionUrl: this._generateInviteUrl(inviteToken),
                metadata: {
                    appointmentStatus: appointment.status,
                    companyName,
                    jobTitle,
                },
            })
        } catch (error) {
            logger.error('[_sendInviteNotification] 站内消息发送失败', { appointmentId, error: error.message })
        }

        // 邮件通知（使用模板）
        if (candidateInfo?.email) {
            try {
                const emailResult = renderEmailTemplate(EMAIL_TYPES.INTERVIEW_INVITE, {
                    companyName,
                    jobTitle,
                    actionUrl: inviteUrl,
                })
                await NotificationService.sendEmail({
                    to: candidateInfo.email,
                    subject: emailResult.subject,
                    html: emailResult.html,
                    async: EMAIL_ASYNC_MODE,
                })
            } catch (error) {
                logger.error('[_sendInviteNotification] 邮件发送失败', { appointmentId, error: error.message })
            }
        }

        // B 端操作通知到固定邮箱
        JobNotificationService.sendCcEmail({
            companyName,
            operatorEmail: appointment.interviewerInfo?.email || '',
            position: jobTitle,
            candidateName: _resolveCandidate(candidateInfo),
            actionType: '发起面试',
        })
    }

    /**
     * 2. 面试时间确认通知 (C端选择时间 → 仅通知B端面试官)
     */
    async _sendConfirmationNotification(appointment) {
        const { interviewerId, jobSnapshot, appointmentId } = appointment
        const jobTitle = jobSnapshot?.title || '职位'

        // 确保候选人信息有效（修复历史数据中的 Unknown）
        const candidateInfo = await this._ensureCandidateInfo(appointment)
        const candidateName = candidateInfo?.name || '未知'

        // 确保面试官信息有效（修复历史数据中缺失的 email）
        const interviewerInfo = await this._ensureInterviewerInfo(appointment)

        // 通知面试官 - 站内消息
        try {
            await NotificationService.sendInAppMessage({
                userId: interviewerId,
                title: '候选人已确认面试时间',
                content: `候选人 ${candidateName} 已确认面试时间`,
                type: 'INTERVIEW',
                referenceId: appointmentId,
                referenceType: 'Appointment',
                actionUrl: this._generateAppointmentUrl(appointmentId, ROLE_B, appointment.status, appointment.jobId),
                metadata: {
                    appointmentStatus: appointment.status,
                    candidateName,
                    jobTitle,
                },
            })
        } catch (error) {
            logger.error('[_sendConfirmationNotification] B端站内消息发送失败', { appointmentId, error: error.message })
        }

        // 通知面试官 - 邮件（使用模板）
        if (interviewerInfo?.email) {
            try {
                const emailResult = renderEmailTemplate(EMAIL_TYPES.INTERVIEW_CONFIRMED_B, {
                    candidateName,
                    jobTitle,
                    actionUrl: this._generateAppointmentUrl(appointmentId, ROLE_B, appointment.status, appointment.jobId),
                })
                await NotificationService.sendEmail({
                    to: interviewerInfo.email,
                    subject: emailResult.subject,
                    html: emailResult.html,
                    async: EMAIL_ASYNC_MODE,
                })
            } catch (error) {
                logger.error('[_sendConfirmationNotification] B端邮件发送失败', { appointmentId, error: error.message })
            }
        }
    }

    /**
     * 3. 改期申请通知 (C端申请改期 → 通知B端)
     */
    async _sendRescheduleRequestNotification(appointment, reason) {
        const { interviewerId, jobSnapshot, appointmentId } = appointment
        const jobTitle = jobSnapshot?.title || '职位'

        // 确保候选人信息有效（修复历史数据中的 Unknown）
        const candidateInfo = await this._ensureCandidateInfo(appointment)
        const candidateName = candidateInfo?.name || '未知'

        // 确保面试官信息有效（修复历史数据中缺失的 email）
        const interviewerInfo = await this._ensureInterviewerInfo(appointment)

        // 站内消息（这也是"面试待接受"场景之一）
        try {
            await NotificationService.sendInAppMessage({
                userId: interviewerId,
                title: '面试邀约',
                content: '您有新的面试邀约，快去确认吧',
                type: 'INTERVIEW',
                priority: 'HIGH',
                referenceId: appointmentId,
                referenceType: 'Appointment',
                actionUrl: this._generateAppointmentUrl(appointmentId, ROLE_B, appointment.status, appointment.jobId),
                metadata: {
                    appointmentStatus: appointment.status,
                    candidateName,
                    jobTitle,
                },
            })
        } catch (error) {
            logger.error('[_sendRescheduleRequestNotification] 站内消息发送失败', { appointmentId, error: error.message })
        }

        // 邮件通知（使用模板）
        if (interviewerInfo?.email) {
            try {
                const emailResult = renderEmailTemplate(EMAIL_TYPES.RESCHEDULE_REQUEST_B, {
                    candidateName,
                    jobTitle,
                    actionUrl: this._generateAppointmentUrl(appointmentId, ROLE_B, appointment.status, appointment.jobId),
                })
                await NotificationService.sendEmail({
                    to: interviewerInfo.email,
                    subject: emailResult.subject,
                    html: emailResult.html,
                    async: EMAIL_ASYNC_MODE,
                })
            } catch (error) {
                logger.error('[_sendRescheduleRequestNotification] 邮件发送失败', { appointmentId, error: error.message })
            }
        }
    }

    /**
     * 4. 改期响应通知 (B端响应改期 → 通知C端)
     */
    async _sendRescheduleResponseNotification(appointment, approved, responseNote) {
        const { candidateId, candidateInfo, jobSnapshot, appointmentId } = appointment
        const companyName = jobSnapshot?.companyName || '企业'
        const jobTitle = jobSnapshot?.title || '职位'

        if (approved) {
            // 改期通过 - 站内消息
            try {
                await NotificationService.sendInAppMessage({
                    userId: candidateId,
                    title: '面试时间已确认',
                    content: '您的改期申请已通过，面试时间已更新',
                    type: 'INTERVIEW',
                    referenceId: appointmentId,
                    referenceType: 'Appointment',
                    actionUrl: this._generateAppointmentUrl(appointmentId, ROLE_C, appointment.status, appointment.jobId),
                    metadata: {
                        appointmentStatus: appointment.status,
                        companyName,
                        jobTitle,
                    },
                })
            } catch (error) {
                logger.error('[_sendRescheduleResponseNotification] 站内消息发送失败', { appointmentId, error: error.message })
            }

            // 改期通过 - 邮件（使用模板）
            if (candidateInfo?.email) {
                try {
                    const emailResult = renderEmailTemplate(EMAIL_TYPES.RESCHEDULE_APPROVED, {
                        companyName,
                        jobTitle,
                        actionUrl: this._generateAppointmentUrl(appointmentId, ROLE_C, appointment.status, appointment.jobId),
                    })
                    await NotificationService.sendEmail({
                        to: candidateInfo.email,
                        subject: emailResult.subject,
                        html: emailResult.html,
                        async: EMAIL_ASYNC_MODE,
                    })
                } catch (error) {
                    logger.error('[_sendRescheduleResponseNotification] 邮件发送失败', { appointmentId, error: error.message })
                }
            }
        } else {
            // 改期被拒绝，B端提供新时间段 - 相当于新的"面试待接受"
            try {
                await NotificationService.sendInAppMessage({
                    userId: candidateId,
                    title: '面试邀约',
                    content: '您有新的面试邀约，快去确认吧',
                    type: 'INTERVIEW',
                    priority: 'HIGH',
                    referenceId: appointmentId,
                    referenceType: 'Appointment',
                    actionUrl: this._generateAppointmentUrl(appointmentId, ROLE_C, appointment.status, appointment.jobId),
                    metadata: {
                        appointmentStatus: appointment.status,
                        companyName,
                        jobTitle,
                    },
                })
            } catch (error) {
                logger.error('[_sendRescheduleResponseNotification] 站内消息发送失败', { appointmentId, error: error.message })
            }

            // 邮件通知（使用模板）
            if (candidateInfo?.email) {
                try {
                    const emailResult = renderEmailTemplate(EMAIL_TYPES.RESCHEDULE_NEW_SLOTS, {
                        companyName,
                        jobTitle,
                        note: responseNote ? `（${responseNote}）` : '',
                        actionUrl: this._generateAppointmentUrl(appointmentId, ROLE_C, appointment.status, appointment.jobId),
                    })
                    await NotificationService.sendEmail({
                        to: candidateInfo.email,
                        subject: emailResult.subject,
                        html: emailResult.html,
                        async: EMAIL_ASYNC_MODE,
                    })
                } catch (error) {
                    logger.error('[_sendRescheduleResponseNotification] 邮件发送失败', { appointmentId, error: error.message })
                }
            }
        }
    }

    /**
     * 5. B端主动改期通知 (B端发起改期 → 通知C端)
     */
    async _sendBSideRescheduleNotification(appointment, note) {
        const { candidateId, candidateInfo, jobSnapshot, appointmentId } = appointment
        const companyName = jobSnapshot?.companyName || '企业'
        const jobTitle = jobSnapshot?.title || '职位'

        // 站内消息（"面试待接受"场景）
        try {
            await NotificationService.sendInAppMessage({
                userId: candidateId,
                title: '面试邀约',
                content: '您有新的面试邀约，快去确认吧',
                type: 'INTERVIEW',
                priority: 'HIGH',
                referenceId: appointmentId,
                referenceType: 'Appointment',
                actionUrl: this._generateAppointmentUrl(appointmentId, ROLE_C, appointment.status, appointment.jobId),
                metadata: {
                    appointmentStatus: appointment.status,
                    companyName,
                    jobTitle,
                },
            })
        } catch (error) {
            logger.error('[_sendBSideRescheduleNotification] 站内消息发送失败', { appointmentId, error: error.message })
        }

        // 邮件通知（使用模板）
        if (candidateInfo?.email) {
            try {
                const emailResult = renderEmailTemplate(EMAIL_TYPES.INTERVIEW_RESCHEDULED, {
                    companyName,
                    jobTitle,
                    note: note ? `（${note}）` : '',
                    actionUrl: this._generateAppointmentUrl(appointmentId, ROLE_C, appointment.status, appointment.jobId),
                })
                await NotificationService.sendEmail({
                    to: candidateInfo.email,
                    subject: emailResult.subject,
                    html: emailResult.html,
                    async: EMAIL_ASYNC_MODE,
                })
            } catch (error) {
                logger.error('[_sendBSideRescheduleNotification] 邮件发送失败', { appointmentId, error: error.message })
            }
        }
    }

    /**
     * 6. 拒绝面试通知 (C端拒绝 → 通知B端)
     */
    async _sendRejectionNotification(appointment, reason) {
        const { interviewerId, interviewerInfo, candidateInfo, jobSnapshot, appointmentId } = appointment
        const jobTitle = jobSnapshot?.title || '职位'

        // 站内消息
        try {
            await NotificationService.sendInAppMessage({
                userId: interviewerId,
                title: '面试被拒绝',
                content: '您有面试邀约被候选人拒绝',
                type: 'INTERVIEW',
                referenceId: appointmentId,
                referenceType: 'Appointment',
                actionUrl: this._generateAppointmentUrl(appointmentId, ROLE_B, appointment.status, appointment.jobId),
                metadata: {
                    appointmentStatus: appointment.status,
                    candidateName: candidateInfo?.name,
                    jobTitle,
                },
            })
        } catch (error) {
            logger.error('[_sendRejectionNotification] 站内消息发送失败', { appointmentId, error: error.message })
        }

        // 邮件通知 - 发送给面试官
        const recipientEmail = interviewerInfo?.email
        if (recipientEmail) {
            try {
                const candidateName = candidateInfo?.name || '候选人'
                const emailResult = renderEmailTemplate(EMAIL_TYPES.INTERVIEW_REJECTED_B, {
                    candidateName,
                    jobTitle,
                    reason: reason ? `，原因：${reason}` : '',
                    actionUrl: this._generateAppointmentUrl(appointmentId, ROLE_B, appointment.status, appointment.jobId),
                })
                await NotificationService.sendEmail({
                    to: recipientEmail,
                    subject: emailResult.subject,
                    html: emailResult.html,
                    async: EMAIL_ASYNC_MODE,
                })
                logger.info('[_sendRejectionNotification] 邮件发送成功', { appointmentId })
            } catch (error) {
                logger.error('[_sendRejectionNotification] 邮件发送失败', { appointmentId, error: error.message })
            }
        }
    }

    /**
     * 7. 面试取消通知 (B/C取消 → 通知对方)
     */
    async _sendCancellationNotification(appointment, reason, cancelledBy) {
        const { candidateId, interviewerId, jobSnapshot, appointmentId } = appointment
        const isCompanyCancelled = cancelledBy === 'B'
        const companyName = jobSnapshot?.companyName || '企业'
        const jobTitle = jobSnapshot?.title || '职位'

        // 确保双方信息有效（修复历史数据）
        const candidateInfo = await this._ensureCandidateInfo(appointment)
        const interviewerInfo = await this._ensureInterviewerInfo(appointment)

        // 通知对象：B取消→通知C，C取消→通知B
        const recipientId = isCompanyCancelled ? candidateId : interviewerId
        const recipientEmail = isCompanyCancelled ? candidateInfo?.email : interviewerInfo?.email
        const actionUrl = isCompanyCancelled
            ? this._generateAppointmentUrl(appointmentId, ROLE_C, appointment.status, appointment.jobId)
            : this._generateAppointmentUrl(appointmentId, ROLE_B, appointment.status, appointment.jobId)

        // 站内消息
        try {
            await NotificationService.sendInAppMessage({
                userId: recipientId,
                title: '面试已取消',
                content: '您有待开始面试已被取消',
                type: 'INTERVIEW',
                referenceId: appointmentId,
                referenceType: 'Appointment',
                actionUrl,
                metadata: {
                    appointmentStatus: appointment.status,
                    cancelledBy,
                    companyName,
                    jobTitle,
                },
            })
        } catch (error) {
            logger.error('[_sendCancellationNotification] 站内消息发送失败', { appointmentId, error: error.message })
        }

        // 邮件通知（使用模板，根据取消方选择不同模板）
        if (recipientEmail) {
            try {
                const emailType = isCompanyCancelled ? EMAIL_TYPES.INTERVIEW_CANCELLED : EMAIL_TYPES.INTERVIEW_CANCELLED_B
                const candidateName = candidateInfo?.name || '未知'

                const emailResult = renderEmailTemplate(emailType, {
                    companyName,
                    jobTitle,
                    candidateName,
                    reason: reason ? `（原因：${reason}）` : '',
                    actionUrl: isCompanyCancelled
                        ? `${process.env.JOB_APPOINTMENT_URL_C || ''}/jobs`
                        : this._generateAppointmentUrl(appointmentId, ROLE_B, appointment.status, appointment.jobId),
                })
                await NotificationService.sendEmail({
                    to: recipientEmail,
                    subject: emailResult.subject,
                    html: emailResult.html,
                    async: EMAIL_ASYNC_MODE,
                })
            } catch (error) {
                logger.error('[_sendCancellationNotification] 邮件发送失败', { appointmentId, error: error.message })
            }
        }
    }

    /**
     * 8. 面试邀约超时通知 - 情况2 (C端超时7天 → 通知B端)
     */
    async _sendExpiredNotification(appointment) {
        const { interviewerId, interviewerInfo, candidateInfo, jobSnapshot, appointmentId } = appointment
        const jobTitle = jobSnapshot?.title || '职位'

        // 站内消息
        try {
            await NotificationService.sendInAppMessage({
                userId: interviewerId,
                title: '面试邀约已取消',
                content: '您有面试超过7天未确认时间，已自动取消',
                type: 'INTERVIEW',
                referenceId: appointmentId,
                referenceType: 'Appointment',
                actionUrl: this._generateAppointmentUrl(appointmentId, ROLE_B, appointment.status, appointment.jobId),
                metadata: {
                    appointmentStatus: appointment.status,
                    expiredBy: 'C', // C端超时
                    candidateName: candidateInfo?.name,
                    jobTitle,
                },
            })
        } catch (error) {
            logger.error('[_sendExpiredNotification] 站内消息发送失败', { appointmentId, error: error.message })
        }

        // 邮件通知 - 发送给面试官
        const recipientEmail = interviewerInfo?.email
        if (recipientEmail) {
            try {
                const candidateName = candidateInfo?.name || '候选人'
                const emailResult = renderEmailTemplate(EMAIL_TYPES.INTERVIEW_EXPIRED_B, {
                    candidateName,
                    jobTitle,
                    actionUrl: this._generateAppointmentUrl(appointmentId, ROLE_B, appointment.status, appointment.jobId),
                })
                await NotificationService.sendEmail({
                    to: recipientEmail,
                    subject: emailResult.subject,
                    html: emailResult.html,
                    async: EMAIL_ASYNC_MODE,
                })
                logger.info('[_sendExpiredNotification] 邮件发送成功', { appointmentId })
            } catch (error) {
                logger.error('[_sendExpiredNotification] 邮件发送失败', { appointmentId, error: error.message })
            }
        }
    }

    /**
     * 9. 改期申请超时通知 - 情况2 (B端超时7天 → 通知C端)
     */
    async _sendExpiredNotificationToCandidate(appointment) {
        const { candidateId, candidateInfo, jobSnapshot, appointmentId } = appointment
        const companyName = jobSnapshot?.companyName || '企业'
        const jobTitle = jobSnapshot?.title || '职位'

        // 站内消息
        try {
            await NotificationService.sendInAppMessage({
                userId: candidateId,
                title: '面试邀约已取消',
                content: '您有面试超过7天未确认时间，已自动取消',
                type: 'INTERVIEW',
                referenceId: appointmentId,
                referenceType: 'Appointment',
                actionUrl: this._generateAppointmentUrl(appointmentId, ROLE_C, appointment.status, appointment.jobId),
                metadata: {
                    appointmentStatus: appointment.status,
                    expiredBy: 'B', // B端超时
                    companyName,
                    jobTitle,
                },
            })
        } catch (error) {
            logger.error('[_sendExpiredNotificationToCandidate] 站内消息发送失败', { appointmentId, error: error.message })
        }

        // 邮件通知 - 发送给候选人
        const recipientEmail = candidateInfo?.email
        if (recipientEmail) {
            try {
                const emailResult = renderEmailTemplate(EMAIL_TYPES.INTERVIEW_EXPIRED_C, {
                    companyName,
                    jobTitle,
                    actionUrl: `${process.env.JOB_APPOINTMENT_URL_C || ''}/jobs`,
                })
                await NotificationService.sendEmail({
                    to: recipientEmail,
                    subject: emailResult.subject,
                    html: emailResult.html,
                    async: EMAIL_ASYNC_MODE,
                })
                logger.info('[_sendExpiredNotificationToCandidate] 邮件发送成功', { appointmentId })
            } catch (error) {
                logger.error('[_sendExpiredNotificationToCandidate] 邮件发送失败', { appointmentId, error: error.message })
            }
        }
    }

    // ============= Phase P1: 即将超时提醒 =============

    /**
     * 处理即将超时的预约 - 提前1天提醒（情况1）
     * 定时任务调用，发送即将超时提醒给等待方
     * @returns {Promise<number>} 处理的预约数量
     */
    async processUpcomingExpirationReminders() {
        const upcomingExpiration = await InterviewAppointment.findUpcomingExpirationAppointments()

        let processedCount = 0
        for (const appointment of upcomingExpiration) {
            try {
                await this._sendExpirationWarningNotification(appointment)

                // 标记已发送提醒
                appointment.expirationWarningNotified = true
                await appointment.save()

                processedCount++
            } catch (error) {
                logger.error('[InterviewAppointmentService] Failed to send expiration warning', {
                    appointmentId: appointment.appointmentId,
                    error: error.message,
                })
            }
        }

        if (processedCount > 0) {
            logger.info('[InterviewAppointmentService] Processed upcoming expiration reminders', {
                count: processedCount,
            })
        }

        return processedCount
    }

    /**
     * 10. 即将超时提醒 - 情况1 (还剩1天即将超时 → 提醒等待方)
     * C端待确认 → 提醒C端；B端待审批改期 → 提醒B端
     */
    async _sendExpirationWarningNotification(appointment) {
        const { candidateId, candidateInfo, interviewerId, interviewerInfo, jobSnapshot, appointmentId, status, inviteToken } = appointment
        const companyName = jobSnapshot?.companyName || '企业'
        const jobTitle = jobSnapshot?.title || '职位'

        // 根据状态判断通知对象
        const isWaitingForCandidate = status === 'initiated'
        const recipientId = isWaitingForCandidate ? candidateId : interviewerId
        const recipientEmail = isWaitingForCandidate ? candidateInfo?.email : interviewerInfo?.email
        const actionUrl = isWaitingForCandidate
            ? this._generateInviteUrl(inviteToken)
            : this._generateAppointmentUrl(appointmentId, ROLE_B, appointment.status, appointment.jobId)

        // 站内消息
        try {
            await NotificationService.sendInAppMessage({
                userId: recipientId,
                title: '面试邀约即将过期',
                content: '您有面试邀约即将超过7天未确认时间',
                type: 'INTERVIEW',
                priority: 'HIGH',
                referenceId: appointmentId,
                referenceType: 'Appointment',
                actionUrl,
                metadata: {
                    appointmentStatus: appointment.status,
                    waitingFor: isWaitingForCandidate ? 'C' : 'B',
                    companyName,
                    jobTitle,
                },
            })
        } catch (error) {
            logger.error('[_sendExpirationWarningNotification] 站内消息发送失败', { appointmentId, error: error.message })
        }

        // 邮件通知 - 发送给等待方
        if (recipientEmail) {
            try {
                const emailResult = renderEmailTemplate(EMAIL_TYPES.INTERVIEW_EXPIRING_WARNING, {
                    jobTitle,
                    actionUrl: isWaitingForCandidate
                        ? `${process.env.JOB_APPOINTMENT_URL_C || ''}/interviews/invite/${inviteToken}`
                        : this._generateAppointmentUrl(appointmentId, ROLE_B, appointment.status, appointment.jobId),
                })
                await NotificationService.sendEmail({
                    to: recipientEmail,
                    subject: emailResult.subject,
                    html: emailResult.html,
                    async: EMAIL_ASYNC_MODE,
                })
                logger.info('[_sendExpirationWarningNotification] 邮件发送成功', { appointmentId })
            } catch (error) {
                logger.error('[_sendExpirationWarningNotification] 邮件发送失败', { appointmentId, error: error.message })
            }
        }
    }

    // ============= Phase P1: 面试开始提醒 =============

    /**
     * 处理24小时前提醒（节点1）
     * @returns {Promise<number>} 处理的预约数量
     */
    async process24HourReminders() {
        const interviews = await InterviewAppointment.findInterviewsFor24HourReminder()

        let processedCount = 0
        for (const appointment of interviews) {
            try {
                await this._send24HourNotification(appointment)

                // 标记已发送提醒
                appointment.twentyFourHourReminderSent = true
                await appointment.save()

                processedCount++
            } catch (error) {
                logger.error('[InterviewAppointmentService] Failed to send 24-hour notification', {
                    appointmentId: appointment.appointmentId,
                    error: error.message,
                })
            }
        }

        if (processedCount > 0) {
            logger.info('[InterviewAppointmentService] Processed 24-hour reminders', {
                count: processedCount,
            })
        }

        return processedCount
    }

    /**
     * 处理30分钟前提醒（节点2）
     * @returns {Promise<number>} 处理的预约数量
     */
    async process30MinuteReminders() {
        const upcomingInterviews = await InterviewAppointment.findUpcomingInterviews(30)

        let processedCount = 0
        for (const appointment of upcomingInterviews) {
            try {
                await this._send30MinuteNotification(appointment)

                // 标记已发送提醒
                appointment.thirtyMinuteReminderSent = true
                await appointment.save()

                processedCount++
            } catch (error) {
                logger.error('[InterviewAppointmentService] Failed to send 30-minute notification', {
                    appointmentId: appointment.appointmentId,
                    error: error.message,
                })
            }
        }

        if (processedCount > 0) {
            logger.info('[InterviewAppointmentService] Processed 30-minute reminders', {
                count: processedCount,
            })
        }

        return processedCount
    }

    /**
     * 处理面试开始提醒（节点3）- 仅通知未进入房间方
     * @returns {Promise<number>} 处理的预约数量
     */
    async processStartingInterviewReminders() {
        const startingInterviews = await InterviewAppointment.findStartingInterviews()

        let processedCount = 0
        for (const appointment of startingInterviews) {
            try {
                // 检查房间状态，判断谁在房间内
                let notifyCandidate = true
                let notifyInterviewer = true

                if (appointment.meeting?.roomId) {
                    try {
                        const roomStatus = await VerTCService.getRoomStatus(appointment.meeting.roomId)
                        const onlineUserIds = roomStatus.onlineUsers?.map(u => u.userId) || []

                        notifyCandidate = !onlineUserIds.includes(appointment.candidateId)
                        notifyInterviewer = !onlineUserIds.includes(appointment.interviewerId)

                        logger.info('[InterviewAppointmentService] Room status checked', {
                            appointmentId: appointment.appointmentId,
                            roomId: appointment.meeting.roomId,
                            onlineUsers: onlineUserIds,
                            notifyCandidate,
                            notifyInterviewer,
                        })
                    } catch (roomError) {
                        logger.warn('[InterviewAppointmentService] Failed to get room status, will notify both', {
                            appointmentId: appointment.appointmentId,
                            error: roomError.message,
                        })
                        // 获取房间状态失败时，默认通知双方
                    }
                }

                // 仅当有人需要通知时才发送
                if (notifyCandidate || notifyInterviewer) {
                    await this._sendInterviewStartedNotification(appointment, notifyCandidate, notifyInterviewer)
                }

                // 标记已发送提醒
                appointment.startReminderSent = true
                await appointment.save()

                processedCount++
            } catch (error) {
                logger.error('[InterviewAppointmentService] Failed to send interview started notification', {
                    appointmentId: appointment.appointmentId,
                    error: error.message,
                })
            }
        }

        if (processedCount > 0) {
            logger.info('[InterviewAppointmentService] Processed starting interview reminders', {
                count: processedCount,
            })
        }

        return processedCount
    }

    /**
     * 节点1: 24小时前提醒
     * 通知双方：候选人 + 面试官
     */
    async _send24HourNotification(appointment) {
        const { candidateId, interviewerId, jobSnapshot, appointmentId } = appointment
        const companyName = jobSnapshot?.companyName || '企业'
        const jobTitle = jobSnapshot?.title || '职位'

        // 确保双方信息有效（修复历史数据）
        const candidateInfo = await this._ensureCandidateInfo(appointment)
        const candidateName = candidateInfo?.name || '候选人'
        const interviewerInfo = await this._ensureInterviewerInfo(appointment)

        // 通知候选人 - 站内消息
        try {
            await NotificationService.sendInAppMessage({
                userId: candidateId,
                title: '面试提醒',
                content: '您有面试将在24小时内开始，请提前做好准备',
                type: 'INTERVIEW',
                priority: 'NORMAL',
                referenceId: appointmentId,
                referenceType: 'Appointment',
                actionUrl: this._generateAppointmentUrl(appointmentId, ROLE_C, appointment.status, appointment.jobId),
                metadata: {
                    appointmentStatus: appointment.status,
                    companyName,
                    jobTitle,
                },
            })
        } catch (error) {
            logger.error('[_send24HourNotification] C端站内消息发送失败', { appointmentId, error: error.message })
        }

        // 通知候选人 - 邮件
        if (candidateInfo?.email) {
            try {
                const emailContent = renderEmailTemplate(EMAIL_TYPES.INTERVIEW_STARTING, {
                    companyName,
                    jobTitle,
                    interviewStartTime: formatInterviewTime(appointment.selectedTimeSlot?.startTime),
                    actionUrl: this._generateAppointmentUrl(appointmentId, ROLE_C, appointment.status, appointment.jobId),
                })
                await NotificationService.sendEmail({
                    to: candidateInfo.email,
                    subject: emailContent.subject,
                    html: emailContent.html,
                    text: emailContent.text,
                    async: EMAIL_ASYNC_MODE,
                })
            } catch (error) {
                logger.error('[_send24HourNotification] C端邮件发送失败', { appointmentId, error: error.message })
            }
        }

        // 通知面试官 - 站内消息
        try {
            await NotificationService.sendInAppMessage({
                userId: interviewerId,
                title: '面试提醒',
                content: `您与 ${candidateName} 的面试将在24小时内开始`,
                type: 'INTERVIEW',
                priority: 'NORMAL',
                referenceId: appointmentId,
                referenceType: 'Appointment',
                actionUrl: this._generateAppointmentUrl(appointmentId, ROLE_B, appointment.status, appointment.jobId),
                metadata: {
                    appointmentStatus: appointment.status,
                    candidateName,
                    jobTitle,
                },
            })
        } catch (error) {
            logger.error('[_send24HourNotification] B端站内消息发送失败', { appointmentId, error: error.message })
        }

        // 通知面试官 - 邮件
        if (interviewerInfo?.email) {
            try {
                const emailContent = renderEmailTemplate(EMAIL_TYPES.INTERVIEW_STARTING_B, {
                    candidateName,
                    jobTitle,
                    interviewStartTime: formatInterviewTime(appointment.selectedTimeSlot?.startTime),
                    actionUrl: this._generateAppointmentUrl(appointmentId, ROLE_B, appointment.status, appointment.jobId),
                })
                await NotificationService.sendEmail({
                    to: interviewerInfo.email,
                    subject: emailContent.subject,
                    html: emailContent.html,
                    text: emailContent.text,
                    async: EMAIL_ASYNC_MODE,
                })
            } catch (error) {
                logger.error('[_send24HourNotification] B端邮件发送失败', { appointmentId, error: error.message })
            }
        }
    }

    /**
     * 节点2: 30分钟前提醒
     * 通知双方：候选人 + 面试官
     */
    async _send30MinuteNotification(appointment) {
        const { candidateId, interviewerId, jobSnapshot, appointmentId } = appointment
        const companyName = jobSnapshot?.companyName || '企业'
        const jobTitle = jobSnapshot?.title || '职位'

        // 确保双方信息有效（修复历史数据）
        const candidateInfo = await this._ensureCandidateInfo(appointment)
        const candidateName = candidateInfo?.name || '候选人'
        const interviewerInfo = await this._ensureInterviewerInfo(appointment)

        // 通知候选人 - 站内消息
        try {
            await NotificationService.sendInAppMessage({
                userId: candidateId,
                title: '面试即将开始',
                content: '您有面试将在30分钟内开始，请做好准备',
                type: 'INTERVIEW',
                priority: 'HIGH',
                referenceId: appointmentId,
                referenceType: 'Appointment',
                actionUrl: this._generateAppointmentUrl(appointmentId, ROLE_C, appointment.status, appointment.jobId),
                metadata: {
                    appointmentStatus: appointment.status,
                    companyName,
                    jobTitle,
                },
            })
        } catch (error) {
            logger.error('[_send30MinuteNotification] C端站内消息发送失败', { appointmentId, error: error.message })
        }

        // 通知候选人 - 邮件（使用 30 分钟专用模板）
        if (candidateInfo?.email) {
            try {
                const emailContent = renderEmailTemplate(EMAIL_TYPES.INTERVIEW_STARTING_30MIN, {
                    companyName,
                    jobTitle,
                    interviewStartTime: formatInterviewTime(appointment.selectedTimeSlot?.startTime),
                    actionUrl: this._generateAppointmentUrl(appointmentId, ROLE_C, appointment.status, appointment.jobId),
                })
                await NotificationService.sendEmail({
                    to: candidateInfo.email,
                    subject: emailContent.subject,
                    html: emailContent.html,
                    text: emailContent.text,
                    async: EMAIL_ASYNC_MODE,
                })
            } catch (error) {
                logger.error('[_send30MinuteNotification] C端邮件发送失败', { appointmentId, error: error.message })
            }
        }

        // 通知面试官 - 站内消息
        try {
            await NotificationService.sendInAppMessage({
                userId: interviewerId,
                title: '面试即将开始',
                content: `您与 ${candidateName} 的面试将在30分钟内开始`,
                type: 'INTERVIEW',
                priority: 'HIGH',
                referenceId: appointmentId,
                referenceType: 'Appointment',
                actionUrl: this._generateAppointmentUrl(appointmentId, ROLE_B, appointment.status, appointment.jobId),
                metadata: {
                    appointmentStatus: appointment.status,
                    candidateName,
                    jobTitle,
                },
            })
        } catch (error) {
            logger.error('[_send30MinuteNotification] B端站内消息发送失败', { appointmentId, error: error.message })
        }

        // 通知面试官 - 邮件（使用 30 分钟专用模板）
        if (interviewerInfo?.email) {
            try {
                const emailContent = renderEmailTemplate(EMAIL_TYPES.INTERVIEW_STARTING_30MIN_B, {
                    candidateName,
                    jobTitle,
                    interviewStartTime: formatInterviewTime(appointment.selectedTimeSlot?.startTime),
                    actionUrl: this._generateAppointmentUrl(appointmentId, ROLE_B, appointment.status, appointment.jobId),
                })
                await NotificationService.sendEmail({
                    to: interviewerInfo.email,
                    subject: emailContent.subject,
                    html: emailContent.html,
                    text: emailContent.text,
                    async: EMAIL_ASYNC_MODE,
                })
            } catch (error) {
                logger.error('[_send30MinuteNotification] B端邮件发送失败', { appointmentId, error: error.message })
            }
        }
    }

    /**
     * 节点3: 面试已开始提醒（面试开始时刻）
     * 通知未进入房间的一方（站内消息 + 邮件）
     * @param {Object} appointment - 预约对象
     * @param {boolean} notifyCandidate - 是否通知候选人
     * @param {boolean} notifyInterviewer - 是否通知面试官
     */
    async _sendInterviewStartedNotification(appointment, notifyCandidate = true, notifyInterviewer = true) {
        const { candidateId, interviewerId, jobSnapshot, appointmentId } = appointment
        const companyName = jobSnapshot?.companyName || '企业'
        const jobTitle = jobSnapshot?.title || '职位'

        // 确保双方信息有效（修复历史数据）
        const candidateInfo = await this._ensureCandidateInfo(appointment)
        const interviewerInfo = await this._ensureInterviewerInfo(appointment)
        const candidateName = candidateInfo?.name || '候选人'

        // 通知候选人 - 站内消息 + 邮件
        if (notifyCandidate) {
            try {
                await NotificationService.sendInAppMessage({
                    userId: candidateId,
                    title: '面试已开始',
                    content: '您有面试已开始，请快速进入',
                    type: 'INTERVIEW',
                    priority: 'URGENT',
                    referenceId: appointmentId,
                    referenceType: 'Appointment',
                    actionUrl: this._generateAppointmentUrl(appointmentId, ROLE_C, appointment.status, appointment.jobId),
                    metadata: {
                        appointmentStatus: appointment.status,
                        companyName,
                        jobTitle,
                    },
                })
                logger.info('[_sendInterviewStartedNotification] C端站内消息发送成功', { appointmentId })
            } catch (error) {
                logger.error('[_sendInterviewStartedNotification] C端站内消息发送失败', { appointmentId, error: error.message })
            }

            // C端邮件
            if (candidateInfo?.email) {
                try {
                    const emailContent = renderEmailTemplate(EMAIL_TYPES.INTERVIEW_STARTED, {
                        companyName,
                        jobTitle,
                        interviewStartTime: formatInterviewTime(appointment.selectedTimeSlot?.startTime),
                        actionUrl: this._generateAppointmentUrl(appointmentId, ROLE_C, appointment.status, appointment.jobId),
                    })
                    await NotificationService.sendEmail({
                        to: candidateInfo.email,
                        subject: emailContent.subject,
                        html: emailContent.html,
                        async: EMAIL_ASYNC_MODE,
                    })
                    logger.info('[_sendInterviewStartedNotification] C端邮件发送成功', { appointmentId })
                } catch (error) {
                    logger.error('[_sendInterviewStartedNotification] C端邮件发送失败', { appointmentId, error: error.message })
                }
            }
        }

        // 通知面试官 - 站内消息 + 邮件
        if (notifyInterviewer) {
            try {
                await NotificationService.sendInAppMessage({
                    userId: interviewerId,
                    title: '面试已开始',
                    content: `您与 ${candidateName} 的面试已开始`,
                    type: 'INTERVIEW',
                    priority: 'URGENT',
                    referenceId: appointmentId,
                    referenceType: 'Appointment',
                    actionUrl: this._generateAppointmentUrl(appointmentId, ROLE_B, appointment.status, appointment.jobId),
                    metadata: {
                        appointmentStatus: appointment.status,
                        candidateName,
                        jobTitle,
                    },
                })
                logger.info('[_sendInterviewStartedNotification] B端站内消息发送成功', { appointmentId })
            } catch (error) {
                logger.error('[_sendInterviewStartedNotification] B端站内消息发送失败', { appointmentId, error: error.message })
            }

            // B端邮件
            if (interviewerInfo?.email) {
                try {
                    const emailContent = renderEmailTemplate(EMAIL_TYPES.INTERVIEW_STARTED_B, {
                        candidateName,
                        jobTitle,
                        interviewStartTime: formatInterviewTime(appointment.selectedTimeSlot?.startTime),
                        actionUrl: this._generateAppointmentUrl(appointmentId, ROLE_B, appointment.status, appointment.jobId),
                    })
                    await NotificationService.sendEmail({
                        to: interviewerInfo.email,
                        subject: emailContent.subject,
                        html: emailContent.html,
                        async: EMAIL_ASYNC_MODE,
                    })
                    logger.info('[_sendInterviewStartedNotification] B端邮件发送成功', { appointmentId })
                } catch (error) {
                    logger.error('[_sendInterviewStartedNotification] B端邮件发送失败', { appointmentId, error: error.message })
                }
            }
        }
    }

    // ============= 支付相关私有方法 =============

    /**
     * C端进入面试时触发扣款（幂等）
     * @param {Object} appointment - 预约对象
     * @returns {Promise<void>}
     * @throws {Error} 扣款失败时抛出错误，阻塞主流程
     */
    async _chargeOnCandidateJoin(appointment) {
        const { payment, appointmentId } = appointment

        // 无支付信息或非冻结状态，跳过
        if (!hasPayment(payment)) {
            logger.debug('[InterviewAppointmentService] No payment to charge', { appointmentId })
            return
        }

        // 幂等检查：已扣款则跳过
        if (!canCharge(payment.status)) {
            logger.info('[InterviewAppointmentService] Payment already processed, skipping charge', {
                appointmentId,
                paymentStatus: payment.status,
            })
            return
        }

        logger.info('[InterviewAppointmentService] Charging payment on candidate join', {
            appointmentId,
            orderId: payment.orderId,
            amount: payment.amount,
        })

        try {
            // 调用 payment-service 确认订单（PAID → COMPLETED）
            const chargeResult = await PaymentService.confirmOrder(payment.orderId, {
                description: `面试费用扣款 - ${appointmentId}`,
                comment: `面试费用扣款 - ${appointmentId}`,
                userId: appointment.interviewerId,
            })

            // 更新支付状态
            appointment.payment.status = PAYMENT_STATUS.CHARGED
            appointment.payment.chargedAt = new Date()
            appointment.payment.transactionId = chargeResult?.orderId || null
            await appointment.save()

            logger.info('[InterviewAppointmentService] Payment charged successfully', {
                appointmentId,
                orderId: payment.orderId,
                transactionId: chargeResult?.orderId,
            })

            // 发送扣款通知给 B 端（已禁用）
            // this._sendPaymentChargedNotification(appointment).catch(error => {
            //     logger.error('[InterviewAppointmentService] Failed to send charge notification', {
            //         appointmentId,
            //         error: error.message,
            //     })
            // })
        } catch (error) {
            // 扣款失败，记录错误但不更新状态为 FAILED（保持 FROZEN 以便重试）
            logger.error('[InterviewAppointmentService] Payment charge failed', {
                appointmentId,
                orderId: payment.orderId,
                error: error.message,
            })

            // 抛出错误，阻塞主流程（C端无法获取 meeting token）
            throw new AppError(
                `面试费用扣款失败，请稍后重试: ${error.message}`,
                ERROR_CODES.EXTERNAL_SERVICE_ERROR || ERROR_CODES.INTERNAL_ERROR
            )
        }
    }

    /**
     * 面试终止时处理退款（幂等）
     * @param {Object} appointment - 预约对象
     * @param {string} scenario - 退款场景（用于日志和通知）
     * @returns {Promise<void>}
     */
    async _processRefund(appointment, scenario) {
        const { payment, appointmentId } = appointment

        // 无支付信息，跳过
        if (!hasPayment(payment)) {
            logger.debug('[InterviewAppointmentService] No payment to refund', { appointmentId })
            return
        }

        // 幂等检查：只有 FROZEN 状态才能退款
        if (!canRefund(payment.status)) {
            logger.info('[InterviewAppointmentService] Payment cannot be refunded, skipping', {
                appointmentId,
                paymentStatus: payment.status,
                scenario,
            })
            return
        }

        const refundReason = REFUND_REASON_DESCRIPTIONS[scenario] || scenario
        logger.info('[InterviewAppointmentService] Processing refund', {
            appointmentId,
            orderId: payment.orderId,
            amount: payment.amount,
            scenario,
            reason: refundReason,
        })

        try {
            // 调用 payment-service 退款
            const refundResult = await PaymentService.refundOrder(payment.orderId, {
                amount: payment.amount,
                reason: refundReason,
                comment: `面试费用退款 - ${appointmentId} - ${refundReason}`,
                userId: appointment.interviewerId,
            })

            // 更新支付状态
            appointment.payment.status = PAYMENT_STATUS.REFUNDED
            appointment.payment.refundedAt = new Date()
            appointment.payment.refundAmount = refundResult?.refundAmount || payment.amount
            appointment.payment.refundReason = refundReason
            await appointment.save()

            logger.info('[InterviewAppointmentService] Payment refunded successfully', {
                appointmentId,
                orderId: payment.orderId,
                refundAmount: appointment.payment.refundAmount,
            })

            // 发送退款通知给 B 端（异步，不阻塞主流程）
            this._sendPaymentRefundedNotification(appointment, scenario).catch(error => {
                logger.error('[InterviewAppointmentService] Failed to send refund notification', {
                    appointmentId,
                    error: error.message,
                })
            })
        } catch (error) {
            // 退款失败，记录错误（不阻塞主流程，因为预约状态已经变更）
            logger.error('[InterviewAppointmentService] Payment refund failed', {
                appointmentId,
                orderId: payment.orderId,
                scenario,
                error: error.message,
            })

            // 记录失败原因到 payment
            appointment.payment.failReason = `退款失败: ${error.message}`
            await appointment.save()
        }
    }

    /**
     * 发送扣款通知给 B 端
     * @param {Object} appointment - 预约对象
     */
    async _sendPaymentChargedNotification(appointment) {
        const { interviewerId, interviewerInfo, candidateInfo, jobSnapshot, appointmentId, payment } = appointment
        const jobTitle = jobSnapshot?.title || '职位'
        const candidateName = candidateInfo?.name || '候选人'
        const amount = payment?.amount || 0

        // 站内消息
        try {
            await NotificationService.sendInAppMessage({
                userId: interviewerId,
                title: '面试费用已扣除',
                content: `候选人 ${candidateName} 已进入面试，费用 ${amount} 元已从账户扣除`,
                type: 'PAYMENT',
                referenceId: appointmentId,
                referenceType: 'Appointment',
                actionUrl: this._generateAppointmentUrl(appointmentId, ROLE_B, appointment.status, appointment.jobId),
                metadata: {
                    paymentStatus: PAYMENT_STATUS.CHARGED,
                    amount,
                    candidateName,
                    jobTitle,
                },
            })
        } catch (error) {
            logger.error('[_sendPaymentChargedNotification] 站内消息发送失败', { appointmentId, error: error.message })
        }

        // 邮件通知（如果需要的话可以启用）
        // 暂时只发站内消息，避免邮件过多
    }

    /**
     * 发送退款通知给 B 端
     * @param {Object} appointment - 预约对象
     * @param {string} scenario - 退款场景
     */
    async _sendPaymentRefundedNotification(appointment, scenario) {
        const { interviewerId, interviewerInfo, candidateInfo, jobSnapshot, appointmentId, payment } = appointment
        const jobTitle = jobSnapshot?.title || '职位'
        const candidateName = candidateInfo?.name || '候选人'
        const refundAmount = payment?.refundAmount || payment?.amount || 0
        const refundReason = REFUND_REASON_DESCRIPTIONS[scenario] || scenario

        // 站内消息
        try {
            await NotificationService.sendInAppMessage({
                userId: interviewerId,
                title: '面试费用已退还',
                content: `面试费用 ${refundAmount} 元已退还至账户（${refundReason}）`,
                type: 'PAYMENT',
                referenceId: appointmentId,
                referenceType: 'Appointment',
                actionUrl: this._generateAppointmentUrl(appointmentId, ROLE_B, appointment.status, appointment.jobId),
                metadata: {
                    paymentStatus: PAYMENT_STATUS.REFUNDED,
                    refundAmount,
                    refundReason,
                    candidateName,
                    jobTitle,
                },
            })
        } catch (error) {
            logger.error('[_sendPaymentRefundedNotification] 站内消息发送失败', { appointmentId, error: error.message })
        }

        // 邮件通知（如果需要的话可以启用）
        // 暂时只发站内消息，避免邮件过多
    }

    /**
     * 获取面试实际时长
     * 查询缓存或调用火山 RTC API 获取面试的实际开始/结束时间
     *
     * 处理顺序：
     * 1. 完整缓存：有 actualStartTime + actualEndTime → source: "cached"
     * 2. 调用火山 API（正确时间范围）→ source: "realtime"
     * 3. 降级：有 actualEndTime 但无 actualStartTime → 用 scheduledStartTime 估算 → source: "estimated"
     *
     * @param {string} appointmentId - 预约 ID
     * @returns {Promise<Object>} 时长信息
     */
    async getMeetingDuration(appointmentId) {
        const appointment = await findBySmartIdOrThrow(InterviewAppointment, appointmentId, {
            errorMessage: 'Appointment not found',
        })

        // 检查是否有会议信息
        if (!appointment.meeting?.roomId) {
            return {
                appointmentId: appointment.appointmentId,
                roomId: null,
                scheduledDuration: appointment.duration,
                actualDuration: null,
                actualStartTime: null,
                actualEndTime: null,
                isFinished: false,
                source: null,
                error: '面试预约尚未生成会议房间',
            }
        }

        const { roomId, scheduledStartTime, scheduledEndTime, actualStartTime, actualEndTime } = appointment.meeting

        // 1. 完整缓存：同时有 actualStartTime 和 actualEndTime
        if (actualStartTime && actualEndTime) {
            const actualDurationMs = new Date(actualEndTime) - new Date(actualStartTime)
            const actualDurationMinutes = Math.round(actualDurationMs / 60000)

            logger.info('[InterviewAppointmentService] getMeetingDuration from cache', {
                appointmentId: appointment.appointmentId,
                roomId,
                actualDuration: actualDurationMinutes,
            })

            return {
                appointmentId: appointment.appointmentId,
                roomId,
                scheduledDuration: appointment.duration,
                actualDuration: actualDurationMinutes,
                actualStartTime,
                actualEndTime,
                isFinished: true,
                source: 'cached',
            }
        }

        // 2. 调用火山 RTC API 获取房间历史信息
        // 关键修复：使用基于面试时间的查询范围，而不是固定 6 小时
        try {
            const queryStartTime = new Date(new Date(scheduledStartTime).getTime() - 1 * 3600000) // 预定前 1 小时
            const queryEndTime = new Date(new Date(scheduledStartTime).getTime() + 24 * 3600000) // 预定后 24 小时

            logger.info('[InterviewAppointmentService] getMeetingDuration calling RTC API', {
                appointmentId: appointment.appointmentId,
                roomId,
                queryStartTime,
                queryEndTime,
            })

            const historyStatus = await VerTCService.getRoomHistory(roomId, queryStartTime, queryEndTime)

            // 检查是否获取到历史数据
            if (historyStatus.found && historyStatus.startTime && historyStatus.endTime) {
                const rtcStartTime = historyStatus.startTime
                const rtcEndTime = historyStatus.endTime

                // 计算实际时长
                const actualDurationMs = new Date(rtcEndTime) - new Date(rtcStartTime)
                const actualDurationMinutes = Math.round(actualDurationMs / 60000)

                // 存储到数据库缓存
                await InterviewAppointment.updateOne(
                    { appointmentId: appointment.appointmentId },
                    {
                        $set: {
                            'meeting.actualStartTime': rtcStartTime,
                            'meeting.actualEndTime': rtcEndTime,
                        },
                    },
                )

                logger.info('[InterviewAppointmentService] getMeetingDuration from RTC API and cached', {
                    appointmentId: appointment.appointmentId,
                    roomId,
                    actualDuration: actualDurationMinutes,
                    actualStartTime: rtcStartTime,
                    actualEndTime: rtcEndTime,
                })

                return {
                    appointmentId: appointment.appointmentId,
                    roomId,
                    scheduledDuration: appointment.duration,
                    actualDuration: actualDurationMinutes,
                    actualStartTime: rtcStartTime,
                    actualEndTime: rtcEndTime,
                    isFinished: historyStatus.isFinished || true,
                    source: 'realtime',
                }
            }

            // 3. 降级方案：API 没有返回数据，但数据库有 actualEndTime
            if (actualEndTime) {
                // 用 scheduledStartTime 估算开始时间
                const estimatedStartTime = scheduledStartTime
                const actualDurationMs = new Date(actualEndTime) - new Date(estimatedStartTime)
                const actualDurationMinutes = Math.round(actualDurationMs / 60000)

                logger.info('[InterviewAppointmentService] getMeetingDuration using estimated start time', {
                    appointmentId: appointment.appointmentId,
                    roomId,
                    estimatedStartTime,
                    actualEndTime,
                    actualDuration: actualDurationMinutes,
                })

                return {
                    appointmentId: appointment.appointmentId,
                    roomId,
                    scheduledDuration: appointment.duration,
                    actualDuration: actualDurationMinutes,
                    actualStartTime: estimatedStartTime,
                    actualEndTime,
                    isFinished: true,
                    source: 'estimated',
                    note: '开始时间为预定时间（火山 API 无历史数据）',
                }
            }

            // 房间不存在或未开始
            logger.info('[InterviewAppointmentService] getMeetingDuration - no history data from RTC API', {
                appointmentId: appointment.appointmentId,
                roomId,
                historyFound: historyStatus.found,
            })

            return {
                appointmentId: appointment.appointmentId,
                roomId,
                scheduledDuration: appointment.duration,
                actualDuration: null,
                actualStartTime: null,
                actualEndTime: null,
                isFinished: false,
                source: 'realtime',
                error: historyStatus.message || '面试尚未结束或数据延迟中（约60秒）',
            }
        } catch (error) {
            logger.error('[InterviewAppointmentService] getMeetingDuration RTC API error', {
                appointmentId: appointment.appointmentId,
                roomId,
                error: error.message,
            })

            // 即使 API 调用失败，如果有 actualEndTime 也尝试降级返回
            if (actualEndTime) {
                const estimatedStartTime = scheduledStartTime
                const actualDurationMs = new Date(actualEndTime) - new Date(estimatedStartTime)
                const actualDurationMinutes = Math.round(actualDurationMs / 60000)

                return {
                    appointmentId: appointment.appointmentId,
                    roomId,
                    scheduledDuration: appointment.duration,
                    actualDuration: actualDurationMinutes,
                    actualStartTime: estimatedStartTime,
                    actualEndTime,
                    isFinished: true,
                    source: 'estimated',
                    note: '开始时间为预定时间（火山 API 调用失败）',
                }
            }

            return {
                appointmentId: appointment.appointmentId,
                roomId,
                scheduledDuration: appointment.duration,
                actualDuration: null,
                actualStartTime: null,
                actualEndTime: null,
                isFinished: false,
                source: null,
                error: `查询失败: ${error.message}`,
            }
        }
    }
}

export default new InterviewAppointmentService()
