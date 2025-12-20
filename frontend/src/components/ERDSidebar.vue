<template>
  <div class="sidebar" :class="{ collapsed: isCollapsed }">
    <div v-show="!isCollapsed" class="sidebar-inner">
      <!-- App Logo/Title -->
      <div class="app-logo">
        <div class="logo-content">
          <h1>DataCraft</h1>
          <p class="app-subtitle">Crafting ERD</p>
        </div>
        <button class="collapse-btn" @click="isCollapsed = true" title="Collapse Sidebar">
          &lt;
        </button>
      </div>

      <!-- Accordion Sections -->
      <div class="sidebar-accordion">
        <n-collapse :default-expanded-names="['tables', 'create']" accordion>
          <!-- Settings Section -->
          <n-collapse-item title="Settings" name="settings">
            <n-space vertical :size="12">
              <!-- Standardization -->
              <div>
                <label class="field-label">Standardization</label>
                <n-select
                  v-model:value="standardization"
                  :options="standardizationOptions"
                  size="small"
                  @update:value="onStandardizationChange"
                />
              </div>

              <n-button
                v-if="standardization === 'bsi_uii' && erdStore.hasTables"
                size="small"
                block
                @click="handleUpdateAllBsiUii"
                title="Sync all tables with latest BSI UII template"
              >
                Sync BSI UII
              </n-button>

              <!-- Load from DB -->
              <n-button
                block
                size="small"
                type="info"
                @click="openLoadFromDBModal"
                :disabled="!craftStore.hasSchema"
              >
                Load from Database
              </n-button>
            </n-space>
          </n-collapse-item>

          <!-- Create Table Section -->
          <n-collapse-item title="Create Table" name="create">
            <n-form ref="tableFormRef" :model="tableForm" :rules="tableRules" size="small">
              <n-form-item label="Table Name" path="name" :show-feedback="false">
                <n-input
                  v-model:value="tableForm.name"
                  placeholder="e.g., users"
                  @keyup.enter="createTable"
                />
              </n-form-item>

              <n-checkbox
                v-if="standardization === 'bsi_uii'"
                v-model:checked="tableForm.useStandardColumns"
                style="margin: 8px 0"
              >
                Use BSI UII columns
              </n-checkbox>

              <n-button
                type="primary"
                block
                size="small"
                style="margin-top: 8px"
                @click="createTable"
              >
                Create
              </n-button>
            </n-form>
          </n-collapse-item>

          <!-- Tables List Section -->
          <n-collapse-item name="tables">
            <template #header>
              <span>Tables</span>
            </template>
            <template #header-extra>
              <span class="badge">{{ erdStore.tables.length }}</span>
            </template>

            <div class="tables-list-content">
              <div v-if="erdStore.tables.length === 0" class="empty-state">
                <p>No tables yet</p>
              </div>

              <div v-else class="tables-list">
                <div
                  v-for="table in erdStore.tables"
                  :key="table.id"
                  class="table-item"
                >
                  <div class="table-item-header" @click="toggleTable(table.id)">
                    <span class="collapse-icon">
                      {{ expandedTables.has(table.id) ? 'v' : '>' }}
                    </span>
                    <span class="table-item-name">{{ table.name }}</span>
                    <span class="column-count">{{ table.columns.length }}</span>
                  </div>

                  <div
                    v-show="expandedTables.has(table.id)"
                    class="table-item-content"
                  >
                    <div class="columns-list">
                      <div
                        v-for="column in table.columns"
                        :key="column.id"
                        class="column-item"
                      >
                        <div class="column-info">
                          <span v-if="column.isPrimaryKey" class="pk-badge">PK</span>
                          <span class="column-name">{{ column.name }}</span>
                        </div>
                        <span class="column-type">{{ column.type }}</span>
                      </div>
                    </div>

                    <div v-if="standardization === 'bsi_uii'" class="table-actions">
                      <n-button
                        size="tiny"
                        @click="applyBsiUiiToTable(table.id)"
                        :disabled="hasBsiUiiColumns(table)"
                      >
                        Apply BSI UII
                      </n-button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </n-collapse-item>
        </n-collapse>
      </div>

      <!-- Footer Actions -->
      <div class="sidebar-footer">
        <div class="craft-actions">
          <n-button size="small" @click="handleExportJson" :disabled="!erdStore.hasTables">
            Export JSON
          </n-button>
          <n-button size="small" @click="triggerImport">
            Import
          </n-button>
          <input
            ref="fileInputRef"
            type="file"
            accept=".json"
            style="display: none"
            @change="handleImport"
          />
        </div>
        <n-button block type="error" ghost @click="handleDisconnect">
          Disconnect
        </n-button>
      </div>
    </div>

    <!-- Expand Button when collapsed -->
    <div v-if="isCollapsed" class="expand-button" @click="isCollapsed = false" title="Expand Sidebar">
      <span>&gt;</span>
    </div>

    <!-- Load from DB Modal -->
    <n-modal
      v-model:show="showLoadFromDBModal"
      preset="card"
      title="Select Tables from Database"
      style="width: 500px; max-height: 80vh"
    >
      <div class="db-tables-modal">
        <n-input
          v-model:value="dbTableSearch"
          placeholder="Search tables..."
          clearable
          style="margin-bottom: 12px"
        />

        <div class="select-actions">
          <n-button size="small" @click="selectAllTables">Select All</n-button>
          <n-button size="small" @click="deselectAllTables">Deselect All</n-button>
          <span class="selected-count">{{ selectedDbTables.length }} selected</span>
        </div>

        <n-checkbox-group v-model:value="selectedDbTables" class="tables-checkbox-group">
          <div
            v-for="table in filteredDbTables"
            :key="table.name"
            class="table-checkbox-item"
          >
            <n-checkbox :value="table.name" :label="table.name" />
            <span class="column-count-badge">{{ table.columns.length }} cols</span>
          </div>
        </n-checkbox-group>

        <div v-if="filteredDbTables.length === 0" class="empty-search">
          No tables found matching "{{ dbTableSearch }}"
        </div>
      </div>

      <template #footer>
        <n-space justify="end">
          <n-button @click="showLoadFromDBModal = false">Cancel</n-button>
          <n-button
            type="primary"
            :disabled="selectedDbTables.length === 0"
            @click="loadSelectedTables"
          >
            Load {{ selectedDbTables.length }} Table(s)
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import { useErdStore } from '@/store/erdStore'
import { useCraftStore } from '@/store/craftStore'
import { dbService } from '@/api/dbService'

const router = useRouter()
const message = useMessage()
const erdStore = useErdStore()
const craftStore = useCraftStore()

// Load from DB Modal
const showLoadFromDBModal = ref(false)
const dbTableSearch = ref('')
const selectedDbTables = ref([])

const filteredDbTables = computed(() => {
  if (!craftStore.schema.tables) return []
  if (!dbTableSearch.value) return craftStore.schema.tables

  const search = dbTableSearch.value.toLowerCase()
  return craftStore.schema.tables.filter(t =>
    t.name.toLowerCase().includes(search)
  )
})

const openLoadFromDBModal = () => {
  selectedDbTables.value = []
  dbTableSearch.value = ''
  showLoadFromDBModal.value = true
}

const selectAllTables = () => {
  selectedDbTables.value = filteredDbTables.value.map(t => t.name)
}

const deselectAllTables = () => {
  selectedDbTables.value = []
}

const loadSelectedTables = () => {
  if (selectedDbTables.value.length === 0) return

  let loadedCount = 0
  let skippedCount = 0

  selectedDbTables.value.forEach((tableName, index) => {
    // Check if table already exists in ERD
    const exists = erdStore.tables.some(t => t.name === tableName)
    if (exists) {
      skippedCount++
      return
    }

    // Find table in schema
    const schemaTable = craftStore.schema.tables.find(t => t.name === tableName)
    if (!schemaTable) return

    // Convert schema columns to ERD column format
    const columns = schemaTable.columns.map(col => ({
      id: erdStore.generateColumnId(),
      name: col.name,
      type: mapDbTypeToErdType(col.type),
      length: extractLength(col.type),
      nullable: col.nullable !== false,
      defaultValue: col.default || null,
      isPrimaryKey: col.isPrimary || false,
      isAutoIncrement: col.autoIncrement || false
    }))

    // Calculate position for new table (grid layout)
    const row = Math.floor((erdStore.tables.length + loadedCount) / 3)
    const col = (erdStore.tables.length + loadedCount) % 3
    const position = {
      x: 100 + col * 350,
      y: 100 + row * 300
    }

    // Add table at position
    erdStore.addTableAtPosition(tableName, position, false)

    // Get the newly created table and update its columns
    const newTable = erdStore.tables[erdStore.tables.length - 1]
    if (newTable) {
      // Clear default columns and set schema columns
      columns.forEach(col => {
        erdStore.addColumn(newTable.id, col)
      })
    }

    loadedCount++
  })

  showLoadFromDBModal.value = false

  if (loadedCount > 0) {
    message.success(`Loaded ${loadedCount} table(s) from database`)
  }
  if (skippedCount > 0) {
    message.info(`Skipped ${skippedCount} table(s) that already exist`)
  }
}

// Helper to map DB type to ERD type
const mapDbTypeToErdType = (dbType) => {
  if (!dbType) return 'VARCHAR'

  const type = dbType.toUpperCase()

  // Handle types with length like VARCHAR(255)
  const baseType = type.replace(/\(.*\)/, '').trim()

  // Map common types
  const typeMap = {
    'INT': 'INT',
    'INTEGER': 'INT',
    'BIGINT': 'BIGINT',
    'SMALLINT': 'SMALLINT',
    'TINYINT': 'TINYINT',
    'MEDIUMINT': 'MEDIUMINT',
    'VARCHAR': 'VARCHAR',
    'CHAR': 'CHAR',
    'TEXT': 'TEXT',
    'LONGTEXT': 'LONGTEXT',
    'MEDIUMTEXT': 'MEDIUMTEXT',
    'DATETIME': 'DATETIME',
    'DATE': 'DATE',
    'TIME': 'TIME',
    'TIMESTAMP': 'TIMESTAMP',
    'DECIMAL': 'DECIMAL',
    'FLOAT': 'FLOAT',
    'DOUBLE': 'DOUBLE',
    'BOOLEAN': 'BOOLEAN',
    'BOOL': 'BOOLEAN',
    'BLOB': 'BLOB',
    'JSON': 'JSON',
    'UUID': 'VARCHAR'
  }

  // Check for UNSIGNED
  if (type.includes('UNSIGNED')) {
    return (typeMap[baseType] || baseType) + ' UNSIGNED'
  }

  return typeMap[baseType] || baseType
}

// Helper to extract length from type like VARCHAR(255)
const extractLength = (dbType) => {
  if (!dbType) return null
  const match = dbType.match(/\((\d+)\)/)
  return match ? parseInt(match[1]) : null
}

const isCollapsed = ref(false)
const expandedTables = ref(new Set())
const fileInputRef = ref(null)
const tableFormRef = ref(null)

// Standardization
const standardization = ref(erdStore.standardization)

const standardizationOptions = [
  { label: 'None', value: 'none' },
  { label: 'BSI UII', value: 'bsi_uii' }
]

const onStandardizationChange = (value) => {
  erdStore.setStandardization(value)
}

const handleUpdateAllBsiUii = () => {
  erdStore.updateAllBsiUiiColumns()
  message.success('All BSI UII columns updated to latest template')
}

// Table creation form
const tableForm = reactive({
  name: '',
  useStandardColumns: true
})

const tableRules = {
  name: [
    { required: true, message: 'Please enter table name' },
    {
      validator: (rule, value) => {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
          return new Error('Table name must start with letter or underscore and contain only alphanumeric characters')
        }
        return true
      }
    }
  ]
}

const createTable = async () => {
  try {
    await tableFormRef.value?.validate()

    // Check for duplicate name
    const exists = erdStore.tables.some(
      t => t.name.toLowerCase() === tableForm.name.toLowerCase()
    )

    if (exists) {
      message.error('Table with this name already exists')
      return
    }

    const useStandardCols = standardization.value === 'bsi_uii' && tableForm.useStandardColumns

    erdStore.createTable(tableForm.name, useStandardCols)
    message.success(`Table "${tableForm.name}" created`)

    // Reset form
    tableForm.name = ''
    tableForm.useStandardColumns = true
  } catch (error) {
    // Validation failed
  }
}

// Toggle table expansion
const toggleTable = (tableId) => {
  if (expandedTables.value.has(tableId)) {
    expandedTables.value.delete(tableId)
  } else {
    expandedTables.value.add(tableId)
  }
  expandedTables.value = new Set(expandedTables.value)
}

// Check if table already has BSI UII columns
const hasBsiUiiColumns = (table) => {
  const bsiColumns = ['id', 'uuid', 'user_input', 'user_update', 'tgl_input', 'tgl_update', 'flag_aktif', 'flag_delete']
  return bsiColumns.every(col => table.columns.some(c => c.name === col))
}

// Apply BSI UII columns to existing table
const applyBsiUiiToTable = (tableId) => {
  erdStore.applyBsiUiiColumns(tableId)
  message.success('BSI UII columns applied')
}

// Export JSON
const handleExportJson = () => {
  erdStore.exportERD()
  message.success('ERD exported as JSON')
}

// Import
const triggerImport = () => {
  fileInputRef.value?.click()
}

const handleImport = async (event) => {
  const file = event.target.files?.[0]
  if (!file) return

  try {
    const text = await file.text()
    const erdData = JSON.parse(text)

    const result = erdStore.importERD(erdData)

    if (result.success) {
      message.success('ERD imported successfully')
    } else {
      message.error(result.error || 'Failed to import ERD')
    }
  } catch (error) {
    message.error('Invalid JSON file')
  }

  event.target.value = ''
}

// Disconnect from database
const handleDisconnect = async () => {
  try {
    await dbService.disconnect()
    craftStore.clearConnection()
    erdStore.resetCanvas()
    message.success('Disconnected from database')
    router.push('/')
  } catch (error) {
    message.error(error.message || 'Failed to disconnect')
  }
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
}

.app-subtitle {
  margin: 5px 0 0 0;
  font-size: 0.75rem;
  color: #63e2b7;
  font-weight: 500;
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
}

.collapse-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: #63e2b7;
  color: #63e2b7;
}

/* Accordion Section */
.sidebar-accordion {
  flex: 1;
  overflow-y: auto;
  padding: 15px;
}

.field-label {
  display: block;
  color: #8896a8;
  font-size: 0.75rem;
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.badge {
  background: #63e2b7;
  color: #0f1419;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 700;
}

/* Collapse Item Headers */
:deep(.n-collapse-item__header) {
  background: rgba(99, 226, 183, 0.08) !important;
  padding: 12px 14px !important;
  font-weight: 600;
  color: #fff !important;
  cursor: pointer !important;
  border-radius: 6px !important;
  margin-bottom: 6px !important;
  border: 1px solid rgba(99, 226, 183, 0.15) !important;
  transition: all 0.2s ease !important;
  user-select: none;
}

:deep(.n-collapse-item__header:hover) {
  background: rgba(99, 226, 183, 0.15) !important;
  border-color: rgba(99, 226, 183, 0.3) !important;
  transform: translateX(2px);
  box-shadow: 0 2px 8px rgba(99, 226, 183, 0.1);
}

:deep(.n-collapse-item__header-main) {
  color: #fff !important;
  font-size: 0.85rem;
}

:deep(.n-collapse-item__content-inner) {
  padding: 12px !important;
  padding-top: 10px !important;
}

:deep(.n-collapse-item__header .n-collapse-item-arrow) {
  color: #63e2b7 !important;
  transition: transform 0.3s ease, color 0.2s ease;
}

:deep(.n-collapse-item__header:hover .n-collapse-item-arrow) {
  color: #4dd09a !important;
}

:deep(.n-collapse) {
  display: flex;
  flex-direction: column;
  gap: 0;
}

:deep(.n-collapse-item) {
  margin-bottom: 0 !important;
}

.tables-list-content {
  max-height: 350px;
  overflow-y: auto;
}

.sidebar-section {
  padding: 15px;
  border-bottom: 1px solid #2d3548;
}

.sidebar-section.flex-grow {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar-section h3 {
  margin: 0 0 12px 0;
  color: #fff;
  font-size: 0.95rem;
}

.section-header {
  margin-bottom: 12px;
}

.section-header h3 {
  margin: 0;
}

.standardization-hint {
  margin: 8px 0 0 0;
  font-size: 0.75rem;
  color: #8896a8;
  line-height: 1.4;
}

.sidebar-content {
  flex: 1;
  overflow-y: auto;
}

.empty-state {
  text-align: center;
  padding: 20px;
  color: #8896a8;
}

.empty-state p {
  margin: 0;
  font-size: 0.9rem;
}

.empty-state .hint {
  margin-top: 8px;
  font-size: 0.8rem;
  opacity: 0.7;
}

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
  padding: 10px 12px;
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
  font-family: monospace;
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

.column-count {
  background: rgba(99, 226, 183, 0.2);
  color: #63e2b7;
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 10px;
  font-weight: 600;
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
  align-items: center;
  padding: 6px 16px 6px 32px;
  font-size: 0.85rem;
}

.column-item:hover {
  background: rgba(99, 226, 183, 0.05);
}

.column-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pk-badge {
  background: #ffd700;
  color: #0f1419;
  font-size: 0.55rem;
  font-weight: bold;
  padding: 1px 4px;
  border-radius: 2px;
}

.column-name {
  color: #63e2b7;
  font-weight: 500;
}

.column-type {
  color: #8896a8;
  font-size: 0.75rem;
}

.table-actions {
  padding: 8px 12px;
  border-top: 1px solid #2d3548;
}

.sidebar-footer {
  padding: 15px;
  border-top: 1px solid #2d3548;
}

.craft-actions {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
}

.craft-actions .n-button {
  flex: 1;
}

/* Load from DB Modal */
.db-tables-modal {
  max-height: 400px;
  overflow-y: auto;
}

.select-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid #2d3548;
}

.selected-count {
  margin-left: auto;
  color: #63e2b7;
  font-size: 0.85rem;
}

.tables-checkbox-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.table-checkbox-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 4px;
  transition: background 0.2s;
}

.table-checkbox-item:hover {
  background: rgba(99, 226, 183, 0.1);
}

.column-count-badge {
  font-size: 0.75rem;
  color: #8896a8;
  background: rgba(255, 255, 255, 0.05);
  padding: 2px 8px;
  border-radius: 10px;
}

.empty-search {
  text-align: center;
  color: #8896a8;
  padding: 20px;
}
</style>
