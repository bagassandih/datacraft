/**
 * Generate unique aliases for tables
 * @param {Array} nodes - List of table nodes
 * @returns {Map} Map of table name to alias
 */
export function generateUniqueAliases(nodes) {
  const aliasMap = new Map()
  const usedAliases = new Set()

  nodes.forEach(node => {
    const tableName = node.data?.table || node.id
    let alias = node.data?.alias

    // If custom alias already set and unique, use it
    if (alias && !usedAliases.has(alias)) {
      usedAliases.add(alias)
      aliasMap.set(tableName, alias)
      return
    }

    // Generate smart alias
    let baseAlias = tableName.substring(0, 1).toLowerCase()
    alias = baseAlias

    // If already used, try first 2 letters, then 3, etc.
    let counter = 2
    while (usedAliases.has(alias)) {
      if (counter <= tableName.length) {
        alias = tableName.substring(0, counter).toLowerCase()
        counter++
      } else {
        // If table name exhausted, add numbers
        alias = baseAlias + (usedAliases.size + 1)
        break
      }
    }

    usedAliases.add(alias)
    aliasMap.set(tableName, alias)
  })

  return aliasMap
}
