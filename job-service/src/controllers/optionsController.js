/**
 * 选项列表控制器
 * 提供各种下拉选项数据
 */

import { sendSuccess } from '../../utils/response.js'
import {
    CONTRACT_TYPE,
    CONTRACT_TYPE_LABEL,
    EDUCATION_LEVEL,
    EDUCATION_LEVEL_LABEL,
    WORK_MODE,
    WORK_MODE_LABEL,
    EXPERIENCE_OPTIONS,
    HOT_CITIES,
    SALARY_PERIOD,
    SALARY_PERIOD_LABEL,
    INTERVIEW_PRICING_TIERS,
} from '../constants/job_constants.js'

class OptionsController {
    /**
     * 获取所有职位相关的选项
     * GET /api/v1/options/job
     */
    async getJobOptions(ctx) {
        const options = {
            // 职位类型选项
            contractTypes: Object.entries(CONTRACT_TYPE).map(([key, value]) => ({
                value,
                label: CONTRACT_TYPE_LABEL[value],
                key,
            })),

            // 学历选项
            educationLevels: Object.entries(EDUCATION_LEVEL).map(([key, value]) => ({
                value,
                label: EDUCATION_LEVEL_LABEL[value],
                key,
            })),

            // 办公方式选项
            workModes: Object.entries(WORK_MODE).map(([key, value]) => ({
                value,
                label: WORK_MODE_LABEL[value],
                key,
            })),

            // 工作经验选项
            experienceOptions: EXPERIENCE_OPTIONS,

            // 薪资周期选项
            salaryPeriods: Object.entries(SALARY_PERIOD).map(([key, value]) => ({
                value,
                label: SALARY_PERIOD_LABEL[value],
                key,
            })),

            // 热门城市
            hotCities: HOT_CITIES.map(city => ({
                value: city,
                label: city,
            })),

            // 其他选项
            currencies: [
                { value: 'CNY', label: '人民币' },
                { value: 'USD', label: '美元' },
            ],

            // 职位状态
            jobStatuses: [
                { value: 'draft', label: '草稿' },
                { value: 'published', label: '已发布' },
                { value: 'paused', label: '已暂停' },
                { value: 'closed', label: '已关闭' },
            ],
        }

        sendSuccess(ctx, options, '获取选项列表成功')
    }

    /**
     * 获取职位类型选项
     * GET /api/v1/options/contract-types
     */
    async getContractTypes(ctx) {
        const options = Object.entries(CONTRACT_TYPE).map(([key, value]) => ({
            value,
            label: CONTRACT_TYPE_LABEL[value],
            key,
        }))

        sendSuccess(ctx, options, '获取职位类型选项成功')
    }

    /**
     * 获取学历选项
     * GET /api/v1/options/education-levels
     */
    async getEducationLevels(ctx) {
        const options = Object.entries(EDUCATION_LEVEL).map(([key, value]) => ({
            value,
            label: EDUCATION_LEVEL_LABEL[value],
            key,
        }))

        sendSuccess(ctx, options, '获取学历选项成功')
    }

    /**
     * 获取办公方式选项
     * GET /api/v1/options/work-modes
     */
    async getWorkModes(ctx) {
        const options = Object.entries(WORK_MODE).map(([key, value]) => ({
            value,
            label: WORK_MODE_LABEL[value],
            key,
        }))

        sendSuccess(ctx, options, '获取办公方式选项成功')
    }

    /**
     * 获取工作经验选项
     * GET /api/v1/options/experience
     */
    async getExperienceOptions(ctx) {
        sendSuccess(ctx, EXPERIENCE_OPTIONS, '获取工作经验选项成功')
    }

    /**
     * 获取城市列表
     * GET /api/v1/options/cities
     */
    async getCities(ctx) {
        const cities = HOT_CITIES.map(city => ({
            value: city,
            label: city,
        }))

        sendSuccess(ctx, cities, '获取城市列表成功')
    }

    /**
     * 获取面试服务阶梯定价
     * GET /api/v1/job-options/interview-pricing
     */
    async getInterviewPricing(ctx) {
        const tiers = INTERVIEW_PRICING_TIERS.map(tier => ({
            ...tier,
            maxSalary: tier.maxSalary === Infinity ? null : tier.maxSalary,
            discount: `${((tier.currentPrice / tier.originalPrice) * 10).toFixed(1)}折`,
        }))

        sendSuccess(
            ctx,
            {
                tiers,
                formula: {
                    description: '年薪 = (月薪最大值 + 月薪最小值) / 2 × N薪',
                    unit: '元',
                    salaryUnit: '万元',
                },
            },
            '获取面试定价成功'
        )
    }
}

export default new OptionsController()
