/**
 * 模拟用户中心服务
 * 用于开发和测试环境，当真实的UserCenterService不可用时使用
 */

class MockUserCenterService {
    /**
     * 模拟获取候选人档案
     */
    async getCandidateProfile(candidateId) {
        // 模拟网络延迟
        await new Promise(resolve => setTimeout(resolve, 100))

        // 返回模拟的候选人信息
        return {
            id: candidateId,
            name: '张三',
            email: `user_${candidateId.slice(0, 8)}@example.com`,
            phone: '13800138000',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + candidateId,
            title: '高级软件工程师',
            summary: '10年软件开发经验，精通多种编程语言和框架',
            location: '深圳市',
            experience: {
                years: 10,
                companies: [
                    { name: 'XMAX科技', position: '高级工程师', duration: '3年' },
                    { name: '腾讯科技', position: '工程师', duration: '5年' },
                    { name: '华为技术', position: '初级工程师', duration: '2年' },
                ],
            },
            education: {
                degree: 'master',
                major: '计算机科学与技术',
                school: '清华大学',
                year: 2014,
            },
            skills: ['Java', 'Python', 'Go', 'React', 'Node.js', 'MongoDB'],
            isProfileComplete: true,
        }
    }

    /**
     * 模拟获取用户信息
     */
    async getUserInfo(userId) {
        await new Promise(resolve => setTimeout(resolve, 100))

        return {
            id: userId,
            name: '测试用户',
            email: 'test@example.com',
            type: 'C',
        }
    }

    /**
     * 模拟批量获取用户信息
     */
    async batchGetUsers(userIds) {
        await new Promise(resolve => setTimeout(resolve, 100))

        return userIds.map(id => ({
            id,
            name: `用户${id.slice(0, 6)}`,
            email: `user_${id.slice(0, 8)}@example.com`,
        }))
    }

    /**
     * 其他方法返回空或默认值
     */
    async getCompanyInfo(companyId) {
        return null
    }

    async verifyPermission(userId, permission) {
        return true
    }

    async getUserRoles(userId) {
        return ['user']
    }

    async updateCandidateStats(candidateId, stats) {
        return { success: true }
    }

    async updateCompanyStats(companyId, stats) {
        return { success: true }
    }
}

export default new MockUserCenterService()
