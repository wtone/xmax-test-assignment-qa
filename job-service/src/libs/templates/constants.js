/**
 * 邮件模板常量定义
 */

/** 语言常量 */
export const LANGUAGES = {
    EN: 'en',
    CN: 'cn',
}

/** 邮件类型 */
export const EMAIL_TYPES = {
    APPLICATION_RECEIVED: 'application_received',
    APPLICATION_SUBMITTED: 'application_submitted',
    INTERVIEW_INVITATION: 'interview_invitation',
    INTERVIEW_INVITE: 'interview_invite',             // 面试邀请（选择时间）- C端
    INTERVIEW_CONFIRMED: 'interview_confirmed',
    INTERVIEW_CONFIRMED_B: 'interview_confirmed_b',   // 候选人确认面试时间 - B端
    INTERVIEW_CANCELLED: 'interview_cancelled',
    INTERVIEW_CANCELLED_B: 'interview_cancelled_b',   // 候选人取消面试 - B端
    INTERVIEW_RESCHEDULED: 'interview_rescheduled',   // 面试时间需要调整 - C端
    RESCHEDULE_REQUEST_B: 'reschedule_request_b',     // 候选人申请改期 - B端
    RESCHEDULE_APPROVED: 'reschedule_approved',       // 改期申请已通过 - C端
    RESCHEDULE_NEW_SLOTS: 'reschedule_new_slots',     // 请重新选择面试时间 - C端
    INTERVIEW_STARTING: 'interview_starting',         // 面试提醒（24小时前）- C端
    INTERVIEW_STARTING_30MIN: 'interview_starting_30min', // 面试提醒（30分钟前）- C端
    INTERVIEW_STARTED: 'interview_started',           // 面试已开始 - C端
    INTERVIEW_STARTING_B: 'interview_starting_b',     // 面试提醒（24小时前）- B端
    INTERVIEW_STARTING_30MIN_B: 'interview_starting_30min_b', // 面试提醒（30分钟前）- B端
    INTERVIEW_STARTED_B: 'interview_started_b',       // 面试已开始 - B端
    INTERVIEW_REJECTED_B: 'interview_rejected_b',     // C 拒绝面试 - B端
    INTERVIEW_EXPIRED_B: 'interview_expired_b',       // C 超时未响应 - B端
    INTERVIEW_EXPIRED_C: 'interview_expired_c',       // B 超时未审批 - C端
    INTERVIEW_EXPIRING_WARNING: 'interview_expiring_warning', // 即将超时提醒
    OFFER_NOTIFICATION: 'offer_notification',
    OFFER_ACCEPTED: 'offer_accepted',
    JOB_EXPIRED: 'job_expired',                          // 职位已过期 - B端
    AI_INTERVIEW_REMINDER: 'ai_interview_reminder',      // AI面试提醒 - C端
    SHADOW_TALENT_INVITATION: 'shadow_talent_invitation', // 影子人才邀请投递 - C端
}

/** 行动组件类型 */
export const ACTION_TYPES = {
    LINK_BUTTON_CENTER: 'link_button_center',
    LINK_BUTTON_RIGHT: 'link_button_right',
    NONE: 'none',
}

/** 行动组件 HTML 模板 */
export const ACTION_COMPONENTS = {
    /** 居中链接按钮 */
    [ACTION_TYPES.LINK_BUTTON_CENTER]: `
          <tr>
            <td align="center" style="padding-top: 10px; padding-bottom: 48px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td class="button" style="background-color: #7B8A60; border-radius: 999px; text-align: center;">
                    <a href="{{ACTION_URL}}" style="display: block; padding: 14px 40px; color: white; font-weight: 400; font-size: 20px; line-height: 1; letter-spacing: 0px; text-decoration: none;">
                      {{ACTION_TEXT}}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`,

    /** 右对齐链接按钮 */
    [ACTION_TYPES.LINK_BUTTON_RIGHT]: `
          <tr>
            <td align="right" style="padding-top: 30px; padding-right: 0px; padding-bottom: 48px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td class="button" style="background-color: #7B8A60; border-radius: 999px 0 0 999px;">
                    <a href="{{ACTION_URL}}" target="_blank"
                    style="display: block;
                    padding: 14px 70px; color: white; text-decoration: none;
                    font-weight: 700; font-size: 16px;
                    line-height: 1;">
                      <span style="display: inline-block; vertical-align: middle;">{{ACTION_TEXT}}</span>
                      <img src="https://cdn.example.com/images/arrow.png" alt="arrow"
                      width="16" height="16"
                      style="margin-left: 8px; display: inline-block; vertical-align: middle;">
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`,

    /** 无行动区域 */
    [ACTION_TYPES.NONE]: `
          <tr>
            <td style="padding-bottom: 48px;"></td>
          </tr>`,
}
