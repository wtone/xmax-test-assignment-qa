/**
 * 请重新选择面试时间 - C端（候选人）
 * Email Type: RESCHEDULE_NEW_SLOTS
 */

import { LANGUAGES, ACTION_TYPES } from '../constants.js'

export default {
    type: 'reschedule_new_slots',

    [LANGUAGES.CN]: {
        subject: '请重新选择面试时间',
        title: '请重新选择面试时间',
        body: '<strong>{{COMPANY_NAME}}</strong> 为您的 <strong>{{JOB_TITLE}}</strong> 面试提供了新的时间选项{{NOTE}}，请重新选择。',
        text: data =>
            `${data.companyName}为您的${data.jobTitle}面试提供了新的时间选项${data.note ? `（${data.note}）` : ''}，请重新选择。`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: '选择面试时间',
        actionUrlKey: 'actionUrl',
    },

    [LANGUAGES.EN]: {
        subject: 'Please Select New Interview Time',
        title: 'Select New Interview Time',
        body: '<strong>{{COMPANY_NAME}}</strong> has provided new time options for your <strong>{{JOB_TITLE}}</strong> interview{{NOTE}}. Please select.',
        text: data =>
            `${data.companyName} has provided new time options for your ${data.jobTitle} interview${data.note ? ` (${data.note})` : ''}. Please select.`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: 'Select Interview Time',
        actionUrlKey: 'actionUrl',
    },
}
