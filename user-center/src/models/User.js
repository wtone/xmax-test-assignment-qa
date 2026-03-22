import mongoose from 'mongoose'
import bcryptjs from 'bcryptjs'
import { v4 as uuidv4 } from 'uuid'
import mongoManager from '../../utils/mongo.js'
import { USER_STATUS, USER_TYPE, LOGIN_PLATFORM } from '../libs/constants.js'

const { Schema } = mongoose

const userSchema = new Schema(
    {
        _id: {
            type: String,
            default: uuidv4,
        },
        username: {
            type: String,
            required: false,
            unique: true,
            sparse: true, // 允许多个null/空值但保持唯一性
            trim: true,
            validate: {
                validator: function (value) {
                    // 如果 username 为空字符串、null 或 undefined，则验证通过
                    if (!value || value === '') return true
                    // 如果提供了用户名，则验证长度
                    return value.length >= 2 && value.length <= 20
                },
                message: 'Username must be between 2-20 characters when provided',
            },
        },
        email: {
            type: String,
            required: false,
            unique: true,
            sparse: true, // 允许多个null值但保持唯一性
            lowercase: true,
            trim: true,
            match: [/^[\w+.-]+@[\w.-]+\.[a-zA-Z]{2,}$/, '请输入有效的邮箱地址'],
        },
        phone: {
            type: String,
            trim: true,
            match: [/^\+?[\d\s-()]+$/, 'Please enter a valid phone number'],
        },
        password: {
            type: String,
            required: false,
            minlength: 6,
            select: false, // 默认不返回密码字段
        },
        type: {
            type: String,
            enum: [USER_TYPE.C_END, USER_TYPE.B_END], // C-end (customer) or B-end (business)
            default: USER_TYPE.C_END,
            required: true,
        },
        status: {
            type: String,
            enum: [USER_STATUS.ACTIVE, USER_STATUS.INACTIVE, USER_STATUS.BANNED],
            default: USER_STATUS.ACTIVE,
        },
        profile: {
            firstName: String,
            lastName: String,
            avatar: String,
            phone: String,
            address: String,
        },
        roles: [
            {
                type: Schema.Types.ObjectId,
                ref: 'Role',
            },
        ],
        lastLoginAt: Date,
        lastLoginIP: { type: String },
        lastLoginPlatform: {
            type: String,
            enum: [LOGIN_PLATFORM.WEB, LOGIN_PLATFORM.IOS, LOGIN_PLATFORM.ANDROID, LOGIN_PLATFORM.DESKTOP, LOGIN_PLATFORM.API],
            default: LOGIN_PLATFORM.WEB,
        },
        loginCount: { type: Number, default: 0 },
        emailVerified: { type: Boolean, default: false },
        phoneVerified: { type: Boolean, default: false },
        twoFactorEnabled: { type: Boolean, default: false },
        refreshTokens: [
            {
                token: String,
                platform: {
                    type: String,
                    enum: [LOGIN_PLATFORM.WEB, LOGIN_PLATFORM.IOS, LOGIN_PLATFORM.ANDROID, LOGIN_PLATFORM.DESKTOP, LOGIN_PLATFORM.API],
                    required: true,
                },
                deviceId: String,
                createdAt: {
                    type: Date,
                    default: Date.now,
                },
                expiresAt: Date,
            },
        ],
    },
    {
        timestamps: true,
        versionKey: false,
    },
)

// 索引
userSchema.index({ status: 1 })
userSchema.index({ createdAt: -1 })

// 密码加密中间件
userSchema.pre('save', async function (next) {
    if (!this.isModified('password') || !this.password) return next()

    try {
        const salt = await bcryptjs.genSalt(12)
        this.password = await bcryptjs.hash(this.password, salt)
        next()
    } catch (error) {
        next(error)
    }
})

// 实例方法：验证密码
userSchema.methods.validatePassword = async function (password) {
    if (!this.password) return false
    return await bcryptjs.compare(password, this.password)
}

// 实例方法：更新登录信息
userSchema.methods.updateLoginInfo = async function (ip, platform = LOGIN_PLATFORM.WEB) {
    this.lastLoginAt = new Date()
    this.lastLoginIP = ip
    this.lastLoginPlatform = platform
    this.loginCount += 1

    // 添加超时处理，避免 save 操作无限等待
    try {
        // 使用 updateOne 替代 save，性能更好且更稳定
        const result = await this.constructor
            .updateOne(
                { _id: this._id },
                {
                    $set: {
                        lastLoginAt: this.lastLoginAt,
                        lastLoginIP: this.lastLoginIP,
                        lastLoginPlatform: this.lastLoginPlatform,
                    },
                    $inc: { loginCount: 1 },
                },
            )
            .maxTimeMS(5000) // 5秒超时

        return result
    } catch (error) {
        console.error('Error updating login info:', error.message)
        // 登录信息更新失败不应该阻止用户登录
        return null
    }
}

// 实例方法：获取用户权限
userSchema.methods.getPermissions = async function () {
    await this.populate({
        path: 'roles',
        populate: {
            path: 'permissions',
        },
    })

    const permissions = new Set()
    this.roles.forEach(role => {
        role.permissions.forEach(permission => {
            permissions.add(`${permission.resource}:${permission.action}`)
        })
    })

    return Array.from(permissions)
}

// 实例方法：检查是否有权限
userSchema.methods.hasPermission = async function (resource, action) {
    const permissions = await this.getPermissions()
    return permissions.includes(`${resource}:${action}`) || permissions.includes('*:*')
}

// 实例方法：检查是否有角色
userSchema.methods.hasRole = function (roleName) {
    return this.roles.some(role => role.name === roleName)
}

// 实例方法：添加刷新令牌
userSchema.methods.addRefreshToken = function (token, expiresAt, platform = LOGIN_PLATFORM.WEB, deviceId = 'unknown-device') {
    this.refreshTokens.push({
        token,
        platform,
        deviceId,
        expiresAt,
    })

    // 清理过期的令牌
    this.refreshTokens = this.refreshTokens.filter(rt => rt.expiresAt > new Date())

    return this.save()
}

// 实例方法：安全地添加刷新令牌（带错误处理）
userSchema.methods.safeAddRefreshToken = async function (token, expiresAt, platform = LOGIN_PLATFORM.WEB, deviceId = 'unknown-device') {
    try {
        await this.addRefreshToken(token, expiresAt, platform, deviceId)

        console.log('RefreshToken成功存储到MongoDB', {
            userId: this._id.toString(),
            tokenLength: token.length,
            platform,
            deviceId,
            expiresAt: expiresAt.toISOString(),
            totalTokens: this.refreshTokens.length,
        })

        return { success: true, error: null }
    } catch (error) {
        console.error('存储RefreshToken到MongoDB失败:', {
            userId: this._id.toString(),
            error: error.message,
            tokenLength: token?.length || 0,
        })

        return { success: false, error: error.message }
    }
}

// 实例方法：移除刷新令牌
userSchema.methods.removeRefreshToken = function (token) {
    this.refreshTokens = this.refreshTokens.filter(rt => rt.token !== token)
    return this.save()
}

// 实例方法：安全地移除刷新令牌（带错误处理）
userSchema.methods.safeRemoveRefreshToken = async function (token) {
    try {
        const beforeCount = this.refreshTokens.length
        await this.removeRefreshToken(token)
        const afterCount = this.refreshTokens.length

        const tokenRemoved = beforeCount > afterCount

        console.log('RefreshToken成功从MongoDB中移除', {
            userId: this._id.toString(),
            tokenLength: token.length,
            tokenRemoved,
            remainingTokens: afterCount,
        })

        return { success: true, removed: tokenRemoved, error: null }
    } catch (error) {
        console.error('从MongoDB移除RefreshToken失败:', {
            userId: this._id.toString(),
            error: error.message,
            tokenLength: token?.length || 0,
        })

        return { success: false, removed: false, error: error.message }
    }
}

// 实例方法：安全地清理所有刷新令牌（带错误处理）
userSchema.methods.safeClearAllRefreshTokens = async function () {
    try {
        const beforeCount = this.refreshTokens.length
        this.refreshTokens = []

        await this.save()

        console.log('所有RefreshToken成功从MongoDB中清理', {
            userId: this._id.toString(),
            clearedCount: beforeCount,
        })

        return { success: true, clearedCount: beforeCount, error: null }
    } catch (error) {
        console.error('从MongoDB清理所有RefreshToken失败:', {
            userId: this._id.toString(),
            error: error.message,
        })

        return { success: false, clearedCount: 0, error: error.message }
    }
}

// 实例方法：查找特定平台的有效refreshToken
userSchema.methods.findValidRefreshTokenByPlatform = function (platform) {
    const now = new Date()
    return this.refreshTokens.find(rt => rt.platform === platform && rt.expiresAt > now)
}

// 实例方法：按平台安全地添加或更新refreshToken
userSchema.methods.safeAddOrUpdateRefreshTokenByPlatform = async function (token, expiresAt, platform, deviceId) {
    try {
        // 移除该平台的旧token
        this.refreshTokens = this.refreshTokens.filter(rt => rt.platform !== platform)

        // 添加新的platform token
        this.refreshTokens.push({
            token,
            platform,
            deviceId,
            expiresAt,
        })

        // 清理过期的令牌
        this.refreshTokens = this.refreshTokens.filter(rt => rt.expiresAt > new Date())

        await this.save()

        console.log('RefreshToken按平台成功存储到MongoDB', {
            userId: this._id.toString(),
            platform,
            deviceId,
            tokenLength: token.length,
            expiresAt: expiresAt.toISOString(),
            totalTokens: this.refreshTokens.length,
        })

        return { success: true, error: null, isNewToken: true }
    } catch (error) {
        console.error('按平台存储RefreshToken到MongoDB失败:', {
            userId: this._id.toString(),
            platform,
            error: error.message,
            tokenLength: token?.length || 0,
        })

        return { success: false, error: error.message, isNewToken: false }
    }
}

// 实例方法：按平台安全地移除refreshToken
userSchema.methods.safeRemoveRefreshTokenByPlatform = async function (platform) {
    try {
        const beforeCount = this.refreshTokens.length
        this.refreshTokens = this.refreshTokens.filter(rt => rt.platform !== platform)
        const afterCount = this.refreshTokens.length

        await this.save()

        const tokenRemoved = beforeCount > afterCount

        console.log('RefreshToken按平台成功从MongoDB中移除', {
            userId: this._id.toString(),
            platform,
            tokenRemoved,
            remainingTokens: afterCount,
        })

        return { success: true, removed: tokenRemoved, error: null }
    } catch (error) {
        console.error('按平台从MongoDB移除RefreshToken失败:', {
            userId: this._id.toString(),
            platform,
            error: error.message,
        })

        return { success: false, removed: false, error: error.message }
    }
}

// 静态方法：根据邮箱或用户名查找用户
userSchema.statics.findByEmailOrUsername = function (identifier) {
    return this.findOne({
        $or: [{ email: identifier }, { username: identifier }],
    })
}

// 虚拟字段：全名
userSchema.virtual('profile.fullName').get(function () {
    if (this.profile.firstName && this.profile.lastName) {
        return `${this.profile.firstName} ${this.profile.lastName}`
    }
    return this.username
})

// 确保虚拟字段在JSON中显示
userSchema.set('toJSON', { virtuals: true })
userSchema.set('toObject', { virtuals: true })

// 删除敏感信息
userSchema.methods.toSafeJSON = function () {
    const user = this.toObject()
    delete user.password
    delete user.refreshTokens
    return user
}

const UserModel = await mongoManager.createModel(process.env.MONGO_USER_CENTER_URI, 'User', userSchema)

export default UserModel
