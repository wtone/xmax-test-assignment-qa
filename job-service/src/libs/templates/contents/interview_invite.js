/**
 * 面试邀请邮件模板 - C端（候选人）
 * Email Type: INTERVIEW_INVITE
 */

import { LANGUAGES, ACTION_TYPES } from '../constants.js'

export default {
    type: 'interview_invite',

    [LANGUAGES.CN]: {
        subject: '您有新的面试邀约，快去看看吧',
        title: '面试邀约',
        body: '<strong>{{COMPANY_NAME}}</strong> 给您发起了一场 <strong>{{JOB_TITLE}}</strong> 的面试邀请，快去确认吧！',
        text: data =>
            `${data.companyName}给您发起了一场${data.jobTitle}的面试邀请，快去确认吧！`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: '确认面试时间',
        actionUrlKey: 'actionUrl',
    },

    [LANGUAGES.EN]: {
        subject: 'You have a new interview invitation',
        title: 'Interview Invitation',
        body: '<strong>{{COMPANY_NAME}}</strong> has invited you for an interview for the <strong>{{JOB_TITLE}}</strong> position. Please confirm!',
        text: data =>
            `${data.companyName} has invited you for an interview for ${data.jobTitle}. Please confirm!`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: 'Confirm Interview Time',
        actionUrlKey: 'actionUrl',
    },
}
