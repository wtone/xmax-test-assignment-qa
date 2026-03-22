/**
 * 邮件模板内容汇总
 * 自动加载 contents 目录下所有模板
 */

import applicationReceived from './application_received.js'
import applicationSubmitted from './application_submitted.js'
import interviewInvitation from './interview_invitation.js'
import interviewInvite from './interview_invite.js'
import interviewConfirmed from './interview_confirmed.js'
import interviewConfirmedB from './interview_confirmed_b.js'
import interviewCancelled from './interview_cancelled.js'
import interviewCancelledB from './interview_cancelled_b.js'
import interviewRescheduled from './interview_rescheduled.js'
import rescheduleRequestB from './reschedule_request_b.js'
import rescheduleApproved from './reschedule_approved.js'
import rescheduleNewSlots from './reschedule_new_slots.js'
import interviewStarting from './interview_starting.js'
import interviewStarting30min from './interview_starting_30min.js'
import interviewStarted from './interview_started.js'
import interviewStartingB from './interview_starting_b.js'
import interviewStarting30minB from './interview_starting_30min_b.js'
import interviewStartedB from './interview_started_b.js'
import interviewRejectedB from './interview_rejected_b.js'
import interviewExpiredB from './interview_expired_b.js'
import interviewExpiredC from './interview_expired_c.js'
import interviewExpiringWarning from './interview_expiring_warning.js'
import offerNotification from './offer_notification.js'
import offerAccepted from './offer_accepted.js'
import jobExpired from './job_expired.js'
import aiInterviewReminder from './ai_interview_reminder.js'
import shadowTalentInvitation from './shadow_talent_invitation.js'

/**
 * 所有邮件模板配置
 * 使用模板的 type 字段作为 key
 */
export const EMAIL_CONTENTS = {
    [applicationReceived.type]: applicationReceived,
    [applicationSubmitted.type]: applicationSubmitted,
    [interviewInvitation.type]: interviewInvitation,
    [interviewInvite.type]: interviewInvite,
    [interviewConfirmed.type]: interviewConfirmed,
    [interviewConfirmedB.type]: interviewConfirmedB,
    [interviewCancelled.type]: interviewCancelled,
    [interviewCancelledB.type]: interviewCancelledB,
    [interviewRescheduled.type]: interviewRescheduled,
    [rescheduleRequestB.type]: rescheduleRequestB,
    [rescheduleApproved.type]: rescheduleApproved,
    [rescheduleNewSlots.type]: rescheduleNewSlots,
    [interviewStarting.type]: interviewStarting,
    [interviewStarting30min.type]: interviewStarting30min,
    [interviewStarted.type]: interviewStarted,
    [interviewStartingB.type]: interviewStartingB,
    [interviewStarting30minB.type]: interviewStarting30minB,
    [interviewStartedB.type]: interviewStartedB,
    [interviewRejectedB.type]: interviewRejectedB,
    [interviewExpiredB.type]: interviewExpiredB,
    [interviewExpiredC.type]: interviewExpiredC,
    [interviewExpiringWarning.type]: interviewExpiringWarning,
    [offerNotification.type]: offerNotification,
    [offerAccepted.type]: offerAccepted,
    [jobExpired.type]: jobExpired,
    [aiInterviewReminder.type]: aiInterviewReminder,
    [shadowTalentInvitation.type]: shadowTalentInvitation,
}

/**
 * 获取所有已注册的邮件类型
 */
export const getRegisteredTypes = () => Object.keys(EMAIL_CONTENTS)

/**
 * 检查模板类型是否存在
 */
export const hasTemplate = type => type in EMAIL_CONTENTS

export default EMAIL_CONTENTS
