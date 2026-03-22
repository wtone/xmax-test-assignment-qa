/**
 * 面试时间需要调整 - C端（候选人）
 * Email Type: INTERVIEW_RESCHEDULED
 */

import { LANGUAGES, ACTION_TYPES } from '../constants.js'

export default {
    type: 'interview_rescheduled',

    [LANGUAGES.CN]: {
        subject: '面试时间需要调整',
        title: '面试时间需要调整',
        body: '<strong>{{COMPANY_NAME}}</strong> 需要调整 <strong>{{JOB_TITLE}}</strong> 的面试时间{{NOTE}}，请重新选择。',
        text: data =>
            `${data.companyName}需要调整${data.jobTitle}的面试时间${data.note ? `（${data.note}）` : ''}，请重新选择。`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: '选择新的面试时间',
        actionUrlKey: 'actionUrl',
    },

    [LANGUAGES.EN]: {
        subject: 'Interview Time Adjustment Required',
        title: 'Interview Rescheduled',
        body: '<strong>{{COMPANY_NAME}}</strong> needs to reschedule your <strong>{{JOB_TITLE}}</strong> interview{{NOTE}}. Please select a new time.',
        text: data =>
            `${data.companyName} needs to reschedule your ${data.jobTitle} interview${data.note ? ` (${data.note})` : ''}. Please select a new time.`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: 'Select New Interview Time',
        actionUrlKey: 'actionUrl',
    },
}
