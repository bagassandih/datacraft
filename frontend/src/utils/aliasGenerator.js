/**
 * Generate unique aliases for tables
 * @param {Array} nodes - List of table nodes
 * @returns {Map} Map of node ID to alias
 */
export function generateUniqueAliases(nodes) {
  const aliasMap = new Map()
  const usedAliases = new Set()

  // Count occurrences of each table name
  const tableCount = {}
  nodes.forEach(node => {
    const tableName = node.data?.table || node.id
    tableCount[tableName] = (tableCount[tableName] || 0) + 1
  })

  // Track which occurrence this is for each table
  const tableOccurrence = {}

  nodes.forEach(node => {
    const nodeId = node.id
    const tableName = node.data?.table || node.id
    let alias = node.data?.alias

    // If custom alias already set and unique, use it
    if (alias && !usedAliases.has(alias)) {
      usedAliases.add(alias)
      aliasMap.set(nodeId, alias)
      return
    }

    // Generate smart alias
    let baseAlias = tableName.substring(0, 1).toLowerCase()

    // If this table appears multiple times, add a number suffix
    if (tableCount[tableName] > 1) {
      tableOccurrence[tableName] = (tableOccurrence[tableName] || 0) + 1
      baseAlias = tableName.substring(0, 1).toLowerCase() + tableOccurrence[tableName]
    }

    alias = baseAlias

    // If already used, try first 2 letters, then 3, etc.
    let counter = 2
    while (usedAliases.has(alias)) {
      if (counter <= tableName.length) {
        alias = tableName.substring(0, counter).toLowerCase()
        if (tableCount[tableName] > 1) {
          alias += tableOccurrence[tableName]
        }
        counter++
      } else {
        // If table name exhausted, add more numbers
        alias = baseAlias + '_' + (usedAliases.size + 1)
        break
      }
    }

    usedAliases.add(alias)
    aliasMap.set(nodeId, alias)
  })

  return aliasMap
}
