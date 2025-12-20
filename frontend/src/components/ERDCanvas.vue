<template>
  <div class="canvas-container">
    <div class="canvas-toolbar">
      <div class="toolbar-content">
        <h2>ERD Canvas</h2>
        <div class="toolbar-hint">
          <span class="hint-text">Double-click table name to rename | Double-click column to edit | Click + to add column</span>
        </div>
      </div>
      <n-space>
        <n-button @click="clearCanvas">Clear Canvas</n-button>
      </n-space>
    </div>

    <VueFlow
      ref="vueFlowRef"
      v-model:nodes="nodes"
      :edges="styledEdges"
      class="vue-flow-container"
      :default-viewport="{ zoom: 1 }"
      :min-zoom="0.3"
      :max-zoom="2"
      :zoom-on-scroll="false"
      :pan-on-scroll="true"
      :zoom-on-pinch="true"
      :pan-on-drag="true"
      @nodes-change="onNodesChange"
      @edges-change="onEdgesChange"
      @connect="onConnect"
      @edge-click="onEdgeClick"
      @viewport-change="onViewportChange"
    >
      <Background pattern-color="#2d3548" :gap="16" />
      <Controls />

      <template #node-erdTable="{ data, id }">
        <ERDTableNode :data="data" :id="id" />
      </template>

      <!-- Edge labels for relationship type -->
      <EdgeLabelRenderer>
        <template v-for="edge in styledEdges" :key="'label-' + edge.id">
          <div
            v-if="edge.data?.relationType"
            :style="getEdgeLabelStyle(edge)"
            class="edge-label-container nodrag nopan"
          >
            <div
              class="edge-label"
              @click="onEdgeLabelClick(edge)"
            >
              <span class="relation-type">{{ edge.data.relationType }}</span>
            </div>
          </div>
        </template>
      </EdgeLabelRenderer>
    </VueFlow>

    <!-- Column Edit Modal -->
    <n-modal v-model:show="showColumnModal" preset="card" :title="editingColumn ? 'Edit Column' : 'Add Column'" style="width: 500px">
      <n-form ref="columnFormRef" :model="columnForm" :rules="columnRules">
        <n-form-item label="Column Name" path="name">
          <n-input v-model:value="columnForm.name" placeholder="e.g., user_id" />
        </n-form-item>

        <n-form-item label="Data Type" path="type">
          <n-select
            v-model:value="columnForm.type"
            :options="dataTypes"
            filterable
          />
        </n-form-item>

        <n-form-item v-if="showLengthField" label="Length">
          <n-input-number
            v-model:value="columnForm.length"
            :min="1"
            placeholder="e.g., 255"
            style="width: 100%"
          />
        </n-form-item>

        <n-form-item label="Constraints">
          <n-space vertical>
            <n-checkbox v-model:checked="columnForm.isPrimaryKey">Primary Key</n-checkbox>
            <n-checkbox v-model:checked="columnForm.nullable">Allow NULL</n-checkbox>
            <n-checkbox v-model:checked="columnForm.isAutoIncrement">Auto Increment</n-checkbox>
          </n-space>
        </n-form-item>

        <n-form-item label="Default Value">
          <n-input v-model:value="columnForm.defaultValue" placeholder="e.g., CURRENT_TIMESTAMP" />
        </n-form-item>
      </n-form>

      <template #footer>
        <n-space justify="space-between">
          <n-button v-if="editingColumn" type="error" @click="deleteColumn">Delete Column</n-button>
          <div v-else></div>
          <n-space>
            <n-button @click="showColumnModal = false">Cancel</n-button>
            <n-button type="primary" @click="saveColumn">{{ editingColumn ? 'Save' : 'Add' }}</n-button>
          </n-space>
        </n-space>
      </template>
    </n-modal>

    <!-- Relationship Edit Modal -->
    <n-modal v-model:show="showRelationModal" preset="card" title="Edit Relationship" style="width: 450px">
      <n-form>
        <n-form-item label="Relationship Type">
          <n-select
            v-model:value="relationForm.relationType"
            :options="relationTypes"
          />
        </n-form-item>

        <n-form-item label="On Delete">
          <n-select
            v-model:value="relationForm.onDelete"
            :options="referentialActions"
          />
        </n-form-item>

        <n-form-item label="On Update">
          <n-select
            v-model:value="relationForm.onUpdate"
            :options="referentialActions"
          />
        </n-form-item>
      </n-form>

      <template #footer>
        <n-space justify="space-between">
          <n-button type="error" @click="deleteRelationship">Delete</n-button>
          <n-space>
            <n-button @click="showRelationModal = false">Cancel</n-button>
            <n-button type="primary" @click="saveRelationship">Save</n-button>
          </n-space>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup>
import { ref, computed, watch, provide } from 'vue'
import { VueFlow, useVueFlow, EdgeLabelRenderer } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { useMessage } from 'naive-ui'
import { useErdStore } from '@/store/erdStore'
import ERDTableNode from './ERDTableNode.vue'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

const message = useMessage()
const erdStore = useErdStore()
const { getEdges } = useVueFlow()
const vueFlowRef = ref(null)

const nodes = ref(erdStore.nodes)
const edges = ref(erdStore.edges)

// Column Modal
const showColumnModal = ref(false)
const editingColumn = ref(null)
const editingTableId = ref(null)
const columnFormRef = ref(null)
const columnForm = ref({
  name: '',
  type: 'VARCHAR',
  length: 255,
  nullable: true,
  isPrimaryKey: false,
  isAutoIncrement: false,
  defaultValue: ''
})

const columnRules = {
  name: { required: true, message: 'Please enter column name' },
  type: { required: true, message: 'Please select data type' }
}

const dataTypes = [
  { label: 'INT', value: 'INT' },
  { label: 'BIGINT', value: 'BIGINT' },
  { label: 'TINYINT', value: 'TINYINT' },
  { label: 'SMALLINT', value: 'SMALLINT' },
  { label: 'DECIMAL', value: 'DECIMAL' },
  { label: 'FLOAT', value: 'FLOAT' },
  { label: 'DOUBLE', value: 'DOUBLE' },
  { label: 'VARCHAR', value: 'VARCHAR' },
  { label: 'CHAR', value: 'CHAR' },
  { label: 'TEXT', value: 'TEXT' },
  { label: 'LONGTEXT', value: 'LONGTEXT' },
  { label: 'DATE', value: 'DATE' },
  { label: 'DATETIME', value: 'DATETIME' },
  { label: 'TIMESTAMP', value: 'TIMESTAMP' },
  { label: 'TIME', value: 'TIME' },
  { label: 'YEAR', value: 'YEAR' },
  { label: 'BOOLEAN', value: 'BOOLEAN' },
  { label: 'BLOB', value: 'BLOB' },
  { label: 'JSON', value: 'JSON' },
  { label: 'ENUM', value: 'ENUM' }
]

const showLengthField = computed(() => {
  return ['VARCHAR', 'CHAR', 'INT', 'BIGINT', 'TINYINT', 'SMALLINT', 'DECIMAL'].includes(columnForm.value.type)
})

// Relationship Modal
const showRelationModal = ref(false)
const selectedRelationshipId = ref(null)
const relationForm = ref({
  relationType: '1:N',
  onDelete: 'NO ACTION',
  onUpdate: 'NO ACTION'
})

const relationTypes = [
  { label: 'One to One (1:1)', value: '1:1' },
  { label: 'One to Many (1:N)', value: '1:N' },
  { label: 'Many to Many (N:M)', value: 'N:M' }
]

const referentialActions = [
  { label: 'NO ACTION', value: 'NO ACTION' },
  { label: 'CASCADE', value: 'CASCADE' },
  { label: 'SET NULL', value: 'SET NULL' },
  { label: 'SET DEFAULT', value: 'SET DEFAULT' },
  { label: 'RESTRICT', value: 'RESTRICT' }
]

// Provide openColumnModal to child nodes
const openColumnModal = (tableId, column) => {
  editingTableId.value = tableId
  editingColumn.value = column

  if (column) {
    columnForm.value = {
      name: column.name,
      type: column.type,
      length: column.length || null,
      nullable: column.nullable !== false,
      isPrimaryKey: column.isPrimaryKey || false,
      isAutoIncrement: column.isAutoIncrement || false,
      defaultValue: column.defaultValue || ''
    }
  } else {
    columnForm.value = {
      name: '',
      type: 'VARCHAR',
      length: 255,
      nullable: true,
      isPrimaryKey: false,
      isAutoIncrement: false,
      defaultValue: ''
    }
  }

  showColumnModal.value = true
}

provide('openColumnModal', openColumnModal)

const saveColumn = async () => {
  try {
    await columnFormRef.value?.validate()

    const columnData = {
      name: columnForm.value.name,
      type: columnForm.value.type,
      length: showLengthField.value ? columnForm.value.length : null,
      nullable: columnForm.value.nullable,
      isPrimaryKey: columnForm.value.isPrimaryKey,
      isAutoIncrement: columnForm.value.isAutoIncrement,
      defaultValue: columnForm.value.defaultValue || null
    }

    if (editingColumn.value) {
      erdStore.updateColumn(editingTableId.value, editingColumn.value.id, columnData)
      message.success('Column updated')
    } else {
      erdStore.addColumn(editingTableId.value, columnData)
      message.success('Column added')
    }

    showColumnModal.value = false
  } catch (error) {
    // Validation failed
  }
}

const deleteColumn = () => {
  if (editingColumn.value && editingTableId.value) {
    erdStore.removeColumn(editingTableId.value, editingColumn.value.id)
    message.success('Column deleted')
    showColumnModal.value = false
  }
}

// Edge label positioning
const getEdgeLabelStyle = (edge) => {
  const vfEdge = getEdges.value.find(e => e.id === edge.id)

  if (!vfEdge || vfEdge.sourceX === undefined) {
    return { display: 'none' }
  }

  const labelX = vfEdge.sourceX + (vfEdge.targetX - vfEdge.sourceX) / 2
  const labelY = vfEdge.sourceY + (vfEdge.targetY - vfEdge.sourceY) / 2

  return {
    position: 'absolute',
    transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
    pointerEvents: 'all',
    zIndex: 1000
  }
}

// Styled edges
const styledEdges = computed(() => {
  return edges.value.map(edge => ({
    ...edge,
    labelStyle: { display: 'none' },
    labelShowBg: false
  }))
})

// Sync with store
watch(() => erdStore.nodes, (newNodes) => {
  nodes.value = newNodes
}, { immediate: true, deep: true })

watch(() => erdStore.edges, (newEdges) => {
  edges.value = newEdges
}, { immediate: true, deep: true })

// Debounce timer for node changes
let nodesChangeTimer = null

const onNodesChange = (changes) => {
  if (nodesChangeTimer) clearTimeout(nodesChangeTimer)
  nodesChangeTimer = setTimeout(() => {
    erdStore.setNodes(nodes.value)
  }, 100)
}

const onEdgesChange = (changes) => {
  changes.forEach(change => {
    if (change.type === 'remove') {
      erdStore.removeRelationship(change.id)
      message.info('Relationship removed')
    }
  })
  erdStore.setEdges(edges.value)
}

// Handle new connection between tables
const onConnect = (params) => {
  // Parse handles to get table and column IDs
  const sourceHandleParts = params.sourceHandle.split('-')
  const targetHandleParts = params.targetHandle.split('-')

  const sourceTableId = sourceHandleParts[0]
  const sourceColumnId = sourceHandleParts[1]
  const targetTableId = targetHandleParts[0]
  const targetColumnId = targetHandleParts[1]

  // Check if relationship already exists
  const existingRel = erdStore.relationships.find(
    r => r.sourceTable === sourceTableId && r.targetTable === targetTableId &&
         r.sourceColumn === sourceColumnId && r.targetColumn === targetColumnId
  )

  if (existingRel) {
    message.warning('Relationship already exists')
    return
  }

  // Get column info for type checking
  const sourceTable = erdStore.tables.find(t => t.id === sourceTableId)
  const targetTable = erdStore.tables.find(t => t.id === targetTableId)
  const sourceColumn = sourceTable?.columns.find(c => c.id === sourceColumnId)
  const targetColumn = targetTable?.columns.find(c => c.id === targetColumnId)

  // Check for type mismatch and auto-fix FK column type
  if (sourceColumn && targetColumn) {
    const sourceType = sourceColumn.type.toUpperCase()
    const targetType = targetColumn.type.toUpperCase()

    if (sourceType !== targetType) {
      // Determine which is FK and which is PK
      let fkColumn, fkTableId, pkColumn
      if (targetColumn.isPrimaryKey && !sourceColumn.isPrimaryKey) {
        fkColumn = sourceColumn
        fkTableId = sourceTableId
        pkColumn = targetColumn
      } else if (sourceColumn.isPrimaryKey && !targetColumn.isPrimaryKey) {
        fkColumn = targetColumn
        fkTableId = targetTableId
        pkColumn = sourceColumn
      }

      if (fkColumn && pkColumn) {
        // Auto-fix: Update FK column type to match PK
        erdStore.updateColumn(fkTableId, fkColumn.id, {
          type: pkColumn.type,
          length: pkColumn.length
        })
        message.success(
          `Auto-fixed: ${fkColumn.name} type changed to ${pkColumn.type} to match ${pkColumn.name}`,
          { duration: 3000 }
        )
      } else {
        message.warning(
          `Column type mismatch: ${sourceColumn.name} (${sourceColumn.type}) vs ${targetColumn.name} (${targetColumn.type}). FK columns should have matching types.`,
          { duration: 5000 }
        )
      }
    }
  }

  erdStore.addRelationship({
    sourceTable: sourceTableId,
    targetTable: targetTableId,
    sourceColumn: sourceColumnId,
    targetColumn: targetColumnId,
    relationType: '1:N',
    onDelete: 'NO ACTION',
    onUpdate: 'NO ACTION'
  })

  message.success('Relationship created')
}

// Handle edge click to edit relationship
const onEdgeClick = ({ edge }) => {
  openRelationshipModal(edge)
}

const onEdgeLabelClick = (edge) => {
  openRelationshipModal(edge)
}

const openRelationshipModal = (edge) => {
  selectedRelationshipId.value = edge.id
  relationForm.value = {
    relationType: edge.data?.relationType || '1:N',
    onDelete: edge.data?.onDelete || 'NO ACTION',
    onUpdate: edge.data?.onUpdate || 'NO ACTION'
  }
  showRelationModal.value = true
}

const saveRelationship = () => {
  if (selectedRelationshipId.value) {
    erdStore.updateRelationship(selectedRelationshipId.value, {
      relationType: relationForm.value.relationType,
      onDelete: relationForm.value.onDelete,
      onUpdate: relationForm.value.onUpdate
    })
    message.success('Relationship updated')
  }
  showRelationModal.value = false
}

const deleteRelationship = () => {
  if (selectedRelationshipId.value) {
    erdStore.removeRelationship(selectedRelationshipId.value)
    message.success('Relationship deleted')
    showRelationModal.value = false
  }
}

// Viewport tracking
let viewportChangeTimer = null

const onViewportChange = (viewport) => {
  if (viewportChangeTimer) clearTimeout(viewportChangeTimer)
  viewportChangeTimer = setTimeout(() => {
    erdStore.setViewport(viewport)
  }, 150)
}

const clearCanvas = () => {
  erdStore.resetCanvas()
  message.info('Canvas cleared')
}

// Expose vue flow ref for PNG export
defineExpose({
  vueFlowRef
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
</style>

<!-- Non-scoped styles for EdgeLabelRenderer -->
<style>
.vue-flow .edge-label-container {
  display: flex;
  align-items: center;
  gap: 6px;
  will-change: transform;
  contain: layout style;
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
  background: rgba(99, 226, 183, 0.2);
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid rgba(99, 226, 183, 0.5);
}

.vue-flow .edge-label:hover {
  background: rgba(99, 226, 183, 0.4);
  transform: scale(1.1);
}

.vue-flow .relation-type {
  font-size: 0.75rem;
  font-weight: 600;
  color: #63e2b7;
}
</style>
