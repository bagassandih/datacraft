import { getConnection } from '../config/knex.js';

/**
 * Get all tables from database
 * @returns {Promise<Array>} List of tables
 */
export async function getTables() {
  const db = getConnection();
  const client = db.client.config.client;

  let tables = [];

  if (client === 'pg') {
    const result = await db.raw(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    tables = result.rows.map(row => row.table_name);
  } else if (client === 'mysql2') {
    const result = await db.raw('SHOW TABLES');
    const key = Object.keys(result[0][0])[0];
    tables = result[0].map(row => row[key]);
  }

  return tables;
}

/**
 * Get columns for a specific table
 * @param {string} tableName - Table name
 * @returns {Promise<Array>} List of columns
 */
export async function getColumns(tableName) {
  const db = getConnection();
  const client = db.client.config.client;

  let columns = [];

  if (client === 'pg') {
    const result = await db.raw(`
      SELECT
        column_name as name,
        data_type as type,
        is_nullable as nullable,
        column_default as default_value
      FROM information_schema.columns
      WHERE table_name = ?
      ORDER BY ordinal_position
    `, [tableName]);
    columns = result.rows;
  } else if (client === 'mysql2') {
    const result = await db.raw('DESCRIBE ??', [tableName]);
    columns = result[0].map(col => ({
      name: col.Field,
      type: col.Type,
      nullable: col.Null === 'YES',
      default_value: col.Default
    }));
  }

  return columns;
}

/**
 * Get foreign key relationships
 * @returns {Promise<Array>} List of foreign keys
 */
export async function getForeignKeys() {
  const db = getConnection();
  const client = db.client.config.client;

  let foreignKeys = [];

  if (client === 'pg') {
    const result = await db.raw(`
      SELECT
        tc.table_name as table_from,
        kcu.column_name as column_from,
        ccu.table_name as table_to,
        ccu.column_name as column_to
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
    `);
    foreignKeys = result.rows;
  } else if (client === 'mysql2') {
    const dbName = db.client.config.connection.database;
    const result = await db.raw(`
      SELECT
        TABLE_NAME as table_from,
        COLUMN_NAME as column_from,
        REFERENCED_TABLE_NAME as table_to,
        REFERENCED_COLUMN_NAME as column_to
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE REFERENCED_TABLE_NAME IS NOT NULL
      AND TABLE_SCHEMA = ?
    `, [dbName]);
    foreignKeys = result[0];
  }

  return foreignKeys;
}

/**
 * Get complete database schema
 * @returns {Promise<Object>} Complete schema with tables, columns, and relationships
 */
export async function getCompleteSchema() {
  const tables = await getTables();

  const schema = await Promise.all(
    tables.map(async (tableName) => {
      const columns = await getColumns(tableName);
      return {
        name: tableName,
        columns: columns
      };
    })
  );

  const relationships = await getForeignKeys();

  return {
    tables: schema,
    relationships: relationships
  };
}
