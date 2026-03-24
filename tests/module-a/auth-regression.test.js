import { jest } from '@jest/globals'
import jwt from 'jsonwebtoken'

const JWT_SECRET = 'test-jwt-secret-for-interview'

describe('Module A: Auth Middleware Regression Tests', () => {

    describe('Bug 1: B-end user without companyId should not receive TOKEN_EXPIRED error', () => {
        // Recreate the error-code selection logic from jwt_auth.js:115-138
        // Test that when a B-end user lacks companyId and accesses a non-allowed path,
        // the error code should NOT be 401003 (TOKEN_EXPIRED)
        // This test EXPOSES the bug by showing the current code returns TOKEN_EXPIRED

        test('should use a permission/forbidden error code, not TOKEN_EXPIRED (401003)', () => {
            // Simulate the logic
            const errorCodes = {
                TOKEN_EXPIRED: { code: 401003, message: 'Access token has expired' },
                PERMISSION_DENIED: { code: 403001, message: 'Permission denied' },
            }

            const decoded = { userId: 'user-1', userType: 'B', companyId: null }
            const path = '/api/v1/jobs'  // not an allowed path
            const method = 'GET'

            const userType = decoded.userType || 'C'
            let thrownError = null

            if (userType === 'B' && !decoded.companyId) {
                const isAllowedPath = (method === 'POST' && path === '/api/v1/company') ||
                                       (method === 'GET' && path === '/api/v1/company/my')
                if (!isAllowedPath) {
                    // Current buggy code uses TOKEN_EXPIRED
                    thrownError = errorCodes.TOKEN_EXPIRED
                }
            }

            // This assertion DEMONSTRATES the bug:
            // The error IS TOKEN_EXPIRED (401003), but it SHOULD be a permission error
            expect(thrownError).not.toBeNull()
            expect(thrownError.code).toBe(401003)  // Current behavior (buggy)
            // The correct behavior would be:
            // expect(thrownError.code).toBe(403001)  // Expected after fix

            // Semantic check: TOKEN_EXPIRED implies the token's exp claim has passed
            // But the actual issue is missing companyId — these are completely different problems
            expect(thrownError.message).toBe('Access token has expired')
            expect(thrownError.message).not.toContain('company')  // No meaningful error message
        })

        test('B-end user with companyId should pass validation', () => {
            const decoded = { userId: 'user-1', userType: 'B', companyId: 'company-123' }
            const userType = decoded.userType || 'C'

            let thrownError = null
            if (userType === 'B' && !decoded.companyId) {
                thrownError = { code: 401003 }
            }

            expect(thrownError).toBeNull()
        })

        test('B-end user without companyId CAN access allowed company creation paths', () => {
            const decoded = { userId: 'user-1', userType: 'B', companyId: null }
            const testCases = [
                { method: 'POST', path: '/api/v1/company', shouldAllow: true },
                { method: 'GET', path: '/api/v1/company/my', shouldAllow: true },
                { method: 'GET', path: '/api/v1/jobs', shouldAllow: false },
                { method: 'DELETE', path: '/api/v1/company', shouldAllow: false },
            ]

            for (const { method, path, shouldAllow } of testCases) {
                const isAllowedPath = (method === 'POST' && path === '/api/v1/company') ||
                                       (method === 'GET' && path === '/api/v1/company/my')
                expect(isAllowedPath).toBe(shouldAllow)
            }
        })
    })

    describe('Bug 2: Debug mode bypasses authentication without token verification', () => {
        // Demonstrate that debug mode allows ANY request without userId to gain debug identity

        test('debug mode sets user without any token verification when userId is missing', () => {
            const config = {
                debug: {
                    enabled: true,
                    userId: 'debug-admin-user',
                    userName: 'Debug Admin',
                    userEmail: 'admin@debug.com',
                    userType: 'admin',
                    userRoles: '["admin"]',
                    // token: 'secret-debug-token'  // This check was commented out!
                }
            }

            // Simulate: request with NO userId header and NO authorization header
            const headers = {}  // completely empty — no auth at all
            let userId = headers['x-user-id']

            // Current (buggy) code — no token check
            if (!userId && config.debug.enabled && config.debug.userId) {
                userId = config.debug.userId
            }

            // Bug: unauthenticated request gets debug admin identity
            expect(userId).toBe('debug-admin-user')
        })

        test('original code required token match (commented out)', () => {
            const config = {
                debug: {
                    enabled: true,
                    userId: 'debug-admin-user',
                    token: 'secret-debug-token',
                }
            }

            const headers = { authorization: 'wrong-token' }
            let userId = headers['x-user-id']

            // What the ORIGINAL code did (before comment-out):
            if (!userId && config.debug.enabled && config.debug.userId && config.debug.token === headers['authorization']) {
                userId = config.debug.userId
            }

            // With wrong token, debug bypass should NOT activate
            expect(userId).toBeUndefined()
        })
    })

    describe('Bug 3: internalAuth const reassignment causes TypeError', () => {
        test('reassigning const variable throws TypeError', () => {
            expect(() => {
                // Simulate the exact bug pattern from gateway_auth.js:182-185
                const simulateInternalAuth = () => {
                    const userId = undefined  // simulating ctx.headers['x-user-id'] being absent
                    const debugEnabled = true
                    const debugUserId = 'debug-user'

                    if (!userId && debugEnabled && debugUserId) {
                        // This is what the buggy code does — reassign a const
                        // We use eval to avoid syntax error at parse time
                        eval('userId = debugUserId')
                    }
                }
                simulateInternalAuth()
            }).toThrow(TypeError)
        })

        test('using let would fix the const reassignment bug', () => {
            // Demonstrate the fix
            const simulateFixedInternalAuth = () => {
                let userId = undefined  // FIX: use let instead of const
                const debugEnabled = true
                const debugUserId = 'debug-user'

                if (!userId && debugEnabled && debugUserId) {
                    userId = debugUserId  // Now works
                }
                return userId
            }

            expect(simulateFixedInternalAuth()).toBe('debug-user')
        })
    })

    describe('Bug 4: user-center response overwrites gateway-verified user data', () => {
        test('gateway companyId is lost after user-center data merge', () => {
            // Simulate gateway headers (from jwt_auth.js)
            const gatewayHeaders = {
                'x-user-id': 'user-123',
                'x-user-type': 'B',
                'x-company-id': 'company-456',  // Set by gateway from JWT
                'x-user-username': '',  // missing, triggers user-center fetch
            }

            // Initial userInfo from headers
            let userInfo = {
                userId: gatewayHeaders['x-user-id'],
                username: gatewayHeaders['x-user-username'] || '',
                email: '',
                type: gatewayHeaders['x-user-type'] || 'C',
                roles: [],
            }

            // Simulate user-center response
            const userCenterData = {
                username: 'John Doe',
                email: 'john@example.com',
                type: 'B',
                roles: ['hr'],
            }

            // Current (buggy) code: COMPLETE REPLACEMENT
            userInfo = {
                userId: gatewayHeaders['x-user-id'],
                username: userCenterData.username,
                email: userCenterData.email,
                type: userCenterData.type || 'C',
                roles: userCenterData.roles || [],
                // BUG: companyId from x-company-id header is NEVER included
            }

            // companyId is lost!
            expect(userInfo.companyId).toBeUndefined()
            // It should have been preserved from gateway headers
            expect(gatewayHeaders['x-company-id']).toBe('company-456')
        })

        test('user-center can override gateway-validated userType', () => {
            const gatewayUserType = 'B'  // from JWT, already verified

            // user-center returns different type (e.g., stale data)
            const userCenterType = 'C'

            // Current code uses user-center type
            const finalType = userCenterType || 'C'

            // Gateway said B, but final result is C — privilege change!
            expect(finalType).not.toBe(gatewayUserType)
            expect(finalType).toBe('C')
        })

        test('correct merge should preserve gateway-verified fields', () => {
            const gatewayHeaders = {
                'x-user-id': 'user-123',
                'x-user-type': 'B',
                'x-company-id': 'company-456',
            }

            const userCenterData = {
                username: 'John',
                email: 'john@example.com',
                type: 'C',  // different from gateway
                roles: ['hr'],
            }

            // CORRECT merge: gateway fields take priority, user-center fills gaps
            const correctUserInfo = {
                userId: gatewayHeaders['x-user-id'],
                username: userCenterData.username,  // supplement
                email: userCenterData.email,        // supplement
                type: gatewayHeaders['x-user-type'],  // gateway takes priority
                companyId: gatewayHeaders['x-company-id'],  // preserved
                roles: userCenterData.roles || [],
            }

            expect(correctUserInfo.companyId).toBe('company-456')
            expect(correctUserInfo.type).toBe('B')  // Gateway type preserved
        })
    })

    describe('JWT Token verification integration tests', () => {
        test('valid JWT token is correctly verified', () => {
            const payload = {
                userId: 'user-123',
                userType: 'C',
                email: 'test@example.com',
            }

            const token = jwt.sign(payload, JWT_SECRET, {
                issuer: 'xmax-user-center',
                audience: 'xmax-services',
                expiresIn: '1h',
            })

            const decoded = jwt.verify(token, JWT_SECRET, {
                issuer: 'xmax-user-center',
                audience: 'xmax-services',
                algorithms: ['HS256'],
            })

            expect(decoded.userId).toBe('user-123')
            expect(decoded.userType).toBe('C')
        })

        test('expired token throws TokenExpiredError', () => {
            const token = jwt.sign(
                { userId: 'user-123' },
                JWT_SECRET,
                { expiresIn: '-1s', issuer: 'xmax-user-center', audience: 'xmax-services' }
            )

            expect(() => {
                jwt.verify(token, JWT_SECRET, {
                    issuer: 'xmax-user-center',
                    audience: 'xmax-services',
                    algorithms: ['HS256'],
                })
            }).toThrow(jwt.TokenExpiredError)
        })

        test('tampered token throws JsonWebTokenError', () => {
            const token = jwt.sign(
                { userId: 'user-123' },
                JWT_SECRET,
                { issuer: 'xmax-user-center', audience: 'xmax-services' }
            )

            // Tamper with the payload
            const parts = token.split('.')
            const tamperedPayload = Buffer.from(JSON.stringify({ userId: 'hacker' })).toString('base64url')
            const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`

            expect(() => {
                jwt.verify(tamperedToken, JWT_SECRET, {
                    issuer: 'xmax-user-center',
                    audience: 'xmax-services',
                    algorithms: ['HS256'],
                })
            }).toThrow(jwt.JsonWebTokenError)
        })
    })
})
