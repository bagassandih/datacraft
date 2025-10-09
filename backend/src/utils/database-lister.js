import { getConnection } from '../config/knex.js';

/**
 * Get list of all databases on the server
 * @returns {Promise<Array>} List of database names
 */
export async function listDatabases(tempConnection) {
  const client = tempConnection.client.config.client;
  let databases = [];

  try {
    if (client === 'pg') {
      const result = await tempConnection.raw(`
        SELECT datname
        FROM pg_database
        WHERE datistemplate = false
        AND datname != 'postgres'
        ORDER BY datname
      `);
      databases = result.rows.map(row => row.datname);
    } else if (client === 'mysql2') {
      const result = await tempConnection.raw('SHOW DATABASES');
      databases = result[0]
        .map(row => Object.values(row)[0])
        .filter(db => !['information_schema', 'performance_schema', 'mysql', 'sys'].includes(db));
    }

    return databases;
  } catch (error) {
    throw new Error(`Failed to list databases: ${error.message}`);
  }
}
