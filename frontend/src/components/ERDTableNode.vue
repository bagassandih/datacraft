<template>
  <div
    class="erd-table-node"
    :style="{ width: nodeWidth + 'px' }"
  >
    <div class="node-header" @dblclick="startEditTableName">
      <div class="table-info">
        <span class="resize-indicator nodrag" @mousedown="startHeaderResize">||</span>
        <span v-if="!isEditingName" class="table-name">{{ data.table }}</span>
        <input
          v-else
          ref="tableNameInput"
          v-model="editingName"
          class="table-name-input nodrag"
          @blur="saveTableName"
          @keyup.enter="saveTableName"
          @keyup.escape="cancelEditTableName"
        />
      </div>
      <div class="header-actions">
        <button class="action-button nodrag" @click.stop="openAddColumnModal" title="Add column">
          +
        </button>
        <button class="close-button nodrag" @click.stop="removeNode" title="Remove table">
          x
        </button>
      </div>
    </div>

    <div class="node-body">
      <div
        v-for="column in data.columns"
        :key="column.id"
        class="column-row"
        @dblclick="openEditColumnModal(column)"
      >
        <!-- Target handle (left side) -->
        <Handle
          :id="`${data.tableId}-${column.id}-target`"
          type="target"
          :position="Position.Left"
          class="column-handle column-handle-target"
        />

        <div class="column-content">
          <span class="column-icons">
            <span v-if="column.isPrimaryKey" class="pk-icon" title="Primary Key">PK</span>
            <span v-if="column.isForeignKey" class="fk-icon" title="Foreign Key">FK</span>
          </span>
          <span class="column-name-text">{{ column.name }}</span>
          <span class="column-type-text">{{ formatColumnType(column) }}</span>
          <span v-if="!column.nullable" class="not-null-badge">NN</span>
        </div>

        <!-- Source handle (right side) -->
        <Handle
          :id="`${data.tableId}-${column.id}-source`"
          type="source"
          :position="Position.Right"
          class="column-handle column-handle-source"
        />
      </div>

      <div v-if="data.columns.length === 0" class="empty-columns">
        <span>No columns defined</span>
        <n-button size="tiny" @click="openAddColumnModal">Add Column</n-button>
      </div>
    </div>

    <!-- Resize handle -->
    <div
      class="resize-handle nodrag"
      @mousedown.stop="startResize"
      title="Drag to resize width"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
        <path d="M11 11L11 7M11 11L7 11M11 11L6 6M11 3L11 1L9 1M3 11L1 11L1 9" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      </svg>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, inject } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { useErdStore } from '@/store/erdStore'

const props = defineProps({
  data: {
    type: Object,
    required: true
  },
  id: {
    type: String,
    required: false
  }
})

const erdStore = useErdStore()

// Injected functions from parent
const openColumnModal = inject('openColumnModal', null)

// Node width for resizing
const nodeWidth = ref(props.data.width || 280)

// Table name editing
const isEditingName = ref(false)
const editingName = ref('')
const tableNameInput = ref(null)

const startEditTableName = () => {
  editingName.value = props.data.table
  isEditingName.value = true
  nextTick(() => {
    tableNameInput.value?.focus()
    tableNameInput.value?.select()
  })
}

const saveTableName = () => {
  if (editingName.value.trim()) {
    erdStore.updateTableName(props.data.tableId, editingName.value.trim())
  }
  isEditingName.value = false
}

const cancelEditTableName = () => {
  isEditingName.value = false
}

const formatColumnType = (column) => {
  let type = column.type
  if (column.length && !['TEXT', 'BLOB', 'DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'YEAR', 'BOOLEAN'].includes(column.type.toUpperCase())) {
    type += `(${column.length})`
  }
  return type
}

const removeNode = () => {
  if (props.data.tableId) {
    erdStore.removeTable(props.data.tableId)
  }
}

const openAddColumnModal = () => {
  if (openColumnModal) {
    openColumnModal(props.data.tableId, null)
  }
}

const openEditColumnModal = (column) => {
  if (openColumnModal) {
    openColumnModal(props.data.tableId, column)
  }
}

// Resize functionality - from corner handle
const startResize = (event) => {
  event.preventDefault()
  event.stopPropagation()

  const startX = event.clientX
  const startWidth = nodeWidth.value
  let rafId = null

  const onMouseMove = (e) => {
    if (rafId) cancelAnimationFrame(rafId)

    rafId = requestAnimationFrame(() => {
      const deltaX = e.clientX - startX
      const newWidth = Math.max(240, Math.min(600, startWidth + deltaX))
      nodeWidth.value = newWidth
    })
  }

  const onMouseUp = () => {
    if (rafId) cancelAnimationFrame(rafId)

    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''

    // Update store
    const nodeIndex = erdStore.nodes.findIndex(n => n.id === props.id)
    if (nodeIndex !== -1) {
      erdStore.nodes[nodeIndex].data.width = nodeWidth.value
    }
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  document.body.style.cursor = 'ew-resize'
  document.body.style.userSelect = 'none'
}

// Resize functionality - from header
const startHeaderResize = (event) => {
  event.preventDefault()
  event.stopPropagation()

  const startX = event.clientX
  const startWidth = nodeWidth.value
  let rafId = null

  const onMouseMove = (e) => {
    if (rafId) cancelAnimationFrame(rafId)

    rafId = requestAnimationFrame(() => {
      const deltaX = e.clientX - startX
      const newWidth = Math.max(240, Math.min(600, startWidth + deltaX))
      nodeWidth.value = newWidth
    })
  }

  const onMouseUp = () => {
    if (rafId) cancelAnimationFrame(rafId)

    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''

    const nodeIndex = erdStore.nodes.findIndex(n => n.id === props.id)
    if (nodeIndex !== -1) {
      erdStore.nodes[nodeIndex].data.width = nodeWidth.value
    }
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  document.body.style.cursor = 'ew-resize'
  document.body.style.userSelect = 'none'
}
</script>

<style scoped>
.erd-table-node {
  background: #1a1f2e;
  border: 2px solid #63e2b7;
  border-radius: 8px;
  min-width: 240px;
  box-shadow: 0 4px 12px rgba(99, 226, 183, 0.2);
  position: relative;
  overflow: hidden;
}

.node-header {
  background: #63e2b7;
  color: #0f1419;
  padding: 10px;
  font-weight: 600;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-radius: 6px 6px 0 0;
  user-select: none;
}

.resize-indicator {
  cursor: ew-resize;
  font-size: 0.8rem;
  padding: 0 6px 0 2px;
  margin-left: -4px;
  color: rgba(15, 20, 25, 0.4);
  transition: all 0.2s;
  font-weight: bold;
}

.resize-indicator:hover {
  color: rgba(15, 20, 25, 0.7);
}

.table-info {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}

.table-name {
  font-size: 0.95rem;
  font-weight: 600;
}

.table-name-input {
  font-size: 0.95rem;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(15, 20, 25, 0.3);
  border-radius: 4px;
  padding: 2px 6px;
  color: #0f1419;
  outline: none;
  width: 120px;
}

.header-actions {
  display: flex;
  gap: 4px;
}

.action-button {
  background: rgba(15, 20, 25, 0.2);
  border: 1px solid rgba(15, 20, 25, 0.3);
  color: #0f1419;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  font-weight: bold;
  transition: all 0.2s;
  padding: 0;
  line-height: 1;
}

.action-button:hover {
  background: rgba(15, 20, 25, 0.4);
}

.close-button {
  background: rgba(15, 20, 25, 0.2);
  border: 1px solid rgba(15, 20, 25, 0.3);
  color: #0f1419;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.9rem;
  font-weight: bold;
  transition: all 0.2s;
  padding: 0;
  line-height: 1;
}

.close-button:hover {
  background: #ff4757;
  color: #fff;
  border-color: #ff4757;
}

.node-body {
  padding: 8px;
  max-height: none;
  overflow: visible;
  position: relative;
}

.column-row {
  padding: 6px 20px;
  color: #fff;
  font-size: 0.85rem;
  position: relative;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid rgba(99, 226, 183, 0.1);
  transition: background 0.2s;
  cursor: pointer;
}

.column-row:hover {
  background: rgba(99, 226, 183, 0.1);
}

.column-row:last-child {
  border-bottom: none;
}

.column-content {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.column-icons {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
}

.pk-icon {
  background: #ffd700;
  color: #0f1419;
  font-size: 0.6rem;
  font-weight: bold;
  padding: 1px 3px;
  border-radius: 2px;
}

.fk-icon {
  background: #63b3ed;
  color: #0f1419;
  font-size: 0.6rem;
  font-weight: bold;
  padding: 1px 3px;
  border-radius: 2px;
}

.column-name-text {
  color: #fff;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.column-type-text {
  color: #8896a8;
  font-size: 0.7rem;
  font-style: italic;
  flex-shrink: 0;
}

.not-null-badge {
  background: rgba(255, 71, 87, 0.2);
  color: #ff4757;
  font-size: 0.55rem;
  font-weight: bold;
  padding: 1px 3px;
  border-radius: 2px;
  flex-shrink: 0;
}

.empty-columns {
  padding: 16px;
  text-align: center;
  color: #8896a8;
  font-size: 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}

/* Column handles */
.column-handle {
  width: 10px !important;
  height: 10px !important;
  background: #63e2b7 !important;
  border: 2px solid #0f1419 !important;
  border-radius: 50% !important;
  position: absolute !important;
  cursor: crosshair !important;
  z-index: 10 !important;
  transition: all 0.2s;
}

.column-handle:hover {
  background: #4dd09a !important;
  transform: scale(1.4);
  box-shadow: 0 0 8px rgba(99, 226, 183, 0.6);
}

.column-handle-source {
  right: 0px !important;
}

.column-handle-target {
  left: 0px !important;
}

/* Resize handle */
.resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 24px;
  height: 24px;
  cursor: nwse-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #63e2b7;
  font-size: 1rem;
  opacity: 0.5;
  transition: all 0.2s;
  user-select: none;
  z-index: 100;
  background: linear-gradient(135deg, transparent 50%, rgba(99, 226, 183, 0.15) 50%);
  border-bottom-right-radius: 6px;
}

.resize-handle:hover {
  opacity: 1;
  background: linear-gradient(135deg, transparent 50%, rgba(99, 226, 183, 0.35) 50%);
}

.resize-handle svg {
  width: 14px;
  height: 14px;
  opacity: 0.8;
}

.erd-table-node:hover .resize-handle {
  opacity: 0.8;
}
</style>
