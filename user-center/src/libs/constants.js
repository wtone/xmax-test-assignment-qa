// 用户状态常量
export const USER_STATUS = {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    BANNED: 'banned',
}

// 用户类型常量
export const USER_TYPE = {
    C_END: 'C', // C-end (customer)
    B_END: 'B', // B-end (business)
}

// 角色状态常量
export const ROLE_STATUS = {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
}

// 权限状态常量
export const PERMISSION_STATUS = {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
}

// JWT 相关常量
export const TOKEN_TYPE = {
    ACCESS: 'access',
    REFRESH: 'refresh',
}

// 登录平台常量
export const LOGIN_PLATFORM = {
    WEB: 'web',
    IOS: 'ios',
    ANDROID: 'android',
    DESKTOP: 'desktop',
    API: 'api',
}

// 品牌配置常量
export const BRAND = {
    NAME: process.env.BRAND_NAME || 'xMatrix招聘平台',
    OFFICIAL_NAME: process.env.BRAND_OFFICIAL_NAME || 'xMatrix官方',
    DOMAIN: process.env.BRAND_DOMAIN || 'example.com',
}

// 导出所有常量
export default {
    USER_STATUS,
    USER_TYPE,
    ROLE_STATUS,
    PERMISSION_STATUS,
    TOKEN_TYPE,
    LOGIN_PLATFORM,
    BRAND,
}
