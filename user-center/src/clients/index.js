import { getEmployeeCompanyInfo } from './servers/company.js'

// Factory function to create a new Request instance
export default traceId => {
    return new Request(traceId)
}

// Request class to manage different API clients
class Request {
    constructor(traceId) {
        this.traceId = traceId
    }

    // Get employee company info helper
    get company() {
        return { getEmployeeCompanyInfo }
    }
}
