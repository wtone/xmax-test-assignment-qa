/**
 * 即将超时提醒（1天）
 * 发给等待方（根据状态判断是 C 端还是 B 端）
 * Email Type: INTERVIEW_EXPIRING_WARNING
 */

import { LANGUAGES, ACTION_TYPES } from '../constants.js'

export default {
    type: 'interview_expiring_warning',

    [LANGUAGES.CN]: {
        subject: '面试邀约未处理，即将超时',
        title: '面试邀约未处理，即将超时',
        body: '您有面试待确认时间，请尽快处理。若未处理，1 天后将超时并自动取消。',
        text: () => `您有面试待确认时间，请尽快处理。若未处理，1 天后将超时并自动取消。`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: '立即处理',
        actionUrlKey: 'actionUrl',
    },

    [LANGUAGES.EN]: {
        subject: 'Interview Invitation Pending, About to Expire',
        title: 'Interview Invitation Pending, About to Expire',
        body: 'You have a pending interview invitation. Please respond soon. It will expire and be automatically cancelled in 1 day if not processed.',
        text: () =>
            `You have a pending interview invitation. Please respond soon. It will expire and be automatically cancelled in 1 day if not processed.`,
        actionType: ACTION_TYPES.LINK_BUTTON_CENTER,
        actionText: 'Respond Now',
        actionUrlKey: 'actionUrl',
    },
}
