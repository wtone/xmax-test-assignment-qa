/**
 * 面试预约控制器
 * @module controllers/appointment_controller
 */

import InterviewAppointmentService from '../services/InterviewAppointmentService.js'
import ApplicationService from '../services/ApplicationService.js'
import VerTCService from '../services/integration/VerTCService.js'
import { sendSuccess, sendError, sendPagination } from '../../utils/response.js'
import { ERROR_CODES } from '../constants/error_codes.js'
import { APPOINTMENT_STATUS_NAMES } from '../constants/appointment_status.js'
import { APPLICATION_STATUS } from '../constants/application_status.js'

/**
 * 面试预约控制器类
 */
class AppointmentController {
    // ============= B 端接口 =============

    /**
     * 创建面试预约（B 端发起）
     * POST /api/v1/appointment-b
     */
    async createAppointment(ctx) {
        try {
            const { body } = ctx.request
            const { userId: interviewerId, companyId } = ctx.state.user

            ctx.logger.info('[createAppointment] 开始创建面试预约', {
                interviewerId,
                companyId,
                candidateId: body.candidateId,
                jobId: body.jobId,
            })

            if (!companyId) {
                throw { ...ERROR_CODES.INVALID_PARAMS, detail: 'B端用户必须关联公司信息' }
            }

            const appointment = await InterviewAppointmentService.createAppointment({
                ...body,
                companyId,
                interviewerId,
            })

            ctx.logger.info('[createAppointment] 面试预约创建成功', {
                appointmentId: appointment.appointmentId,
            })

            sendSuccess(ctx, appointment, '面试预约创建成功', 201)
        } catch (error) {
            ctx.logger.error('[createAppointment] 创建面试预约失败', {
                error: error.message,
                stack: error.stack,
            })
            if (error.code) {
                sendError(ctx, error, error.detail)
            } else {
                sendError(ctx, ERROR_CODES.INTERNAL_ERROR, error.message)
            }
        }
    }

    /**
     * 获取预约列表（B 端）
     * GET /api/v1/appointment-b
     */
    async getAppointments(ctx) {
        try {
            const { companyId, userId: interviewerId } = ctx.state.user
            const { jobId, candidateId, status, dateFrom, dateTo, page, pageSize, sortBy, sortOrder } = ctx.query

            ctx.logger.info('[getAppointments] 获取预约列表', {
                companyId,
                interviewerId,
                filters: { jobId, candidateId, status, dateFrom, dateTo },
            })

            const filters = {
                companyId,
                ...(jobId && { jobId }),
                ...(candidateId && { candidateId }),
                ...(status && { status }),
                ...(dateFrom && { dateFrom }),
                ...(dateTo && { dateTo }),
            }

            // 如果不是管理员，只查看自己作为面试官的预约
            // TODO: 根据实际权限系统调整
            if (!ctx.state.user.isAdmin) {
                filters.interviewerId = interviewerId
            }

            const result = await InterviewAppointmentService.getAppointments(filters, { page: parseInt(page) || 1, pageSize: parseInt(pageSize) || 20 }, { sortBy, sortOrder })

            sendPagination(ctx, result.data, result.pagination)
        } catch (error) {
            ctx.logger.error('[getAppointments] 获取预约列表失败', {
                error: error.message,
            })
            sendError(ctx, ERROR_CODES.INTERNAL_ERROR, error.message)
        }
    }

    /**
     * 获取预约详情（B 端）
     * GET /api/v1/appointment-b/:appointmentId
     */
    async getAppointmentById(ctx) {
        try {
            const { appointmentId } = ctx.params
            const { companyId } = ctx.state.user

            ctx.logger.info('[getAppointmentById] 获取预约详情', {
                appointmentId,
                companyId,
            })

            const appointment = await InterviewAppointmentService.getAppointmentById(appointmentId)

            // 验证权限
            if (appointment.companyId !== companyId) {
                throw ERROR_CODES.FORBIDDEN
            }

            sendSuccess(ctx, appointment)
        } catch (error) {
            ctx.logger.error('[getAppointmentById] 获取预约详情失败', {
                error: error.message,
            })
            if (error.code) {
                sendError(ctx, error)
            } else {
                sendError(ctx, ERROR_CODES.INTERNAL_ERROR, error.message)
            }
        }
    }

    /**
     * B端选择改期时间（同意改期）
     * POST /api/v1/appointment-b/:appointmentId/select-time
     */
    async selectRescheduleTime(ctx) {
        try {
            const { appointmentId } = ctx.params
            const { body } = ctx.request
            const { userId, companyId } = ctx.state.user

            ctx.logger.info('[selectRescheduleTime] B端选择改期时间', {
                appointmentId,
                slotIndex: body.slotIndex,
                operatorId: userId,
            })

            // 先获取预约验证权限
            const existing = await InterviewAppointmentService.getAppointmentById(appointmentId)
            if (existing.companyId !== companyId) {
                throw ERROR_CODES.FORBIDDEN
            }

            const appointment = await InterviewAppointmentService.selectRescheduleTime(appointmentId, body.slotIndex, body.responseNote, userId)

            sendSuccess(ctx, appointment, '已确认改期时间')
        } catch (error) {
            ctx.logger.error('[selectRescheduleTime] B端选择改期时间失败', {
                error: error.message,
            })
            if (error.code) {
                sendError(ctx, error, error.detail)
            } else {
                sendError(ctx, ERROR_CODES.INTERNAL_ERROR, error.message)
            }
        }
    }

    /**
     * B端改期（响应C端改期或主动发起改期）
     * - 当前状态为 RESCHEDULE_REQUESTED：拒绝C端改期，提供新时间段（循环协商）
     * - 当前状态为 SCHEDULE_CONFIRMED：B端主动发起改期，提供新时间段
     * POST /api/v1/appointment-b/:appointmentId/reschedule
     */
    async respondToReschedule(ctx) {
        try {
            const { appointmentId } = ctx.params
            const { body } = ctx.request
            const { userId, companyId } = ctx.state.user

            ctx.logger.info('[respondToReschedule] B端改期', {
                appointmentId,
                proposedSlotsCount: body.proposedSlots?.length,
                operatorId: userId,
            })

            // 先获取预约验证权限
            const existing = await InterviewAppointmentService.getAppointmentById(appointmentId)
            if (existing.companyId !== companyId) {
                throw ERROR_CODES.FORBIDDEN
            }

            const appointment = await InterviewAppointmentService.respondToReschedule(appointmentId, body.proposedSlots, body.responseNote, userId)

            sendSuccess(ctx, appointment, '已提供新时间段，等待候选人选择')
        } catch (error) {
            ctx.logger.error('[respondToReschedule] B端改期失败', {
                error: error.message,
            })
            if (error.code) {
                sendError(ctx, error, error.detail)
            } else {
                sendError(ctx, ERROR_CODES.INTERNAL_ERROR, error.message)
            }
        }
    }

    /**
     * 取消预约（B 端）
     * POST /api/v1/appointment-b/:appointmentId/cancel
     */
    async cancelAppointmentB(ctx) {
        try {
            const { appointmentId } = ctx.params
            const { reason } = ctx.request.body
            const { companyId } = ctx.state.user

            ctx.logger.info('[cancelAppointmentB] B端取消预约', {
                appointmentId,
                reason,
            })

            // 验证权限
            const existing = await InterviewAppointmentService.getAppointmentById(appointmentId)
            if (existing.companyId !== companyId) {
                throw ERROR_CODES.FORBIDDEN
            }

            const appointment = await InterviewAppointmentService.cancelAppointment(appointmentId, reason, 'B')

            sendSuccess(ctx, appointment, '预约已取消')
        } catch (error) {
            ctx.logger.error('[cancelAppointmentB] 取消预约失败', {
                error: error.message,
            })
            if (error.code) {
                sendError(ctx, error, error.detail)
            } else {
                sendError(ctx, ERROR_CODES.INTERNAL_ERROR, error.message)
            }
        }
    }

    /**
     * 标记面试完成（B 端）
     * POST /api/v1/appointment-b/:appointmentId/complete
     */
    async completeAppointment(ctx) {
        try {
            const { appointmentId } = ctx.params
            const { feedback } = ctx.request.body
            const { userId, companyId } = ctx.state.user

            ctx.logger.info('[completeAppointment] 标记面试完成', {
                appointmentId,
                operatorId: userId,
            })

            // 验证权限
            const existing = await InterviewAppointmentService.getAppointmentById(appointmentId)
            if (existing.companyId !== companyId) {
                throw ERROR_CODES.FORBIDDEN
            }

            const appointment = await InterviewAppointmentService.completeAppointment(appointmentId, feedback, userId)

            sendSuccess(ctx, appointment, '面试已完成')
        } catch (error) {
            ctx.logger.error('[completeAppointment] 标记完成失败', {
                error: error.message,
            })
            if (error.code) {
                sendError(ctx, error, error.detail)
            } else {
                sendError(ctx, ERROR_CODES.INTERNAL_ERROR, error.message)
            }
        }
    }

    /**
     * 标记缺席（B 端）
     * POST /api/v1/appointment-b/:appointmentId/no-show
     */
    async markNoShow(ctx) {
        try {
            const { appointmentId } = ctx.params
            const { note } = ctx.request.body
            const { userId, companyId } = ctx.state.user

            ctx.logger.info('[markNoShow] 标记缺席', {
                appointmentId,
                operatorId: userId,
            })

            // 验证权限
            const existing = await InterviewAppointmentService.getAppointmentById(appointmentId)
            if (existing.companyId !== companyId) {
                throw ERROR_CODES.FORBIDDEN
            }

            const appointment = await InterviewAppointmentService.markNoShow(appointmentId, note, userId)

            sendSuccess(ctx, appointment, '已标记为缺席')
        } catch (error) {
            ctx.logger.error('[markNoShow] 标记缺席失败', {
                error: error.message,
            })
            if (error.code) {
                sendError(ctx, error, error.detail)
            } else {
                sendError(ctx, ERROR_CODES.INTERNAL_ERROR, error.message)
            }
        }
    }

    /**
     * 获取面试官日程（B 端）
     * GET /api/v1/appointment-b/schedule
     */
    async getSchedule(ctx) {
        try {
            const { userId: interviewerId } = ctx.state.user
            const { startDate, endDate } = ctx.query

            ctx.logger.info('[getSchedule] 获取面试官日程', {
                interviewerId,
                startDate,
                endDate,
            })

            const schedule = await InterviewAppointmentService.getInterviewerSchedule(interviewerId, new Date(startDate), new Date(endDate))

            sendSuccess(ctx, schedule)
        } catch (error) {
            ctx.logger.error('[getSchedule] 获取日程失败', {
                error: error.message,
            })
            sendError(ctx, ERROR_CODES.INTERNAL_ERROR, error.message)
        }
    }

    /**
     * 获取预约统计（B 端）
     * GET /api/v1/appointment-b/stats
     */
    async getStats(ctx) {
        try {
            const { companyId } = ctx.state.user

            ctx.logger.info('[getStats] 获取预约统计', { companyId })

            const stats = await InterviewAppointmentService.getAppointmentStats(companyId)

            // 添加状态名称映射
            const formattedStats = {
                ...stats,
                statusNames: APPOINTMENT_STATUS_NAMES,
            }

            sendSuccess(ctx, formattedStats)
        } catch (error) {
            ctx.logger.error('[getStats] 获取统计失败', {
                error: error.message,
            })
            sendError(ctx, ERROR_CODES.INTERNAL_ERROR, error.message)
        }
    }

    /**
     * 获取会议加入信息（B 端）
     * GET /api/v1/appointment-b/:appointmentId/meeting
     */
    async getMeetingInfoB(ctx) {
        try {
            const { appointmentId } = ctx.params
            const { userId, companyId } = ctx.state.user

            ctx.logger.info('[getMeetingInfoB] B端获取会议信息', {
                appointmentId,
                userId,
            })

            // 验证权限
            const existing = await InterviewAppointmentService.getAppointmentById(appointmentId)
            if (existing.companyId !== companyId) {
                throw ERROR_CODES.FORBIDDEN
            }

            const meetingInfo = await InterviewAppointmentService.getMeetingJoinInfo(appointmentId, userId, 'interviewer')

            sendSuccess(ctx, meetingInfo)
        } catch (error) {
            ctx.logger.error('[getMeetingInfoB] 获取会议信息失败', {
                error: error.message,
            })
            if (error.code) {
                sendError(ctx, error, error.detail)
            } else {
                sendError(ctx, ERROR_CODES.INTERNAL_ERROR, error.message)
            }
        }
    }

    /**
     * 获取面试房间状态（B 端）
     * 综合查询：用户是否在线、会议起始结束时间
     * GET /api/v1/appointment-b/:appointmentId/room-status
     */
    async getRoomStatusB(ctx) {
        try {
            const { appointmentId } = ctx.params
            const { companyId } = ctx.state.user

            ctx.logger.info('[getRoomStatusB] B端查询房间状态', { appointmentId })

            // 验证权限
            const appointment = await InterviewAppointmentService.getAppointmentById(appointmentId)
            if (appointment.companyId !== companyId) {
                throw ERROR_CODES.FORBIDDEN
            }

            // 检查是否有会议信息（字段名为 meeting）
            if (!appointment.meeting?.roomId) {
                sendSuccess(ctx, {
                    appointmentId,
                    meetingStatus: 'not_configured',
                    message: '面试预约尚未生成会议房间',
                    appointment: {
                        status: appointment.status,
                        selectedTimeSlot: appointment.selectedTimeSlot,
                    },
                })
                return
            }

            const { roomId } = appointment.meeting
            const scheduledStartTime = appointment.selectedTimeSlot?.startTime || appointment.proposedTimeSlots?.[0]?.startTime

            // 调用 VerTCService 获取综合状态
            const roomStatus = await VerTCService.getRoomFullStatus(roomId, scheduledStartTime)

            sendSuccess(ctx, {
                appointmentId,
                ...roomStatus,
                appointment: {
                    status: appointment.status,
                    scheduledStartTime: scheduledStartTime,
                    scheduledEndTime: appointment.selectedTimeSlot?.endTime,
                    duration: appointment.duration,
                },
            })
        } catch (error) {
            ctx.logger.error('[getRoomStatusB] 查询房间状态失败', {
                error: error.message,
            })
            if (error.code) {
                sendError(ctx, error, error.detail)
            } else {
                sendError(ctx, ERROR_CODES.INTERNAL_ERROR, error.message)
            }
        }
    }

    /**
     * 获取面试实际时长（B 端）
     * 查询后缓存到数据库，避免重复调用火山 RTC API
     * GET /api/v1/appointment-b/:appointmentId/meeting-duration
     */
    async getMeetingDuration(ctx) {
        try {
            const { appointmentId } = ctx.params
            const { companyId } = ctx.state.user

            ctx.logger.info('[getMeetingDuration] B端查询面试实际时长', { appointmentId })

            // 验证权限
            const appointment = await InterviewAppointmentService.getAppointmentById(appointmentId)
            if (appointment.companyId !== companyId) {
                throw ERROR_CODES.FORBIDDEN
            }

            const result = await InterviewAppointmentService.getMeetingDuration(appointmentId)

            sendSuccess(ctx, result)
        } catch (error) {
            ctx.logger.error('[getMeetingDuration] 查询面试时长失败', {
                error: error.message,
            })
            if (error.code) {
                sendError(ctx, error, error.detail)
            } else {
                sendError(ctx, ERROR_CODES.INTERNAL_ERROR, error.message)
            }
        }
    }

    // ============= C 端接口 =============

    /**
     * 通过邀请链接获取预约信息（C 端）
     * GET /api/v1/appointment-c/invite/:token
     */
    async getAppointmentByToken(ctx) {
        try {
            const { token } = ctx.params

            ctx.logger.info('[getAppointmentByToken] 通过token获取预约', {
                tokenPrefix: token.substring(0, 8) + '...',
            })

            const appointment = await InterviewAppointmentService.getAppointmentByToken(token)

            // 返回候选人需要的信息（隐藏敏感信息）
            const response = {
                appointmentId: appointment.appointmentId,
                status: appointment.status,
                statusText: APPOINTMENT_STATUS_NAMES[appointment.status],
                proposedTimeSlots: appointment.proposedTimeSlots,
                selectedTimeSlot: appointment.selectedTimeSlot,
                duration: appointment.duration,
                jobInfo: appointment.jobSnapshot,
                interviewerInfo: appointment.interviewerInfo,
                notes: appointment.notes,
                inviteExpireAt: appointment.inviteExpireAt,
                isExpired: new Date() > appointment.inviteExpireAt,
            }

            sendSuccess(ctx, response)
        } catch (error) {
            ctx.logger.error('[getAppointmentByToken] 获取预约失败', {
                error: error.message,
            })
            if (error.code) {
                sendError(ctx, error)
            } else {
                sendError(ctx, ERROR_CODES.INTERNAL_ERROR, error.message)
            }
        }
    }

    /**
     * 候选人选择时间段（C 端）
     * POST /api/v1/appointment-c/:appointmentId/select-time
     */
    async selectTimeSlot(ctx) {
        try {
            const { appointmentId } = ctx.params
            const { slotIndex } = ctx.request.body
            const { userId } = ctx.state.user

            ctx.logger.info('[selectTimeSlot] 候选人选择时间段', {
                appointmentId,
                slotIndex,
                candidateId: userId,
            })

            // 验证是当前候选人
            const existing = await InterviewAppointmentService.getAppointmentById(appointmentId)
            if (existing.candidateId !== userId) {
                throw ERROR_CODES.FORBIDDEN
            }

            const appointment = await InterviewAppointmentService.selectTimeSlot(appointmentId, slotIndex, userId)

            sendSuccess(ctx, appointment, '时间已确认')
        } catch (error) {
            ctx.logger.error('[selectTimeSlot] 选择时间失败', {
                error: error.message,
            })
            if (error.code) {
                sendError(ctx, error, error.detail)
            } else {
                sendError(ctx, ERROR_CODES.INTERNAL_ERROR, error.message)
            }
        }
    }

    /**
     * 候选人申请改期（C 端）
     * POST /api/v1/appointment-c/:appointmentId/reschedule
     */
    async requestReschedule(ctx) {
        try {
            const { appointmentId } = ctx.params
            const { proposedSlots, reason } = ctx.request.body
            const { userId } = ctx.state.user

            ctx.logger.info('[requestReschedule] 候选人申请改期', {
                appointmentId,
                candidateId: userId,
                proposedSlotsCount: proposedSlots?.length,
            })

            // 验证是当前候选人
            const existing = await InterviewAppointmentService.getAppointmentById(appointmentId)
            if (existing.candidateId !== userId) {
                throw ERROR_CODES.FORBIDDEN
            }

            const appointment = await InterviewAppointmentService.requestReschedule(appointmentId, proposedSlots, reason, userId)

            sendSuccess(ctx, appointment, '改期申请已提交')
        } catch (error) {
            ctx.logger.error('[requestReschedule] 申请改期失败', {
                error: error.message,
            })
            if (error.code) {
                sendError(ctx, error, error.detail)
            } else {
                sendError(ctx, ERROR_CODES.INTERNAL_ERROR, error.message)
            }
        }
    }

    /**
     * 候选人拒绝面试（C 端）
     * POST /api/v1/appointment-c/:appointmentId/reject
     */
    async rejectAppointment(ctx) {
        try {
            const { appointmentId } = ctx.params
            const { reason } = ctx.request.body
            const { userId } = ctx.state.user

            ctx.logger.info('[rejectAppointment] 候选人拒绝面试', {
                appointmentId,
                candidateId: userId,
            })

            // 验证是当前候选人
            const existing = await InterviewAppointmentService.getAppointmentById(appointmentId)
            if (existing.candidateId !== userId) {
                throw ERROR_CODES.FORBIDDEN
            }

            const appointment = await InterviewAppointmentService.rejectAppointment(appointmentId, reason, userId)

            sendSuccess(ctx, appointment, '已拒绝面试邀请')
        } catch (error) {
            ctx.logger.error('[rejectAppointment] 拒绝面试失败', {
                error: error.message,
            })
            if (error.code) {
                sendError(ctx, error, error.detail)
            } else {
                sendError(ctx, ERROR_CODES.INTERNAL_ERROR, error.message)
            }
        }
    }

    /**
     * 候选人取消预约（C 端）
     * POST /api/v1/appointment-c/:appointmentId/cancel
     */
    async cancelAppointmentC(ctx) {
        try {
            const { appointmentId } = ctx.params
            const { reason } = ctx.request.body
            const { userId } = ctx.state.user

            ctx.logger.info('[cancelAppointmentC] C端取消预约', {
                appointmentId,
                candidateId: userId,
            })

            // 验证是当前候选人
            const existing = await InterviewAppointmentService.getAppointmentById(appointmentId)
            if (existing.candidateId !== userId) {
                throw ERROR_CODES.FORBIDDEN
            }

            const appointment = await InterviewAppointmentService.cancelAppointment(appointmentId, reason, 'C')

            sendSuccess(ctx, appointment, '预约已取消')
        } catch (error) {
            ctx.logger.error('[cancelAppointmentC] 取消预约失败', {
                error: error.message,
            })
            if (error.code) {
                sendError(ctx, error, error.detail)
            } else {
                sendError(ctx, ERROR_CODES.INTERNAL_ERROR, error.message)
            }
        }
    }

    /**
     * 获取候选人的预约列表（C 端）
     * GET /api/v1/appointment-c
     */
    async getCandidateAppointments(ctx) {
        try {
            const { userId } = ctx.state.user
            const { status, page, pageSize, sortBy, sortOrder } = ctx.query

            ctx.logger.info('[getCandidateAppointments] 获取候选人预约列表', {
                candidateId: userId,
                status,
            })

            const filters = {
                candidateId: userId,
                ...(status && { status }),
            }

            const result = await InterviewAppointmentService.getAppointments(filters, { page: parseInt(page) || 1, pageSize: parseInt(pageSize) || 20 }, { sortBy, sortOrder })

            sendPagination(ctx, result.data, result.pagination)
        } catch (error) {
            ctx.logger.error('[getCandidateAppointments] 获取预约列表失败', {
                error: error.message,
            })
            sendError(ctx, ERROR_CODES.INTERNAL_ERROR, error.message)
        }
    }

    /**
     * 获取候选人预约统计（C 端）
     * GET /api/v1/appointment-c/stats
     */
    async getCandidateAppointmentStats(ctx) {
        try {
            const { userId } = ctx.state.user

            ctx.logger.info('[getCandidateAppointmentStats] 获取候选人预约统计', { candidateId: userId })

            // 并行查询: screening 从 Application, 面试状态从 Appointment
            const [applicationStats, appointmentStats] = await Promise.all([
                ApplicationService.getApplicationStats(userId, { status: APPLICATION_STATUS.SCREENING }),
                InterviewAppointmentService.getCandidateAppointmentStats(userId),
            ])

            const screening = applicationStats.screening || 0

            const result = {
                total: screening + Object.values(appointmentStats).reduce((sum, v) => sum + v, 0),
                screening,
                ...appointmentStats,
            }

            ctx.logger.info('[getCandidateAppointmentStats] 统计完成', { candidateId: userId, stats: result })

            sendSuccess(ctx, result)
        } catch (error) {
            ctx.logger.error('[getCandidateAppointmentStats] 获取统计失败', { error: error.message })
            sendError(ctx, ERROR_CODES.INTERNAL_ERROR, error.message)
        }
    }

    /**
     * 获取预约详情（C 端）
     * GET /api/v1/appointment-c/:appointmentId
     */
    async getCandidateAppointmentById(ctx) {
        try {
            const { appointmentId } = ctx.params
            const { userId } = ctx.state.user

            ctx.logger.info('[getCandidateAppointmentById] C端获取预约详情', {
                appointmentId,
                candidateId: userId,
            })

            const appointment = await InterviewAppointmentService.getAppointmentById(appointmentId)

            // 验证权限
            if (appointment.candidateId !== userId) {
                throw ERROR_CODES.FORBIDDEN
            }

            sendSuccess(ctx, appointment)
        } catch (error) {
            ctx.logger.error('[getCandidateAppointmentById] 获取预约详情失败', {
                error: error.message,
            })
            if (error.code) {
                sendError(ctx, error)
            } else {
                sendError(ctx, ERROR_CODES.INTERNAL_ERROR, error.message)
            }
        }
    }

    /**
     * 获取会议加入信息（C 端）
     * GET /api/v1/appointment-c/:appointmentId/meeting
     */
    async getMeetingInfoC(ctx) {
        try {
            const { appointmentId } = ctx.params
            const { userId } = ctx.state.user

            ctx.logger.info('[getMeetingInfoC] C端获取会议信息', {
                appointmentId,
                candidateId: userId,
            })

            // 验证权限
            const existing = await InterviewAppointmentService.getAppointmentById(appointmentId)
            if (existing.candidateId !== userId) {
                throw ERROR_CODES.FORBIDDEN
            }

            const meetingInfo = await InterviewAppointmentService.getMeetingJoinInfo(appointmentId, userId, 'candidate')

            sendSuccess(ctx, meetingInfo)
        } catch (error) {
            ctx.logger.error('[getMeetingInfoC] 获取会议信息失败', {
                error: error.message,
            })
            if (error.code) {
                sendError(ctx, error, error.detail)
            } else {
                sendError(ctx, ERROR_CODES.INTERNAL_ERROR, error.message)
            }
        }
    }
}

export default new AppointmentController()
