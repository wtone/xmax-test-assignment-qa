/**
 * Cookie utility for refresh token management
 */

import JWTService from './jwt.js'

// Create a temporary JWT service instance to access the time parsing utility
const jwtService = new JWTService()

/**
 * Get refresh token cookie configuration from environment variables
 */
const getCookieConfig = () => {
    // Use JWT_REFRESH_EXPIRES_IN for consistency with JWT token expiry
    const refreshExpiry = process.env.JWT_REFRESH_EXPIRES_IN || '30d'

    return {
        httpOnly: process.env.NODE_ENV_HTTPONLY === 'true',
        //secure: process.env.NODE_ENV === 'production',
        secure: process.env.NODE_ENV_SECURE === 'true',
        sameSite: process.env.NODE_ENV_SAME_SITE || 'strict',
        maxAge: jwtService.parseExpiryToSeconds(refreshExpiry) * 1000, // Convert seconds to milliseconds
        path: '/',
    }
}

/**
 * Set refresh token as HTTP-only cookie
 * @param {Object} ctx - Koa context
 * @param {string} refreshToken - The refresh token to set
 */
export const setRefreshTokenCookie = (ctx, refreshToken) => {
    ctx.cookies.set('refreshToken', refreshToken, getCookieConfig())
}

/**
 * Clear refresh token cookie
 * @param {Object} ctx - Koa context
 */
export const clearRefreshTokenCookie = ctx => {
    ctx.cookies.set('refreshToken', null, {
        ...getCookieConfig(),
        maxAge: 0, // Expire immediately
    })
}

/**
 * Get refresh token from cookie
 * @param {Object} ctx - Koa context
 * @returns {string|null} The refresh token or null if not found
 */
export const getRefreshTokenFromCookie = ctx => {
    return ctx.cookies.get('refreshToken')
}

/**
 * Get cookie configuration - public export for external use
 * @returns {Object} Cookie configuration object
 */
export { getCookieConfig }

export default {
    setRefreshTokenCookie,
    clearRefreshTokenCookie,
    getRefreshTokenFromCookie,
    getCookieConfig,
}
