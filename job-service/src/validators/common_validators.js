/**
 * 通用验证器集合
 * 提供可复用的业务验证规则
 * @module validators/common_validators
 */

import Joi from 'joi'

/**
 * 货币类型
 */
export const CURRENCY_TYPES = ['CNY', 'USD', 'EUR', 'GBP', 'JPY']

/**
 * 薪资周期类型
 */
export const PERIOD_TYPES = ['hour', 'day', 'month', 'year']

/**
 * 货币验证器
 */
export const currency = () =>
    Joi.string()
        .valid(...CURRENCY_TYPES)
        .messages({
            'any.only': '不支持的货币类型',
            'string.base': '货币必须是字符串',
            'string.empty': '货币不能为空',
            'any.required': '货币不能为空',
        })

/**
 * 薪资周期验证器
 */
export const period = () =>
    Joi.string()
        .valid(...PERIOD_TYPES)
        .messages({
            'any.only': '不支持的薪资周期',
            'string.base': '薪资周期必须是字符串',
            'string.empty': '薪资周期不能为空',
            'any.required': '薪资周期不能为空',
        })

/**
 * 薪资范围验证器
 * 用于职位发布时的薪资范围
 */
export const salaryRange = () =>
    Joi.object({
        min: Joi.number().min(0).required().messages({
            'number.base': '最低薪资必须是数字',
            'number.min': '最低薪资不能小于0',
            'any.required': '最低薪资不能为空',
        }),
        max: Joi.number().min(0).required().messages({
            'number.base': '最高薪资必须是数字',
            'number.min': '最高薪资不能小于0',
            'any.required': '最高薪资不能为空',
        }),
        currency: currency().default('CNY'),
        period: period().default('day'),
        months: Joi.number().integer().min(12).default(12).messages({
            'number.base': '薪资月数必须是数字',
            'number.integer': '薪资月数必须是整数',
            'number.min': '薪资月数不能小于12',
        }),
    })
        .custom((value, helpers) => {
            if (value.min > value.max) {
                return helpers.error('any.custom', { message: '最低薪资不能大于最高薪资' })
            }
            return value
        })
        .messages({
            'any.custom': '最低薪资不能大于最高薪资',
        })

/**
 * 期望薪资验证器
 * 用于候选人提交申请时的期望薪资
 */
export const expectedSalary = () =>
    Joi.object({
        min: Joi.number().min(0).messages({
            'number.base': '最低期望薪资必须是数字',
            'number.min': '最低期望薪资不能小于0',
        }),
        max: Joi.number().min(0).messages({
            'number.base': '最高期望薪资必须是数字',
            'number.min': '最高期望薪资不能小于0',
        }),
        currency: currency().default('CNY'),
    }).custom((value, helpers) => {
        if (value.min && value.max && value.min > value.max) {
            return helpers.error('any.custom', { message: '最低期望薪资不能大于最高期望薪资' })
        }
        return value
    })

/**
 * 合同报酬验证器
 * 用于合同创建时的报酬信息
 */
export const compensation = () =>
    Joi.object({
        rate: Joi.number().positive().required().messages({
            'number.base': '薪资必须是数字',
            'number.positive': '薪资必须大于0',
            'any.required': '薪资不能为空',
        }),
        currency: currency().required(),
        period: period().required(),
    })

/**
 * 经验要求验证器
 */
export const experience = () =>
    Joi.object({
        min: Joi.number().min(0).required().messages({
            'number.base': '最低经验年限必须是数字',
            'number.min': '最低经验年限不能小于0',
            'any.required': '最低经验年限不能为空',
        }),
        max: Joi.number().min(0).required().messages({
            'number.base': '最高经验年限必须是数字',
            'number.min': '最高经验年限不能小于0',
            'any.required': '最高经验年限不能为空',
        }),
        unit: Joi.string().valid('months', 'years').default('years').messages({
            'any.only': '经验单位必须是months或years',
        }),
    }).custom((value, helpers) => {
        if (value.min > value.max) {
            return helpers.error('any.custom', { message: '最低经验年限不能大于最高经验年限' })
        }
        return value
    })

/**
 * 合同期限验证器
 */
export const contractDuration = () =>
    Joi.object({
        value: Joi.number().min(0).required().messages({
            'number.base': '合同期限必须是数字',
            'number.min': '合同期限不能小于0',
            'any.required': '合同期限不能为空',
        }),
        unit: Joi.string().valid('hour', 'day', 'week', 'month', 'year').required().messages({
            'any.only': '时间单位无效',
            'any.required': '时间单位不能为空',
        }),
    })

/**
 * 通用验证器集合
 */
export const commonValidators = {
    currency,
    period,
    salaryRange,
    expectedSalary,
    compensation,
    experience,
    contractDuration,
}

export default commonValidators
