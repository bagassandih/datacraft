import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { generateUniqueAliases } from '@/utils/aliasGenerator'

const SESSION_KEY = 'datacraft_session'

export const useCraftStore = defineStore('craft', () => {
  // State
  const dbConnection = ref(null)
  const schema = ref({ tables: [], relationships: [] })
  const nodes = ref([])
  const edges = ref([])
  const generatedQuery = ref('')
  const queryResults = ref(null)
  const filters = ref([]) // Deprecated: use queryClauses instead
  const queryClauses = ref({
    filters: [],
    orderBy: [],
    groupBy: [],
    having: []
  })
  const loading = ref(false)
  const error = ref(null)

  // Debounced session save to avoid blocking during drag
  let saveTimer = null
  const debouncedSaveSession = () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveSession()
    }, 500) // Save 500ms after last change
  }

  // Watch for changes and save to session storage (debounced)
  watch(
    [dbConnection, schema, edges, queryClauses],
    () => {
      debouncedSaveSession()
    },
    { deep: true }
  )

  // Separate watcher for nodes - only watch length to avoid position change triggers
  watch(
    () => nodes.value.length,
    () => {
      debouncedSaveSession()
    }
  )

  // Getters
  const isConnected = computed(() => dbConnection.value !== null)
  const hasSchema = computed(() => schema.value.tables.length > 0)
  const hasNodes = computed(() => nodes.value.length > 0)

  // Actions
  function setConnection(config) {
    dbConnection.value = config
  }

  function clearConnection() {
    dbConnection.value = null
    schema.value = { tables: [], relationships: [] }
    nodes.value = []
    edges.value = []
    filters.value = []
    queryClauses.value = { filters: [], orderBy: [], groupBy: [], having: [] }
    generatedQuery.value = ''
    queryResults.value = null
    clearSession()
  }

  function setSchema(data) {
    schema.value = data
    // Update existing nodes with new schema data (including collation info)
    updateNodesWithSchema()
  }

  // Update existing nodes with current schema data
  function updateNodesWithSchema() {
    if (!schema.value.tables || schema.value.tables.length === 0) return

    // Create new array to trigger reactivity
    nodes.value = nodes.value.map(node => {
      const schemaTable = schema.value.tables.find(t => t.name === node.data.table)
      if (schemaTable) {
        // Update columns with new schema data (preserves selectedColumns)
        return {
          ...node,
          data: {
            ...node.data,
            columns: schemaTable.columns
          }
        }
      }
      return node
    })

    // Also update edges to detect collation mismatches
    updateEdgesCollationInfo()
  }

  // Update edges with collation mismatch info based on current node data
  function updateEdgesCollationInfo() {
    // Create new array to trigger reactivity
    edges.value = edges.value.map(edge => {
      if (!edge.data?.sourceColumn || !edge.data?.targetColumn) return edge

      const sourceNode = nodes.value.find(n => n.id === edge.source)
      const targetNode = nodes.value.find(n => n.id === edge.target)

      if (!sourceNode || !targetNode) return edge

      const sourceColInfo = sourceNode.data.columns?.find(c => c.name === edge.data.sourceColumn)
      const targetColInfo = targetNode.data.columns?.find(c => c.name === edge.data.targetColumn)

      if (sourceColInfo?.collation && targetColInfo?.collation) {
        const hasMismatch = sourceColInfo.collation !== targetColInfo.collation
        return {
          ...edge,
          data: {
            ...edge.data,
            hasCollationMismatch: hasMismatch,
            sourceCollation: sourceColInfo.collation,
            targetCollation: targetColInfo.collation
          }
        }
      }

      return edge
    })
  }

  // Store viewport state
  const viewport = ref({ x: 0, y: 0, zoom: 1 })
  const pendingViewportRestore = ref(null) // Used when importing to signal viewport restoration

  function setViewport(vp) {
    viewport.value = vp
  }

  function clearPendingViewportRestore() {
    pendingViewportRestore.value = null
  }

  function addNode(node) {
    nodes.value.push(node)
    updateAliases()
  }

  // Add node at viewport center
  function addNodeAtViewportCenter(nodeData) {
    // Calculate center position based on current viewport
    // Viewport dimensions (approximate canvas center)
    const canvasWidth = window.innerWidth * 0.6 // Approximate canvas width
    const canvasHeight = window.innerHeight

    // Convert screen center to canvas coordinates
    const centerX = (canvasWidth / 2 - viewport.value.x) / viewport.value.zoom
    const centerY = (canvasHeight / 2 - viewport.value.y) / viewport.value.zoom

    const node = {
      ...nodeData,
      position: { x: centerX, y: centerY }
    }

    addNode(node)
  }

  function removeNode(nodeId) {
    nodes.value = nodes.value.filter(n => n.id !== nodeId)
    // Also remove edges connected to this node
    edges.value = edges.value.filter(
      e => e.source !== nodeId && e.target !== nodeId
    )
    updateAliases()
  }

  function updateNode(nodeId, updates) {
    const index = nodes.value.findIndex(n => n.id === nodeId)
    if (index !== -1) {
      nodes.value[index] = { ...nodes.value[index], ...updates }
    }
  }

  function setNodes(newNodes) {
    nodes.value = newNodes
    updateAliases()
    // Trigger debounced save for position updates
    debouncedSaveSession()
  }

  function addEdge(edge) {
    edges.value.push(edge)
  }

  function removeEdge(edgeId) {
    edges.value = edges.value.filter(e => e.id !== edgeId)
  }

  function updateEdge(edgeId, updates) {
    const index = edges.value.findIndex(e => e.id === edgeId)
    if (index !== -1) {
      edges.value[index] = { ...edges.value[index], ...updates }
    }
  }

  function setEdges(newEdges) {
    edges.value = newEdges
  }

  function setGeneratedQuery(query) {
    generatedQuery.value = query
  }

  function setQueryResults(results) {
    queryResults.value = results
  }

  function setFilters(newFilters) {
    filters.value = newFilters
  }

  function setQueryClauses(clauses) {
    queryClauses.value = clauses
  }

  function setLoading(status) {
    loading.value = status
  }

  function setError(err) {
    error.value = err
  }

  function clearError() {
    error.value = null
  }

  // Reset canvas
  function resetCanvas() {
    nodes.value = []
    edges.value = []
    filters.value = []
    queryClauses.value = { filters: [], orderBy: [], groupBy: [], having: [] }
    generatedQuery.value = ''
    queryResults.value = null
  }

  // Session storage functions
  function saveSession() {
    if (dbConnection.value) {
      const session = {
        dbConnection: dbConnection.value,
        schema: schema.value,
        nodes: nodes.value,
        edges: edges.value,
        queryClauses: queryClauses.value
      }
      localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    }
  }

  function loadSession() {
    const saved = localStorage.getItem(SESSION_KEY)
    if (saved) {
      try {
        const session = JSON.parse(saved)
        dbConnection.value = session.dbConnection
        schema.value = session.schema || { tables: [], relationships: [] }
        nodes.value = session.nodes || []
        edges.value = session.edges || []
        queryClauses.value = session.queryClauses || { filters: [], orderBy: [], groupBy: [], having: [] }
        // Backward compatibility
        if (!session.queryClauses && session.filters) {
          queryClauses.value.filters = session.filters
        }
        updateAliases() // Update aliases after loading
        return true
      } catch (error) {
        console.error('Failed to load session:', error)
        return false
      }
    }
    return false
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY)
  }

  // Update aliases for all nodes
  function updateAliases() {
    const aliasMap = generateUniqueAliases(nodes.value)
    nodes.value.forEach(node => {
      if (node.id) {
        node.data.alias = aliasMap.get(node.id)
      }
    })
  }

  // Update a specific node's alias
  function updateNodeAlias(nodeId, newAlias) {
    const nodeIndex = nodes.value.findIndex(n => n.id === nodeId)
    if (nodeIndex !== -1) {
      // Set the custom alias
      nodes.value[nodeIndex].data.alias = newAlias
      // Regenerate all aliases to ensure uniqueness
      updateAliases()
    }
  }

  // Export craft to JSON file
  function exportCraft() {
    const craftData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      craft: {
        nodes: nodes.value,
        edges: edges.value,
        queryClauses: queryClauses.value,
        viewport: viewport.value
      }
    }

    const json = JSON.stringify(craftData, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = `datacraft_${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    return true
  }

  // Import craft from JSON file
  function importCraft(craftData) {
    try {
      // Validate the craft data structure
      if (!craftData || !craftData.craft) {
        throw new Error('Invalid craft file format')
      }

      const craft = craftData.craft

      // Validate required fields exist
      if (!Array.isArray(craft.nodes)) {
        throw new Error('Invalid craft file: missing nodes')
      }

      // Validate nodes have required properties
      for (const node of craft.nodes) {
        if (!node.id || !node.position || !node.data || !node.data.table) {
          throw new Error('Invalid craft file: node missing required properties')
        }
      }

      // Check if tables exist in current schema
      const schemaTableNames = schema.value.tables.map(t => t.name)
      const missingTables = []

      for (const node of craft.nodes) {
        if (!schemaTableNames.includes(node.data.table)) {
          missingTables.push(node.data.table)
        }
      }

      if (missingTables.length > 0) {
        throw new Error(`Tables not found in database: ${missingTables.join(', ')}`)
      }

      // Update nodes with current schema columns
      const updatedNodes = craft.nodes.map(node => {
        const schemaTable = schema.value.tables.find(t => t.name === node.data.table)
        return {
          ...node,
          data: {
            ...node.data,
            columns: schemaTable ? schemaTable.columns : node.data.columns
          }
        }
      })

      // Load the craft state
      nodes.value = updatedNodes
      edges.value = craft.edges || []
      queryClauses.value = craft.queryClauses || { filters: [], orderBy: [], groupBy: [], having: [] }
      if (craft.viewport) {
        viewport.value = craft.viewport
      }

      // Update aliases after import
      updateAliases()

      // Update edges with collation mismatch info based on current schema
      updateEdgesCollationInfo()

      // Clear previous query results
      generatedQuery.value = ''
      queryResults.value = null

      // Set pending viewport restore so CanvasCraft can apply it
      if (craft.viewport) {
        pendingViewportRestore.value = craft.viewport
      }

      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  return {
    // State
    dbConnection,
    schema,
    nodes,
    edges,
    generatedQuery,
    queryResults,
    filters,
    queryClauses,
    loading,
    error,
    viewport,
    pendingViewportRestore,

    // Getters
    isConnected,
    hasSchema,
    hasNodes,

    // Actions
    setConnection,
    clearConnection,
    setSchema,
    setViewport,
    clearPendingViewportRestore,
    addNode,
    addNodeAtViewportCenter,
    removeNode,
    updateNode,
    setNodes,
    addEdge,
    removeEdge,
    updateEdge,
    setEdges,
    setGeneratedQuery,
    setQueryResults,
    setFilters,
    setQueryClauses,
    setLoading,
    setError,
    clearError,
    resetCanvas,
    saveSession,
    loadSession,
    clearSession,
    updateNodeAlias,
    exportCraft,
    importCraft
  }
})
