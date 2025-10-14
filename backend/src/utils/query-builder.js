/**
 * Build SQL query from nodes and edges
 * @param {Array} nodes - List of table nodes with selected columns
 * @param {Array} edges - List of edges (joins) between tables
 * @param {Object} clauses - Query clauses (filters, orderBy, groupBy, having)
 * @returns {string} SQL query
 */
export function buildQuery(nodes, edges, clauses = {}) {
  // Handle backward compatibility
  const filters = clauses.filters || clauses || []
  const orderBy = clauses.orderBy || []
  const groupBy = clauses.groupBy || []
  const having = clauses.having || []
  if (!nodes || nodes.length === 0) {
    throw new Error('No tables selected');
  }

  // STEP 1: Build alias mapping for all nodes FIRST
  // This ensures consistent aliases across SELECT and JOIN clauses
  const firstNode = nodes[0];
  const firstTableName = firstNode.tableName || firstNode.id;
  const firstAlias = firstNode.alias || firstNode.id;

  // Track aliases: Map from node ID to final alias
  const nodeAliasMap = new Map();
  // Track which table names have been used
  const usedTableAliases = new Map();

  // First table is in FROM clause
  nodeAliasMap.set(firstNode.id, firstAlias);
  usedTableAliases.set(firstTableName, [firstAlias]);

  // Pre-process all edges to determine final aliases for all nodes
  edges.forEach(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);

    if (!sourceNode || !targetNode) {
      return;
    }

    const sourceTableName = sourceNode.tableName || sourceNode.id;
    const targetTableName = targetNode.tableName || targetNode.id;

    // Set source alias if not already set
    if (!nodeAliasMap.has(sourceNode.id)) {
      let sourceAlias = sourceNode.alias || sourceNode.id;
      const usedAliasesForSourceTable = usedTableAliases.get(sourceTableName) || [];

      // Check if user provided a custom alias (different from table name)
      const isCustomSourceAlias = sourceNode.alias && sourceNode.alias !== sourceTableName;

      if (usedAliasesForSourceTable.length > 0) {
        // Table already used
        const isAliasTaken = usedAliasesForSourceTable.includes(sourceAlias);

        if (isCustomSourceAlias && !isAliasTaken) {
          // User provided custom alias and it's not taken - use it as is
        } else {
          // Generate unique alias
          sourceAlias = `${sourceAlias}_${usedAliasesForSourceTable.length}`;
        }
      }

      nodeAliasMap.set(sourceNode.id, sourceAlias);
      if (!usedTableAliases.has(sourceTableName)) {
        usedTableAliases.set(sourceTableName, []);
      }
      usedTableAliases.get(sourceTableName).push(sourceAlias);
    }

    // Set target alias if not already set
    if (!nodeAliasMap.has(targetNode.id)) {
      let targetAlias = targetNode.alias || targetNode.id;
      const usedAliasesForTable = usedTableAliases.get(targetTableName) || [];

      // Check if user provided a custom alias (different from table name)
      const isCustomAlias = targetNode.alias && targetNode.alias !== targetTableName;

      if (usedAliasesForTable.length > 0) {
        // Table already used

        // Check if the custom alias is already taken by another node
        const isAliasTaken = usedAliasesForTable.includes(targetAlias);

        if (isCustomAlias && !isAliasTaken) {
          // User provided custom alias and it's not taken - use it as is
          // Don't modify it
        } else {
          // Either no custom alias, or custom alias is already taken
          // Generate unique alias
          const sourceColumn = edge.data?.sourceColumn;
          if (sourceColumn) {
            const columnPart = sourceColumn.replace(/_id$|_user_id$|_fk$/, '').replace(/_/g, '');
            targetAlias = `${targetAlias}_${columnPart}`;
          } else {
            targetAlias = `${targetAlias}_${usedAliasesForTable.length}`;
          }
        }
      }

      nodeAliasMap.set(targetNode.id, targetAlias);
      if (!usedTableAliases.has(targetTableName)) {
        usedTableAliases.set(targetTableName, []);
      }
      usedTableAliases.get(targetTableName).push(targetAlias);
    }
  });

  // STEP 2: Build SELECT clause using final aliases from nodeAliasMap
  const selectParts = [];
  const columnCount = {}; // Track column name occurrences

  nodes.forEach(node => {
    // Use final alias from map
    const alias = nodeAliasMap.get(node.id) || node.alias || node.id;
    const columns = node.columns || [];

    // Only add columns if user has selected any
    if (columns.length > 0) {
      columns.forEach(col => {
        // Track how many times this column name appears
        columnCount[col] = (columnCount[col] || 0) + 1;

        // Add table alias prefix to column name for clarity
        // Format: tablealias_columnname (e.g., u_name, o_name)
        const columnAlias = `${alias}_${col}`;
        selectParts.push(`${alias}.${col} AS ${columnAlias}`);
      });
    }
  });

  // If no columns selected at all, select all columns from each table with alias prefix
  let selectClause;
  if (selectParts.length > 0) {
    selectClause = `SELECT ${selectParts.join(', ')}`;
  } else {
    // Fallback: SELECT alias.* for each table to avoid ambiguity
    const allTableSelects = nodes.map(node => {
      const alias = nodeAliasMap.get(node.id) || node.alias || node.id;
      return `${alias}.*`;
    });
    selectClause = `SELECT ${allTableSelects.join(', ')}`;
  }

  // STEP 3: Build FROM clause
  const fromClause = firstAlias !== firstTableName
    ? `FROM ${firstTableName} ${firstAlias}`
    : `FROM ${firstTableName}`;

  // STEP 4: Build JOIN clauses using final aliases from nodeAliasMap
  const joinClauses = [];
  edges.forEach(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);

    if (!sourceNode || !targetNode) {
      return;
    }

    // Get table names
    const sourceTableName = sourceNode.tableName || sourceNode.id;
    const targetTableName = targetNode.tableName || targetNode.id;

    // Get final aliases from pre-built map
    const sourceAlias = nodeAliasMap.get(sourceNode.id);
    const targetAlias = nodeAliasMap.get(targetNode.id);

    // Get join type
    const joinType = edge.data?.joinType || edge.joinType || 'INNER';

    // Determine join condition
    let joinCondition;

    if (edge.data?.condition) {
      // 1. Use explicit condition from edge.data
      joinCondition = edge.data.condition
        .replace(new RegExp(`\\b${sourceTableName}\\b`, 'g'), sourceAlias)
        .replace(new RegExp(`\\b${targetTableName}\\b`, 'g'), targetAlias);
    } else if (edge.data?.sourceColumn && edge.data?.targetColumn) {
      // 2. Use specific columns from edge data (column-level join)
      joinCondition = `${sourceAlias}.${edge.data.sourceColumn} = ${targetAlias}.${edge.data.targetColumn}`;
    } else if (edge.condition) {
      // 3. Use condition from edge
      joinCondition = edge.condition
        .replace(new RegExp(`\\b${sourceTableName}\\b`, 'g'), sourceAlias)
        .replace(new RegExp(`\\b${targetTableName}\\b`, 'g'), targetAlias);
    } else {
      // 4. Default: assume foreign key naming convention (table_id)
      joinCondition = `${sourceAlias}.${targetTableName}_id = ${targetAlias}.id`;
    }

    // Always add alias for joined tables
    const joinTablePart = `${targetTableName} ${targetAlias}`;

    joinClauses.push(
      `${joinType} JOIN ${joinTablePart} ON ${joinCondition}`
    );
  });

  // STEP 5: Build WHERE clause from filters using consistent aliases
  const whereClauses = [];
  if (filters && filters.length > 0) {
    // Filter out incomplete filters
    const validFilters = filters.filter(f => {
      if (['IS NULL', 'IS NOT NULL'].includes(f.operator)) {
        return f.table && f.column;
      }
      return f.table && f.column && f.value;
    });

    validFilters.forEach((filter, index) => {
      // Find node by table name and get its final alias from map
      const node = nodes.find(n => (n.tableName || n.id) === filter.table);
      const alias = node ? nodeAliasMap.get(node.id) : filter.table;

      let clause = `${alias}.${filter.column} ${filter.operator}`;

      if (!['IS NULL', 'IS NOT NULL'].includes(filter.operator)) {
        // Handle IN operator - expect comma-separated values
        if (filter.operator === 'IN' || filter.operator === 'NOT IN') {
          clause += ` (${filter.value})`;
        } else if (filter.operator === 'LIKE' || filter.operator === 'NOT LIKE') {
          clause += ` '${filter.value}'`;
        } else {
          // Try to detect if value is number
          const isNumber = !isNaN(filter.value) && filter.value.trim() !== '';
          clause += isNumber ? ` ${filter.value}` : ` '${filter.value}'`;
        }
      }

      if (index > 0) {
        const logic = filter.logic || 'AND';
        clause = `${logic} ${clause}`;
      }

      whereClauses.push(clause);
    });
  }

  // STEP 6: Build GROUP BY clause using consistent aliases
  const groupByParts = [];
  if (groupBy && groupBy.length > 0) {
    const validGroups = groupBy.filter(g => g.table && g.column);
    validGroups.forEach(group => {
      // Find node by table name and get its final alias from map
      const node = nodes.find(n => (n.tableName || n.id) === group.table);
      const alias = node ? nodeAliasMap.get(node.id) : group.table;
      groupByParts.push(`${alias}.${group.column}`);
    });
  }

  // STEP 7: Build HAVING clause using consistent aliases
  const havingClauses = [];
  if (having && having.length > 0) {
    const validHaving = having.filter(h => h.aggregate && h.table && h.column && h.value);
    validHaving.forEach((havingItem, index) => {
      // Find node by table name and get its final alias from map
      const node = nodes.find(n => (n.tableName || n.id) === havingItem.table);
      const alias = node ? nodeAliasMap.get(node.id) : havingItem.table;

      let clause = `${havingItem.aggregate}(${alias}.${havingItem.column}) ${havingItem.operator}`;

      const isNumber = !isNaN(havingItem.value) && havingItem.value.trim() !== '';
      clause += isNumber ? ` ${havingItem.value}` : ` '${havingItem.value}'`;

      if (index > 0) {
        const logic = havingItem.logic || 'AND';
        clause = `${logic} ${clause}`;
      }

      havingClauses.push(clause);
    });
  }

  // STEP 8: Build ORDER BY clause using consistent aliases
  const orderByParts = [];
  if (orderBy && orderBy.length > 0) {
    const validOrders = orderBy.filter(o => o.table && o.column);
    validOrders.forEach(order => {
      // Find node by table name and get its final alias from map
      const node = nodes.find(n => (n.tableName || n.id) === order.table);
      const alias = node ? nodeAliasMap.get(node.id) : order.table;
      const direction = order.direction || 'ASC';
      orderByParts.push(`${alias}.${order.column} ${direction}`);
    });
  }

  // Combine all parts
  const queryParts = [
    selectClause,
    fromClause,
    ...joinClauses
  ];

  if (whereClauses.length > 0) {
    queryParts.push(`WHERE ${whereClauses.join(' ')}`);
  }

  if (groupByParts.length > 0) {
    queryParts.push(`GROUP BY ${groupByParts.join(', ')}`);
  }

  if (havingClauses.length > 0) {
    queryParts.push(`HAVING ${havingClauses.join(' ')}`);
  }

  if (orderByParts.length > 0) {
    queryParts.push(`ORDER BY ${orderByParts.join(', ')}`);
  }

  const query = queryParts.join('\n');

  return query;
}

/**
 * Validate that query is SELECT only
 * @param {string} query - SQL query
 * @returns {boolean}
 */
export function isSelectQuery(query) {
  const trimmed = query.trim().toUpperCase();
  return trimmed.startsWith('SELECT');
}

/**
 * Add LIMIT to query
 * @param {string} query - SQL query
 * @param {number} limit - Row limit (default 100)
 * @returns {string}
 */
export function addLimit(query, limit = 100) {
  if (!query.toUpperCase().includes('LIMIT')) {
    return `${query}\nLIMIT ${limit}`;
  }
  return query;
}
