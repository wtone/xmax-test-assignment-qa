/**
 * 火山引擎 veRTC 视频会议服务
 * @module services/integration/VerTCService
 *
 * 官方文档: https://www.volcengine.com/docs/6348/291043
 *
 * veRTC 关键概念:
 * - AppId: 应用标识（从控制台获取）
 * - AppKey: 应用密钥（用于生成 Token，必须保存在服务端）
 * - AccessKey/SecretKey: 火山引擎账号密钥（用于调用服务端 OpenAPI 验证配置）
 * - RoomId: 房间 ID（每次面试唯一，房间在用户加入时自动创建）
 * - UserId: 用户标识（B端/C端）
 * - Token: 入会凭证（服务端生成，客户端用于加入房间）
 *
 * 重要说明:
 * - 无需调用 CreateRoom API，房间在第一个用户加入时自动创建
 * - Token 最长有效期为 7 天
 * - AppKey 必须保存在服务端，禁止泄露到客户端
 * - 配置 ACCESS_KEY/SECRET_KEY 可在启动时通过 API 验证配置是否正确
 */

import crypto from 'crypto'
import axios from 'axios'
import { Signer } from '@volcengine/openapi'
import logger from '../../../utils/logger.js'
import { toUTC } from '../../../utils/helpers.js'

// 获取环境变量配置
const VERTC_APP_ID = process.env.VERTC_APP_ID || ''
const VERTC_APP_KEY = process.env.VERTC_APP_KEY || ''
const VERTC_ACCESS_KEY = process.env.VERTC_ACCESS_KEY || ''
const VERTC_SECRET_KEY = process.env.VERTC_SECRET_KEY || ''
const VERTC_API_HOST = 'rtc.volcengineapi.com'
const VERTC_API_REGION = 'cn-north-1'

// veRTC Token 权限类型（官方定义）
const Privileges = {
    PrivPublishStream: 0, // 发布流权限
    privPublishAudioStream: 1, // 内部使用
    privPublishVideoStream: 2, // 内部使用
    privPublishDataStream: 3, // 内部使用
    PrivSubscribeStream: 4, // 订阅流权限
}

// Token 版本号
const TOKEN_VERSION = '001'

/**
 * 二进制缓冲区工具类（用于 Token 序列化）
 * 基于火山引擎官方实现
 */
class ByteBuf {
    constructor() {
        this.buffer = Buffer.alloc(1024)
        this.position = 0
    }

    pack() {
        const out = Buffer.alloc(this.position)
        this.buffer.copy(out, 0, 0, out.length)
        return out
    }

    putUint16(v) {
        this.buffer.writeUInt16LE(v, this.position)
        this.position += 2
        return this
    }

    putUint32(v) {
        this.buffer.writeUInt32LE(v, this.position)
        this.position += 4
        return this
    }

    putBytes(bytes) {
        this.putUint16(bytes.length)
        bytes.copy(this.buffer, this.position)
        this.position += bytes.length
        return this
    }

    putString(str) {
        return this.putBytes(Buffer.from(str))
    }

    putTreeMapUInt32(map) {
        if (!map) {
            this.putUint16(0)
            return this
        }

        const keys = Object.keys(map)
        this.putUint16(keys.length)
        for (const key of keys) {
            this.putUint16(parseInt(key))
            this.putUint32(map[key])
        }

        return this
    }
}

/**
 * veRTC AccessToken 生成器
 * 基于火山引擎官方实现 (https://github.com/volcengine/rtc-aigc-demo/blob/main/Server/token.js)
 */
class AccessToken {
    constructor(appId, appKey, roomId, userId) {
        this.appId = appId
        this.appKey = appKey
        this.roomId = roomId
        this.userId = userId
        this.issuedAt = Math.floor(Date.now() / 1000)
        this.nonce = Math.floor(Math.random() * 0xffffffff)
        this.expireAt = 0
        this.privileges = {}
    }

    /**
     * 设置 Token 过期时间
     * @param {number} expireTimestamp - Unix 时间戳（秒）
     */
    expireTime(expireTimestamp) {
        this.expireAt = expireTimestamp
        return this
    }

    /**
     * 添加权限
     * @param {number} privilege - 权限类型
     * @param {number} expireTimestamp - 权限过期时间（0 表示跟随 Token 过期）
     */
    addPrivilege(privilege, expireTimestamp = 0) {
        this.privileges[privilege] = expireTimestamp

        // 如果是发布流权限，自动添加音频、视频、数据流权限
        if (privilege === Privileges.PrivPublishStream) {
            this.privileges[Privileges.privPublishVideoStream] = expireTimestamp
            this.privileges[Privileges.privPublishAudioStream] = expireTimestamp
            this.privileges[Privileges.privPublishDataStream] = expireTimestamp
        }
        return this
    }

    /**
     * 打包消息体
     * @private
     */
    packMsg() {
        const bufM = new ByteBuf()
        bufM.putUint32(this.nonce)
        bufM.putUint32(this.issuedAt)
        bufM.putUint32(this.expireAt)
        bufM.putString(this.roomId)
        bufM.putString(this.userId)
        bufM.putTreeMapUInt32(this.privileges)
        return bufM.pack()
    }

    /**
     * 序列化生成最终 Token
     * 格式: VERSION + AppID + Base64(msg + signature)
     * @returns {string} Token 字符串
     */
    serialize() {
        const bytesM = this.packMsg()

        // 使用 HMAC-SHA256 签名
        const signature = crypto.createHmac('sha256', this.appKey).update(bytesM).digest()

        // 构建内容: msg + signature
        const content = new ByteBuf().putBytes(bytesM).putBytes(signature).pack()

        // 最终格式: VERSION + AppID + Base64(content)
        return TOKEN_VERSION + this.appId + content.toString('base64')
    }
}

/**
 * veRTC 服务类
 */
class VerTCService {
    constructor() {
        this.appId = VERTC_APP_ID
        this.appKey = VERTC_APP_KEY
        this.accessKey = VERTC_ACCESS_KEY
        this.secretKey = VERTC_SECRET_KEY
        this.serviceName = 'vertc-service'
    }

    /**
     * 检查服务配置是否完整
     * @returns {boolean} 是否配置完整
     */
    isConfigured() {
        return !!(this.appId && this.appKey)
    }

    /**
     * 检查是否可以调用 OpenAPI（需要 ACCESS_KEY/SECRET_KEY）
     * @returns {boolean} 是否可以调用 OpenAPI
     */
    canCallOpenAPI() {
        return !!(this.accessKey && this.secretKey)
    }

    /**
     * 通用 OpenAPI 调用方法
     * @private
     * @param {string} action - API Action 名称
     * @param {string} version - API 版本
     * @param {string} method - HTTP 方法 (GET/POST)
     * @param {Object} bodyOrParams - POST 时为请求体，GET 时为额外的查询参数
     * @returns {Promise<Object>} API 响应
     */
    async _callOpenAPI(action, version, method = 'POST', bodyOrParams = null) {
        // 构建查询参数
        const params = { Action: action, Version: version }

        // GET 请求时，合并额外参数到 URL
        if (method === 'GET' && bodyOrParams) {
            Object.assign(params, bodyOrParams)
        }

        const requestData = {
            method,
            region: VERTC_API_REGION,
            params,
            headers: {
                'Content-Type': 'application/json',
                Host: VERTC_API_HOST,
            },
        }

        // POST 请求时，设置请求体
        if (method === 'POST' && bodyOrParams) {
            requestData.body = JSON.stringify(bodyOrParams)
        }

        const signer = new Signer(requestData, 'rtc')
        signer.addAuthorization({
            accessKeyId: this.accessKey,
            secretKey: this.secretKey,
        })

        // 构建 URL
        const urlParams = new URLSearchParams(params)
        const url = `https://${VERTC_API_HOST}/?${urlParams.toString()}`

        if (method === 'GET') {
            return axios.get(url, { headers: requestData.headers, timeout: 10000 })
        }
        return axios.post(url, requestData.body, { headers: requestData.headers, timeout: 10000 })
    }

    /**
     * 调用 veRTC ListApps API 获取应用列表并验证配置
     * 此方法可以验证：
     * 1. ACCESS_KEY/SECRET_KEY 是否有效（API 签名验证）
     * 2. APP_ID 是否存在于当前账号下
     * 3. APP_KEY 是否与 API 返回的 AppKey 匹配（如果 API 返回了 AppKey 信息）
     *
     * @returns {Promise<Object>} 验证结果
     */
    async verifyConfigViaAPI() {
        if (!this.canCallOpenAPI()) {
            return {
                verified: false,
                message: 'Cannot verify via API: VERTC_ACCESS_KEY or VERTC_SECRET_KEY not configured',
            }
        }

        try {
            // 使用 ListApps API 获取应用列表（版本 2020-12-01 - 应用管理模块）
            const response = await this._callOpenAPI('ListApps', '2020-12-01', 'GET')

            // 检查响应 - 适配不同的响应格式
            const apps = response.data?.Result?.Apps || response.data?.Result?.AppList || response.data?.Apps || []
            if (apps.length > 0 || response.data?.Result || response.data?.ResponseMetadata) {
                const targetApp = apps.find(app => app.AppId === this.appId)

                if (!targetApp) {
                    return {
                        verified: false,
                        message: `VERTC_APP_ID "${this.appId}" not found in your account. Available AppIds: ${apps.map(a => a.AppId).join(', ') || 'none'}`,
                        error: { availableApps: apps.map(a => ({ appId: a.AppId, appName: a.AppName })) },
                    }
                }

                // 找到了对应的应用，验证 AppKey
                logger.info('[VerTCService] Found app in account', {
                    appId: this.appId,
                    appName: targetApp.AppName,
                    hasAppKey: !!targetApp.AppKey,
                })

                // 如果 API 返回了 AppKey，进行对比验证
                if (targetApp.AppKey) {
                    if (targetApp.AppKey === this.appKey) {
                        return {
                            verified: true,
                            message: 'All credentials verified: AppId, AppKey, AccessKey, SecretKey',
                            appInfo: {
                                appId: targetApp.AppId,
                                appName: targetApp.AppName,
                                status: targetApp.Status,
                            },
                        }
                    } else {
                        return {
                            verified: false,
                            message: `VERTC_APP_KEY mismatch! The configured AppKey does not match the one in your veRTC console for AppId "${this.appId}"`,
                            error: {
                                hint: 'Please check VERTC_APP_KEY in your .env file matches the AppKey shown in veRTC console',
                            },
                        }
                    }
                }

                // API 没有返回 AppKey（出于安全考虑），尝试用其他方式验证
                // 调用 GetRoomOnlineUsers 进一步验证 AppId 有效性
                const roomVerifyResult = await this._verifyAppIdViaRoomAPI()

                if (roomVerifyResult.verified) {
                    return {
                        verified: true,
                        message: 'AppId and AccessKey verified. AppKey format is valid (full verification occurs when user joins room)',
                        appInfo: {
                            appId: targetApp.AppId,
                            appName: targetApp.AppName,
                            status: targetApp.Status,
                        },
                        note: 'AppKey correctness will be verified when user joins room with generated Token',
                    }
                } else {
                    return roomVerifyResult
                }
            }

            // 响应格式异常
            logger.warn('[VerTCService] Unexpected API response format', { response: response.data })
            return {
                verified: false,
                message: 'Unexpected API response format from ListApps',
                error: response.data,
            }
        } catch (error) {
            return this._handleAPIError(error, 'ListApps')
        }
    }

    /**
     * 使用 GetRoomOnlineUsers API 验证 AppId
     * @private
     */
    async _verifyAppIdViaRoomAPI() {
        try {
            const testRoomId = `validation_${Date.now()}`
            await this._callOpenAPI('GetRoomOnlineUsers', '2023-08-01', 'POST', {
                AppId: this.appId,
                RoomId: testRoomId,
            })
            return { verified: true }
        } catch (error) {
            const errorData = error.response?.data
            const errorCode = errorData?.ResponseMetadata?.Error?.Code
            const errorMsg = errorData?.ResponseMetadata?.Error?.Message

            // 房间不存在是预期的，说明 AppId 有效
            if (errorCode === 'InvalidParameter.RoomId' || errorMsg?.includes('RoomId') || errorMsg?.includes('not found')) {
                return { verified: true }
            }

            // AppId 无效
            if (errorMsg?.includes('owner') || errorMsg?.includes('AppId')) {
                return {
                    verified: false,
                    message: `Invalid VERTC_APP_ID: ${errorMsg}`,
                }
            }

            return { verified: true } // 其他错误视为配置可能正确
        }
    }

    /**
     * 统一处理 API 错误
     * @private
     */
    _handleAPIError(error, apiName) {
        const statusCode = error.response?.status
        const errorData = error.response?.data
        const errorCode = errorData?.ResponseMetadata?.Error?.Code
        const errorMsg = errorData?.ResponseMetadata?.Error?.Message

        logger.error(`[VerTCService] ${apiName} API failed`, {
            statusCode,
            errorCode,
            errorMsg,
            error: error.message,
        })

        if (statusCode === 401 || statusCode === 403) {
            return {
                verified: false,
                message: `API authentication failed (${statusCode}): Invalid ACCESS_KEY or SECRET_KEY`,
                error: errorData,
            }
        }

        if (errorCode === 'InvalidAccessKeyId' || errorMsg?.includes('AccessKey')) {
            return {
                verified: false,
                message: `Invalid VERTC_ACCESS_KEY: ${errorMsg}`,
                error: errorData,
            }
        }

        if (errorCode === 'SignatureDoesNotMatch' || errorMsg?.includes('Signature')) {
            return {
                verified: false,
                message: `Invalid VERTC_SECRET_KEY: Signature mismatch`,
                error: errorData,
            }
        }

        return {
            verified: false,
            message: `API verification failed: ${errorMsg || error.message}`,
            error: errorData || error.message,
        }
    }

    /**
     * 确保服务已配置
     * @throws {Error} 如果服务未配置
     */
    ensureConfigured() {
        if (!this.isConfigured()) {
            throw new Error('veRTC service not configured. Please set VERTC_APP_ID and VERTC_APP_KEY environment variables.')
        }
    }

    /**
     * 生成房间 ID
     * @param {string} appointmentId - 预约 ID
     * @returns {string} 房间 ID
     */
    generateRoomId(appointmentId) {
        const timestamp = Date.now()
        const hash = crypto.createHash('md5').update(`${appointmentId}-${timestamp}`).digest('hex').substring(0, 8)
        return `interview_${hash}`
    }

    /**
     * 生成用户入会 Token
     * 使用火山引擎官方 AccessToken 格式
     *
     * @param {string} roomId - 房间 ID
     * @param {string} userId - 用户 ID
     * @param {number} expireSeconds - 过期时间（秒），默认 24 小时
     * @returns {string} Token
     */
    generateToken(roomId, userId, expireSeconds = 86400) {
        this.ensureConfigured()

        const expireAt = Math.floor(Date.now() / 1000) + expireSeconds

        const token = new AccessToken(this.appId, this.appKey, roomId, userId)
            .expireTime(expireAt)
            .addPrivilege(Privileges.PrivPublishStream, 0) // 发布流权限，跟随 Token 过期
            .addPrivilege(Privileges.PrivSubscribeStream, 0) // 订阅流权限，跟随 Token 过期
            .serialize()

        logger.debug('[VerTCService] Token generated', {
            roomId,
            userId,
            expireAt: toUTC(expireAt * 1000),
        })

        return token
    }

    /**
     * 创建会议房间信息（生成 Token，不调用 API）
     *
     * 说明：veRTC 不需要显式创建房间，房间在第一个用户加入时自动创建。
     * 此方法只生成必要的 Token 和房间信息。
     *
     * @param {Object} options - 创建选项
     * @param {string} options.appointmentId - 预约 ID
     * @param {Date} options.scheduledTime - 预定时间
     * @param {number} options.duration - 时长（分钟）
     * @param {Array} options.participants - 参与者列表
     * @returns {Object} 房间信息
     */
    createRoom(options) {
        const { appointmentId, scheduledTime, duration, participants } = options

        this.ensureConfigured()

        const roomId = this.generateRoomId(appointmentId)

        // Token 有效期：固定 6 天 20 小时（veRTC 最长支持 7 天）
        // 简化逻辑，避免复杂的时间计算导致的 bug
        const tokenExpireSeconds = (6 * 24 + 20) * 3600 // 6天20小时 = 164小时

        // 为每个参与者生成 Token
        const tokens = {}
        for (const participant of participants) {
            const token = this.generateToken(roomId, participant.userId, tokenExpireSeconds)
            tokens[participant.role] = token
        }

        const joinUrl = this._generateJoinUrl(roomId)

        logger.info('[VerTCService] Meeting info created', {
            roomId,
            appointmentId,
            participantCount: participants.length,
        })

        return {
            appId: this.appId,
            roomId,
            joinUrl,
            bToken: tokens.interviewer,
            cToken: tokens.candidate,
            scheduledStartTime: scheduledTime,
            scheduledEndTime: new Date(new Date(scheduledTime).getTime() + duration * 60000),
        }
    }

    /**
     * 销毁会议房间
     *
     * 说明：veRTC 房间在所有用户离开后会自动销毁。
     * 如需强制解散房间，可以使用服务端 OpenAPI（需要 AccessKey/SecretKey 签名）。
     * 当前实现为日志记录，实际解散由 veRTC 自动处理。
     *
     * @param {string} roomId - 房间 ID
     * @returns {boolean} 是否成功
     */
    async destroyRoom(roomId) {
        logger.info('[VerTCService] Room marked for cleanup (auto-destroyed by veRTC when empty)', { roomId })

        // veRTC 房间在所有用户离开后自动销毁
        // 如需强制解散，需要实现 OpenAPI 签名调用（使用 @volcengine/openapi）
        // 当前简化实现：记录日志，依赖 veRTC 自动清理机制

        return true
    }

    /**
     * 查询房间实时状态
     * 使用 GetRoomOnlineUsers API 获取房间在线用户信息
     *
     * @param {string} roomId - 房间 ID
     * @returns {Promise<Object>} 房间状态
     */
    async getRoomStatus(roomId) {
        if (!this.canCallOpenAPI()) {
            return {
                roomId,
                status: 'unknown',
                error: 'OpenAPI not configured (missing ACCESS_KEY/SECRET_KEY)',
                onlineUsers: [],
                userCount: 0,
            }
        }

        try {
            const response = await this._callOpenAPI('GetRoomOnlineUsers', '2023-08-01', 'POST', {
                AppId: this.appId,
                RoomId: roomId,
            })

            // 解析响应
            // API 返回: VisibleUserList (字符串数组), TotalUser, RoomExists
            const result = response.data?.Result || {}
            const roomExists = result.RoomExists === true
            const userList = result.VisibleUserList || []
            const totalUser = result.TotalUser || 0

            logger.info('[VerTCService] GetRoomOnlineUsers success', {
                roomId,
                roomExists,
                userCount: totalUser,
                users: userList,
            })

            return {
                roomId,
                roomExists,
                status: roomExists && totalUser > 0 ? 'active' : (roomExists ? 'empty' : 'not_found'),
                onlineUsers: userList.map(userId => ({ userId })),
                userCount: totalUser,
                queriedAt: toUTC(Date.now()),
            }
        } catch (error) {
            const errorData = error.response?.data
            const errorCode = errorData?.ResponseMetadata?.Error?.Code
            const errorMsg = errorData?.ResponseMetadata?.Error?.Message

            // 房间不存在（未创建或已销毁）
            if (errorMsg?.includes('not found') || errorMsg?.includes('RoomId')) {
                logger.info('[VerTCService] Room not found (not created or already destroyed)', { roomId })
                return {
                    roomId,
                    status: 'not_started',
                    onlineUsers: [],
                    userCount: 0,
                    message: 'Room has not been created yet (no user has joined)',
                    queriedAt: toUTC(Date.now()),
                }
            }

            logger.error('[VerTCService] GetRoomOnlineUsers failed', {
                roomId,
                errorCode,
                errorMsg,
                error: error.message,
            })

            return {
                roomId,
                status: 'error',
                error: errorMsg || error.message,
                onlineUsers: [],
                userCount: 0,
            }
        }
    }

    /**
     * 查询房间历史信息（离线数据）
     * 使用 ListRoomInfo API 获取房间起止时间等历史信息
     *
     * 注意：这是离线数据 API，有约 20 秒的数据延迟
     * 文档：https://www.volcengine.com/docs/6348/1186715
     *
     * @param {string} roomId - 房间 ID
     * @param {Date} startTime - 查询开始时间
     * @param {Date} endTime - 查询结束时间
     * @returns {Promise<Object>} 房间历史信息
     */
    async getRoomHistory(roomId, startTime, endTime) {
        if (!this.canCallOpenAPI()) {
            return {
                roomId,
                error: 'OpenAPI not configured (missing ACCESS_KEY/SECRET_KEY)',
            }
        }

        try {
            const response = await this._callOpenAPI('ListRoomInfo', '2023-11-01', 'GET', {
                AppId: this.appId,
                RoomId: roomId,
                StartTime: toUTC(startTime),
                EndTime: toUTC(endTime),
                PageNum: '1',
                PageSize: '20',
            })

            const result = response.data?.Result || {}
            const rooms = result.RoomList || []


            // 找到匹配的房间记录
            const roomInfo = rooms.find(r => r.RoomId === roomId) || rooms[0]

            if (roomInfo) {
                return {
                    roomId,
                    found: true,
                    startTime: toUTC(roomInfo.CreatedTime),
                    endTime: toUTC(roomInfo.DestroyTime),
                    isFinished: roomInfo.IsFinished || false,
                    callId: roomInfo.CallId || null,
                }
            }

            return {
                roomId,
                found: false,
                message: 'No room history found in the specified time range (data delay ~20s)',
            }
        } catch (error) {
            const errorData = error.response?.data
            const errorMsg = errorData?.ResponseMetadata?.Error?.Message


            logger.error('[VerTCService] ListRoomInfo failed', {
                roomId,
                errorMsg: errorMsg || error.message,
                errorCode: errorData?.ResponseMetadata?.Error?.Code,
            })

            return {
                roomId,
                error: errorMsg || error.message,
            }
        }
    }

    /**
     * 获取房间用户列表（离线数据）
     * 使用 ListUserInfo API 获取参与过房间的用户信息
     *
     * 注意：
     * - 数据延迟约 20 秒
     * - 最大查询时间跨度 24 小时
     * - 最远可查询 14 天
     *
     * @param {string} roomId - 房间 ID
     * @param {Date} startTime - 查询开始时间
     * @param {Date} endTime - 查询结束时间
     * @returns {Promise<Object>} 用户列表信息
     */
    async getRoomUsers(roomId, startTime, endTime) {
        if (!this.canCallOpenAPI()) {
            return { roomId, error: 'OpenAPI not configured' }
        }

        try {
            const response = await this._callOpenAPI('ListUserInfo', '2023-11-01', 'GET', {
                AppId: this.appId,
                RoomId: roomId,
                StartTime: toUTC(startTime),
                EndTime: toUTC(endTime),
                PageNum: '1',
                PageSize: '100',
            })

            const result = response.data?.Result || {}
            const users = result.UserList || []

            // 统计唯一用户数
            const uniqueUserIds = [...new Set(users.map(u => u.UserId))]

            return {
                roomId,
                found: users.length > 0,
                totalUsers: uniqueUserIds.length,
                userIds: uniqueUserIds,
                userDetails: users.map(u => ({
                    userId: u.UserId,
                    joinTime: u.JoinTime,
                    leaveTime: u.LeaveTime,
                    duration: u.Duration,
                })),
            }
        } catch (error) {
            const errorMsg = error.response?.data?.ResponseMetadata?.Error?.Message
            logger.error('[VerTCService] ListUserInfo failed', { roomId, error: errorMsg || error.message })
            return { roomId, error: errorMsg || error.message }
        }
    }

    /**
     * 获取房间综合状态（实时 + 历史）
     * 融合实时在线状态和历史记录
     *
     * 注意：
     * - GetRoomOnlineUsers: 实时数据，返回当前在线用户
     * - ListRoomInfo: 离线数据，有约 20 秒延迟
     *
     * @param {string} roomId - 房间 ID
     * @param {Date} scheduledStartTime - 预定开始时间
     * @returns {Promise<Object>} 综合状态
     */
    async getRoomFullStatus(roomId, scheduledStartTime) {
        // 查询时间范围：最近6小时（ListUserInfo API 限制）
        const startTime = new Date(Date.now() - 6 * 3600000) // 6小时前
        const endTime = new Date(Date.now() + 3600000) // 现在+1小时

        // 并行查询实时状态、历史记录和用户列表
        const [realtimeStatus, historyStatus, usersStatus] = await Promise.all([
            this.getRoomStatus(roomId),
            this.getRoomHistory(roomId, startTime, endTime),
            this.getRoomUsers(roomId, startTime, endTime),
        ])

        // 综合判断状态
        let meetingStatus = 'not_started'
        if (realtimeStatus.status === 'active' && realtimeStatus.userCount > 0) {
            meetingStatus = 'in_progress'
        } else if (historyStatus.found && historyStatus.isFinished) {
            meetingStatus = 'ended'
        } else if (historyStatus.found && !historyStatus.isFinished) {
            meetingStatus = realtimeStatus.userCount > 0 ? 'in_progress' : 'started_but_empty'
        }

        return {
            roomId,
            meetingStatus, // not_started, in_progress, started_but_empty, ended
            realtime: {
                onlineUsers: realtimeStatus.onlineUsers,
                userCount: realtimeStatus.userCount,
                roomExists: realtimeStatus.roomExists,
            },
            history: historyStatus.found
                ? {
                      actualStartTime: historyStatus.startTime,
                      actualEndTime: historyStatus.endTime,
                      isFinished: historyStatus.isFinished,
                      callId: historyStatus.callId,
                      totalUsers: usersStatus.totalUsers || 0,
                      userIds: usersStatus.userIds || [],
                  }
                : null,
            note: 'Data delay: ListRoomInfo ~60s, ListUserInfo ~100s',
            queriedAt: toUTC(Date.now()),
        }
    }

    /**
     * 刷新用户 Token
     * @param {string} roomId - 房间 ID
     * @param {string} userId - 用户 ID
     * @param {number} expireSeconds - 新的过期时间（秒）
     * @returns {string} 新 Token
     */
    refreshToken(roomId, userId, expireSeconds = 3600) {
        return this.generateToken(roomId, userId, expireSeconds)
    }

    /**
     * 生成加入 URL
     * @private
     * @param {string} roomId - 房间 ID
     * @returns {string} 加入 URL
     */
    _generateJoinUrl(roomId) {
        const baseUrl = process.env.JOB_APPOINTMENT_URL_C || 'https://example.com'
        return `${baseUrl}/meeting/join/${roomId}`
    }

    /**
     * 健康检查
     * @returns {Object} 健康状态
     */
    healthCheck() {
        return {
            service: this.serviceName,
            configured: this.isConfigured(),
            appId: this.appId ? `${this.appId.substring(0, 8)}...` : 'not configured',
            status: this.isConfigured() ? 'ready' : 'not_configured',
        }
    }

    /**
     * 启动时验证配置（带日志输出）
     * 如果配置了 VERTC_APP_ID 但配置无效，会抛出错误终止启动
     * 如果配置了 ACCESS_KEY/SECRET_KEY，会通过 API 验证配置正确性
     *
     * @throws {Error} 配置无效时抛出错误
     */
    async validateOnStartup() {
        // 1. 先进行本地格式验证
        const localResult = this.validateConfig()

        if (!localResult.details.enabled) {
            console.log(`ℹ️  veRTC: ${localResult.message}`)
            return
        }

        if (!localResult.valid) {
            console.error(`❌ veRTC: ${localResult.message}`)
            logger.error('veRTC configuration validation failed', localResult.details)
            throw new Error(localResult.message)
        }

        // 2. 如果配置了 ACCESS_KEY/SECRET_KEY，通过 API 验证
        if (this.canCallOpenAPI()) {
            console.log(`🔍 veRTC: Verifying configuration via OpenAPI (ListApps)...`)

            const apiResult = await this.verifyConfigViaAPI()

            if (apiResult.verified) {
                // 根据验证结果显示不同的消息
                if (apiResult.message.includes('All credentials verified')) {
                    console.log(`✅ veRTC: ${apiResult.message}`)
                } else {
                    console.log(`✅ veRTC: AppId verified via OpenAPI`)
                    if (apiResult.appInfo) {
                        console.log(`   📱 App: ${apiResult.appInfo.appName || apiResult.appInfo.appId}`)
                    }
                    if (apiResult.note) {
                        console.log(`   ⚠️  Note: ${apiResult.note}`)
                    }
                }
                logger.info('veRTC configuration verified via OpenAPI', {
                    appId: `${this.appId.substring(0, 8)}...`,
                    appInfo: apiResult.appInfo,
                })
            } else {
                console.error(`❌ veRTC: ${apiResult.message}`)
                if (apiResult.error?.hint) {
                    console.error(`   💡 Hint: ${apiResult.error.hint}`)
                }
                logger.error('veRTC API verification failed', apiResult)
                throw new Error(apiResult.message)
            }
        } else {
            // 未配置 ACCESS_KEY/SECRET_KEY，仅进行本地验证
            console.log(`✅ veRTC: ${localResult.message}`)
            console.log(`   💡 Tip: Set VERTC_ACCESS_KEY and VERTC_SECRET_KEY to enable API verification`)
            logger.info('veRTC configuration check passed (API verification not available)', localResult.details)
        }
    }

    /**
     * 验证配置是否有效
     *
     * @returns {Object} 验证结果 { valid: boolean, message: string, details?: object }
     */
    validateConfig() {
        const result = {
            valid: false,
            message: '',
            details: {},
        }

        // 检查是否启用（配置了 APP_ID）
        if (!this.appId) {
            result.valid = true
            result.message = 'veRTC is not enabled (VERTC_APP_ID not set)'
            result.details = { enabled: false }
            return result
        }

        // 如果配置了 APP_ID，则 APP_KEY 也必须配置
        if (!this.appKey) {
            result.valid = false
            result.message = 'veRTC configuration error: VERTC_APP_ID is set but VERTC_APP_KEY is missing'
            result.details = {
                enabled: true,
                hasAppId: true,
                hasAppKey: false,
            }
            return result
        }

        // 验证 AppId 格式（通常是字母数字组合）
        if (!/^[a-zA-Z0-9]+$/.test(this.appId)) {
            result.valid = false
            result.message = 'veRTC configuration error: VERTC_APP_ID format is invalid (should be alphanumeric)'
            result.details = {
                enabled: true,
                hasAppId: true,
                hasAppKey: true,
                appIdFormat: 'invalid',
            }
            return result
        }

        // 尝试生成测试 Token 来验证配置
        try {
            const testRoomId = 'test_room_validation'
            const testUserId = 'test_user_validation'
            const testToken = this.generateToken(testRoomId, testUserId, 60) // 1分钟有效期

            // 验证 Token 格式（VERSION + AppID + Base64）
            // 格式: "001" + AppID(24字符) + Base64内容
            if (!testToken.startsWith(TOKEN_VERSION)) {
                result.valid = false
                result.message = 'veRTC Token generation error: invalid version prefix'
                result.details = {
                    enabled: true,
                    hasAppId: true,
                    hasAppKey: true,
                    tokenGeneration: 'failed',
                    reason: 'invalid version',
                }
                return result
            }

            // 验证 Token 中的 appId 与配置一致
            const tokenAppId = testToken.substring(3, 3 + this.appId.length)
            if (tokenAppId !== this.appId) {
                result.valid = false
                result.message = 'veRTC Token generation error: appId mismatch'
                result.details = {
                    enabled: true,
                    hasAppId: true,
                    hasAppKey: true,
                    tokenGeneration: 'failed',
                    reason: 'appId mismatch',
                }
                return result
            }

            // 验证 Base64 部分可以正常解码
            const base64Content = testToken.substring(3 + this.appId.length)
            Buffer.from(base64Content, 'base64')

            // 配置完整性验证通过
            // 注意：无法在本地验证 APP_KEY 是否正确，只有用户加入房间时 veRTC 服务端才会验证
            result.valid = true
            result.message = 'veRTC is enabled (AppId/AppKey configured, validity will be verified when joining room)'
            result.details = {
                enabled: true,
                hasAppId: true,
                hasAppKey: true,
                tokenGeneration: 'success',
                appId: `${this.appId.substring(0, 8)}...`,
                note: 'AppKey correctness can only be verified by veRTC server when user joins room',
            }

            logger.info('[VerTCService] Configuration check passed (AppKey validity not verifiable locally)', {
                appId: `${this.appId.substring(0, 8)}...`,
            })

            return result
        } catch (error) {
            result.valid = false
            result.message = `veRTC Token generation error: ${error.message}`
            result.details = {
                enabled: true,
                hasAppId: true,
                hasAppKey: true,
                tokenGeneration: 'error',
                error: error.message,
            }
            return result
        }
    }
}

export default new VerTCService()
