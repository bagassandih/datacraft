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

  // Build SELECT clause
  const selectParts = [];
  nodes.forEach(node => {
    const alias = node.alias || node.id;
    const columns = node.columns || [];

    // Only add columns if user has selected any
    if (columns.length > 0) {
      columns.forEach(col => {
        selectParts.push(`${alias}.${col}`);
      });
    }
  });

  // If no columns selected at all, fallback to SELECT all from first table
  const selectClause = selectParts.length > 0
    ? `SELECT ${selectParts.join(', ')}`
    : `SELECT *`;

  // Build FROM clause (first table)
  const firstNode = nodes[0];
  const firstAlias = firstNode.alias || firstNode.id;
  // Only add alias if it's different from table name
  const fromClause = firstAlias !== firstNode.id
    ? `FROM ${firstNode.id} ${firstAlias}`
    : `FROM ${firstNode.id}`;

  // Build JOIN clauses
  const joinClauses = [];
  edges.forEach(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);

    if (!sourceNode || !targetNode) {
      return;
    }

    const sourceAlias = sourceNode.alias || sourceNode.id;
    const targetAlias = targetNode.alias || targetNode.id;

    // Get join type from edge data or edge itself
    const joinType = edge.data?.joinType || edge.joinType || 'INNER';

    // Determine join condition
    let joinCondition;

    if (edge.data?.condition) {
      // 1. Use explicit condition from edge.data
      // Replace table names with aliases
      joinCondition = edge.data.condition
        .replace(new RegExp(`\\b${sourceNode.id}\\b`, 'g'), sourceAlias)
        .replace(new RegExp(`\\b${targetNode.id}\\b`, 'g'), targetAlias);
    } else if (edge.data?.sourceColumn && edge.data?.targetColumn) {
      // 2. Use specific columns from edge data (column-level join)
      joinCondition = `${sourceAlias}.${edge.data.sourceColumn} = ${targetAlias}.${edge.data.targetColumn}`;
    } else if (edge.condition) {
      // 3. Use condition from edge
      // Replace table names with aliases
      joinCondition = edge.condition
        .replace(new RegExp(`\\b${sourceNode.id}\\b`, 'g'), sourceAlias)
        .replace(new RegExp(`\\b${targetNode.id}\\b`, 'g'), targetAlias);
    } else {
      // 4. Default: assume foreign key naming convention (table_id)
      joinCondition = `${sourceAlias}.${edge.target}_id = ${targetAlias}.id`;
    }

    // Only add alias if it's different from table name
    const joinTablePart = targetAlias !== targetNode.id
      ? `${targetNode.id} ${targetAlias}`
      : targetNode.id;

    joinClauses.push(
      `${joinType} JOIN ${joinTablePart} ON ${joinCondition}`
    );
  });

  // Build WHERE clause from filters
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
      const node = nodes.find(n => n.id === filter.table);
      const alias = node?.alias || filter.table;

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

  // Build GROUP BY clause
  const groupByParts = [];
  if (groupBy && groupBy.length > 0) {
    const validGroups = groupBy.filter(g => g.table && g.column);
    validGroups.forEach(group => {
      const node = nodes.find(n => n.id === group.table);
      const alias = node?.alias || group.table;
      groupByParts.push(`${alias}.${group.column}`);
    });
  }

  // Build HAVING clause
  const havingClauses = [];
  if (having && having.length > 0) {
    const validHaving = having.filter(h => h.aggregate && h.table && h.column && h.value);
    validHaving.forEach((havingItem, index) => {
      const node = nodes.find(n => n.id === havingItem.table);
      const alias = node?.alias || havingItem.table;

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

  // Build ORDER BY clause
  const orderByParts = [];
  if (orderBy && orderBy.length > 0) {
    const validOrders = orderBy.filter(o => o.table && o.column);
    validOrders.forEach(order => {
      const node = nodes.find(n => n.id === order.table);
      const alias = node?.alias || order.table;
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
