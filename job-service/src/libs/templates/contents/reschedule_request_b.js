/**
 * 候选人申请改期 - B端（面试官）
 * Email Type: RESCHEDULE_REQUEST_B
 */

import { LANGUAGES, ACTION_TYPES } from '../constants.js'

export default {
    type: 'reschedule_request_b',

    [LANGUAGES.CN]: {
        subject: '候选人申请改期',
        title: '候选人申请改期',
        body: '候选人 <strong>{{CANDIDATE_NAME}}</strong> 申请更改 <strong>{{JOB_TITLE}}</strong> 面试时间，请尽快处理。',
        text: data => `候选人${data.candidateName}申请更改${data.jobTitle}面试时间，请尽快处理。`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: '处理改期申请',
        actionUrlKey: 'actionUrl',
    },

    [LANGUAGES.EN]: {
        subject: 'Candidate Reschedule Request',
        title: 'Reschedule Request',
        body: 'Candidate <strong>{{CANDIDATE_NAME}}</strong> has requested to reschedule the <strong>{{JOB_TITLE}}</strong> interview. Please respond.',
        text: data => `Candidate ${data.candidateName} has requested to reschedule the ${data.jobTitle} interview. Please respond.`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: 'Handle Request',
        actionUrlKey: 'actionUrl',
    },
}
