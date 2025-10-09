/**
 * Validate database connection config
 * @param {Object} config - Database config
 * @returns {Object} Validation result
 */
export function validateConnectionConfig(config) {
  const errors = [];

  if (!config.host) errors.push('Host is required');
  if (!config.user) errors.push('User is required');
  if (!config.password) errors.push('Password is required');
  if (!config.database) errors.push('Database name is required');

  if (config.client && !['pg', 'mysql2'].includes(config.client)) {
    errors.push('Client must be either "pg" or "mysql2"');
  }

  if (config.port && (config.port < 1 || config.port > 65535)) {
    errors.push('Port must be between 1 and 65535');
  }

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Validate SQL query structure
 * @param {string} query - SQL query
 * @returns {Object} Validation result
 */
export function validateQuery(query) {
  const errors = [];

  if (!query || typeof query !== 'string') {
    errors.push('Query must be a non-empty string');
    return { valid: false, errors };
  }

  const trimmed = query.trim().toUpperCase();

  // Only allow SELECT queries
  if (!trimmed.startsWith('SELECT')) {
    errors.push('Only SELECT queries are allowed');
  }

  // Check for dangerous keywords
  const dangerousKeywords = ['DROP', 'DELETE', 'INSERT', 'UPDATE', 'ALTER', 'CREATE', 'TRUNCATE'];
  dangerousKeywords.forEach(keyword => {
    if (trimmed.includes(keyword)) {
      errors.push(`Dangerous keyword detected: ${keyword}`);
    }
  });

  return {
    valid: errors.length === 0,
    errors: errors
  };
}

/**
 * Validate nodes and edges for query generation
 * @param {Array} nodes - Table nodes
 * @param {Array} edges - Join edges
 * @returns {Object} Validation result
 */
export function validateNodesAndEdges(nodes, edges) {
  const errors = [];

  if (!Array.isArray(nodes) || nodes.length === 0) {
    errors.push('At least one table node is required');
  }

  if (!Array.isArray(edges)) {
    errors.push('Edges must be an array');
  }

  // Validate each node
  nodes.forEach((node, index) => {
    if (!node.id) {
      errors.push(`Node at index ${index} missing id`);
    }
  });

  // Validate each edge
  edges.forEach((edge, index) => {
    if (!edge.source) {
      errors.push(`Edge at index ${index} missing source`);
    }
    if (!edge.target) {
      errors.push(`Edge at index ${index} missing target`);
    }
  });

  return {
    valid: errors.length === 0,
    errors: errors
  };
}
