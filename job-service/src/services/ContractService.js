/**
 * 合同管理服务
 * @module services/ContractService
 */

import ContractOffer from '../models/ContractOffer.js'
import JobApplication from '../models/JobApplication.js'
import JobPost from '../models/JobPost.js'
import UserCenterService from './integration/UserCenterService.js'
import NotificationService from './integration/NotificationService.js'
import { AppError } from '../../utils/response.js'
import { ERROR_CODES } from '../constants/error_codes.js'
import logger from '../../utils/logger.js'
import mongoose from 'mongoose'
import { findBySmartId, updateBySmartId, findBySmartIdOrThrow } from '../utils/dbQueryHelper.js'

class ContractService {
    /**
     * 创建合同录用通知
     */
    async createContractOffer(offerData) {
        const { applicationId, fromCompany, terms, benefits, workArrangement, message, attachments, expiresAt } = offerData

        // 获取申请信息
        const application = await findBySmartId(JobApplication, applicationId, {
            populate: 'jobId',
        })

        if (!application) {
            throw new AppError('Application not found', ERROR_CODES.NOT_FOUND)
        }

        // 检查申请状态
        if (!['interview', 'offer'].includes(application.status)) {
            throw new AppError('Application status must be interview or offer', ERROR_CODES.INVALID_STATUS)
        }

        // 检查是否已有有效的offer
        const existingOffer = await ContractOffer.findOne({
            applicationId,
            status: { $in: ['pending', 'accepted', 'signed'] },
        })

        if (existingOffer) {
            throw new AppError('Active offer already exists', ERROR_CODES.DUPLICATE_OFFER)
        }

        // 创建offer
        const offer = new ContractOffer({
            applicationId,
            jobId: application.jobId._id,
            fromCompany,
            toCandidate: application.candidateId,
            terms,
            benefits,
            workArrangement,
            message,
            attachments,
            expiresAt: expiresAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 默认7天过期
            status: 'pending',
        })

        await offer.save()

        // 更新申请状态
        await this.updateApplicationStatus(applicationId, 'offer')

        logger.info(`Contract offer created: ${offer.offerId}`, {
            applicationId,
            candidateId: application.candidateId,
            jobId: application.jobId._id,
        })

        return offer
    }

    /**
     * 获取合同列表
     */
    async getContractOffers(filters = {}, pagination = {}, sort = {}) {
        const { fromCompany, toCandidate, status, dateFrom, dateTo } = filters

        const query = {}

        if (fromCompany) {
            query.fromCompany = fromCompany // UUID格式（外部系统ID）
        }

        if (toCandidate) {
            query.toCandidate = toCandidate // UUID格式（外部系统ID）
        }

        if (status) {
            query.status = status
        }

        if (dateFrom || dateTo) {
            query.sentAt = {}
            if (dateFrom) query.sentAt.$gte = new Date(dateFrom)
            if (dateTo) query.sentAt.$lte = new Date(dateTo)
        }

        const { page = 1, pageSize = 20 } = pagination
        const skip = (page - 1) * pageSize

        const { sortBy = 'sentAt', sortOrder = 'desc' } = sort
        const sortOption = { [sortBy]: sortOrder === 'desc' ? -1 : 1 }

        const [data, total] = await Promise.all([
            ContractOffer.find(query)
                .sort(sortOption)
                .skip(skip)
                .limit(pageSize)
                .populate('jobId', 'title location')
                .populate('applicationId', 'appliedAt')
                .lean(),
            ContractOffer.countDocuments(query),
        ])

        // 检查并更新过期状态
        await ContractOffer.updateExpiredOffers()

        return {
            data,
            pagination: {
                total,
                page,
                pageSize,
                totalPages: Math.ceil(total / pageSize),
            },
        }
    }

    /**
     * 获取合同详情
     */
    async getContractOfferById(offerId) {
        const offer = await findBySmartId(ContractOffer, offerId, {
            populate: ['jobId', 'applicationId'],
        })

        if (!offer) {
            throw new AppError('Contract offer not found', ERROR_CODES.NOT_FOUND)
        }

        // 检查并更新过期状态
        await offer.checkAndUpdateExpired()

        return offer
    }

    /**
     * 获取合同详情（通过offerId）
     */
    async getContractOfferByOfferId(offerId) {
        const offer = await ContractOffer.findOne({ offerId }).populate('jobId').populate('applicationId')

        if (!offer) {
            throw new AppError('Contract offer not found', ERROR_CODES.NOT_FOUND)
        }

        // 检查并更新过期状态
        await offer.checkAndUpdateExpired()

        return offer
    }

    /**
     * 发送合同（如果需要从草稿状态发送）
     */
    async sendContractOffer(offerId, senderId) {
        const offer = await this.getContractOfferById(offerId)

        // 这里可以添加发送前的验证逻辑
        // 比如检查是否所有必要信息都已填写

        // 发送通知
        await this.sendOfferNotification(offer)

        logger.info(`Contract offer sent: ${offer.offerId}`, {
            senderId,
            candidateId: offer.toCandidate,
        })

        return offer
    }

    /**
     * 候选人查看合同
     */
    async viewContractOffer(offerId, candidateId) {
        const offer = await findBySmartId(ContractOffer, offerId)

        if (!offer) {
            throw new AppError('Contract offer not found', ERROR_CODES.NOT_FOUND)
        }

        if (offer.toCandidate.toString() !== candidateId) {
            throw new AppError('Access denied', ERROR_CODES.FORBIDDEN)
        }

        // 更新查看时间（如果需要）
        if (!offer.candidateResponse || !offer.candidateResponse.viewedAt) {
            offer.candidateResponse = offer.candidateResponse || {}
            offer.candidateResponse.viewedAt = new Date()
            await offer.save()
        }

        return offer
    }

    /**
     * 接受合同
     */
    async acceptContractOffer(offerId, candidateId, message) {
        const offer = await this.getContractOfferById(offerId)

        if (offer.toCandidate.toString() !== candidateId) {
            throw new AppError('Access denied', ERROR_CODES.FORBIDDEN)
        }

        await offer.accept(message)

        // 更新申请状态
        await this.updateApplicationStatus(offer.applicationId, 'hired')

        // 发送通知
        await this.sendAcceptanceNotification(offer)

        logger.info(`Contract offer accepted: ${offer.offerId}`, {
            candidateId,
        })

        return offer
    }

    /**
     * 拒绝合同
     */
    async rejectContractOffer(offerId, candidateId, message) {
        const offer = await this.getContractOfferById(offerId)

        if (offer.toCandidate.toString() !== candidateId) {
            throw new AppError('Access denied', ERROR_CODES.FORBIDDEN)
        }

        await offer.reject(message)

        // 更新申请状态
        await this.updateApplicationStatus(offer.applicationId, 'rejected')

        // 发送通知
        await this.sendRejectionNotification(offer)

        logger.info(`Contract offer rejected: ${offer.offerId}`, {
            candidateId,
            reason: message,
        })

        return offer
    }

    /**
     * 协商合同
     */
    async negotiateContractOffer(offerId, candidateId, message, counterOffer) {
        const offer = await this.getContractOfferById(offerId)

        if (offer.toCandidate.toString() !== candidateId) {
            throw new AppError('Access denied', ERROR_CODES.FORBIDDEN)
        }

        await offer.negotiate(message, counterOffer)

        // 发送通知
        await this.sendNegotiationNotification(offer)

        logger.info(`Contract offer negotiation: ${offer.offerId}`, {
            candidateId,
        })

        return offer
    }

    /**
     * 签署合同
     */
    async signContractOffer(offerId, candidateId) {
        const offer = await this.getContractOfferById(offerId)

        if (offer.toCandidate.toString() !== candidateId) {
            throw new AppError('Access denied', ERROR_CODES.FORBIDDEN)
        }

        await offer.sign()

        // 发送通知
        await this.sendSignedNotification(offer)

        logger.info(`Contract offer signed: ${offer.offerId}`, {
            candidateId,
        })

        return offer
    }

    /**
     * 撤回合同
     */
    async withdrawContractOffer(offerId, operatorId, reason) {
        const offer = await this.getContractOfferById(offerId)

        await offer.withdraw(operatorId, reason)

        // 发送通知
        await this.sendWithdrawalNotification(offer)

        logger.info(`Contract offer withdrawn: ${offer.offerId}`, {
            operatorId,
            reason,
        })

        return offer
    }

    /**
     * 获取合同统计
     */
    async getContractStats(companyId, dateRange) {
        const stats = await ContractOffer.getOfferStats(companyId, dateRange)

        // 计算额外统计信息
        const summary = {
            total: 0,
            pending: 0,
            accepted: 0,
            rejected: 0,
            signed: 0,
            expired: 0,
            withdrawn: 0,
            acceptanceRate: 0,
            avgResponseDays: 0,
        }

        stats.forEach(stat => {
            summary.total += stat.count
            summary[stat.status] = stat.count
            if (stat.avgResponseDays) {
                summary.avgResponseDays = stat.avgResponseDays
            }
        })

        if (summary.total > 0) {
            summary.acceptanceRate = (((summary.accepted + summary.signed) / summary.total) * 100).toFixed(1)
        }

        return {
            byStatus: stats,
            summary,
        }
    }

    /**
     * 批量创建合同
     */
    async batchCreateContractOffers(offerDataList) {
        const results = {
            success: [],
            failed: [],
        }

        for (const offerData of offerDataList) {
            try {
                const offer = await this.createContractOffer(offerData)
                results.success.push({
                    applicationId: offerData.applicationId,
                    offerId: offer.offerId,
                })
            } catch (error) {
                results.failed.push({
                    applicationId: offerData.applicationId,
                    error: error.message,
                })
            }
        }

        return results
    }

    /**
     * 更新申请状态
     */
    async updateApplicationStatus(applicationId, status) {
        await updateBySmartId(JobApplication, applicationId, {
            status,
            $push: {
                statusHistory: {
                    status,
                    timestamp: new Date(),
                },
            },
        })
    }

    /**
     * 发送录用通知
     */
    async sendOfferNotification(offer) {
        try {
            // 获取候选人信息
            const candidateInfo = await UserCenterService.getUserInfo(offer.toCandidate.toString())

            // 获取职位信息
            const job = await findBySmartId(JobPost, offer.jobId)

            await NotificationService.sendEmail({
                to: candidateInfo.data.email,
                templateId: 'offer-notification',
                data: {
                    candidateName: candidateInfo.data.name,
                    jobTitle: job.title,
                    companyName: job.companyInfo.name,
                    offerId: offer.offerId,
                    expiresAt: offer.expiresAt,
                    viewUrl: `${process.env.FRONTEND_URL}/offers/${offer.offerId}`,
                },
            })
        } catch (error) {
            logger.error('Failed to send offer notification', error)
        }
    }

    /**
     * 发送接受通知
     */
    async sendAcceptanceNotification(offer) {
        try {
            await NotificationService.sendInAppNotification({
                userId: offer.fromCompany,
                type: 'offer-accepted',
                data: {
                    offerId: offer.offerId,
                    candidateId: offer.toCandidate,
                    acceptedAt: offer.respondedAt,
                },
            })
        } catch (error) {
            logger.error('Failed to send acceptance notification', error)
        }
    }

    /**
     * 发送拒绝通知
     */
    async sendRejectionNotification(offer) {
        try {
            await NotificationService.sendInAppNotification({
                userId: offer.fromCompany,
                type: 'offer-rejected',
                data: {
                    offerId: offer.offerId,
                    candidateId: offer.toCandidate,
                    rejectedAt: offer.respondedAt,
                    reason: offer.candidateResponse.message,
                },
            })
        } catch (error) {
            logger.error('Failed to send rejection notification', error)
        }
    }

    /**
     * 发送协商通知
     */
    async sendNegotiationNotification(offer) {
        try {
            await NotificationService.sendInAppNotification({
                userId: offer.fromCompany,
                type: 'offer-negotiation',
                data: {
                    offerId: offer.offerId,
                    candidateId: offer.toCandidate,
                    message: offer.candidateResponse.message,
                    counterOffer: offer.candidateResponse.counterOffer,
                },
            })
        } catch (error) {
            logger.error('Failed to send negotiation notification', error)
        }
    }

    /**
     * 发送签署通知
     */
    async sendSignedNotification(offer) {
        try {
            await NotificationService.sendInAppNotification({
                userId: offer.fromCompany,
                type: 'offer-signed',
                data: {
                    offerId: offer.offerId,
                    candidateId: offer.toCandidate,
                    signedAt: offer.signedAt,
                },
            })
        } catch (error) {
            logger.error('Failed to send signed notification', error)
        }
    }

    /**
     * 发送撤回通知
     */
    async sendWithdrawalNotification(offer) {
        try {
            await NotificationService.sendEmail({
                to: offer.toCandidate,
                templateId: 'offer-withdrawn',
                data: {
                    offerId: offer.offerId,
                    reason: offer.statusHistory[offer.statusHistory.length - 1].note,
                },
            })
        } catch (error) {
            logger.error('Failed to send withdrawal notification', error)
        }
    }
}

export default new ContractService()
