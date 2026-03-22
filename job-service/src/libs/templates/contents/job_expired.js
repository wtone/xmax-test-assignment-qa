/**
 * 职位已过期 - B端（发布者）
 * Email Type: JOB_EXPIRED
 */

import { LANGUAGES, ACTION_TYPES } from '../constants.js'

export default {
    type: 'job_expired',

    [LANGUAGES.CN]: {
        subject: data => `职位已过期 - ${data.jobTitle}`,
        title: '职位已过期',
        body: '您发布的职位「<strong>{{JOB_TITLE}}</strong>」已到达申请截止日期，已自动转为历史岗位。',
        text: data =>
            `您发布的职位「${data.jobTitle}」已到达申请截止日期，已自动转为历史岗位。`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: '查看详情',
        actionUrlKey: 'actionUrl',
    },

    [LANGUAGES.EN]: {
        subject: data => `Job Expired - ${data.jobTitle}`,
        title: 'Job Posting Expired',
        body: 'Your job posting "<strong>{{JOB_TITLE}}</strong>" has reached its application deadline and has been automatically archived.',
        text: data =>
            `Your job posting "${data.jobTitle}" has reached its application deadline and has been automatically archived.`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: 'View Details',
        actionUrlKey: 'actionUrl',
    },
}
