import mongoose from 'mongoose'
import { v4 as uuidv4 } from 'uuid'

const { Schema } = mongoose

// 薪资结构 Schema
const compensationSchema = new Schema(
    {
        rate: {
            type: Number,
            required: true,
            min: 0,
        },
        currency: {
            type: String,
            required: true,
            default: 'CNY',
            enum: ['CNY', 'USD', 'EUR', 'GBP', 'JPY'],
        },
        period: {
            type: String,
            required: true,
            enum: ['hour', 'day', 'week', 'month', 'year'],
        },
        hoursPerWeek: {
            type: Number,
            min: 0,
            max: 168,
        },
        overtimeRate: {
            type: Number,
            min: 1,
            default: 1.5,
        },
        paymentFrequency: {
            type: String,
            enum: ['weekly', 'bi-weekly', 'monthly'],
            default: 'monthly',
        },
    },
    { _id: false },
)

// 休假配置 Schema
const vacationSchema = new Schema(
    {
        annualLeave: {
            type: Number,
            min: 0,
            default: 10,
        },
        sickLeave: {
            type: Number,
            min: 0,
            default: 5,
        },
        personalLeave: {
            type: Number,
            min: 0,
            default: 3,
        },
    },
    { _id: false },
)

// 工作安排 Schema
const workArrangementSchema = new Schema(
    {
        location: {
            type: String,
            required: true,
            trim: true,
        },
        remote: {
            type: Boolean,
            default: false,
        },
        flexibleHours: {
            type: Boolean,
            default: false,
        },
        coreHours: {
            type: String,
            trim: true,
        },
        workDays: [
            {
                type: String,
                enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
            },
        ],
        vacation: vacationSchema,
    },
    { _id: false },
)

// 合同条款 Schema
const termsSchema = new Schema(
    {
        position: {
            type: String,
            required: true,
            trim: true,
        },
        department: {
            type: String,
            trim: true,
        },
        startDate: {
            type: Date,
            required: true,
        },
        endDate: Date,
        compensation: compensationSchema,
        contractDuration: {
            type: Number, // 月
            min: 0,
        },
        probationPeriod: {
            type: Number, // 月
            min: 0,
            default: 1,
        },
        noticePeriod: {
            type: Number, // 天
            min: 0,
            default: 30,
        },
        renewalOption: {
            type: Boolean,
            default: false,
        },
        exclusivity: {
            type: Boolean,
            default: false,
        },
        intellectualProperty: {
            type: String,
            enum: ['company', 'employee', 'shared'],
            default: 'company',
        },
        confidentiality: {
            type: Boolean,
            default: true,
        },
    },
    { _id: false },
)

// 福利 Schema
const benefitSchema = new Schema(
    {
        type: {
            type: String,
            required: true,
            enum: ['insurance', 'leave', 'allowance', 'equipment', 'training', 'bonus', 'other'],
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            maxlength: 500,
        },
    },
    { _id: false },
)

// 状态历史 Schema
const statusHistorySchema = new Schema(
    {
        status: {
            type: String,
            required: true,
        },
        timestamp: {
            type: Date,
            default: Date.now,
        },
        operator: {
            type: Schema.Types.ObjectId,
        },
        note: {
            type: String,
            maxlength: 500,
        },
    },
    { _id: false },
)

// 附件 Schema
const attachmentSchema = new Schema(
    {
        type: {
            type: String,
            required: true,
            enum: ['contract', 'nda', 'handbook', 'other'],
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        url: {
            type: String,
            required: true,
        },
    },
    { _id: false },
)

// 候选人回复 Schema
const candidateResponseSchema = new Schema(
    {
        action: {
            type: String,
            enum: ['accept', 'reject', 'negotiate'],
        },
        message: {
            type: String,
            maxlength: 2000,
        },
        counterOffer: {
            type: Schema.Types.Mixed, // 可以是薪资、休假等的反向报价
        },
        respondedAt: Date,
    },
    { _id: false },
)

// 合同offer模型
const contractOfferSchema = new Schema(
    {
        // 业务标识
        offerId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },

        // 关联信息
        applicationId: {
            type: Schema.Types.ObjectId, // 引用JobApplication的_id
            ref: 'JobApplication',
            required: true,
            index: true,
        },
        jobId: {
            type: Schema.Types.ObjectId, // 引用JobPost的_id
            ref: 'JobPost',
            required: true,
        },
        fromCompany: {
            type: String, // 支持UUID格式（外部系统）
            required: true,
            index: true,
        },
        toCandidate: {
            type: String, // 支持UUID格式（外部系统）
            required: true,
            index: true,
        },

        // 合同条款
        terms: {
            type: termsSchema,
            required: true,
        },

        // 福利待遇
        benefits: [benefitSchema],

        // 工作安排
        workArrangement: workArrangementSchema,

        // 状态信息
        status: {
            type: String,
            required: true,
            enum: ['pending', 'accepted', 'rejected', 'signed', 'expired', 'withdrawn'],
            default: 'pending',
        },
        statusHistory: [statusHistorySchema],

        // 消息内容
        message: {
            type: String,
            maxlength: 3000,
        },
        attachments: [attachmentSchema],

        // 回复信息
        candidateResponse: candidateResponseSchema,

        // 时间信息
        sentAt: {
            type: Date,
            default: Date.now,
        },
        expiresAt: {
            type: Date,
            required: true,
            index: true,
        },
        respondedAt: Date,
        signedAt: Date,
    },
    {
        timestamps: true,
        collection: 'contract_offers',
    },
)

// 虚拟字段：是否已过期
contractOfferSchema.virtual('isExpired').get(function () {
    return this.status === 'pending' && this.expiresAt < new Date()
})

// 虚拟字段：剩余有效天数
contractOfferSchema.virtual('daysRemaining').get(function () {
    if (this.status !== 'pending' || this.isExpired) {
        return 0
    }
    const diffMs = this.expiresAt - new Date()
    return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
})

// 虚拟字段：是否可以撤回
contractOfferSchema.virtual('canWithdraw').get(function () {
    return this.status === 'pending' && !this.candidateResponse
})

// 虚拟字段：年薪计算（仅供参考）
contractOfferSchema.virtual('annualSalary').get(function () {
    if (!this.terms || !this.terms.compensation) {
        return null
    }

    const comp = this.terms.compensation
    let annual = 0

    switch (comp.period) {
        case 'hour':
            annual = comp.rate * (comp.hoursPerWeek || 40) * 52
            break
        case 'day':
            annual = comp.rate * 250 // 假设一年250个工作日
            break
        case 'week':
            annual = comp.rate * 52
            break
        case 'month':
            annual = comp.rate * 12
            break
        case 'year':
            annual = comp.rate
            break
    }

    return {
        amount: Math.round(annual),
        currency: comp.currency,
    }
})

// 索引定义
// 复合索引 - 候选人查看自己的offer
contractOfferSchema.index({ toCandidate: 1, status: 1, sentAt: -1 })

// 复合索引 - 企业查看发出的offer
contractOfferSchema.index({ fromCompany: 1, status: 1, sentAt: -1 })

// 中间件：生成 offerId
contractOfferSchema.pre('validate', async function (next) {
    if (!this.offerId && this.isNew) {
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
        const sequence = uuidv4().slice(0, 8)
        this.offerId = `offer_${date}_${sequence}`
    }
    next()
})

// 中间件：记录状态变更
contractOfferSchema.pre('save', function (next) {
    if (this.isModified('status')) {
        // 不要重复记录相同状态
        const lastStatus = this.statusHistory.length > 0 ? this.statusHistory[this.statusHistory.length - 1].status : null

        if (lastStatus !== this.status) {
            this.statusHistory.push({
                status: this.status,
                timestamp: new Date(),
                note: `状态变更为: ${this.status}`,
            })
        }

        // 设置相应的时间戳
        if (this.status === 'signed' && !this.signedAt) {
            this.signedAt = new Date()
        }
    }
    next()
})

// 中间件：验证日期逻辑
contractOfferSchema.pre('save', function (next) {
    if (this.terms) {
        // 验证合同结束日期大于开始日期
        if (this.terms.endDate && this.terms.endDate <= this.terms.startDate) {
            return next(new Error('合同结束日期必须大于开始日期'))
        }

        // 验证试用期不超过合同期限
        if (this.terms.contractDuration && this.terms.probationPeriod > this.terms.contractDuration) {
            return next(new Error('试用期不能超过合同期限'))
        }
    }
    next()
})

// 实例方法：接受offer
contractOfferSchema.methods.accept = async function (message) {
    if (this.status !== 'pending') {
        throw new Error('只有待处理的offer可以接受')
    }

    this.status = 'accepted'
    this.candidateResponse = {
        action: 'accept',
        message,
        respondedAt: new Date(),
    }
    this.respondedAt = new Date()

    return this.save()
}

// 实例方法：拒绝offer
contractOfferSchema.methods.reject = async function (message) {
    if (this.status !== 'pending') {
        throw new Error('只有待处理的offer可以拒绝')
    }

    this.status = 'rejected'
    this.candidateResponse = {
        action: 'reject',
        message,
        respondedAt: new Date(),
    }
    this.respondedAt = new Date()

    return this.save()
}

// 实例方法：协商offer
contractOfferSchema.methods.negotiate = async function (message, counterOffer) {
    if (this.status !== 'pending') {
        throw new Error('只有待处理的offer可以协商')
    }

    this.candidateResponse = {
        action: 'negotiate',
        message,
        counterOffer,
        respondedAt: new Date(),
    }
    this.respondedAt = new Date()

    return this.save()
}

// 实例方法：签署offer
contractOfferSchema.methods.sign = async function () {
    if (this.status !== 'accepted') {
        throw new Error('只有已接受的offer可以签署')
    }

    this.status = 'signed'
    this.signedAt = new Date()

    return this.save()
}

// 实例方法：撤回offer
contractOfferSchema.methods.withdraw = async function (operator, reason) {
    if (!this.canWithdraw) {
        throw new Error('此offer不能撤回')
    }

    this.status = 'withdrawn'
    this.statusHistory.push({
        status: 'withdrawn',
        timestamp: new Date(),
        operator,
        note: reason || '企业撤回了offer',
    })

    return this.save()
}

// 实例方法：检查并更新过期状态
contractOfferSchema.methods.checkAndUpdateExpired = async function () {
    if (this.isExpired && this.status === 'pending') {
        this.status = 'expired'
        return this.save()
    }
    return this
}

// 静态方法：批量更新过期offer
contractOfferSchema.statics.updateExpiredOffers = async function () {
    const now = new Date()
    return this.updateMany(
        {
            status: 'pending',
            expiresAt: { $lt: now },
        },
        {
            $set: { status: 'expired' },
            $push: {
                statusHistory: {
                    status: 'expired',
                    timestamp: now,
                    note: 'Offer已过期',
                },
            },
        },
    )
}

// 静态方法：统计offer数据
contractOfferSchema.statics.getOfferStats = async function (companyId, dateRange) {
    const match = {}
    if (companyId) match.fromCompany = companyId // 支持UUID格式（外部系统）
    if (dateRange) {
        match.sentAt = {
            $gte: dateRange.start,
            $lte: dateRange.end,
        }
    }

    return this.aggregate([
        { $match: match },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
                avgResponseTime: {
                    $avg: {
                        $cond: [{ $and: ['$respondedAt', '$sentAt'] }, { $subtract: ['$respondedAt', '$sentAt'] }, null],
                    },
                },
            },
        },
        {
            $project: {
                status: '$_id',
                count: 1,
                avgResponseDays: {
                    $cond: ['$avgResponseTime', { $divide: ['$avgResponseTime', 1000 * 60 * 60 * 24] }, null],
                },
            },
        },
    ])
}

// toJSON 转换
contractOfferSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        delete ret._id
        delete ret.__v
        return ret
    },
})

const ContractOffer = mongoose.model('ContractOffer', contractOfferSchema)

export default ContractOffer
