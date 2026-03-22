/**
 * 合同管理控制器
 * @module controllers/contractController
 */

import ContractService from '../services/ContractService.js'
import { AppError, asyncHandler, sendResponse } from '../../utils/response.js'
import { ERROR_CODES } from '../constants/error_codes.js'
class ContractController {
    /**
     * 创建合同录用通知
     */
    createContract = asyncHandler(async ctx => {
        const companyId = ctx.state.user.userId
        const contractData = ctx.request.body

        const offer = await ContractService.createContractOffer({
            ...contractData,
            fromCompany: companyId,
        })

        sendResponse(ctx, 201, {
            message: 'Contract offer created successfully',
            data: offer,
        })
    })

    /**
     * 获取合同列表
     */
    getContracts = asyncHandler(async ctx => {
        const { userId, userType } = ctx.state.user
        const { status, dateFrom, dateTo, page = 1, pageSize = 20, sortBy = 'sentAt', sortOrder = 'desc' } = ctx.query

        const filters = {}

        if (userType === 'C_USER') {
            filters.toCandidate = userId
        } else if (userType === 'B_USER') {
            filters.fromCompany = userId
        }

        if (status) {
            filters.status = status
        }

        if (dateFrom || dateTo) {
            filters.dateFrom = dateFrom
            filters.dateTo = dateTo
        }

        const result = await ContractService.getContractOffers(filters, { page: parseInt(page), pageSize: parseInt(pageSize) }, { sortBy, sortOrder })

        sendResponse(ctx, 200, result)
    })

    /**
     * 获取合同详情
     */
    getContractById = asyncHandler(async ctx => {
        const { contractId } = ctx.params
        const { userId, userType } = ctx.state.user

        const offer = await ContractService.getContractOfferByOfferId(contractId)

        // 权限检查
        if (userType === 'C_USER' && offer.toCandidate.toString() !== userId) {
            throw new AppError('Access denied', ERROR_CODES.FORBIDDEN)
        }

        if (userType === 'B_USER' && offer.fromCompany.toString() !== userId) {
            throw new AppError('Access denied', ERROR_CODES.FORBIDDEN)
        }

        // 如果是候选人查看，记录查看时间
        if (userType === 'C_USER') {
            await ContractService.viewContractOffer(offer._id, userId)
        }

        sendResponse(ctx, 200, {
            data: offer,
        })
    })

    /**
     * 发送合同
     */
    sendContract = asyncHandler(async ctx => {
        const { contractId } = ctx.params
        const userId = ctx.state.user.userId

        const offer = await ContractService.getContractOfferByOfferId(contractId)

        // 权限检查
        if (offer.fromCompany.toString() !== userId) {
            throw new AppError('Access denied', ERROR_CODES.FORBIDDEN)
        }

        const sentOffer = await ContractService.sendContractOffer(offer._id, userId)

        sendResponse(ctx, 200, {
            message: 'Contract offer sent successfully',
            data: sentOffer,
        })
    })

    /**
     * 接受合同
     */
    acceptContract = asyncHandler(async ctx => {
        const { contractId } = ctx.params
        const { message } = ctx.request.body
        const candidateId = ctx.state.user.userId

        const offer = await ContractService.getContractOfferByOfferId(contractId)
        const acceptedOffer = await ContractService.acceptContractOffer(offer._id, candidateId, message)

        sendResponse(ctx, 200, {
            message: 'Contract offer accepted successfully',
            data: acceptedOffer,
        })
    })

    /**
     * 拒绝合同
     */
    rejectContract = asyncHandler(async ctx => {
        const { contractId } = ctx.params
        const { reason } = ctx.request.body
        const candidateId = ctx.state.user.userId

        const offer = await ContractService.getContractOfferByOfferId(contractId)
        const rejectedOffer = await ContractService.rejectContractOffer(offer._id, candidateId, reason)

        sendResponse(ctx, 200, {
            message: 'Contract offer rejected',
            data: rejectedOffer,
        })
    })

    /**
     * 协商合同
     */
    negotiateContract = asyncHandler(async ctx => {
        const { contractId } = ctx.params
        const { message, counterOffer } = ctx.request.body
        const candidateId = ctx.state.user.userId

        const offer = await ContractService.getContractOfferByOfferId(contractId)
        const negotiatedOffer = await ContractService.negotiateContractOffer(offer._id, candidateId, message, counterOffer)

        sendResponse(ctx, 200, {
            message: 'Counter offer submitted',
            data: negotiatedOffer,
        })
    })

    /**
     * 签署合同
     */
    signContract = asyncHandler(async ctx => {
        const { contractId } = ctx.params
        const candidateId = ctx.state.user.userId

        const offer = await ContractService.getContractOfferByOfferId(contractId)
        const signedOffer = await ContractService.signContractOffer(offer._id, candidateId)

        sendResponse(ctx, 200, {
            message: 'Contract signed successfully',
            data: signedOffer,
        })
    })

    /**
     * 撤回/取消合同
     */
    cancelContract = asyncHandler(async ctx => {
        const { contractId } = ctx.params
        const { reason } = ctx.request.body
        const userId = ctx.state.user.userId

        const offer = await ContractService.getContractOfferByOfferId(contractId)

        // 权限检查
        if (offer.fromCompany.toString() !== userId) {
            throw new AppError('Access denied', ERROR_CODES.FORBIDDEN)
        }

        const withdrawnOffer = await ContractService.withdrawContractOffer(offer._id, userId, reason)

        sendResponse(ctx, 200, {
            message: 'Contract offer withdrawn',
            data: withdrawnOffer,
        })
    })

    /**
     * 获取合同统计
     */
    getContractStats = asyncHandler(async ctx => {
        const companyId = ctx.state.user.userId
        const { dateFrom, dateTo } = ctx.query

        const dateRange = {}
        if (dateFrom) dateRange.start = new Date(dateFrom)
        if (dateTo) dateRange.end = new Date(dateTo)

        const stats = await ContractService.getContractStats(companyId, dateRange)

        sendResponse(ctx, 200, {
            data: stats,
        })
    })

    /**
     * 批量创建合同
     */
    batchCreateContracts = asyncHandler(async ctx => {
        const companyId = ctx.state.user.userId
        const { offers } = ctx.request.body

        if (!Array.isArray(offers) || offers.length === 0) {
            throw new AppError('Invalid offers data', ERROR_CODES.VALIDATION_ERROR)
        }

        // 为每个offer添加fromCompany
        const offerDataList = offers.map(offer => ({
            ...offer,
            fromCompany: companyId,
        }))

        const results = await ContractService.batchCreateContractOffers(offerDataList)

        sendResponse(ctx, 201, {
            message: 'Batch contract creation completed',
            data: results,
        })
    })
}

export default new ContractController()
