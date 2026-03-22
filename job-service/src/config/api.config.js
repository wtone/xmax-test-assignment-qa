/**
 * API 配置
 * @module config/api
 */

export const API_CONFIG = {
    // API 版本
    version: process.env.API_VERSION || 'v1',

    // 路径前缀配置
    paths: {
        base: '/api',
        b_side: process.env.B_SIDE_PATH_PREFIX || 'job-b',
        c_side: process.env.C_SIDE_PATH_PREFIX || 'job-c',
    },

    // 获取完整路径
    getFullPath(side) {
        const version = this.version
        const basePath = this.paths.base
        const sidePath = side === 'B' ? this.paths.b_side : this.paths.c_side
        return `${basePath}/${version}/${sidePath}`
    },
}

export default API_CONFIG
