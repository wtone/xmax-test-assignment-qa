/**
 * 支付状态常量
 * @module constants/payment_status
 */

/**
 * 支付状态枚举（job-service 内部使用）
 */
export const PAYMENT_STATUS = {
    UNPAID: 'UNPAID', // 未支付（无需支付或未冻结）
    FROZEN: 'FROZEN', // 已冻结（待扣款）
    CHARGED: 'CHARGED', // 已扣款
    REFUNDED: 'REFUNDED', // 已退款
    FAILED: 'FAILED', // 支付失败
}

/**
 * payment-service 订单状态（整数）
 */
export const ORDER_STATUS = {
    PENDING: 0, // 待支付
    PAID: 1, // 已支付（积分渠道: PAID = 余额已冻结）
    COMPLETED: 2, // 已完成（已扣款，不可退款）
    REFUNDED: 3, // 已退款
    CLOSED: 4, // 已关闭
    FAILED: 5, // 支付失败
}

/**
 * payment-service ORDER_STATUS → job-service PAYMENT_STATUS 映射
 * @param {number} orderStatus - payment-service 订单状态
 * @returns {string} job-service 支付状态
 */
export function mapOrderStatusToPaymentStatus(orderStatus) {
    const mapping = {
        [ORDER_STATUS.PENDING]: PAYMENT_STATUS.UNPAID,
        [ORDER_STATUS.PAID]: PAYMENT_STATUS.FROZEN,
        [ORDER_STATUS.COMPLETED]: PAYMENT_STATUS.CHARGED,
        [ORDER_STATUS.REFUNDED]: PAYMENT_STATUS.REFUNDED,
        [ORDER_STATUS.CLOSED]: PAYMENT_STATUS.FAILED,
        [ORDER_STATUS.FAILED]: PAYMENT_STATUS.FAILED,
    }
    return mapping[orderStatus] || PAYMENT_STATUS.UNPAID
}

/**
 * 支付状态名称映射
 */
export const PAYMENT_STATUS_NAMES = {
    [PAYMENT_STATUS.UNPAID]: '未支付',
    [PAYMENT_STATUS.FROZEN]: '已冻结',
    [PAYMENT_STATUS.CHARGED]: '已扣款',
    [PAYMENT_STATUS.REFUNDED]: '已退款',
    [PAYMENT_STATUS.FAILED]: '支付失败',
}

/**
 * 退款原因枚举
 */
export const REFUND_REASON = {
    B_CANCELLED: 'b_cancelled', // B端取消
    C_CANCELLED: 'c_cancelled', // C端取消
    CANDIDATE_REJECTED: 'candidate_rejected', // C端拒绝
    INVITE_EXPIRED: 'invite_expired', // 邀请超时过期
    RESCHEDULE_EXPIRED: 'reschedule_expired', // 改期审批超时
    NO_SHOW: 'no_show', // 缺席（根据业务规则决定是否退款）
}

/**
 * 退款原因描述映射
 */
export const REFUND_REASON_DESCRIPTIONS = {
    [REFUND_REASON.B_CANCELLED]: '企业取消预约',
    [REFUND_REASON.C_CANCELLED]: '候选人取消预约',
    [REFUND_REASON.CANDIDATE_REJECTED]: '候选人拒绝面试邀请',
    [REFUND_REASON.INVITE_EXPIRED]: '面试邀请超时未确认',
    [REFUND_REASON.RESCHEDULE_EXPIRED]: '改期申请超时未审批',
    [REFUND_REASON.NO_SHOW]: '参会方缺席',
}

/**
 * 判断是否可以扣款
 * @param {string} status - 当前支付状态
 * @returns {boolean}
 */
export function canCharge(status) {
    return status === PAYMENT_STATUS.FROZEN
}

/**
 * 判断是否可以退款
 * @param {string} status - 当前支付状态
 * @returns {boolean}
 */
export function canRefund(status) {
    return status === PAYMENT_STATUS.FROZEN
}

/**
 * 判断是否需要处理支付
 * @param {Object} payment - 支付信息对象
 * @returns {boolean}
 */
export function hasPayment(payment) {
    return payment && payment.orderId && payment.amount > 0
}
