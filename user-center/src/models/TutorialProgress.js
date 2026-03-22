import mongoose from 'mongoose'
import { v4 as uuidv4 } from 'uuid'
import mongoManager from '../../utils/mongo.js'
import errors from '../errors.js'

const { Schema } = mongoose

const tutorialProgressSchema = new Schema(
    {
        _id: {
            type: String,
            default: uuidv4,
        },
        userId: {
            type: String,
            required: true,
            index: true,
        },
        actionType: {
            type: String,
            required: true,
            trim: true,
            validate: {
                validator: function (value) {
                    return value && value.length > 0 && value.length <= 50
                },
                message: 'Action type must be between 1-50 characters',
            },
        },
        completedAt: {
            type: Date,
            required: true,
            default: Date.now,
        },
        metadata: {
            type: Object,
            default: {},
        },
    },
    {
        timestamps: true,
        versionKey: false,
    },
)

// 组合索引：用户ID + 操作类型，确保唯一性
tutorialProgressSchema.index({ userId: 1, actionType: 1 }, { unique: true })

// 静态方法：记录用户完成的操作（仅允许一次）
tutorialProgressSchema.statics.recordAction = async function (userId, actionType, metadata = {}) {
    try {
        // 检查是否已存在记录
        const existing = await this.findOne({ userId, actionType })
        if (existing) {
            return { success: false, error: errors.TUTORIAL_ACTION_ALREADY_COMPLETED }
        }

        // 创建新记录
        const newRecord = new this({
            userId,
            actionType,
            metadata,
            completedAt: new Date()
        })

        const result = await newRecord.save()
        return { success: true, data: result }
    } catch (error) {
        return { success: false, error: error.message }
    }
}

// 静态方法：获取用户的操作状态
tutorialProgressSchema.statics.getUserActionStatus = async function (userId, actionType = null) {
    try {
        const query = { userId }
        if (actionType) {
            query.actionType = actionType
        }

        const results = await this.find(query).sort({ completedAt: -1 })

        if (actionType) {
            // 查询特定操作
            return {
                success: true,
                data: results.length > 0 ? results[0] : null,
                completed: results.length > 0
            }
        } else {
            // 查询所有操作
            const actionMap = {}
            results.forEach(item => {
                actionMap[item.actionType] = {
                    completedAt: item.completedAt,
                    metadata: item.metadata
                }
            })

            return {
                success: true,
                data: actionMap,
                totalActions: results.length
            }
        }
    } catch (error) {
        return { success: false, error: error.message }
    }
}

const TutorialProgressModel = await mongoManager.createModel(
    process.env.MONGO_USER_CENTER_URI,
    'Tutorial',
    tutorialProgressSchema
)

export default TutorialProgressModel
