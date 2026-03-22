/**
 * XMAX Job Service 数据模型入口文件
 *
 * 导出所有 Mongoose 模型，提供统一的模型访问接口
 */

import JobPost from './JobPost.js'
import JobApplication from './JobApplication.js'
import InterviewProcess from './InterviewProcess.js'
import ContractOffer from './ContractOffer.js'
import ManualCandidate from './ManualCandidate.js'
import ShadowApplication from './ShadowApplication.js'
import JobCollaborator from './JobCollaborator.js'

// 导出所有模型
export { JobPost, JobApplication, InterviewProcess, ContractOffer, ManualCandidate, ShadowApplication, JobCollaborator }

// 默认导出
export default {
    JobPost,
    JobApplication,
    InterviewProcess,
    ContractOffer,
    ManualCandidate,
    ShadowApplication,
    JobCollaborator,
}
