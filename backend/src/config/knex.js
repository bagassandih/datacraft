import knex from 'knex';

let dbConnection = null;

/**
 * Initialize database connection
 * @param {Object} config - Database configuration
 * @returns {Object} Knex instance
 */
export function initializeConnection(config) {
  const { client, host, port, user, password, database } = config;

  dbConnection = knex({
    client: client || 'pg',
    connection: {
      host: host || 'localhost',
      port: port || (client === 'mysql2' ? 3306 : 5432),
      user: user,
      password: password,
      database: database,
    },
    pool: { min: 0, max: 10 },
  });

  return dbConnection;
}

/**
 * Get current database connection
 * @returns {Object|null} Knex instance or null
 */
export function getConnection() {
  return dbConnection;
}

/**
 * Close database connection
 */
export async function closeConnection() {
  if (dbConnection) {
    await dbConnection.destroy();
    dbConnection = null;
  }
}

/**
 * Test database connection
 * @param {Object} config - Database configuration
 * @returns {Promise<boolean>}
 */
export async function testConnection(config) {
  try {
    const testConn = initializeConnection(config);
    await testConn.raw('SELECT 1');
    return true;
  } catch (error) {
    throw new Error(`Connection failed: ${error.message}`);
  }
}
