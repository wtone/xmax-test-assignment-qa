import BaseService from './base_service.js'

class OSSService extends BaseService {
    constructor() {
        super({
            serviceName: 'oss',
            baseURL: process.env.OSS_SERVICE_URL || 'http://localhost:3004',
            timeout: 60000, // 文件上传可能需要更长时间
            retries: 2,
            retryInterval: 1000,
        })
    }

    /**
     * 上传文件
     */
    async uploadFile(fileData) {
        return this.request({
            method: 'POST',
            url: '/api/v1/oss/upload',
            data: fileData,
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        })
    }

    /**
     * 获取文件信息
     */
    async getFileInfo(fileId) {
        return this.request({
            method: 'GET',
            url: `/api/v1/oss/file/${fileId}`,
        })
    }

    /**
     * 获取文件下载URL
     */
    async getDownloadUrl(fileId, expires = 3600) {
        return this.request({
            method: 'GET',
            url: `/api/v1/oss/file/${fileId}/download-url`,
            params: { expires },
        })
    }

    /**
     * 删除文件
     */
    async deleteFile(fileId) {
        return this.request({
            method: 'DELETE',
            url: `/api/v1/oss/file/${fileId}`,
        })
    }

    /**
     * 批量删除文件
     */
    async batchDeleteFiles(fileIds) {
        return this.request({
            method: 'POST',
            url: '/api/v1/oss/batch-delete',
            data: { fileIds },
        })
    }

    /**
     * 获取上传凭证
     */
    async getUploadToken(options = {}) {
        return this.request({
            method: 'POST',
            url: '/api/v1/oss/upload-token',
            data: options,
        })
    }

    /**
     * 复制文件
     */
    async copyFile(sourceFileId, targetPath) {
        return this.request({
            method: 'POST',
            url: `/api/v1/oss/file/${sourceFileId}/copy`,
            data: { targetPath },
        })
    }

    /**
     * 移动文件
     */
    async moveFile(fileId, targetPath) {
        return this.request({
            method: 'POST',
            url: `/api/v1/oss/file/${fileId}/move`,
            data: { targetPath },
        })
    }

    /**
     * 获取文件列表
     */
    async listFiles(params = {}) {
        return this.request({
            method: 'GET',
            url: '/api/v1/oss/files',
            params,
        })
    }

    /**
     * 获取存储统计信息
     */
    async getStorageStats(userId) {
        return this.request({
            method: 'GET',
            url: '/api/v1/oss/stats',
            params: { userId },
        })
    }
}

export default new OSSService()
