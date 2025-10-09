import { testConnection, initializeConnection } from '../config/knex.js';
import { getCompleteSchema } from '../utils/schema-reader.js';
import { validateConnectionConfig } from '../utils/validator.js';
import { listDatabases } from '../utils/database-lister.js';
import knex from 'knex';

/**
 * Service for database connection operations
 */
export class DbService {
  /**
   * Test connection and list available databases
   * @param {Object} config - Database configuration (without database name)
   * @returns {Promise<Object>} List of databases
   */
  async listDatabases(config) {
    try {
      // Create temporary connection to default database
      const tempConfig = {
        client: config.client || 'pg',
        connection: {
          host: config.host,
          port: config.port || (config.client === 'mysql2' ? 3306 : 5432),
          user: config.user,
          password: config.password,
          database: config.client === 'mysql2' ? 'mysql' : 'postgres'
        }
      };

      const tempConnection = knex(tempConfig);

      // Test connection first
      await tempConnection.raw('SELECT 1');

      // Get list of databases
      const databases = await listDatabases(tempConnection);

      // Close temp connection
      await tempConnection.destroy();

      return {
        success: true,
        databases: databases
      };
    } catch (error) {
      throw new Error(`Failed to list databases: ${error.message}`);
    }
  }

  /**
   * Connect to specific database
   * @param {Object} config - Database configuration
   * @returns {Promise<Object>} Connection result
   */
  async connect(config) {
    // Validate config
    const validation = validateConnectionConfig(config);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    try {
      await testConnection(config);
      initializeConnection(config);

      return {
        success: true,
        message: 'Connected successfully'
      };
    } catch (error) {
      throw new Error(`Connection failed: ${error.message}`);
    }
  }

  /**
   * Get database schema
   * @returns {Promise<Object>} Database schema
   */
  async getSchema() {
    try {
      const schema = await getCompleteSchema();
      return schema;
    } catch (error) {
      throw new Error(`Failed to retrieve schema: ${error.message}`);
    }
  }
}

export default new DbService();
