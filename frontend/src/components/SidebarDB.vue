<template>
  <div class="sidebar" :class="{ collapsed: isCollapsed }">
    <div v-show="!isCollapsed" class="sidebar-inner">
      <!-- App Logo/Title -->
      <div class="app-logo">
        <div class="logo-content">
          <h1>🛠️ DataCraft</h1>
          <p class="app-subtitle">Visual SQL Query Builder</p>
        </div>
        <!-- Toggle Button in Logo -->
        <button class="collapse-btn" @click="isCollapsed = true" title="Collapse Sidebar">
          ◀
        </button>
      </div>

      <div class="sidebar-header">
        <h3>📊 Database Schema</h3>
        <n-button size="small" @click="refreshSchema">
          Refresh
        </n-button>
      </div>

    <div class="sidebar-search">
      <n-input
        ref="searchInputRef"
        v-model:value="searchQuery"
        placeholder="Search tables... (Press / to focus)"
        clearable
        @keydown.esc="searchQuery = ''"
      >
        <template #prefix>
          <span>🔍</span>
        </template>
      </n-input>
      <div v-if="craftStore.schema.tables.length > 0" class="table-count">
        <span :class="{ 'filtered': searchQuery }">
          {{ filteredTables.length }}
        </span>
        of {{ craftStore.schema.tables.length }} tables
      </div>
    </div>

    <div class="sidebar-content">
      <div v-if="filteredTables.length === 0" class="empty-state">
        <p v-if="searchQuery">No tables found matching "{{ searchQuery }}"</p>
        <p v-else>No tables available</p>
      </div>

      <div v-else class="tables-list">
        <div
          v-for="table in filteredTables"
          :key="table.name"
          class="table-item"
        >
          <div class="table-item-header" @click="toggleTable(table.name)">
            <span class="collapse-icon">
              {{ expandedTables.has(table.name) ? '▼' : '▶' }}
            </span>
            <span class="table-item-name">{{ table.name }}</span>
            <n-button
              size="tiny"
              type="primary"
              class="add-button"
              @click.stop="addTableToCanvas(table)"
            >
              Add
            </n-button>
          </div>

          <div
            v-show="expandedTables.has(table.name)"
            class="table-item-content"
          >
            <div class="columns-list">
              <div
                v-for="column in table.columns"
                :key="column.name"
                class="column-item"
              >
                <span class="column-name">{{ column.name }}</span>
                <span class="column-type">{{ column.type }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

      <div class="sidebar-footer">
        <n-button block @click="handleDisconnect">
          Disconnect
        </n-button>
      </div>
    </div>

    <!-- Expand Button when collapsed -->
    <div v-if="isCollapsed" class="expand-button" @click="isCollapsed = false" title="Expand Sidebar">
      <span>▶</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import { useCraftStore } from '@/store/craftStore'
import { dbService } from '@/api/dbService'

const router = useRouter()
const message = useMessage()
const craftStore = useCraftStore()

const isCollapsed = ref(false)
const searchQuery = ref('')
const expandedTables = ref(new Set())
const searchInputRef = ref(null)

// Filter tables based on search query
const filteredTables = computed(() => {
  if (!searchQuery.value) {
    return craftStore.schema.tables
  }

  const query = searchQuery.value.toLowerCase()
  return craftStore.schema.tables.filter(table =>
    table.name.toLowerCase().includes(query)
  )
})

// Toggle table expansion
const toggleTable = (tableName) => {
  if (expandedTables.value.has(tableName)) {
    expandedTables.value.delete(tableName)
  } else {
    expandedTables.value.add(tableName)
  }
  // Force reactivity update
  expandedTables.value = new Set(expandedTables.value)
}

// Keyboard shortcut: Press "/" to focus search
const handleKeyDown = (e) => {
  // Focus search on "/" key (if not already in an input)
  if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
    e.preventDefault()
    searchInputRef.value?.focus()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
})

const addTableToCanvas = (table) => {
  // Check if table already exists
  const exists = craftStore.nodes.find(n => n.id === table.name)
  if (exists) {
    message.warning(`Table ${table.name} already added`)
    return
  }

  // Add node to store (CanvasCraft will handle positioning)
  const newNode = {
    id: table.name,
    type: 'custom',
    position: { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
    data: {
      table: table.name,
      columns: table.columns,
      selectedColumns: []
    }
  }

  craftStore.addNode(newNode)
  message.success(`Added ${table.name} to canvas`)
}

const refreshSchema = async () => {
  try {
    const result = await dbService.getSchema()
    craftStore.setSchema(result.data)
    message.success('Schema refreshed')
  } catch (error) {
    message.error('Failed to refresh schema')
  }
}

const handleDisconnect = () => {
  craftStore.clearConnection()
  router.push('/')
  message.info('Disconnected from database')
}
</script>

<style scoped>
.sidebar {
  width: 300px;
  background: #1a1f2e;
  border-right: 1px solid #2d3548;
  display: flex;
  flex-direction: column;
  position: relative;
  transition: width 0.3s ease;
}

.sidebar.collapsed {
  width: 40px;
  min-width: 40px;
}

.expand-button {
  position: absolute;
  top: 20px;
  left: 5px;
  width: 30px;
  height: 30px;
  background: #63e2b7;
  color: #0f1419;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: bold;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.expand-button:hover {
  background: #4dd09a;
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(99, 226, 183, 0.4);
}

.sidebar-inner {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.app-logo {
  padding: 20px;
  background: linear-gradient(135deg, #1e3a5f 0%, #1a1f2e 100%);
  border-bottom: 2px solid #63e2b7;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.logo-content {
  flex: 1;
}

.app-logo h1 {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: #fff;
  letter-spacing: 0.5px;
}

.app-subtitle {
  margin: 5px 0 0 0;
  font-size: 0.75rem;
  color: #63e2b7;
  font-weight: 500;
  letter-spacing: 0.3px;
}

.collapse-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.collapse-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: #63e2b7;
  color: #63e2b7;
  transform: scale(1.1);
}

.sidebar-header {
  padding: 20px;
  border-bottom: 1px solid #2d3548;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-header h3 {
  margin: 0;
  color: #fff;
  font-size: 1.1rem;
}

.sidebar-search {
  padding: 15px;
  border-bottom: 1px solid #2d3548;
}

.table-count {
  margin-top: 8px;
  font-size: 0.75rem;
  color: #8896a8;
  text-align: right;
}

.table-count .filtered {
  color: #63e2b7;
  font-weight: 700;
  font-size: 0.85rem;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #8896a8;
  font-size: 0.9rem;
}

.empty-state p {
  margin: 0;
}

/* Tables List */
.tables-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.table-item {
  background: rgba(255, 255, 255, 0.02);
  border-radius: 4px;
  overflow: hidden;
}

.table-item-header {
  display: flex;
  align-items: center;
  padding: 12px 12px;
  cursor: pointer;
  transition: background 0.2s;
  gap: 8px;
}

.table-item-header:hover {
  background: rgba(99, 226, 183, 0.1);
}

.collapse-icon {
  color: #8896a8;
  font-size: 0.7rem;
  width: 12px;
  flex-shrink: 0;
}

.table-item-name {
  flex: 1;
  color: #fff;
  font-weight: 500;
  font-size: 0.9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.add-button {
  width: 48px !important;
  flex-shrink: 0;
  margin-left: auto;
}

.table-item-content {
  border-top: 1px solid #2d3548;
  background: rgba(0, 0, 0, 0.2);
}

.columns-list {
  padding: 8px 0;
}

.column-item {
  display: flex;
  justify-content: space-between;
  padding: 6px 16px 6px 32px;
  font-size: 0.85rem;
}

.column-item:hover {
  background: rgba(99, 226, 183, 0.05);
}

.column-name {
  color: #63e2b7;
  font-weight: 500;
}

.column-type {
  color: #8896a8;
  font-size: 0.75rem;
}

.sidebar-footer {
  padding: 15px;
  border-top: 1px solid #2d3548;
}
</style>
