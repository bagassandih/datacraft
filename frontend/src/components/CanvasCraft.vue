<template>
  <div class="canvas-container">
    <div class="canvas-toolbar">
      <div class="toolbar-content">
        <h2>Query Canvas</h2>
        <div class="toolbar-hint">
          <span class="hint-text">💡 Tip: Click connection line to edit join type or delete</span>
        </div>
      </div>
      <n-space>
        <n-button @click="clearCanvas">Clear Canvas</n-button>
      </n-space>
    </div>

    <VueFlow
      v-model:nodes="nodes"
      :edges="styledEdges"
      class="vue-flow-container"
      :default-viewport="{ zoom: 1 }"
      :min-zoom="0.5"
      :max-zoom="2"
      :zoom-on-scroll="false"
      :pan-on-scroll="true"
      :zoom-on-pinch="true"
      :pan-on-drag="true"
      :edges-updatable="true"
      @nodes-change="onNodesChange"
      @edges-change="onEdgesChange"
      @connect="onConnect"
      @edge-click="onEdgeClick"
      @viewport-change="onViewportChange"
    >
      <Background pattern-color="#2d3548" :gap="16" />
      <Controls />

      <template #node-custom="{ data, id }">
        <TableNode :data="data" :id="id" />
      </template>

      <!-- Custom Edge Labels -->
      <template v-for="edge in styledEdges" :key="'label-' + edge.id">
        <EdgeLabelRenderer v-if="edge.label">
          <div
            :style="getEdgeLabelStyle(edge)"
            class="edge-label-container nodrag nopan"
          >
            <div
              class="edge-label"
              :title="`${edge.data?.sourceColumn} → ${edge.data?.targetColumn}${hasMismatch(edge.id) ? ' (Collation mismatch!)' : ''}`"
              @click="onEdgeLabelClick(edge)"
            >
              <span v-if="showWarning(edge)" class="edge-warning-icon">⚠️</span>
              <span class="join-type">{{ edge.data?.joinType || 'INNER' }}</span>
            </div>
          </div>
        </EdgeLabelRenderer>
      </template>
    </VueFlow>

    <!-- Modal untuk edit join type -->
    <n-modal v-model:show="showJoinModal" preset="card" title="Edit Join Configuration" style="width: 500px">
      <n-form>
        <n-form-item label="Connection">
          <n-input
            :value="selectedEdgeInfo"
            readonly
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 3 }"
          />
        </n-form-item>

        <!-- Collation Warning -->
        <div v-if="selectedEdgeCollationInfo?.hasMismatch" class="collation-warning">
          <div class="warning-header">
            <span class="warning-icon">⚠️</span>
            <span>Collation Mismatch Detected</span>
          </div>
          <div class="warning-details">
            <div class="collation-item">
              <span class="label">Source:</span>
              <code>{{ selectedEdgeCollationInfo.sourceCollation }}</code>
            </div>
            <div class="collation-item">
              <span class="label">Target:</span>
              <code>{{ selectedEdgeCollationInfo.targetCollation }}</code>
            </div>
          </div>
          <p class="warning-text">
            Different collations may cause query errors. Enable COLLATE to fix this.
          </p>
        </div>

        <n-form-item label="Join Type">
          <n-select
            v-model:value="selectedJoinType"
            :options="joinTypes"
          />
        </n-form-item>

        <!-- COLLATE Option -->
        <n-form-item v-if="selectedEdgeCollationInfo?.hasMismatch" label="Use COLLATE">
          <n-space vertical>
            <n-switch v-model:value="selectedUseCollate" />
            <n-select
              v-if="selectedUseCollate"
              v-model:value="selectedCollateValue"
              :options="selectedEdgeCollationInfo.availableCollations.map(c => ({ label: c, value: c }))"
              placeholder="Select collation to use"
            />
          </n-space>
        </n-form-item>

        <n-form-item label="Custom Join Condition (optional)">
          <n-input
            v-model:value="selectedJoinCondition"
            placeholder="Leave empty to use default column mapping"
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 3 }"
          />
        </n-form-item>
      </n-form>
      <template #footer>
        <n-space justify="space-between">
          <n-button type="error" @click="deleteEdgeFromModal">Delete Connection</n-button>
          <n-space>
            <n-button @click="showJoinModal = false">Cancel</n-button>
            <n-button type="primary" @click="saveJoinType">Save</n-button>
          </n-space>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted } from 'vue'
import { VueFlow, useVueFlow, EdgeLabelRenderer } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { useMessage } from 'naive-ui'
import { useCraftStore } from '@/store/craftStore'
import TableNode from './TableNode.vue'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

const message = useMessage()
const craftStore = useCraftStore()
const { project, getViewport, setViewport, getEdges } = useVueFlow()

// Get edge label position style from VueFlow's internal edge data
const getEdgeLabelStyle = (edge) => {
  // Get VueFlow's internal edges which have computed positions
  const vfEdges = getEdges.value
  const vfEdge = vfEdges.find(e => e.id === edge.id)

  if (!vfEdge) return { display: 'none' }

  // VueFlow stores label position in the edge when rendered
  // Use sourceX/Y and targetX/Y to calculate middle position
  const sourceX = vfEdge.sourceX ?? 0
  const sourceY = vfEdge.sourceY ?? 0
  const targetX = vfEdge.targetX ?? 0
  const targetY = vfEdge.targetY ?? 0

  const labelX = sourceX + (targetX - sourceX) / 2
  const labelY = sourceY + (targetY - sourceY) / 2

  return {
    position: 'absolute',
    transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
    pointerEvents: 'all',
    zIndex: 1000
  }
}

// Handle edge label click
const onEdgeLabelClick = (edge) => {
  selectedEdgeId.value = edge.id
  selectedJoinType.value = edge.data?.joinType || 'INNER'
  selectedJoinCondition.value = edge.data?.condition || ''
  selectedUseCollate.value = edge.data?.useCollate || false

  if (edge.data?.collateValue) {
    selectedCollateValue.value = edge.data.collateValue
  } else if (edge.data?.sourceCollation) {
    selectedCollateValue.value = edge.data.sourceCollation
  } else if (edge.data?.targetCollation) {
    selectedCollateValue.value = edge.data.targetCollation
  } else {
    selectedCollateValue.value = ''
  }

  showJoinModal.value = true
}

const nodes = ref(craftStore.nodes)
const edges = ref(craftStore.edges)

// Join modal
const showJoinModal = ref(false)
const selectedEdgeId = ref(null)
const selectedJoinType = ref('INNER')
const selectedJoinCondition = ref('')
const selectedUseCollate = ref(false)
const selectedCollateValue = ref('')

// Helper to get column info from node
const getColumnInfo = (nodeId, columnName) => {
  const node = nodes.value.find(n => n.id === nodeId)
  if (!node || !node.data.columns) return null
  return node.data.columns.find(c => c.name === columnName)
}

// Check if edge has collation mismatch (for template use)
const hasCollationMismatch = (edge) => {
  if (!edge?.data) return false
  // First check if already flagged
  if (edge.data.hasCollationMismatch) return true
  // Otherwise check from column data
  const sourceColInfo = getColumnInfo(edge.source, edge.data.sourceColumn)
  const targetColInfo = getColumnInfo(edge.target, edge.data.targetColumn)
  if (sourceColInfo?.collation && targetColInfo?.collation) {
    return sourceColInfo.collation !== targetColInfo.collation
  }
  return false
}

// Get current edge info for display
const selectedEdgeInfo = computed(() => {
  const edge = edges.value.find(e => e.id === selectedEdgeId.value)
  if (!edge || !edge.data) return ''

  const sourceCol = edge.data.sourceColumn || 'unknown'
  const targetCol = edge.data.targetColumn || 'unknown'
  return `${edge.source}.${sourceCol} → ${edge.target}.${targetCol}`
})

// Get collation mismatch info for selected edge
const selectedEdgeCollationInfo = computed(() => {
  const edge = edges.value.find(e => e.id === selectedEdgeId.value)
  if (!edge || !edge.data) return null

  // Try to get collation from node columns first
  const sourceColInfo = getColumnInfo(edge.source, edge.data.sourceColumn)
  const targetColInfo = getColumnInfo(edge.target, edge.data.targetColumn)

  // Use edge data as fallback if node columns don't have collation info
  const sourceCollation = sourceColInfo?.collation || edge.data.sourceCollation
  const targetCollation = targetColInfo?.collation || edge.data.targetCollation

  // Check if we have collation info from any source
  if (!sourceCollation || !targetCollation) {
    // Still check if edge has mismatch flag
    if (edge.data.hasCollationMismatch) {
      return {
        hasMismatch: true,
        sourceCollation: edge.data.sourceCollation || 'unknown',
        targetCollation: edge.data.targetCollation || 'unknown',
        availableCollations: [edge.data.sourceCollation, edge.data.targetCollation].filter(Boolean)
      }
    }
    return null
  }

  const hasMismatch = sourceCollation !== targetCollation

  return {
    hasMismatch,
    sourceCollation,
    targetCollation,
    availableCollations: [sourceCollation, targetCollation]
  }
})

const joinTypes = [
  { label: 'INNER JOIN', value: 'INNER' },
  { label: 'LEFT JOIN', value: 'LEFT' },
  { label: 'RIGHT JOIN', value: 'RIGHT' },
  { label: 'FULL OUTER JOIN', value: 'FULL OUTER' }
]

// Reactive map to store mismatch results by edge id
const mismatchMap = ref({})

// Update mismatch map whenever edges or nodes change
watch(
  [edges, nodes],
  () => {
    const results = {}
    edges.value.forEach(edge => {
      results[edge.id] = hasCollationMismatch(edge)
    })
    mismatchMap.value = results
  },
  { deep: true, immediate: true }
)

// Helper for template to check mismatch by edge id
const hasMismatch = (edgeId) => {
  return mismatchMap.value[edgeId] || false
}

// Check if edge should show warning (has mismatch AND collate not enabled)
const showWarning = (edge) => {
  return hasMismatch(edge.id) && !edge.data?.useCollate
}

// Computed edges with class for collation mismatch styling and hidden default label
const styledEdges = computed(() => {
  return edges.value.map(edge => {
    const mismatch = mismatchMap.value[edge.id] || false
    return {
      ...edge,
      class: mismatch && !edge.data?.useCollate ? 'collation-mismatch' : '',
      // Hide default label, we render custom label with EdgeLabelRenderer
      labelStyle: { display: 'none' },
      labelShowBg: false
    }
  })
})

// Sync with store
watch(() => craftStore.nodes, (newNodes) => {
  nodes.value = newNodes
}, { deep: true })

watch(() => craftStore.edges, (newEdges) => {
  edges.value = newEdges
}, { deep: true })

const onNodesChange = (changes) => {
  // Handle node changes
  craftStore.setNodes(nodes.value)
}

const onEdgesChange = (changes) => {
  // Handle edge changes including deletions
  changes.forEach(change => {
    if (change.type === 'remove') {
      craftStore.removeEdge(change.id)
      message.info('Connection removed')
    }
  })
  craftStore.setEdges(edges.value)
}

// Handle new connection between tables
const onConnect = (params) => {
  // Parse source and target handles to extract table and column names
  // Format: "tableName-columnName-source" or "tableName-columnName-target"
  const sourceHandleParts = params.sourceHandle.split('-')
  const targetHandleParts = params.targetHandle.split('-')

  // Extract table and column names
  const sourceTable = params.source
  const targetTable = params.target

  // Handle format: "tableName-columnName-source"
  // Remove the last part (source/target) and join the rest
  const sourceColumn = sourceHandleParts.slice(1, -1).join('-')
  const targetColumn = targetHandleParts.slice(1, -1).join('-')

  // Check for collation mismatch
  const sourceNode = nodes.value.find(n => n.id === params.source)
  const targetNode = nodes.value.find(n => n.id === params.target)
  const sourceColInfo = sourceNode?.data.columns?.find(c => c.name === sourceColumn)
  const targetColInfo = targetNode?.data.columns?.find(c => c.name === targetColumn)

  let hasCollationMismatch = false
  if (sourceColInfo?.collation && targetColInfo?.collation) {
    hasCollationMismatch = sourceColInfo.collation !== targetColInfo.collation
  }

  const newEdge = {
    id: `e${params.source}-${sourceColumn}-${params.target}-${targetColumn}`,
    source: params.source,
    target: params.target,
    sourceHandle: params.sourceHandle,
    targetHandle: params.targetHandle,
    type: 'default',
    animated: true,
    label: 'INNER',
    data: {
      joinType: 'INNER',
      sourceColumn: sourceColumn,
      targetColumn: targetColumn,
      hasCollationMismatch: hasCollationMismatch,
      sourceCollation: sourceColInfo?.collation || null,
      targetCollation: targetColInfo?.collation || null,
      useCollate: false,
      collateValue: null
    }
  }

  craftStore.addEdge(newEdge)

  if (hasCollationMismatch) {
    message.warning(`Collation mismatch detected: ${sourceColInfo.collation} vs ${targetColInfo.collation}. Click the join to configure COLLATE.`, { duration: 5000 })
  } else {
    message.success(`Connected ${sourceTable}.${sourceColumn} → ${targetTable}.${targetColumn}`)
  }
}

// Handle edge click to edit join type
const onEdgeClick = ({ edge }) => {
  selectedEdgeId.value = edge.id
  selectedJoinType.value = edge.data?.joinType || 'INNER'
  selectedJoinCondition.value = edge.data?.condition || ''
  selectedUseCollate.value = edge.data?.useCollate || false

  // Set default collate value from edge data or first available collation
  if (edge.data?.collateValue) {
    selectedCollateValue.value = edge.data.collateValue
  } else if (edge.data?.sourceCollation) {
    selectedCollateValue.value = edge.data.sourceCollation
  } else if (edge.data?.targetCollation) {
    selectedCollateValue.value = edge.data.targetCollation
  } else {
    selectedCollateValue.value = ''
  }

  showJoinModal.value = true
}

// Auto-select first collation when enabling COLLATE
watch(selectedUseCollate, (newValue) => {
  if (newValue && !selectedCollateValue.value && selectedEdgeCollationInfo.value?.availableCollations?.length > 0) {
    selectedCollateValue.value = selectedEdgeCollationInfo.value.availableCollations[0]
  }
})

// Save join type changes
const saveJoinType = () => {
  if (selectedEdgeId.value) {
    const edge = craftStore.edges.find(e => e.id === selectedEdgeId.value)
    if (edge) {
      craftStore.updateEdge(selectedEdgeId.value, {
        label: selectedJoinType.value,
        data: {
          ...edge.data,
          joinType: selectedJoinType.value,
          condition: selectedJoinCondition.value || null,
          useCollate: selectedUseCollate.value,
          collateValue: selectedUseCollate.value ? selectedCollateValue.value : null
        }
      })

      // Force edges refresh for VueFlow to re-render
      edges.value = [...craftStore.edges]

      message.success('Join configuration updated')
    }
  }
  showJoinModal.value = false
}

const clearCanvas = () => {
  craftStore.resetCanvas()
  message.info('Canvas cleared')
}

// Delete edge from modal
const deleteEdgeFromModal = () => {
  if (selectedEdgeId.value) {
    craftStore.removeEdge(selectedEdgeId.value)
    message.success('Connection deleted')
    showJoinModal.value = false
    selectedEdgeId.value = null
  }
}

// Delete edge from label button
const deleteEdge = (edgeId) => {
  craftStore.removeEdge(edgeId)
  message.success('Connection deleted')
}

// Track viewport changes (pan/zoom)
const onViewportChange = (viewport) => {
  craftStore.setViewport(viewport)
}

// Watch for pending viewport restore (from import)
watch(() => craftStore.pendingViewportRestore, (newViewport) => {
  if (newViewport) {
    // Apply the viewport after a short delay to ensure nodes are rendered
    setTimeout(() => {
      setViewport(newViewport)
      craftStore.clearPendingViewportRestore()
    }, 100)
  }
})
</script>

<style scoped>
.canvas-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #0f1419;
}

.canvas-toolbar {
  padding: 15px 20px;
  background: #1a1f2e;
  border-bottom: 1px solid #2d3548;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.toolbar-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.canvas-toolbar h2 {
  margin: 0;
  color: #fff;
  font-size: 1.2rem;
}

.toolbar-hint {
  display: flex;
  align-items: center;
}

.hint-text {
  font-size: 0.75rem;
  color: #8896a8;
  display: flex;
  align-items: center;
  gap: 4px;
}

.hint-text kbd {
  background: rgba(99, 226, 183, 0.1);
  color: #63e2b7;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: monospace;
  font-size: 0.7rem;
  font-weight: 600;
  border: 1px solid rgba(99, 226, 183, 0.3);
}

.hint-text .delete-icon {
  color: #ff4757;
  font-weight: bold;
  font-size: 0.85rem;
}

.vue-flow-container {
  flex: 1;
  background: #0f1419;
}

:deep(.vue-flow__background) {
  background-color: #0f1419;
}

:deep(.vue-flow__edge-path) {
  stroke: #63e2b7;
  stroke-width: 2;
}

:deep(.vue-flow__edge.collation-mismatch .vue-flow__edge-path) {
  stroke: #ffc107;
  stroke-width: 3;
}

:deep(.vue-flow__edge.collation-mismatch) {
  filter: drop-shadow(0 0 4px rgba(255, 193, 7, 0.5));
}

:deep(.vue-flow__edge-textwrapper) {
  background: transparent;
  color: #fff;
  padding: 0;
  border-radius: 4px;
}


.collate-badge {
  font-size: 0.6rem;
  background: rgba(15, 20, 25, 0.3);
  padding: 2px 6px;
  border-radius: 3px;
  margin-top: 4px;
  font-weight: 600;
}

.join-columns {
  font-size: 0.7rem;
  font-weight: 600;
  margin-top: 4px;
  white-space: nowrap;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.source-col,
.target-col {
  background: rgba(15, 20, 25, 0.2);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: monospace;
}

.arrow {
  font-weight: bold;
  font-size: 0.9rem;
}

/* Collation Warning Styles */
.collation-warning {
  background: rgba(255, 193, 7, 0.15);
  border: 1px solid #ffc107;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 16px;
}

.warning-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #ffc107;
  margin-bottom: 8px;
}

.warning-icon {
  font-size: 1.2rem;
}

.warning-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}

.collation-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
}

.collation-item .label {
  color: #8896a8;
  min-width: 60px;
}

.collation-item code {
  background: rgba(0, 0, 0, 0.3);
  padding: 2px 8px;
  border-radius: 4px;
  font-family: monospace;
  color: #fff;
}

.warning-text {
  margin: 0;
  font-size: 0.8rem;
  color: #8896a8;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
</style>

<!-- Non-scoped styles for EdgeLabelRenderer (renders in portal) -->
<style>
.vue-flow .edge-label-container {
  display: flex;
  align-items: center;
  gap: 6px;
}

.vue-flow .edge-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #fff;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
}

.vue-flow .edge-label:hover {
  transform: scale(1.1);
}

.vue-flow .edge-warning-icon {
  font-size: 0.85rem;
  line-height: 1;
}

.vue-flow .join-type {
  font-size: 0.75rem;
  font-weight: 500;
}
</style>
