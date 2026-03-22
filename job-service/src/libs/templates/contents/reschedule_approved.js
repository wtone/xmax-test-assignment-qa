/**
 * 改期申请已通过 - C端（候选人）
 * Email Type: RESCHEDULE_APPROVED
 */

import { LANGUAGES, ACTION_TYPES } from '../constants.js'

export default {
    type: 'reschedule_approved',

    [LANGUAGES.CN]: {
        subject: '改期申请已通过',
        title: '改期申请已通过',
        body: '您与 <strong>{{COMPANY_NAME}}</strong> 的 <strong>{{JOB_TITLE}}</strong> 面试改期申请已通过，面试时间已更新。',
        text: data =>
            `您与${data.companyName}的${data.jobTitle}面试改期申请已通过，面试时间已更新。`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: '查看新的面试时间',
        actionUrlKey: 'actionUrl',
    },

    [LANGUAGES.EN]: {
        subject: 'Reschedule Request Approved',
        title: 'Reschedule Approved',
        body: 'Your reschedule request for <strong>{{JOB_TITLE}}</strong> interview at <strong>{{COMPANY_NAME}}</strong> has been approved. Interview time updated.',
        text: data =>
            `Your reschedule request for ${data.jobTitle} interview at ${data.companyName} has been approved.`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: 'View New Interview Time',
        actionUrlKey: 'actionUrl',
    },
}
