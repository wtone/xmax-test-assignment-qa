import mongoose from 'mongoose'
import { v4 as uuidv4 } from 'uuid'

const { Schema } = mongoose

// 测试用例 Schema
const testCaseSchema = new Schema(
    {
        input: {
            type: String,
            required: true,
        },
        output: {
            type: String,
            required: true,
        },
    },
    { _id: false },
)

// 代码模板 Schema
const templateSchema = new Schema(
    {
        java: String,
        python: String,
        javascript: String,
        typescript: String,
        cpp: String,
        go: String,
    },
    { _id: false },
)

// 问题 Schema
const questionSchema = new Schema(
    {
        questionId: {
            type: String,
            required: true,
        },
        content: {
            type: String,
            required: true,
            maxlength: 3000,
        },
        followUp: {
            type: String,
            maxlength: 2000,
        },
        category: {
            type: String,
            required: true,
            enum: [
                'jvm',
                'concurrency',
                'framework',
                'algorithm',
                'database',
                'system-design',
                'network',
                'security',
                'cloud',
                'devops',
                'behavioral',
                'communication',
                'leadership',
                'problem-solving',
            ],
        },
        difficulty: {
            type: String,
            required: true,
            enum: ['easy', 'medium', 'intermediate', 'hard', 'advanced'],
        },
        points: {
            type: Number,
            required: true,
            min: 0,
        },
        keywords: [
            {
                type: String,
                trim: true,
            },
        ],
        expectedDuration: {
            type: Number, // 秒
            min: 0,
        },
        testCases: [testCaseSchema],
        template: templateSchema,
    },
    { _id: false },
)

// 面试步骤 Schema
const stepSchema = new Schema(
    {
        stepId: {
            type: String,
            required: true,
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            maxlength: 1000,
        },
        type: {
            type: String,
            required: true,
            enum: ['video', 'coding', 'quiz', 'file-upload'],
        },
        timeLimit: {
            type: Number, // 秒
            min: 0,
        },
        order: {
            type: Number,
            required: true,
            min: 1,
        },
        required: {
            type: Boolean,
            default: true,
        },
        questions: [questionSchema],
    },
    { _id: false },
)

// 评分权重 Schema
const weightsSchema = new Schema(
    {
        technical: {
            type: Number,
            min: 0,
            max: 1,
            default: 0.4,
        },
        communication: {
            type: Number,
            min: 0,
            max: 1,
            default: 0.3,
        },
        problemSolving: {
            type: Number,
            min: 0,
            max: 1,
            default: 0.3,
        },
    },
    { _id: false },
)

// 评分等级 Schema
const gradeSchema = new Schema(
    {
        min: {
            type: Number,
            required: true,
            min: 0,
        },
        description: {
            type: String,
            required: true,
            trim: true,
        },
    },
    { _id: false },
)

// 评分标准 Schema
const gradingRubricSchema = new Schema(
    {
        excellent: gradeSchema,
        good: gradeSchema,
        average: gradeSchema,
        poor: gradeSchema,
    },
    { _id: false },
)

// 评分配置 Schema
const scoringSchema = new Schema(
    {
        totalPoints: {
            type: Number,
            required: true,
            min: 0,
        },
        passingScore: {
            type: Number,
            required: true,
            min: 0,
        },
        weights: weightsSchema,
        gradingRubric: gradingRubricSchema,
    },
    { _id: false },
)

// 使用统计 Schema
const usageSchema = new Schema(
    {
        totalUses: {
            type: Number,
            default: 0,
            min: 0,
        },
        avgScore: {
            type: Number,
            default: 0,
            min: 0,
            max: 100,
        },
        passRate: {
            type: Number,
            default: 0,
            min: 0,
            max: 1,
        },
    },
    { _id: false },
)

// 面试流程模型
const interviewProcessSchema = new Schema(
    {
        // 业务标识
        processId: {
            type: String,
            required: true,
            unique: true,
            index: true,
        },

        // 基本信息
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200,
        },
        description: {
            type: String,
            maxlength: 2000,
        },
        category: {
            type: String,
            required: true,
            enum: ['frontend', 'backend', 'fullstack', 'mobile', 'qa', 'devops', 'ai', 'data', 'product', 'design'],
            index: true,
        },

        // 面试步骤
        steps: {
            type: [stepSchema],
            validate: {
                validator: function (steps) {
                    // 验证步骤顺序唯一
                    const orders = steps.map(s => s.order)
                    return orders.length === new Set(orders).size
                },
                message: '面试步骤顺序必须唯一',
            },
        },

        // 评分配置
        scoring: {
            type: scoringSchema,
            required: true,
        },

        // 创建信息
        createdBy: {
            type: Schema.Types.ObjectId,
            required: true,
            index: true,
        },
        isTemplate: {
            type: Boolean,
            default: false,
            index: true,
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },
        version: {
            type: String,
            default: '1.0',
        },

        // 使用统计
        usage: {
            type: usageSchema,
            default: () => ({}),
        },
    },
    {
        timestamps: true,
        collection: 'interview_processes',
    },
)

// 虚拟字段：总问题数
interviewProcessSchema.virtual('totalQuestions').get(function () {
    return this.steps.reduce((total, step) => total + (step.questions ? step.questions.length : 0), 0)
})

// 虚拟字段：预计总时长（分钟）
interviewProcessSchema.virtual('estimatedDuration').get(function () {
    const totalSeconds = this.steps.reduce((total, step) => total + (step.timeLimit || 0), 0)
    return Math.ceil(totalSeconds / 60)
})

// 虚拟字段：必需步骤数
interviewProcessSchema.virtual('requiredStepsCount').get(function () {
    return this.steps.filter(step => step.required).length
})

// 虚拟字段：通过率百分比
interviewProcessSchema.virtual('passRatePercentage').get(function () {
    return Math.round((this.usage.passRate || 0) * 100)
})

// 索引定义
// 复合索引 - 查找可用的面试流程
interviewProcessSchema.index({ createdBy: 1, isTemplate: 1, isActive: 1 })

// 中间件：生成 processId
interviewProcessSchema.pre('validate', async function (next) {
    if (!this.processId && this.isNew) {
        const categoryPrefix = this.category.substring(0, 3)
        const sequence = uuidv4().slice(0, 8)
        this.processId = `process_${categoryPrefix}_${sequence}`
    }
    next()
})

// 中间件：验证总分
interviewProcessSchema.pre('save', function (next) {
    // 计算所有问题的总分
    const calculatedTotal = this.steps.reduce((total, step) => {
        const stepTotal = step.questions.reduce((sum, q) => sum + (q.points || 0), 0)
        return total + stepTotal
    }, 0)

    // 验证总分是否匹配
    if (Math.abs(calculatedTotal - this.scoring.totalPoints) > 0.01) {
        return next(new Error(`问题总分(${calculatedTotal})与配置的总分(${this.scoring.totalPoints})不匹配`))
    }

    // 验证通过分数
    if (this.scoring.passingScore > this.scoring.totalPoints) {
        return next(new Error('通过分数不能大于总分'))
    }

    // 验证权重总和
    const weightSum = this.scoring.weights.technical + this.scoring.weights.communication + this.scoring.weights.problemSolving
    if (Math.abs(weightSum - 1) > 0.01) {
        return next(new Error('评分权重总和必须等于1'))
    }

    next()
})

// 实例方法：获取指定类型的问题
interviewProcessSchema.methods.getQuestionsByType = function (type) {
    const questions = []
    this.steps.forEach(step => {
        if (step.type === type) {
            questions.push(...step.questions)
        }
    })
    return questions
}

// 实例方法：获取指定难度的问题
interviewProcessSchema.methods.getQuestionsByDifficulty = function (difficulty) {
    const questions = []
    this.steps.forEach(step => {
        step.questions.forEach(q => {
            if (q.difficulty === difficulty) {
                questions.push(q)
            }
        })
    })
    return questions
}

// 实例方法：更新使用统计
interviewProcessSchema.methods.updateUsageStats = async function (score, passed) {
    const totalUses = this.usage.totalUses + 1
    const currentTotal = this.usage.avgScore * this.usage.totalUses
    const newAvgScore = (currentTotal + score) / totalUses

    const currentPasses = Math.round(this.usage.passRate * this.usage.totalUses)
    const newPasses = currentPasses + (passed ? 1 : 0)
    const newPassRate = newPasses / totalUses

    this.usage = {
        totalUses,
        avgScore: Math.round(newAvgScore * 10) / 10,
        passRate: Math.round(newPassRate * 1000) / 1000,
    }

    return this.save()
}

// 实例方法：克隆为新流程
interviewProcessSchema.methods.cloneAsTemplate = async function (newName, createdBy) {
    const clonedData = this.toObject()
    delete clonedData._id
    delete clonedData.processId
    delete clonedData.createdAt
    delete clonedData.updatedAt

    clonedData.name = newName
    clonedData.createdBy = createdBy
    clonedData.isTemplate = true
    clonedData.usage = { totalUses: 0, avgScore: 0, passRate: 0 }
    clonedData.version = '1.0'

    const InterviewProcess = this.constructor
    return new InterviewProcess(clonedData).save()
}

// 静态方法：获取模板列表
interviewProcessSchema.statics.getTemplates = async function (category, createdBy) {
    const query = { isTemplate: true, isActive: true }
    if (category) query.category = category
    if (createdBy) query.createdBy = new mongoose.Types.ObjectId(createdBy)

    return this.find(query)
        .select('processId name description category estimatedDuration totalQuestions usage')
        .sort({ 'usage.totalUses': -1, createdAt: -1 })
        .exec()
}

// 静态方法：按类别统计
interviewProcessSchema.statics.countByCategory = async function (createdBy) {
    const match = { isActive: true }
    if (createdBy) match.createdBy = new mongoose.Types.ObjectId(createdBy)

    return this.aggregate([
        { $match: match },
        {
            $group: {
                _id: '$category',
                count: { $sum: 1 },
                templates: {
                    $sum: { $cond: ['$isTemplate', 1, 0] },
                },
                avgUses: { $avg: '$usage.totalUses' },
            },
        },
    ])
}

// 静态方法：搜索问题
interviewProcessSchema.statics.searchQuestions = async function (keyword, filters = {}) {
    const pipeline = [{ $match: { isActive: true } }, { $unwind: '$steps' }, { $unwind: '$steps.questions' }]

    // 添加搜索条件
    const questionMatch = {}
    if (keyword) {
        questionMatch.$or = [{ 'steps.questions.content': { $regex: keyword, $options: 'i' } }, { 'steps.questions.keywords': { $in: [keyword] } }]
    }
    if (filters.category) {
        questionMatch['steps.questions.category'] = filters.category
    }
    if (filters.difficulty) {
        questionMatch['steps.questions.difficulty'] = filters.difficulty
    }

    if (Object.keys(questionMatch).length > 0) {
        pipeline.push({ $match: questionMatch })
    }

    // 返回问题信息
    pipeline.push({
        $project: {
            processId: 1,
            processName: '$name',
            stepName: '$steps.name',
            question: '$steps.questions',
        },
    })

    return this.aggregate(pipeline)
}

// toJSON 转换
interviewProcessSchema.set('toJSON', {
    virtuals: true,
    transform: function (doc, ret) {
        delete ret._id
        delete ret.__v
        return ret
    },
})

const InterviewProcess = mongoose.model('InterviewProcess', interviewProcessSchema)

export default InterviewProcess
