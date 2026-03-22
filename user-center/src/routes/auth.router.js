import Router from 'koa-router'
import authController from '../controllers/auth.js'
import gatewayAuth from '../middlewares/jwt_auth.js' // 新的网关认证中间件

// 认证相关路由
const authRoutes = new Router({ prefix: '/api/v1/auth' })

// 无需JWT验证的路由
authRoutes.post('/register', authController.register)
authRoutes.post('/login-with-psw', authController.login)
authRoutes.post('/refresh', authController.refreshToken)
authRoutes.post('/verify-token', authController.verifyToken)

// 邮箱验证链接 (无需JWT验证，通过URL参数验证)
authRoutes.get('/verify-email-link', authController.verifyEmailByLink)

// 邮箱验证码登录相关路由 (无需JWT验证)
authRoutes.post('/send-login-code', authController.sendLoginCode)
authRoutes.post('/login-with-code', authController.loginWithCode)

// 密码重置相关路由 (无需JWT验证)
authRoutes.post('/forgot-password', authController.forgotPassword)
authRoutes.post('/change-password-with-code', authController.resetPassword)

// 需要JWT验证的路由
authRoutes.post('/logout', gatewayAuth, authController.logout)
authRoutes.post('/revoke-all-tokens', gatewayAuth, authController.revokeAllTokens)
authRoutes.post('/change-password', gatewayAuth, authController.changePassword)

// 邮箱验证相关路由 (需要JWT验证)
authRoutes.post('/verify-email', gatewayAuth, authController.verifyEmail)
authRoutes.post('/resend-verification', gatewayAuth, authController.resendVerification)

export default authRoutes
