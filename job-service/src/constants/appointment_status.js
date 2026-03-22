/**
 * 面试预约状态枚举
 * @module constants/appointment_status
 */

import { APPLICATION_STATUS } from './application_status.js'

/**
 * 面试预约状态枚举
 * 基于 MVP 需求文档定义
 */
export const APPOINTMENT_STATUS = {
    INITIATED: 'initiated', // B 端已发送邀请，等待 C 端操作
    RESCHEDULE_REQUESTED: 'reschedule_requested', // C 端请求更改时间，等待 B 端审批
    SCHEDULE_CONFIRMED: 'schedule_confirmed', // 双方确认时间，会议链接已生成
    COMPLETED: 'completed', // 面试正常结束
    REJECTED: 'rejected', // C 端拒绝面试邀请
    EXPIRED: 'expired', // 超过 7 天未响应，邀约失效
    CANCELLED: 'cancelled', // B 端或 C 端在确认后取消
    NO_SHOW: 'no_show', // 一方或双方未参加会议
}

/**
 * 获取所有面试预约状态值数组
 */
export const APPOINTMENT_STATUS_VALUES = Object.values(APPOINTMENT_STATUS)

/**
 * 面试预约状态中文名称映射
 */
export const APPOINTMENT_STATUS_NAMES = {
    [APPOINTMENT_STATUS.INITIATED]: '已发起',
    [APPOINTMENT_STATUS.RESCHEDULE_REQUESTED]: '申请改期',
    [APPOINTMENT_STATUS.SCHEDULE_CONFIRMED]: '已确认',
    [APPOINTMENT_STATUS.COMPLETED]: '已完成',
    [APPOINTMENT_STATUS.REJECTED]: '已拒绝',
    [APPOINTMENT_STATUS.EXPIRED]: '已过期',
    [APPOINTMENT_STATUS.CANCELLED]: '已取消',
    [APPOINTMENT_STATUS.NO_SHOW]: '缺席',
}

/**
 * 改期申请状态
 */
export const RESCHEDULE_STATUS = {
    PENDING: 'pending', // 待审批
    APPROVED: 'approved', // 已同意
    REJECTED: 'rejected', // 已拒绝
}

/**
 * 改期申请状态中文名称
 */
export const RESCHEDULE_STATUS_NAMES = {
    [RESCHEDULE_STATUS.PENDING]: '待审批',
    [RESCHEDULE_STATUS.APPROVED]: '已同意',
    [RESCHEDULE_STATUS.REJECTED]: '已拒绝',
}

/**
 * 请求方类型
 */
export const REQUESTER_TYPE = {
    B_SIDE: 'B', // 企业/面试官
    C_SIDE: 'C', // 候选人
}

/**
 * 默认配置常量
 */
export const APPOINTMENT_DEFAULTS = {
    INVITE_EXPIRE_DAYS: 7, // 邀请链接过期天数
    DEFAULT_DURATION_MINUTES: 60, // 默认面试时长（分钟）
    NO_SHOW_GRACE_HOURS: 2, // 缺席判定宽限时间（小时）
    MAX_TIME_SLOTS: 99, // B 端最多提供的可选时间段数量
}

/**
 * 判断预约状态是否有效
 * @param {string} status - 预约状态
 * @returns {boolean} 是否有效
 */
export const isValidAppointmentStatus = status => {
    return APPOINTMENT_STATUS_VALUES.includes(status)
}

/**
 * 判断预约是否可以取消
 * @param {string} status - 预约状态
 * @returns {boolean} 是否可以取消
 */
export const canCancelAppointment = status => {
    return [APPOINTMENT_STATUS.INITIATED, APPOINTMENT_STATUS.RESCHEDULE_REQUESTED, APPOINTMENT_STATUS.SCHEDULE_CONFIRMED].includes(status)
}

/**
 * 判断预约是否已结束
 * @param {string} status - 预约状态
 * @returns {boolean} 是否已结束
 */
export const isAppointmentFinished = status => {
    return [APPOINTMENT_STATUS.COMPLETED, APPOINTMENT_STATUS.REJECTED, APPOINTMENT_STATUS.EXPIRED, APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.NO_SHOW].includes(status)
}

/**
 * 判断预约是否可以进入会议
 * @param {string} status - 预约状态
 * @returns {boolean} 是否可以进入会议
 */
export const canJoinMeeting = status => {
    return status === APPOINTMENT_STATUS.SCHEDULE_CONFIRMED
}

/**
 * 判断候选人是否可以响应（选择时间/申请改期/拒绝）
 * @param {string} status - 预约状态
 * @returns {boolean} 是否可以响应
 */
export const canCandidateRespond = status => {
    return status === APPOINTMENT_STATUS.INITIATED
}

/**
 * 判断企业是否可以审批改期申请
 * @param {string} status - 预约状态
 * @returns {boolean} 是否可以审批
 */
export const canApproveReschedule = status => {
    return status === APPOINTMENT_STATUS.RESCHEDULE_REQUESTED
}

/**
 * 判断C端是否可以发起改期
 * - INITIATED: 初次收到邀请时申请改期
 * - SCHEDULE_CONFIRMED: 已确认后申请改期
 * @param {string} status - 预约状态
 * @returns {boolean} 是否可以发起改期
 */
export const canCandidateRequestReschedule = status => {
    return [APPOINTMENT_STATUS.INITIATED, APPOINTMENT_STATUS.SCHEDULE_CONFIRMED].includes(status)
}

/**
 * 判断B端是否可以改期（响应C端改期或主动发起改期）
 * - RESCHEDULE_REQUESTED: 响应C端的改期请求
 * - SCHEDULE_CONFIRMED: B端主动发起改期
 * @param {string} status - 预约状态
 * @returns {boolean} 是否可以改期
 */
export const canBSideReschedule = status => {
    return [APPOINTMENT_STATUS.RESCHEDULE_REQUESTED, APPOINTMENT_STATUS.SCHEDULE_CONFIRMED].includes(status)
}

/**
 * 获取下一个可能的状态
 * @param {string} currentStatus - 当前状态
 * @returns {Array<string>} 可能的下一个状态列表
 */
export const getNextPossibleStatuses = currentStatus => {
    const statusFlow = {
        [APPOINTMENT_STATUS.INITIATED]: [
            APPOINTMENT_STATUS.SCHEDULE_CONFIRMED, // C 端确认时间
            APPOINTMENT_STATUS.RESCHEDULE_REQUESTED, // C 端申请改期
            APPOINTMENT_STATUS.REJECTED, // C 端拒绝
            APPOINTMENT_STATUS.EXPIRED, // 超时
            APPOINTMENT_STATUS.CANCELLED, // B 端取消
        ],
        [APPOINTMENT_STATUS.RESCHEDULE_REQUESTED]: [
            APPOINTMENT_STATUS.SCHEDULE_CONFIRMED, // B 端同意改期
            APPOINTMENT_STATUS.INITIATED, // B 端拒绝改期，重新选择时间
            APPOINTMENT_STATUS.CANCELLED, // 取消
            APPOINTMENT_STATUS.EXPIRED, // B端超时未审批改期申请
        ],
        [APPOINTMENT_STATUS.SCHEDULE_CONFIRMED]: [
            APPOINTMENT_STATUS.COMPLETED, // 面试完成
            APPOINTMENT_STATUS.NO_SHOW, // 缺席
            APPOINTMENT_STATUS.CANCELLED, // 取消
            APPOINTMENT_STATUS.INITIATED, // B端改期（提供新时间）
            APPOINTMENT_STATUS.RESCHEDULE_REQUESTED, // C端改期（申请改期）
        ],
        [APPOINTMENT_STATUS.COMPLETED]: [],
        [APPOINTMENT_STATUS.REJECTED]: [],
        [APPOINTMENT_STATUS.EXPIRED]: [],
        [APPOINTMENT_STATUS.CANCELLED]: [
            APPOINTMENT_STATUS.INITIATED, // 可以重新发起预约
        ],
        [APPOINTMENT_STATUS.NO_SHOW]: [
            APPOINTMENT_STATUS.INITIATED, // 可以重新发起预约
        ],
    }

    return statusFlow[currentStatus] || []
}

/**
 * 判断状态转换是否合法
 * @param {string} fromStatus - 当前状态
 * @param {string} toStatus - 目标状态
 * @returns {boolean} 是否合法
 */
export const isValidStatusTransition = (fromStatus, toStatus) => {
    const possibleStatuses = getNextPossibleStatuses(fromStatus)
    return possibleStatuses.includes(toStatus)
}

/**
 * InterviewAppointment 状态到 Application 状态的映射
 * @see docs/online-interview-appointment-scheduling/appointment_requirement_analysis.md
 */
export const APPOINTMENT_TO_APPLICATION_STATUS = {
    [APPOINTMENT_STATUS.INITIATED]: APPLICATION_STATUS.INTERVIEW_INVITING,
    [APPOINTMENT_STATUS.RESCHEDULE_REQUESTED]: APPLICATION_STATUS.INTERVIEW_INVITING,
    [APPOINTMENT_STATUS.SCHEDULE_CONFIRMED]: APPLICATION_STATUS.INTERVIEW_SCHEDULED,
    [APPOINTMENT_STATUS.COMPLETED]: APPLICATION_STATUS.INTERVIEW_COMPLETED,
    [APPOINTMENT_STATUS.REJECTED]: APPLICATION_STATUS.INTERVIEW_TERMINATED,
    [APPOINTMENT_STATUS.EXPIRED]: APPLICATION_STATUS.INTERVIEW_TERMINATED,
    [APPOINTMENT_STATUS.CANCELLED]: APPLICATION_STATUS.INTERVIEW_TERMINATED,
    [APPOINTMENT_STATUS.NO_SHOW]: APPLICATION_STATUS.INTERVIEW_TERMINATED,
}

/**
 * 根据 InterviewAppointment 状态获取对应的 Application 状态
 * @param {string} appointmentStatus - InterviewAppointment 状态
 * @returns {string} 对应的 Application 状态
 */
export const getApplicationStatusFromAppointment = appointmentStatus => {
    return APPOINTMENT_TO_APPLICATION_STATUS[appointmentStatus] || null
}

/**
 * Application 状态到 InterviewAppointment 状态的映射（用于查询）
 */
export const APPLICATION_TO_APPOINTMENT_STATUS = {
    [APPLICATION_STATUS.INTERVIEW_INVITING]: [APPOINTMENT_STATUS.INITIATED, APPOINTMENT_STATUS.RESCHEDULE_REQUESTED],
    [APPLICATION_STATUS.INTERVIEW_SCHEDULED]: [APPOINTMENT_STATUS.SCHEDULE_CONFIRMED],
    [APPLICATION_STATUS.INTERVIEW_COMPLETED]: [APPOINTMENT_STATUS.COMPLETED],
    [APPLICATION_STATUS.INTERVIEW_TERMINATED]: [APPOINTMENT_STATUS.REJECTED, APPOINTMENT_STATUS.EXPIRED, APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.NO_SHOW],
}

/**
 * 根据 Application 状态获取对应的 InterviewAppointment 状态列表
 * @param {string} applicationStatus - Application 状态
 * @returns {Array<string>} 对应的 InterviewAppointment 状态列表
 */
export const getAppointmentStatusesFromApplication = applicationStatus => {
    return APPLICATION_TO_APPOINTMENT_STATUS[applicationStatus] || []
}

export default {
    APPOINTMENT_STATUS,
    APPOINTMENT_STATUS_VALUES,
    APPOINTMENT_STATUS_NAMES,
    RESCHEDULE_STATUS,
    RESCHEDULE_STATUS_NAMES,
    REQUESTER_TYPE,
    APPOINTMENT_DEFAULTS,
    APPOINTMENT_TO_APPLICATION_STATUS,
    APPLICATION_TO_APPOINTMENT_STATUS,
    isValidAppointmentStatus,
    canCancelAppointment,
    isAppointmentFinished,
    canJoinMeeting,
    canCandidateRespond,
    canApproveReschedule,
    canCandidateRequestReschedule,
    canBSideReschedule,
    getNextPossibleStatuses,
    isValidStatusTransition,
    getApplicationStatusFromAppointment,
    getAppointmentStatusesFromApplication,
}
