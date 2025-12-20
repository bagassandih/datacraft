import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useCraftStore } from './craftStore'

const ERD_SESSION_KEY = 'datacraft_erd_session'

// BSI UII Standard columns template
const BSI_UII_COLUMNS = [
  { name: 'id', type: 'BIGINT UNSIGNED', length: null, nullable: false, defaultValue: 'uuid_short()', isPrimaryKey: true, isAutoIncrement: false },
  { name: 'uuid', type: 'VARCHAR', length: 255, nullable: false, defaultValue: 'uuid()', isPrimaryKey: false, isAutoIncrement: false },
  { name: 'user_input', type: 'VARCHAR', length: 125, nullable: true, defaultValue: null, isPrimaryKey: false, isAutoIncrement: false },
  { name: 'user_update', type: 'VARCHAR', length: 125, nullable: true, defaultValue: null, isPrimaryKey: false, isAutoIncrement: false },
  { name: 'tgl_input', type: 'DATETIME', length: null, nullable: false, defaultValue: 'CURRENT_TIMESTAMP', isPrimaryKey: false, isAutoIncrement: false },
  { name: 'tgl_update', type: 'DATETIME', length: null, nullable: false, defaultValue: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP', isPrimaryKey: false, isAutoIncrement: false },
  { name: 'flag_aktif', type: 'INT', length: null, nullable: false, defaultValue: '1', isPrimaryKey: false, isAutoIncrement: false },
  { name: 'flag_delete', type: 'INT', length: null, nullable: false, defaultValue: '0', isPrimaryKey: false, isAutoIncrement: false }
]

export const useErdStore = defineStore('erd', () => {
  const craftStore = useCraftStore()

  // State
  const tables = ref([]) // ERD tables with columns
  const relationships = ref([]) // Relations between tables
  const nodes = ref([]) // Vue Flow nodes
  const edges = ref([]) // Vue Flow edges
  const viewport = ref({ x: 0, y: 0, zoom: 1 })
  const standardization = ref('none') // 'none' or 'bsi_uii'
  const loading = ref(false)
  const error = ref(null)

  // Track executed tables - stores original state at time of execution
  // Key: tableId, Value: { name, columns: [...] }
  const executedTables = ref({})

  // Debounced session save
  let saveTimer = null
  const debouncedSaveSession = () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveSession()
    }, 500)
  }

  // Watch for changes and save to session storage
  watch(
    [tables, relationships, edges, standardization, executedTables],
    () => {
      debouncedSaveSession()
    },
    { deep: true }
  )

  watch(
    () => nodes.value.length,
    () => {
      debouncedSaveSession()
    }
  )

  // Getters
  const isConnected = computed(() => craftStore.isConnected)
  const dbConnection = computed(() => craftStore.dbConnection)
  const hasTables = computed(() => tables.value.length > 0)

  // Generate unique table ID
  function generateTableId() {
    return `table_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Generate unique column ID
  function generateColumnId() {
    return `col_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Create a new table
  function createTable(name, useStandardColumns = false) {
    const tableId = generateTableId()

    let columns = []
    if (useStandardColumns && standardization.value === 'bsi_uii') {
      columns = BSI_UII_COLUMNS.map(col => ({
        ...col,
        id: generateColumnId()
      }))
    }

    const table = {
      id: tableId,
      name: name,
      columns: columns
    }

    tables.value.push(table)

    // Create node for Vue Flow
    const node = {
      id: tableId,
      type: 'erdTable',
      position: { x: 100 + (nodes.value.length * 50), y: 100 + (nodes.value.length * 30) },
      data: {
        table: name,
        tableId: tableId,
        columns: columns
      }
    }
    nodes.value.push(node)

    return tableId
  }

  // Add table at specific position
  function addTableAtPosition(name, position, useStandardColumns = false) {
    const tableId = generateTableId()

    let columns = []
    if (useStandardColumns && standardization.value === 'bsi_uii') {
      columns = BSI_UII_COLUMNS.map(col => ({
        ...col,
        id: generateColumnId()
      }))
    }

    const table = {
      id: tableId,
      name: name,
      columns: columns
    }

    tables.value.push(table)

    const node = {
      id: tableId,
      type: 'erdTable',
      position: position,
      data: {
        table: name,
        tableId: tableId,
        columns: columns
      }
    }
    nodes.value.push(node)

    return tableId
  }

  // Update table name
  function updateTableName(tableId, newName) {
    const tableIndex = tables.value.findIndex(t => t.id === tableId)
    if (tableIndex !== -1) {
      tables.value[tableIndex] = { ...tables.value[tableIndex], name: newName }
    }

    // Create new nodes array to trigger reactivity
    nodes.value = nodes.value.map(n => {
      if (n.id === tableId) {
        return {
          ...n,
          data: { ...n.data, table: newName }
        }
      }
      return n
    })
  }

  // Remove table
  function removeTable(tableId) {
    tables.value = tables.value.filter(t => t.id !== tableId)
    nodes.value = nodes.value.filter(n => n.id !== tableId)

    // Remove related relationships and edges
    relationships.value = relationships.value.filter(
      r => r.sourceTable !== tableId && r.targetTable !== tableId
    )
    edges.value = edges.value.filter(
      e => e.source !== tableId && e.target !== tableId
    )

    // Clear executed state for this table
    clearExecutedTable(tableId)
  }

  // Add column to table
  function addColumn(tableId, column) {
    const tableIndex = tables.value.findIndex(t => t.id === tableId)
    if (tableIndex !== -1) {
      const newColumn = {
        ...column,
        id: column.id || generateColumnId()
      }
      const updatedColumns = [...tables.value[tableIndex].columns, newColumn]
      tables.value[tableIndex] = { ...tables.value[tableIndex], columns: updatedColumns }

      // Create new nodes array to trigger reactivity
      nodes.value = nodes.value.map(n => {
        if (n.id === tableId) {
          return {
            ...n,
            data: { ...n.data, columns: updatedColumns }
          }
        }
        return n
      })
    }
  }

  // Update column
  function updateColumn(tableId, columnId, updates) {
    const tableIndex = tables.value.findIndex(t => t.id === tableId)
    if (tableIndex !== -1) {
      const table = tables.value[tableIndex]
      const colIndex = table.columns.findIndex(c => c.id === columnId)
      if (colIndex !== -1) {
        const updatedColumns = table.columns.map((col, idx) =>
          idx === colIndex ? { ...col, ...updates } : col
        )
        tables.value[tableIndex] = { ...table, columns: updatedColumns }

        // Create new nodes array to trigger reactivity
        nodes.value = nodes.value.map(n => {
          if (n.id === tableId) {
            return {
              ...n,
              data: { ...n.data, columns: updatedColumns }
            }
          }
          return n
        })
      }
    }
  }

  // Remove column
  function removeColumn(tableId, columnId) {
    const tableIndex = tables.value.findIndex(t => t.id === tableId)
    if (tableIndex !== -1) {
      const updatedColumns = tables.value[tableIndex].columns.filter(c => c.id !== columnId)
      tables.value[tableIndex] = { ...tables.value[tableIndex], columns: updatedColumns }

      // Create new nodes array to trigger reactivity
      nodes.value = nodes.value.map(n => {
        if (n.id === tableId) {
          return {
            ...n,
            data: { ...n.data, columns: updatedColumns }
          }
        }
        return n
      })

      // Remove related relationships
      relationships.value = relationships.value.filter(
        r => !(r.sourceTable === tableId && r.sourceColumn === columnId) &&
             !(r.targetTable === tableId && r.targetColumn === columnId)
      )
    }
  }

  // Add relationship between tables
  function addRelationship(relationship) {
    const rel = {
      id: `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...relationship
    }
    relationships.value.push(rel)

    // Create edge for Vue Flow
    const edge = {
      id: rel.id,
      source: relationship.sourceTable,
      target: relationship.targetTable,
      sourceHandle: `${relationship.sourceTable}-${relationship.sourceColumn}-source`,
      targetHandle: `${relationship.targetTable}-${relationship.targetColumn}-target`,
      type: 'smoothstep',
      animated: false,
      data: {
        relationType: relationship.relationType, // '1:1', '1:N', 'N:M'
        sourceColumn: relationship.sourceColumn,
        targetColumn: relationship.targetColumn,
        onDelete: relationship.onDelete || 'NO ACTION',
        onUpdate: relationship.onUpdate || 'NO ACTION'
      }
    }
    edges.value.push(edge)

    return rel.id
  }

  // Update relationship
  function updateRelationship(relationshipId, updates) {
    const relIndex = relationships.value.findIndex(r => r.id === relationshipId)
    if (relIndex !== -1) {
      relationships.value[relIndex] = { ...relationships.value[relIndex], ...updates }
    }

    const edgeIndex = edges.value.findIndex(e => e.id === relationshipId)
    if (edgeIndex !== -1) {
      edges.value[edgeIndex] = {
        ...edges.value[edgeIndex],
        data: { ...edges.value[edgeIndex].data, ...updates }
      }
    }
  }

  // Remove relationship
  function removeRelationship(relationshipId) {
    relationships.value = relationships.value.filter(r => r.id !== relationshipId)
    edges.value = edges.value.filter(e => e.id !== relationshipId)
  }

  // Set nodes (from Vue Flow)
  function setNodes(newNodes) {
    nodes.value = newNodes
    debouncedSaveSession()
  }

  // Set edges (from Vue Flow)
  function setEdges(newEdges) {
    edges.value = newEdges
  }

  // Set viewport
  function setViewport(vp) {
    viewport.value = vp
  }

  // Set standardization
  function setStandardization(std) {
    standardization.value = std
  }

  // Apply BSI UII columns to a table (add new or update existing)
  function applyBsiUiiColumns(tableId) {
    const tableIndex = tables.value.findIndex(t => t.id === tableId)
    if (tableIndex === -1) return

    const table = tables.value[tableIndex]

    BSI_UII_COLUMNS.forEach(bsiCol => {
      const existingColIndex = table.columns.findIndex(c => c.name === bsiCol.name)

      if (existingColIndex === -1) {
        // Column doesn't exist, add it
        addColumn(tableId, { ...bsiCol })
      } else {
        // Column exists, update it to match BSI UII template
        const existingCol = table.columns[existingColIndex]
        // Only update if type or other properties differ
        if (existingCol.type !== bsiCol.type ||
            existingCol.defaultValue !== bsiCol.defaultValue ||
            existingCol.nullable !== bsiCol.nullable ||
            existingCol.isPrimaryKey !== bsiCol.isPrimaryKey) {
          updateColumn(tableId, existingCol.id, {
            type: bsiCol.type,
            length: bsiCol.length,
            nullable: bsiCol.nullable,
            defaultValue: bsiCol.defaultValue,
            isPrimaryKey: bsiCol.isPrimaryKey,
            isAutoIncrement: bsiCol.isAutoIncrement
          })
        }
      }
    })
  }

  // Update all tables with BSI UII columns to latest template
  function updateAllBsiUiiColumns() {
    tables.value.forEach(table => {
      // Check if table has any BSI UII columns
      const hasBsiColumns = table.columns.some(col =>
        BSI_UII_COLUMNS.some(bsi => bsi.name === col.name)
      )
      if (hasBsiColumns) {
        applyBsiUiiColumns(table.id)
      }
    })
  }

  // Mark a single table as executed (stores original state)
  function markTableAsExecuted(tableId) {
    const table = tables.value.find(t => t.id === tableId)
    if (table) {
      executedTables.value = {
        ...executedTables.value,
        [tableId]: {
          name: table.name,
          columns: JSON.parse(JSON.stringify(table.columns)) // Deep clone
        }
      }
    }
  }

  // Mark all current tables as executed
  function markAllTablesAsExecuted() {
    const executed = {}
    tables.value.forEach(table => {
      executed[table.id] = {
        name: table.name,
        columns: JSON.parse(JSON.stringify(table.columns)) // Deep clone
      }
    })
    executedTables.value = executed
  }

  // Check if a table has been executed
  function isTableExecuted(tableId) {
    return !!executedTables.value[tableId]
  }

  // Clear executed state for a table (e.g., when table is removed)
  function clearExecutedTable(tableId) {
    if (executedTables.value[tableId]) {
      const { [tableId]: removed, ...rest } = executedTables.value
      executedTables.value = rest
    }
  }

  // Generate SQL statements (CREATE for new tables, ALTER for modified tables)
  function generateSQL() {
    const craftStore = useCraftStore()
    const dbClient = craftStore.dbConnection?.client || 'mysql2'

    let sql = ''
    const createStatements = []
    const alterStatements = []

    // Process each table
    tables.value.forEach(table => {
      const originalTable = executedTables.value[table.id]

      if (!originalTable) {
        // New table - generate CREATE TABLE
        createStatements.push(generateCreateTableSQL(table, dbClient))
      } else {
        // Existing table - check for modifications
        const alterSQL = generateAlterTableSQL(table, originalTable, dbClient)
        if (alterSQL.trim()) {
          alterStatements.push(alterSQL)
        }
      }
    })

    // Add CREATE statements first
    if (createStatements.length > 0) {
      sql += '-- CREATE NEW TABLES\n'
      sql += createStatements.join('\n\n')
      sql += '\n\n'
    }

    // Add ALTER statements
    if (alterStatements.length > 0) {
      sql += '-- ALTER EXISTING TABLES\n'
      sql += alterStatements.join('\n\n')
      sql += '\n\n'
    }

    // Generate ALTER TABLE for foreign keys (only for new tables)
    const newTableIds = tables.value
      .filter(t => !executedTables.value[t.id])
      .map(t => t.id)

    const newRelationships = relationships.value.filter(
      rel => newTableIds.includes(rel.sourceTable)
    )

    if (newRelationships.length > 0) {
      sql += '-- ADD FOREIGN KEYS\n'
      newRelationships.forEach(rel => {
        sql += generateForeignKeySQL(rel, dbClient)
        sql += '\n'
      })
    }

    return sql.trim()
  }

  function generateCreateTableSQL(table, dbClient) {
    const isMySQL = dbClient === 'mysql2'
    const quote = isMySQL ? '`' : '"'

    let sql = `CREATE TABLE ${quote}${table.name}${quote} (\n`

    const columnDefs = []
    const primaryKeys = []

    table.columns.forEach(col => {
      // Get base type (without UNSIGNED)
      const baseType = col.type.toUpperCase().replace(' UNSIGNED', '')
      let colDef = `  ${quote}${col.name}${quote} ${col.type}`

      // Only add length for types that support it
      const typesWithLength = ['VARCHAR', 'CHAR', 'DECIMAL', 'NUMERIC']
      if (col.length && typesWithLength.includes(baseType)) {
        colDef += `(${col.length})`
      }

      if (!col.nullable) {
        colDef += ' NOT NULL'
      }

      if (col.defaultValue) {
        // Handle special default values
        if (col.defaultValue === 'CURRENT_TIMESTAMP' ||
            col.defaultValue === 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') {
          colDef += ` DEFAULT ${col.defaultValue}`
        } else if (col.defaultValue === 'uuid()' || col.defaultValue === 'uuid_short()') {
          // MySQL 8.0.13+ requires expression defaults in parentheses
          if (isMySQL) {
            colDef += ` DEFAULT (${col.defaultValue})`
          } else {
            // PostgreSQL uses gen_random_uuid()
            colDef += ` DEFAULT gen_random_uuid()`
          }
        } else if (col.defaultValue === 'NULL') {
          colDef += ` DEFAULT NULL`
        } else {
          colDef += ` DEFAULT ${col.defaultValue}`
        }
      }

      if (col.isAutoIncrement) {
        colDef += isMySQL ? ' AUTO_INCREMENT' : ' GENERATED ALWAYS AS IDENTITY'
      }

      if (col.isPrimaryKey) {
        primaryKeys.push(col.name)
      }

      columnDefs.push(colDef)
    })

    sql += columnDefs.join(',\n')

    if (primaryKeys.length > 0) {
      sql += `,\n  PRIMARY KEY (${primaryKeys.map(pk => `${quote}${pk}${quote}`).join(', ')})`
    }

    sql += '\n)'

    if (isMySQL) {
      sql += ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
    }

    sql += ';'

    return sql
  }

  function generateForeignKeySQL(rel, dbClient) {
    const isMySQL = dbClient === 'mysql2'
    const quote = isMySQL ? '`' : '"'

    const sourceTable = tables.value.find(t => t.id === rel.sourceTable)
    const targetTable = tables.value.find(t => t.id === rel.targetTable)
    const sourceColumn = sourceTable?.columns.find(c => c.id === rel.sourceColumn)
    const targetColumn = targetTable?.columns.find(c => c.id === rel.targetColumn)

    if (!sourceTable || !targetTable || !sourceColumn || !targetColumn) {
      return ''
    }

    // Auto-detect correct FK direction:
    // FK should be on the non-PK column, referencing the PK column
    let fkTable, fkColumn, pkTable, pkColumn

    if (targetColumn.isPrimaryKey && !sourceColumn.isPrimaryKey) {
      // Correct direction: source (FK) -> target (PK)
      fkTable = sourceTable
      fkColumn = sourceColumn
      pkTable = targetTable
      pkColumn = targetColumn
    } else if (sourceColumn.isPrimaryKey && !targetColumn.isPrimaryKey) {
      // Reversed direction: swap them
      // source (PK) -> target (FK) becomes target (FK) -> source (PK)
      fkTable = targetTable
      fkColumn = targetColumn
      pkTable = sourceTable
      pkColumn = sourceColumn
    } else {
      // Both are PK or neither is PK - use original direction
      fkTable = sourceTable
      fkColumn = sourceColumn
      pkTable = targetTable
      pkColumn = targetColumn
    }

    const constraintName = `fk_${fkTable.name}_${fkColumn.name}`

    let sql = `ALTER TABLE ${quote}${fkTable.name}${quote}\n`
    sql += `  ADD CONSTRAINT ${quote}${constraintName}${quote}\n`
    sql += `  FOREIGN KEY (${quote}${fkColumn.name}${quote})\n`
    sql += `  REFERENCES ${quote}${pkTable.name}${quote} (${quote}${pkColumn.name}${quote})`

    if (rel.onDelete && rel.onDelete !== 'NO ACTION') {
      sql += `\n  ON DELETE ${rel.onDelete}`
    }
    if (rel.onUpdate && rel.onUpdate !== 'NO ACTION') {
      sql += `\n  ON UPDATE ${rel.onUpdate}`
    }

    sql += ';'

    return sql
  }

  // Generate ALTER TABLE statements for modified tables
  function generateAlterTableSQL(table, originalTable, dbClient) {
    const isMySQL = dbClient === 'mysql2'
    const quote = isMySQL ? '`' : '"'
    const statements = []

    // Check for table rename
    if (table.name !== originalTable.name) {
      if (isMySQL) {
        statements.push(`RENAME TABLE ${quote}${originalTable.name}${quote} TO ${quote}${table.name}${quote};`)
      } else {
        statements.push(`ALTER TABLE ${quote}${originalTable.name}${quote} RENAME TO ${quote}${table.name}${quote};`)
      }
    }

    // Use current table name for subsequent ALTER statements
    const tableName = table.name

    // Build maps for column comparison
    const originalColsById = {}
    const originalColsByName = {}
    originalTable.columns.forEach(col => {
      originalColsById[col.id] = col
      originalColsByName[col.name] = col
    })

    const currentColsById = {}
    table.columns.forEach(col => {
      currentColsById[col.id] = col
    })

    // Find dropped columns (exist in original but not in current)
    originalTable.columns.forEach(origCol => {
      if (!currentColsById[origCol.id]) {
        statements.push(`ALTER TABLE ${quote}${tableName}${quote} DROP COLUMN ${quote}${origCol.name}${quote};`)
      }
    })

    // Find added and modified columns
    table.columns.forEach(col => {
      const origCol = originalColsById[col.id]

      if (!origCol) {
        // New column - ADD COLUMN (includeName = true)
        const colDef = generateColumnDefinition(col, isMySQL, quote, true)
        statements.push(`ALTER TABLE ${quote}${tableName}${quote} ADD COLUMN ${colDef};`)
      } else {
        // Check if column was modified
        const isModified = isColumnModified(col, origCol)
        const isRenamed = col.name !== origCol.name

        if (isRenamed && isMySQL) {
          // MySQL: Use CHANGE COLUMN for rename with possible modification
          const colDef = generateColumnDefinition(col, isMySQL, quote, true)
          statements.push(`ALTER TABLE ${quote}${tableName}${quote} CHANGE COLUMN ${quote}${origCol.name}${quote} ${colDef};`)
        } else if (isRenamed) {
          // PostgreSQL: Use RENAME COLUMN
          statements.push(`ALTER TABLE ${quote}${tableName}${quote} RENAME COLUMN ${quote}${origCol.name}${quote} TO ${quote}${col.name}${quote};`)
          if (isModified) {
            // Separate ALTER for type change in PostgreSQL
            const colDef = generateColumnDefinition(col, isMySQL, quote, true)
            statements.push(`ALTER TABLE ${quote}${tableName}${quote} ALTER COLUMN ${colDef};`)
          }
        } else if (isModified) {
          // Column modified but not renamed
          if (isMySQL) {
            const colDef = generateColumnDefinition(col, isMySQL, quote, true)
            statements.push(`ALTER TABLE ${quote}${tableName}${quote} MODIFY COLUMN ${colDef};`)
          } else {
            // PostgreSQL ALTER COLUMN is more complex
            const colDef = generateColumnDefinition(col, isMySQL, quote, true)
            statements.push(`ALTER TABLE ${quote}${tableName}${quote} ALTER COLUMN ${colDef};`)
          }
        }
      }
    })

    return statements.join('\n')
  }

  // Generate column definition for ALTER statements
  function generateColumnDefinition(col, isMySQL, quote, includeName = false) {
    const baseType = col.type.toUpperCase().replace(' UNSIGNED', '')
    let colDef = includeName ? `${quote}${col.name}${quote} ` : ''
    colDef += col.type

    // Only add length for types that support it
    const typesWithLength = ['VARCHAR', 'CHAR', 'DECIMAL', 'NUMERIC']
    if (col.length && typesWithLength.includes(baseType)) {
      colDef += `(${col.length})`
    }

    if (!col.nullable) {
      colDef += ' NOT NULL'
    }

    if (col.defaultValue) {
      if (col.defaultValue === 'CURRENT_TIMESTAMP' ||
          col.defaultValue === 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP') {
        colDef += ` DEFAULT ${col.defaultValue}`
      } else if (col.defaultValue === 'uuid()' || col.defaultValue === 'uuid_short()') {
        if (isMySQL) {
          colDef += ` DEFAULT (${col.defaultValue})`
        } else {
          colDef += ` DEFAULT gen_random_uuid()`
        }
      } else if (col.defaultValue === 'NULL') {
        colDef += ` DEFAULT NULL`
      } else {
        colDef += ` DEFAULT ${col.defaultValue}`
      }
    }

    if (col.isAutoIncrement) {
      colDef += isMySQL ? ' AUTO_INCREMENT' : ' GENERATED ALWAYS AS IDENTITY'
    }

    return colDef
  }

  // Check if column has been modified
  function isColumnModified(currentCol, originalCol) {
    return (
      currentCol.type !== originalCol.type ||
      currentCol.length !== originalCol.length ||
      currentCol.nullable !== originalCol.nullable ||
      currentCol.defaultValue !== originalCol.defaultValue ||
      currentCol.isPrimaryKey !== originalCol.isPrimaryKey ||
      currentCol.isAutoIncrement !== originalCol.isAutoIncrement
    )
  }

  // Export ERD to JSON
  function exportERD() {
    const erdData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      standardization: standardization.value,
      erd: {
        tables: tables.value,
        relationships: relationships.value,
        nodes: nodes.value,
        edges: edges.value,
        viewport: viewport.value
      }
    }

    const json = JSON.stringify(erdData, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = `datacraft_erd_${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    return true
  }

  // Import ERD from JSON
  function importERD(erdData) {
    try {
      if (!erdData || !erdData.erd) {
        throw new Error('Invalid ERD file format')
      }

      const erd = erdData.erd

      tables.value = erd.tables || []
      relationships.value = erd.relationships || []
      nodes.value = erd.nodes || []
      edges.value = erd.edges || []
      standardization.value = erdData.standardization || 'none'

      if (erd.viewport) {
        viewport.value = erd.viewport
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  // Export SQL file
  function exportSQL() {
    const sql = generateSQL()
    const blob = new Blob([sql], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = `datacraft_schema_${new Date().toISOString().slice(0, 10)}.sql`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    return true
  }

  // Session storage functions
  function saveSession() {
    const session = {
      tables: tables.value,
      relationships: relationships.value,
      nodes: nodes.value,
      edges: edges.value,
      viewport: viewport.value,
      standardization: standardization.value,
      executedTables: executedTables.value
    }
    localStorage.setItem(ERD_SESSION_KEY, JSON.stringify(session))
  }

  function loadSession() {
    const saved = localStorage.getItem(ERD_SESSION_KEY)
    if (saved) {
      try {
        const session = JSON.parse(saved)
        tables.value = session.tables || []
        relationships.value = session.relationships || []
        nodes.value = session.nodes || []
        edges.value = session.edges || []
        viewport.value = session.viewport || { x: 0, y: 0, zoom: 1 }
        standardization.value = session.standardization || 'none'
        executedTables.value = session.executedTables || {}

        // Auto-update BSI UII columns to latest template if standardization is enabled
        if (standardization.value === 'bsi_uii') {
          updateAllBsiUiiColumns()
        }

        return true
      } catch (error) {
        console.error('Failed to load ERD session:', error)
        return false
      }
    }
    return false
  }

  function clearSession() {
    localStorage.removeItem(ERD_SESSION_KEY)
  }

  // Reset canvas
  function resetCanvas() {
    tables.value = []
    relationships.value = []
    nodes.value = []
    edges.value = []
    viewport.value = { x: 0, y: 0, zoom: 1 }
    executedTables.value = {}
    clearSession()
  }

  // Set loading state
  function setLoading(status) {
    loading.value = status
  }

  // Set error
  function setError(err) {
    error.value = err
  }

  function clearError() {
    error.value = null
  }

  return {
    // State
    tables,
    relationships,
    nodes,
    edges,
    viewport,
    standardization,
    loading,
    error,
    executedTables,

    // Getters
    isConnected,
    dbConnection,
    hasTables,

    // Constants
    BSI_UII_COLUMNS,

    // Actions
    generateTableId,
    generateColumnId,
    createTable,
    addTableAtPosition,
    updateTableName,
    removeTable,
    addColumn,
    updateColumn,
    removeColumn,
    addRelationship,
    updateRelationship,
    removeRelationship,
    setNodes,
    setEdges,
    setViewport,
    setStandardization,
    applyBsiUiiColumns,
    updateAllBsiUiiColumns,
    markTableAsExecuted,
    markAllTablesAsExecuted,
    isTableExecuted,
    clearExecutedTable,
    generateSQL,
    exportERD,
    importERD,
    exportSQL,
    saveSession,
    loadSession,
    clearSession,
    resetCanvas,
    setLoading,
    setError,
    clearError
  }
})
