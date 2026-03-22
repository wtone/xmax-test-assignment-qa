/**
 * 手动录入候选人路由
 */

import Router from 'koa-router'
import { gatewayAuth } from '../middlewares/gateway-auth.js'
import { requireBUserType } from '../middlewares/require-b-user.js'
import {
    createManualCandidate,
    getManualCandidates,
    getManualCandidateDetail,
    deleteManualCandidate
} from '../controllers/manualCandidateController.js'

const router = new Router({
    prefix: '/job-b/manual-candidates'
})

// 基础路由（B端用户需认证）
router.post('/', gatewayAuth({ allowAnonymous: false }), requireBUserType(), createManualCandidate)
router.get('/', gatewayAuth({ allowAnonymous: false }), requireBUserType(), getManualCandidates)
router.get('/:candidateId', gatewayAuth({ allowAnonymous: false }), requireBUserType(), getManualCandidateDetail)
router.delete('/:candidateId', gatewayAuth({ allowAnonymous: false }), requireBUserType(), deleteManualCandidate)

export default router