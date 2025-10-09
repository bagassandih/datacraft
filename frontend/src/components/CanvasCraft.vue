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
      v-model:edges="edges"
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
    >
      <Background pattern-color="#2d3548" :gap="16" />
      <Controls />

      <template #node-custom="{ data, id }">
        <TableNode :data="data" :id="id" />
      </template>

      <template #edge-label="{ edge }">
        <div class="edge-label-container">
          <div class="edge-label" :title="`${edge.source}.${edge.data?.sourceColumn} → ${edge.target}.${edge.data?.targetColumn}`">
            <div class="join-type">{{ edge.data?.joinType || 'INNER' }}</div>
            <div v-if="edge.data?.sourceColumn" class="join-columns">
              <span class="source-col">{{ edge.data.sourceColumn }}</span>
              <span class="arrow">→</span>
              <span class="target-col">{{ edge.data.targetColumn }}</span>
            </div>
          </div>
          <button class="delete-edge-btn" @click="deleteEdge(edge.id)" title="Delete connection (or select and press Delete)">
            ✕
          </button>
        </div>
      </template>
    </VueFlow>

    <!-- Modal untuk edit join type -->
    <n-modal v-model:show="showJoinModal" preset="card" title="Edit Join Configuration" style="width: 450px">
      <n-form>
        <n-form-item label="Connection">
          <n-input
            :value="selectedEdgeInfo"
            readonly
            type="textarea"
            :autosize="{ minRows: 2, maxRows: 3 }"
          />
        </n-form-item>
        <n-form-item label="Join Type">
          <n-select
            v-model:value="selectedJoinType"
            :options="joinTypes"
          />
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
import { ref, watch, computed } from 'vue'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { useMessage } from 'naive-ui'
import { useCraftStore } from '@/store/craftStore'
import TableNode from './TableNode.vue'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

const message = useMessage()
const craftStore = useCraftStore()

const nodes = ref(craftStore.nodes)
const edges = ref(craftStore.edges)

// Join modal
const showJoinModal = ref(false)
const selectedEdgeId = ref(null)
const selectedJoinType = ref('INNER')
const selectedJoinCondition = ref('')

// Get current edge info for display
const selectedEdgeInfo = computed(() => {
  const edge = edges.value.find(e => e.id === selectedEdgeId.value)
  if (!edge || !edge.data) return ''

  const sourceCol = edge.data.sourceColumn || 'unknown'
  const targetCol = edge.data.targetColumn || 'unknown'
  return `${edge.source}.${sourceCol} → ${edge.target}.${targetCol}`
})

const joinTypes = [
  { label: 'INNER JOIN', value: 'INNER' },
  { label: 'LEFT JOIN', value: 'LEFT' },
  { label: 'RIGHT JOIN', value: 'RIGHT' },
  { label: 'FULL OUTER JOIN', value: 'FULL OUTER' }
]

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
      condition: `${sourceTable}.${sourceColumn} = ${targetTable}.${targetColumn}`
    }
  }

  craftStore.addEdge(newEdge)
  message.success(`Connected ${sourceTable}.${sourceColumn} → ${targetTable}.${targetColumn}`)
}

// Handle edge click to edit join type
const onEdgeClick = ({ edge }) => {
  selectedEdgeId.value = edge.id
  selectedJoinType.value = edge.data?.joinType || 'INNER'
  selectedJoinCondition.value = edge.data?.condition || ''
  showJoinModal.value = true
}

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
          condition: selectedJoinCondition.value || null
        }
      })
      message.success('Join type updated')
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

:deep(.vue-flow__edge-textwrapper) {
  background: transparent;
  color: #fff;
  padding: 0;
  border-radius: 4px;
}

.edge-label-container {
  display: flex;
  align-items: center;
  gap: 6px;
}

.edge-label {
  background: #63e2b7;
  color: #0f1419;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
  transition: all 0.2s;
  border: 2px solid #0f1419;
  min-width: 80px;
  text-align: center;
}

.delete-edge-btn {
  background: #ff4757;
  color: #fff;
  border: 2px solid #0f1419;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  padding: 0;
  line-height: 1;
}

.delete-edge-btn:hover {
  background: #e84118;
  transform: scale(1.15);
  box-shadow: 0 4px 12px rgba(255, 71, 87, 0.5);
}

.edge-label:hover {
  background: #4dd09a;
  transform: scale(1.08);
  box-shadow: 0 4px 16px rgba(99, 226, 183, 0.5);
}

.join-type {
  font-weight: 700;
  font-size: 0.85rem;
  letter-spacing: 0.5px;
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
</style>
