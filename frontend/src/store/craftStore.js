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

  // Watch for changes and save to session storage
  watch(
    [dbConnection, schema, nodes, edges, queryClauses],
    () => {
      saveSession()
    },
    { deep: true }
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
  }

  function addNode(node) {
    nodes.value.push(node)
    updateAliases()
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
      if (node.data?.table) {
        node.data.alias = aliasMap.get(node.data.table)
      }
    })
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

    // Getters
    isConnected,
    hasSchema,
    hasNodes,

    // Actions
    setConnection,
    clearConnection,
    setSchema,
    addNode,
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
    clearSession
  }
})
