import { getConnection } from '../config/knex.js';
import { buildQuery, isSelectQuery, addLimit } from '../utils/query-builder.js';
import { validateQuery, validateNodesAndEdges } from '../utils/validator.js';

/**
 * Service for query generation and execution
 */
export class QueryService {
  /**
   * Generate SQL query from nodes and edges
   * @param {Array} nodes - Table nodes
   * @param {Array} edges - Join edges
   * @param {Object} clauses - Query clauses (filters, orderBy, groupBy, having)
   * @returns {Object} Generated query
   */
  generateQuery(nodes, edges, clauses = {}) {
    // Validate input
    const validation = validateNodesAndEdges(nodes, edges);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    try {
      const query = buildQuery(nodes, edges, clauses);
      return {
        success: true,
        query: query
      };
    } catch (error) {
      throw new Error(`Failed to generate query: ${error.message}`);
    }
  }

  /**
   * Execute SQL query
   * @param {string} query - SQL query to execute
   * @returns {Promise<Object>} Query results
   */
  async executeQuery(query) {
    // Validate query
    const validation = validateQuery(query);
    if (!validation.valid) {
      throw new Error(validation.errors.join(', '));
    }

    // Additional security check
    if (!isSelectQuery(query)) {
      throw new Error('Only SELECT queries are allowed');
    }

    const db = getConnection();
    if (!db) {
      throw new Error('No database connection. Please connect first.');
    }

    try {
      // Add limit for safety
      const limitedQuery = addLimit(query, 100);

      const result = await db.raw(limitedQuery);

      // Format result based on database client
      const client = db.client.config.client;
      const rows = client === 'pg' ? result.rows : result[0];

      return {
        success: true,
        rows: rows,
        count: rows.length
      };
    } catch (error) {
      throw new Error(`Query execution failed: ${error.message}`);
    }
  }
}

export default new QueryService();
