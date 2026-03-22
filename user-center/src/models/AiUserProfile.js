import mongoose from 'mongoose'
import mongoManager from '../../utils/mongo.js'

const { Schema } = mongoose

// 元数据 Schema
const metadataSchema = new Schema(
    {
        source: {
            type: String,
            enum: ['ai', 'manual', 'mixed'],
            default: 'ai',
        },
        aiConfidence: {
            type: Number,
            min: 0,
            max: 1,
        },
        aiParsedFields: [String],
        aiParsedAt: Date,
        version: {
            type: Number,
            default: 1,
        },
    },
    { _id: false }
)

// AI 用户画像 Schema
const aiUserProfileSchema = new Schema(
    {
        userId: {
            type: String,
            required: true,
            unique: true,
        },
        profileData: {
            type: Schema.Types.Mixed,
            default: {},
        },
        metadata: {
            type: metadataSchema,
            default: () => ({}),
        },
    },
    {
        timestamps: true,
        versionKey: false,
        collection: 'ai_profiles',
    }
)

// 索引
aiUserProfileSchema.index({ updatedAt: -1 })
aiUserProfileSchema.index({ 'metadata.aiParsedAt': -1 })

// 静态方法：根据 userId 查找
aiUserProfileSchema.statics.findByUserId = function (userId) {
    return this.findOne({ userId })
}

// 静态方法：upsert 操作（使用原子操作避免竞态条件）
aiUserProfileSchema.statics.upsertByUserId = async function (userId, profileData, options = {}) {
    const { confidence, parsedFields, source = 'ai' } = options

    const result = await this.findOneAndUpdate(
        { userId },
        {
            $set: {
                profileData,
                'metadata.source': source,
                'metadata.aiConfidence': confidence,
                'metadata.aiParsedFields': parsedFields,
                'metadata.aiParsedAt': new Date(),
            },
            $inc: { 'metadata.version': 1 },
            $setOnInsert: { userId },
        },
        {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
            rawResult: true,
        }
    )

    const isNew = result.lastErrorObject?.upserted != null
    const doc = result.value

    return {
        userId: doc?.userId ?? userId,
        operation: isNew ? 'created' : 'updated',
        version: doc?.metadata?.version ?? 1,
    }
}

const AiUserProfileModel = await mongoManager.createModel(
    process.env.MONGO_USER_CENTER_URI,
    'AiUserProfile',
    aiUserProfileSchema
)

export default AiUserProfileModel
