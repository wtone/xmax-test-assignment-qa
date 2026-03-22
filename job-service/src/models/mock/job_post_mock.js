/**
 * JobPost 模型的内存模拟版本
 * 用于测试环境，提供与真实模型相同的接口
 */

import { generateJobId } from '../../utils/id_generator.js'
import { JOB_STATUS } from '../../constants/job_status.js'

// 内存存储
const jobStore = new Map()
let idCounter = 1

/**
 * 模拟 JobPost 模型
 */
export class JobPostMock {
    constructor(data) {
        this._id = `mock_${idCounter++}`
        this.jobId = data.jobId || generateJobId()
        this.companyId = data.companyId
        this.createdBy = data.createdBy

        // 基本信息
        this.title = data.title
        this.description = data.description
        this.requirements = data.requirements || []
        this.responsibilities = data.responsibilities || []

        // 位置和工作模式
        this.location = data.location
        this.remote = data.remote || false
        this.workMode = data.workMode || 'onsite'

        // 薪资和合同
        this.salaryRange = data.salaryRange
        this.contractType = data.contractType
        this.contractHours = data.contractHours

        // 要求
        this.experience = data.experience
        this.education = data.education
        this.skills = data.skills || []

        // 面试配置
        this.interviewConfig = data.interviewConfig || { enabled: false }

        // 申请限制
        this.maxApplicants = data.maxApplicants || 100
        this.applicationDeadline = data.applicationDeadline

        // 状态和统计
        this.status = data.status || JOB_STATUS.DRAFT
        this.viewCount = data.viewCount || 0
        this.applicationCount = data.applicationCount || 0

        // 时间戳
        this.createdAt = new Date()
        this.updatedAt = new Date()
        this.publishedAt = null

        // 虚拟字段
        Object.defineProperty(this, 'isActive', {
            get() {
                return this.status === JOB_STATUS.PUBLISHED
            },
        })

        Object.defineProperty(this, 'canApply', {
            get() {
                return (
                    this.isActive &&
                    this.applicationCount < this.maxApplicants &&
                    (!this.applicationDeadline || new Date() < new Date(this.applicationDeadline))
                )
            },
        })
    }

    // 保存方法
    async save() {
        this.updatedAt = new Date()
        jobStore.set(this.jobId, this)
        return this
    }

    // 实例方法
    incrementViewCount() {
        this.viewCount += 1
        return this.save()
    }

    incrementApplicationCount() {
        this.applicationCount += 1
        return this.save()
    }

    // 转换为JSON
    toJSON() {
        const obj = { ...this }
        obj.id = this._id
        delete obj._id
        return obj
    }

    // 静态方法
    static async create(data) {
        const job = new JobPostMock(data)
        return job.save()
    }

    static async findById(id) {
        // 支持通过 _id 或 jobId 查找
        for (const [jobId, job] of jobStore.entries()) {
            if (job._id === id || job.jobId === id) {
                return job
            }
        }
        return null
    }

    static async findOne(query) {
        for (const job of jobStore.values()) {
            let match = true
            for (const [key, value] of Object.entries(query)) {
                if (job[key] !== value) {
                    match = false
                    break
                }
            }
            if (match) return job
        }
        return null
    }

    static async find(query = {}) {
        const results = []
        for (const job of jobStore.values()) {
            let match = true
            for (const [key, value] of Object.entries(query)) {
                if (key === 'companyId' && job.companyId !== value) {
                    match = false
                    break
                }
                if (key === 'status' && job.status !== value) {
                    match = false
                    break
                }
                if (key === 'title' && value.$regex) {
                    const regex = new RegExp(value.$regex, value.$options || 'i')
                    if (!regex.test(job.title)) {
                        match = false
                        break
                    }
                }
            }
            if (match) results.push(job)
        }

        // 模拟 Mongoose 查询链
        return {
            sort: function (sortOptions) {
                // 简单排序实现
                if (sortOptions.createdAt === -1) {
                    results.sort((a, b) => b.createdAt - a.createdAt)
                }
                return this
            },
            skip: function (n) {
                this._skip = n
                return this
            },
            limit: function (n) {
                this._limit = n
                return this
            },
            exec: async function () {
                const start = this._skip || 0
                const end = this._limit ? start + this._limit : results.length
                return results.slice(start, end)
            },
            countDocuments: async function () {
                return results.length
            },
        }
    }

    static async findByIdAndUpdate(id, update, options = {}) {
        const job = await this.findById(id)
        if (!job) return null

        Object.assign(job, update)
        job.updatedAt = new Date()

        if (options.new) {
            return job.save()
        }
        return job
    }

    static async deleteOne(query) {
        for (const [jobId, job] of jobStore.entries()) {
            let match = true
            for (const [key, value] of Object.entries(query)) {
                if (job[key] !== value) {
                    match = false
                    break
                }
            }
            if (match) {
                jobStore.delete(jobId)
                return { deletedCount: 1 }
            }
        }
        return { deletedCount: 0 }
    }

    static async countDocuments(query = {}) {
        let count = 0
        for (const job of jobStore.values()) {
            let match = true
            for (const [key, value] of Object.entries(query)) {
                if (job[key] !== value) {
                    match = false
                    break
                }
            }
            if (match) count++
        }
        return count
    }

    static async aggregate(pipeline) {
        // 简单的聚合模拟
        const results = []
        const jobs = Array.from(jobStore.values())

        for (const stage of pipeline) {
            if (stage.$match) {
                // 匹配阶段
                const filtered = jobs.filter(job => {
                    for (const [key, value] of Object.entries(stage.$match)) {
                        if (job[key] !== value) return false
                    }
                    return true
                })
                return filtered
            }
            if (stage.$group) {
                // 分组阶段
                const groups = {}
                for (const job of jobs) {
                    const key = job[stage.$group._id.substr(1)]
                    if (!groups[key]) {
                        groups[key] = { _id: key, count: 0 }
                    }
                    groups[key].count++
                }
                return Object.values(groups)
            }
        }

        return results
    }

    // 清空存储（用于测试）
    static clear() {
        jobStore.clear()
        idCounter = 1
    }
}

// 导出为默认
export default JobPostMock
