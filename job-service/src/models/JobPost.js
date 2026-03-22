import mongoose from 'mongoose'
import { v4 as uuidv4 } from 'uuid'
import {
    CONTRACT_TYPE,
    EDUCATION_LEVEL,
    WORK_MODE,
    TIME_UNIT,
    SALARY_PERIOD,
    CURRENCY,
    OTHER_REQUIREMENTS_MAX_LENGTH,
} from '../constants/job_constants.js'

const { Schema } = mongoose

// 薪资范围 Schema
const salaryRangeSchema = new Schema(
    {
        min: {
            type: Number,
            required: true,
            min: 0,
        },
        max: {
            type: Number,
            required: true,
            min: 0,
        },
        currency: {
            type: String,
            required: true,
            default: CURRENCY.CNY,
            enum: Object.values(CURRENCY),
        },
        period: {
            type: String,
            required: true,
            default: SALARY_PERIOD.DAY,
            enum: Object.values(SALARY_PERIOD),
        },
        months: {
            type: Number,
            required: false,
            default: 12,
            min: 12,
            validate: {
                validator: Number.isInteger,
                message: '薪资月数必须是整数',
            },
        },
    },
    { _id: false },
)

// 经验要求 Schema
const experienceSchema = new Schema(
    {
        min: {
            type: Number,
            required: true,
            min: 0,
        },
        max: {
            type: Number,
            required: true,
            min: 0,
        },
        unit: {
            type: String,
            required: true,
            default: 'years',
            enum: ['months', 'years'],
        },
    },
    { _id: false },
)

// 合同时长 Schema
const contractDurationSchema = new Schema(
    {
        value: {
            type: Number,
            required: true,
            min: 0,
        },
        unit: {
            type: String,
            required: true,
            // 使用 TIME_UNIT 枚举，专门用于时间单位
            enum: Object.values(TIME_UNIT),
            default: TIME_UNIT.HOUR,
        },
    },
    { _id: false },
)

// 面试配置 Schema
const interviewConfigSchema = new Schema(
    {
        enabled: {
            type: Boolean,
            default: true,
        },
        processId: {
            type: Schema.Types.ObjectId,
            ref: 'InterviewProcess',
        },
        requiredModules: [
            {
                type: String,
                enum: ['coding', 'system-design', 'communication', 'technical', 'behavioral'],
            },
        ],
        estimatedDuration: {
            type: Number, // 分钟
            min: 0,
        },
    },
    { _id: false },
)

// 统计信息 Schema
const statsSchema = new Schema(
    {
        views: {
            type: Number,
            default: 0,
            min: 0,
        },
        applications: {
            type: Number,
            default: 0,
            min: 0,
        },
        avgMatchScore: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
        },
    },
    { _id: false },
)

// 职位模型
const jobPostSchema = new Schema(
    {
        // 业务标识
        jobId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },

        // 发布者信息
        companyId: {
            type: String, // 支持UUID格式的公司ID
            required: true,
            index: true,
        },
        companyName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
        },
        showCompanyName: {
            type: Boolean,
            default: true,
            required: true,
        },
        companyAlias: {
            type: String,
            trim: true,
            maxlength: 100,
            required: false,
            default: '匿名公司',
        },
        publisherId: {
            type: String, // 支持UUID格式的用户ID
            required: true,
            index: true,
        },

        // 基本信息
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200,
        },
        description: {
            type: String,
            required: true,
            minlength: 50,
            maxlength: 30000,
            trim: true,
        },
        parsedDescription: {
            type: String,
            required: false,
            maxlength: 10000,
            trim: true,
        },
        // AI 解析出的职位评价标签列表（由 job-ai-service 填充）
        parsedTagList: [
            {
                id: { type: String, required: true },
                label: { type: String, required: true },
                category: { type: String, required: true },
                _id: false,
            },
        ],
        requirements: [
            {
                type: String,
                trim: true,
            },
        ],
        otherRequirements: {
            type: String,
            trim: true,
            required: false,
            maxlength: OTHER_REQUIREMENTS_MAX_LENGTH,
        },

        // 工作条件
        location: {
            type: String,
            required: false,
            trim: true,
        },
        remote: {
            type: Boolean,
            default: false,
        },
        workMode: {
            type: String,
            enum: Object.values(WORK_MODE),
            default: WORK_MODE.ONSITE,
            required: true,
        },

        // 薪资和合同信息
        salaryRange: salaryRangeSchema,
        contractType: {
            type: String,
            required: true,
            enum: Object.values(CONTRACT_TYPE),
            default: CONTRACT_TYPE.FULL_TIME,
        },
        contractDuration: contractDurationSchema,

        // 要求条件
        experience: experienceSchema,
        education: {
            type: String,
            enum: Object.values(EDUCATION_LEVEL),
            default: EDUCATION_LEVEL.NONE,
            required: true,
        },

        // 面试配置
        interviewConfig: interviewConfigSchema,

        // 面试类型（支持多选sessions.id）
        interviewTypes: {
            type: [String],
            default: [],
            validate: {
                validator: function (v) {
                    // 验证数组中的每个值都是字符串
                    return Array.isArray(v) && v.every(item => typeof item === 'string')
                },
                message: '面试类型必须是字符串数组',
            },
        },

        // 状态管理
        status: {
            type: String,
            required: true,
            enum: ['draft', 'published', 'paused', 'closed', 'expired'],
            default: 'draft',
        },
        maxApplicants: {
            type: Number,
            min: 0,
        },
        currentApplicants: {
            type: Number,
            default: 0,
            min: 0,
        },
        hiredCount: {
            type: Number,
            default: 0,
            min: 0,
        },

        // 时间信息
        startDate: {
            type: Date,
        },
        applicationDeadline: {
            type: Date,
        },
        publishedAt: {
            type: Date,
        },
        expiredAt: {
            type: Date,
            description: '职位过期时间（系统自动设置）',
        },
        closedAt: {
            type: Date,
            description: '职位关闭时间（手动关闭时设置）',
        },

        // 统计信息
        stats: {
            type: statsSchema,
            default: () => ({}),
        },
    },
    {
        timestamps: true,
        collection: 'job_posts',
    },
)

// 虚拟字段：是否处于活跃状态
jobPostSchema.virtual('isActive').get(function () {
    return (
        this.status === 'published' &&
        (!this.applicationDeadline || this.applicationDeadline > new Date()) &&
        (!this.maxApplicants || (this.hiredCount || 0) < this.maxApplicants)
    )
})

// 虚拟字段：是否可以申请
jobPostSchema.virtual('canApply').get(function () {
    return this.isActive
})

// 虚拟字段：招聘进度百分比
jobPostSchema.virtual('applicationProgress').get(function () {
    if (!this.maxApplicants || this.maxApplicants === 0) {
        return 0
    }
    return Math.min(100, Math.round(((this.hiredCount || 0) / this.maxApplicants) * 100))
})

// 索引定义
// 复合索引 - 企业查看自己的职位
jobPostSchema.index({ companyId: 1, status: 1, createdAt: -1 })

// 复合索引 - C端搜索职位
jobPostSchema.index({ status: 1, location: 1, remote: 1, 'salaryRange.min': 1 })

// 复合索引 - 按发布者+公司查询（数据隔离）
jobPostSchema.index({ publisherId: 1, companyId: 1 })

// 文本搜索索引
jobPostSchema.index({ title: 'text', description: 'text', requirements: 'text' })

// 中间件：生成 jobId
jobPostSchema.pre('validate', async function (next) {
    if (!this.jobId && this.isNew) {
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
        const sequence = uuidv4().slice(0, 8)
        this.jobId = `job_${date}_${sequence}`
    }
    next()
})

// 中间件：发布时设置发布时间
jobPostSchema.pre('save', function (next) {
    if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
        this.publishedAt = new Date()
    }
    next()
})

// 中间件：验证薪资范围
jobPostSchema.pre('save', function (next) {
    if (this.salaryRange && this.salaryRange.min > this.salaryRange.max) {
        return next(new Error('薪资最小值不能大于最大值'))
    }
    if (this.experience && this.experience.min > this.experience.max) {
        return next(new Error('经验最小值不能大于最大值'))
    }
    next()
})

// 实例方法：增加浏览次数
jobPostSchema.methods.incrementViews = async function () {
    this.stats.views += 1
    return this.save()
}

// 实例方法：增加申请次数
jobPostSchema.methods.incrementApplications = async function () {
    this.currentApplicants += 1
    this.stats.applications += 1
    return this.save()
}

// 实例方法：更新平均匹配分数
jobPostSchema.methods.updateAvgMatchScore = async function (newScore, totalScores) {
    if (totalScores > 0) {
        this.stats.avgMatchScore = newScore
        return this.save()
    }
}

// 实例方法：检查是否可以申请
jobPostSchema.methods.checkCanApply = function () {
    if (this.status !== 'published') {
        return { canApply: false, reason: '职位未发布' }
    }
    if (this.applicationDeadline && this.applicationDeadline < new Date()) {
        return { canApply: false, reason: '申请已截止' }
    }
    if (this.maxApplicants && (this.hiredCount || 0) >= this.maxApplicants) {
        return { canApply: false, reason: '招聘人数已满' }
    }
    return { canApply: true }
}

// 静态方法：按公司统计职位
jobPostSchema.statics.countByCompany = async function (companyId) {
    return this.aggregate([
        { $match: { companyId: companyId } },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 },
            },
        },
    ])
}

// 静态方法：搜索职位
jobPostSchema.statics.searchJobs = async function (filters = {}, options = {}) {
    const query = { status: 'published' }

    // 构建查询条件
    if (filters.location) query.location = filters.location
    if (filters.remote !== undefined) query.remote = filters.remote
    if (filters.workMode) query.workMode = filters.workMode
    if (filters.contractType) query.contractType = filters.contractType
    if (filters.minSalary) {
        query['salaryRange.min'] = { $gte: filters.minSalary }
    }
    if (filters.maxSalary) {
        query['salaryRange.max'] = { $lte: filters.maxSalary }
    }
    if (filters.education) query.education = filters.education
    if (filters.keyword) {
        query.$text = { $search: filters.keyword }
    }

    // 构建查询
    let queryBuilder = this.find(query)

    // 排序
    const sortBy = options.sortBy || 'createdAt'
    const sortOrder = options.sortOrder === 'asc' ? 1 : -1
    queryBuilder = queryBuilder.sort({ [sortBy]: sortOrder })

    // 分页
    if (options.page && options.pageSize) {
        const skip = (options.page - 1) * options.pageSize
        queryBuilder = queryBuilder.skip(skip).limit(options.pageSize)
    }

    // 字段选择
    if (options.select) {
        queryBuilder = queryBuilder.select(options.select)
    }

    return queryBuilder.exec()
}

// toJSON 转换
jobPostSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        delete ret._id
        delete ret.__v
        return ret
    },
})

const JobPost = mongoose.model('JobPost', jobPostSchema)

export default JobPost
