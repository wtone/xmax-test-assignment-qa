/**
 * 选项路由
 */

import Router from 'koa-router'
import optionsController from '../controllers/optionsController.js'

const router = new Router({ prefix: '/job-options' })

/**
 * @swagger
 * /api/v1/job-options/job:
 *   get:
 *     summary: 获取所有职位相关选项
 *     tags: [通用-选项数据]
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     responses:
 *       200:
 *         description: 成功获取所有选项
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 contractTypes:
 *                   type: array
 *                   description: 职位类型选项
 *                 educationLevels:
 *                   type: array
 *                   description: 学历选项
 *                 workModes:
 *                   type: array
 *                   description: 办公方式选项
 *                 experienceOptions:
 *                   type: array
 *                   description: 工作经验选项
 *                 hotCities:
 *                   type: array
 *                   description: 热门城市
 */
router.get('/job', optionsController.getJobOptions)

/**
 * @swagger
 * /api/v1/job-options/contract-types:
 *   get:
 *     summary: 获取职位类型选项
 *     tags: [通用-选项数据]
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     responses:
 *       200:
 *         description: 成功获取职位类型选项
 */
router.get('/contract-types', optionsController.getContractTypes)

/**
 * @swagger
 * /api/v1/job-options/education-levels:
 *   get:
 *     summary: 获取学历选项
 *     tags: [通用-选项数据]
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     responses:
 *       200:
 *         description: 成功获取学历选项
 */
router.get('/education-levels', optionsController.getEducationLevels)

/**
 * @swagger
 * /api/v1/job-options/work-modes:
 *   get:
 *     summary: 获取办公方式选项
 *     tags: [通用-选项数据]
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     responses:
 *       200:
 *         description: 成功获取办公方式选项
 */
router.get('/work-modes', optionsController.getWorkModes)

/**
 * @swagger
 * /api/v1/job-options/experience:
 *   get:
 *     summary: 获取工作经验选项
 *     tags: [通用-选项数据]
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     responses:
 *       200:
 *         description: 成功获取工作经验选项
 */
router.get('/experience', optionsController.getExperienceOptions)

/**
 * @swagger
 * /api/v1/job-options/cities:
 *   get:
 *     summary: 获取城市列表
 *     tags: [通用-选项数据]
 *     security:
 *       - bearerAuth: []
 *       - GatewayAuth: []
 *     responses:
 *       200:
 *         description: 成功获取城市列表
 */
router.get('/cities', optionsController.getCities)

/**
 * @swagger
 * /api/v1/job-options/interview-pricing:
 *   get:
 *     summary: 获取面试服务阶梯定价
 *     tags: [通用-选项数据]
 *     responses:
 *       200:
 *         description: 成功获取面试定价
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 0
 *                 message:
 *                   type: string
 *                   example: 获取面试定价成功
 *                 data:
 *                   type: object
 *                   properties:
 *                     tiers:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: tier1
 *                           maxSalary:
 *                             type: integer
 *                             nullable: true
 *                             example: 200000
 *                           label:
 *                             type: string
 *                             example: 20万以下
 *                           originalPrice:
 *                             type: integer
 *                             example: 599
 *                           currentPrice:
 *                             type: integer
 *                             example: 399
 *                           discount:
 *                             type: string
 *                             example: 6.7折
 *                     formula:
 *                       type: object
 *                       properties:
 *                         description:
 *                           type: string
 *                           example: 年薪 = (月薪最大值 + 月薪最小值) / 2 × N薪
 *                         unit:
 *                           type: string
 *                           example: 元
 *                         salaryUnit:
 *                           type: string
 *                           example: 万元
 */
router.get('/interview-pricing', optionsController.getInterviewPricing)

export default router
