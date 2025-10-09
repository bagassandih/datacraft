import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    const message = error.response?.data?.message || error.message || 'Unknown error'
    return Promise.reject(new Error(message))
  }
)

export const dbService = {
  /**
   * List available databases
   * @param {Object} config - Server configuration (without database)
   * @returns {Promise}
   */
  async listDatabases(config) {
    return api.post('/databases', config)
  },

  /**
   * Connect to specific database
   * @param {Object} config - Database configuration
   * @returns {Promise}
   */
  async connect(config) {
    return api.post('/connect', config)
  },

  /**
   * Get database schema
   * @returns {Promise}
   */
  async getSchema() {
    return api.get('/schema')
  },

  /**
   * Generate SQL query from visual structure
   * @param {Object} data - Nodes and edges
   * @returns {Promise}
   */
  async generateQuery(data) {
    return api.post('/generate', data)
  },

  /**
   * Execute SQL query
   * @param {string} query - SQL query
   * @returns {Promise}
   */
  async executeQuery(query) {
    return api.post('/execute', { query })
  }
}

export default api
