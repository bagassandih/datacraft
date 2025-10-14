<template>
  <div class="filter-panel" :class="{ collapsed: isCollapsed }">
    <!-- Toggle Button -->
    <div class="toggle-button" @click="isCollapsed = !isCollapsed" :title="isCollapsed ? 'Expand Query Builder' : 'Collapse Query Builder'">
      <span class="toggle-icon">{{ isCollapsed ? '◀' : '▶' }}</span>
    </div>

    <div v-show="!isCollapsed" class="panel-inner">
      <div class="panel-header">
        <h3>🔍 Query Builder</h3>
        <n-button
          size="small"
          @click="clearAll"
          title="Clear all clauses"
        >
          Clear All
        </n-button>
      </div>

      <div class="panel-content">
      <div v-if="!craftStore.hasNodes" class="empty-state">
        <p>Add tables to start building query</p>
      </div>

      <div v-else>
        <n-collapse :default-expanded-names="['aliases', 'where']">
          <!-- Table Aliases Section -->
          <n-collapse-item title="Table Aliases" name="aliases">
            <template #header-extra>
              <span v-if="craftStore.nodes.length > 0" class="badge">{{ craftStore.nodes.length }}</span>
            </template>

            <n-space vertical :size="8">
              <div
                v-for="node in craftStore.nodes"
                :key="node.id"
                class="alias-item-row"
              >
                <label class="alias-label-compact" :title="node.data.table">{{ node.data.table }}</label>
                <n-input
                  :value="node.data.alias"
                  @update:value="(value) => updateAlias(node.id, value)"
                  size="small"
                  placeholder="Alias"
                  class="alias-input-compact"
                />
              </div>
            </n-space>
          </n-collapse-item>

          <!-- WHERE Clause Section -->
          <n-collapse-item title="WHERE Conditions" name="where">
            <template #header-extra>
              <span v-if="activeFiltersCount > 0" class="badge">{{ activeFiltersCount }}</span>
            </template>

            <n-space vertical :size="12">
              <!-- Filter List -->
              <div v-for="(filter, index) in filters" :key="index" class="filter-item">
                <div class="filter-row">
                  <!-- Logic Operator (AND/OR) - show for 2nd+ filters -->
                  <n-select
                    v-if="index > 0"
                    v-model:value="filter.logic"
                    :options="logicOptions"
                    size="small"
                    style="width: 70px"
                  />

                  <!-- Table Selection -->
                  <n-select
                    v-model:value="filter.table"
                    :options="tableOptions"
                    placeholder="Table"
                    size="small"
                    filterable
                    :consistent-menu-width="false"
                    style="flex: 1; min-width: 100px"
                    @update:value="() => onTableChange(index)"
                  />

                  <!-- Column Selection -->
                  <n-select
                    v-model:value="filter.column"
                    :options="getColumnOptions(filter.table)"
                    placeholder="Column"
                    size="small"
                    filterable
                    :consistent-menu-width="false"
                    style="flex: 1; min-width: 100px"
                    :disabled="!filter.table"
                  />

                  <!-- Operator -->
                  <n-select
                    v-model:value="filter.operator"
                    :options="operatorOptions"
                    size="small"
                    style="width: 90px"
                  />

                  <!-- Value Input -->
                  <n-input
                    v-if="!['IS NULL', 'IS NOT NULL'].includes(filter.operator)"
                    v-model:value="filter.value"
                    placeholder="Value"
                    size="small"
                    style="flex: 1; min-width: 100px"
                  />

                  <!-- Remove Button -->
                  <n-button
                    size="small"
                    @click="removeFilter(index)"
                    type="error"
                    title="Remove filter"
                  >
                    ✕
                  </n-button>
                </div>
              </div>

              <!-- Add Filter Button -->
              <n-button
                block
                dashed
                size="small"
                @click="addFilter"
              >
                + Add WHERE Condition
              </n-button>

              <!-- Active Filters Preview -->
              <div v-if="activeFiltersCount > 0" class="clause-preview">
                <pre>{{ whereClause }}</pre>
              </div>
            </n-space>
          </n-collapse-item>

          <!-- ORDER BY Clause Section -->
          <n-collapse-item title="ORDER BY" name="orderby">
            <template #header-extra>
              <span v-if="orderBy.length > 0" class="badge">{{ orderBy.length }}</span>
            </template>

            <n-space vertical :size="12">
              <div v-for="(order, index) in orderBy" :key="index" class="filter-item">
                <div class="filter-row">
                  <!-- Table Selection -->
                  <n-select
                    v-model:value="order.table"
                    :options="tableOptions"
                    placeholder="Table"
                    size="small"
                    filterable
                    :consistent-menu-width="false"
                    style="flex: 1"
                    @update:value="() => onTableChangeOrder(index)"
                  />

                  <!-- Column Selection -->
                  <n-select
                    v-model:value="order.column"
                    :options="getColumnOptions(order.table)"
                    placeholder="Column"
                    size="small"
                    filterable
                    :consistent-menu-width="false"
                    style="flex: 1"
                    :disabled="!order.table"
                  />

                  <!-- Direction -->
                  <n-select
                    v-model:value="order.direction"
                    :options="[
                      { label: 'ASC', value: 'ASC' },
                      { label: 'DESC', value: 'DESC' }
                    ]"
                    size="small"
                    style="width: 80px"
                  />

                  <!-- Remove Button -->
                  <n-button
                    size="small"
                    @click="removeOrderBy(index)"
                    type="error"
                  >
                    ✕
                  </n-button>
                </div>
              </div>

              <n-button
                block
                dashed
                size="small"
                @click="addOrderBy"
              >
                + Add ORDER BY
              </n-button>

              <div v-if="orderBy.length > 0" class="clause-preview">
                <pre>{{ orderByClause }}</pre>
              </div>
            </n-space>
          </n-collapse-item>

          <!-- GROUP BY Clause Section -->
          <n-collapse-item title="GROUP BY" name="groupby">
            <template #header-extra>
              <span v-if="groupBy.length > 0" class="badge">{{ groupBy.length }}</span>
            </template>

            <div class="group-by-hint">
              <span class="hint-icon">⚠️</span>
              <span class="hint-text">Important: When using GROUP BY, make sure all selected columns in the canvas are either listed here or used in aggregate functions (COUNT, SUM, etc). Otherwise, you may get SQL error.</span>
            </div>

            <n-space vertical :size="12">
              <div v-for="(group, index) in groupBy" :key="index" class="filter-item">
                <div class="filter-row">
                  <!-- Table Selection -->
                  <n-select
                    v-model:value="group.table"
                    :options="tableOptions"
                    placeholder="Table"
                    size="small"
                    filterable
                    :consistent-menu-width="false"
                    style="flex: 1"
                    @update:value="() => onTableChangeGroup(index)"
                  />

                  <!-- Column Selection -->
                  <n-select
                    v-model:value="group.column"
                    :options="getColumnOptions(group.table)"
                    placeholder="Column"
                    size="small"
                    filterable
                    :consistent-menu-width="false"
                    style="flex: 1"
                    :disabled="!group.table"
                  />

                  <!-- Remove Button -->
                  <n-button
                    size="small"
                    @click="removeGroupBy(index)"
                    type="error"
                  >
                    ✕
                  </n-button>
                </div>
              </div>

              <n-button
                block
                dashed
                size="small"
                @click="addGroupBy"
              >
                + Add GROUP BY
              </n-button>

              <div v-if="groupBy.length > 0" class="clause-preview">
                <pre>{{ groupByClause }}</pre>
              </div>
            </n-space>
          </n-collapse-item>

          <!-- HAVING Clause Section -->
          <n-collapse-item title="HAVING Conditions" name="having">
            <template #header-extra>
              <span v-if="activeHavingCount > 0" class="badge">{{ activeHavingCount }}</span>
            </template>

            <n-space vertical :size="12">
              <div v-for="(having, index) in havingConditions" :key="index" class="filter-item">
                <div class="filter-row">
                  <!-- Logic Operator (AND/OR) - show for 2nd+ -->
                  <n-select
                    v-if="index > 0"
                    v-model:value="having.logic"
                    :options="logicOptions"
                    size="small"
                    style="width: 70px"
                  />

                  <!-- Aggregate Function -->
                  <n-select
                    v-model:value="having.aggregate"
                    :options="[
                      { label: 'COUNT', value: 'COUNT' },
                      { label: 'SUM', value: 'SUM' },
                      { label: 'AVG', value: 'AVG' },
                      { label: 'MAX', value: 'MAX' },
                      { label: 'MIN', value: 'MIN' }
                    ]"
                    placeholder="Function"
                    size="small"
                    style="width: 90px"
                  />

                  <!-- Table Selection -->
                  <n-select
                    v-model:value="having.table"
                    :options="tableOptions"
                    placeholder="Table"
                    size="small"
                    filterable
                    :consistent-menu-width="false"
                    style="flex: 1"
                    @update:value="() => onTableChangeHaving(index)"
                  />

                  <!-- Column Selection -->
                  <n-select
                    v-model:value="having.column"
                    :options="getColumnOptions(having.table)"
                    placeholder="Column"
                    size="small"
                    filterable
                    :consistent-menu-width="false"
                    style="flex: 1"
                    :disabled="!having.table"
                  />

                  <!-- Operator -->
                  <n-select
                    v-model:value="having.operator"
                    :options="operatorOptions.filter(o => !['IS NULL', 'IS NOT NULL', 'LIKE', 'NOT LIKE'].includes(o.value))"
                    size="small"
                    style="width: 70px"
                  />

                  <!-- Value -->
                  <n-input
                    v-model:value="having.value"
                    placeholder="Value"
                    size="small"
                    style="width: 80px"
                  />

                  <!-- Remove Button -->
                  <n-button
                    size="small"
                    @click="removeHaving(index)"
                    type="error"
                  >
                    ✕
                  </n-button>
                </div>
              </div>

              <n-button
                block
                dashed
                size="small"
                @click="addHaving"
              >
                + Add HAVING Condition
              </n-button>

              <div v-if="activeHavingCount > 0" class="clause-preview">
                <pre>{{ havingClause }}</pre>
              </div>
            </n-space>
          </n-collapse-item>
        </n-collapse>
      </div>
    </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useCraftStore } from '@/store/craftStore'

const craftStore = useCraftStore()

const isCollapsed = ref(false)
const filters = ref([])
const orderBy = ref([])
const groupBy = ref([])
const havingConditions = ref([])

const logicOptions = [
  { label: 'AND', value: 'AND' },
  { label: 'OR', value: 'OR' }
]

const operatorOptions = [
  { label: '=', value: '=' },
  { label: '!=', value: '!=' },
  { label: '>', value: '>' },
  { label: '<', value: '<' },
  { label: '>=', value: '>=' },
  { label: '<=', value: '<=' },
  { label: 'LIKE', value: 'LIKE' },
  { label: 'NOT LIKE', value: 'NOT LIKE' },
  { label: 'IN', value: 'IN' },
  { label: 'NOT IN', value: 'NOT IN' },
  { label: 'IS NULL', value: 'IS NULL' },
  { label: 'IS NOT NULL', value: 'IS NOT NULL' }
]

// Get table options from nodes
const tableOptions = computed(() => {
  return craftStore.nodes.map(node => ({
    label: `${node.data.table} (${node.data.alias})`,
    value: node.data.table
  }))
})

// Get column options for a specific table
const getColumnOptions = (tableName) => {
  const node = craftStore.nodes.find(n => n.data.table === tableName)
  if (!node) return []

  return node.data.columns.map(col => ({
    label: `${col.name} (${col.type})`,
    value: col.name
  }))
}

// Handle table change - reset column selection
const onTableChange = (index) => {
  filters.value[index].column = null
}

// Add new filter
const addFilter = () => {
  filters.value.push({
    logic: 'AND',
    table: null,
    column: null,
    operator: '=',
    value: ''
  })
}

// Remove filter
const removeFilter = (index) => {
  filters.value.splice(index, 1)
}

// Clear all filters
const clearFilters = () => {
  filters.value = []
}

// Clear all
const clearAll = () => {
  filters.value = []
  orderBy.value = []
  groupBy.value = []
  havingConditions.value = []
}

// ORDER BY functions
const addOrderBy = () => {
  orderBy.value.push({
    table: null,
    column: null,
    direction: 'ASC'
  })
}

const removeOrderBy = (index) => {
  orderBy.value.splice(index, 1)
}

const onTableChangeOrder = (index) => {
  orderBy.value[index].column = null
}

// GROUP BY functions
const addGroupBy = () => {
  groupBy.value.push({
    table: null,
    column: null
  })
}

const removeGroupBy = (index) => {
  groupBy.value.splice(index, 1)
}

const onTableChangeGroup = (index) => {
  groupBy.value[index].column = null
}

// HAVING functions
const addHaving = () => {
  havingConditions.value.push({
    logic: 'AND',
    aggregate: 'COUNT',
    table: null,
    column: null,
    operator: '>',
    value: ''
  })
}

const removeHaving = (index) => {
  havingConditions.value.splice(index, 1)
}

const onTableChangeHaving = (index) => {
  havingConditions.value[index].column = null
}

// Count active filters (complete filters only)
const activeFiltersCount = computed(() => {
  return filters.value.filter(f => {
    if (['IS NULL', 'IS NOT NULL'].includes(f.operator)) {
      return f.table && f.column
    }
    return f.table && f.column && f.value
  }).length
})

// Generate WHERE clause preview
const whereClause = computed(() => {
  const validFilters = filters.value.filter(f => {
    if (['IS NULL', 'IS NOT NULL'].includes(f.operator)) {
      return f.table && f.column
    }
    return f.table && f.column && f.value
  })

  if (validFilters.length === 0) return ''

  const clauses = validFilters.map((filter, index) => {
    const node = craftStore.nodes.find(n => n.data.table === filter.table)
    const alias = node?.data.alias || filter.table

    let clause = `${alias}.${filter.column} ${filter.operator}`

    if (!['IS NULL', 'IS NOT NULL'].includes(filter.operator)) {
      // Handle IN operator - expect comma-separated values
      if (filter.operator === 'IN' || filter.operator === 'NOT IN') {
        clause += ` (${filter.value})`
      } else if (filter.operator === 'LIKE' || filter.operator === 'NOT LIKE') {
        clause += ` '${filter.value}'`
      } else {
        // Try to detect if value is number
        const isNumber = !isNaN(filter.value) && filter.value.trim() !== ''
        clause += isNumber ? ` ${filter.value}` : ` '${filter.value}'`
      }
    }

    if (index > 0) {
      return `${filter.logic} ${clause}`
    }
    return clause
  })

  return 'WHERE ' + clauses.join('\n')
})

// Generate ORDER BY clause
const orderByClause = computed(() => {
  const validOrders = orderBy.value.filter(o => o.table && o.column)
  if (validOrders.length === 0) return ''

  const clauses = validOrders.map(order => {
    const node = craftStore.nodes.find(n => n.data.table === order.table)
    const alias = node?.data.alias || order.table
    return `${alias}.${order.column} ${order.direction}`
  })

  return 'ORDER BY ' + clauses.join(', ')
})

// Generate GROUP BY clause
const groupByClause = computed(() => {
  const validGroups = groupBy.value.filter(g => g.table && g.column)
  if (validGroups.length === 0) return ''

  const clauses = validGroups.map(group => {
    const node = craftStore.nodes.find(n => n.data.table === group.table)
    const alias = node?.data.alias || group.table
    return `${alias}.${group.column}`
  })

  return 'GROUP BY ' + clauses.join(', ')
})

// Count active HAVING conditions
const activeHavingCount = computed(() => {
  return havingConditions.value.filter(h =>
    h.aggregate && h.table && h.column && h.value
  ).length
})

// Generate HAVING clause
const havingClause = computed(() => {
  const validHaving = havingConditions.value.filter(h =>
    h.aggregate && h.table && h.column && h.value
  )
  if (validHaving.length === 0) return ''

  const clauses = validHaving.map((having, index) => {
    const node = craftStore.nodes.find(n => n.data.table === having.table)
    const alias = node?.data.alias || having.table

    let clause = `${having.aggregate}(${alias}.${having.column}) ${having.operator}`

    const isNumber = !isNaN(having.value) && having.value.trim() !== ''
    clause += isNumber ? ` ${having.value}` : ` '${having.value}'`

    if (index > 0) {
      return `${having.logic} ${clause}`
    }
    return clause
  })

  return 'HAVING ' + clauses.join(' ')
})

// Watch all clauses and save to store
watch([filters, orderBy, groupBy, havingConditions], () => {
  craftStore.setQueryClauses({
    filters: filters.value,
    orderBy: orderBy.value,
    groupBy: groupBy.value,
    having: havingConditions.value
  })
}, { deep: true })

// Load from store on mount
if (craftStore.queryClauses) {
  filters.value = craftStore.queryClauses.filters || []
  orderBy.value = craftStore.queryClauses.orderBy || []
  groupBy.value = craftStore.queryClauses.groupBy || []
  havingConditions.value = craftStore.queryClauses.having || []
}

// Update alias
const updateAlias = (nodeId, newAlias) => {
  craftStore.updateNodeAlias(nodeId, newAlias)
}
</script>

<style scoped>
.filter-panel {
  width: 350px;
  background: #1a1f2e;
  border-left: 1px solid #2d3548;
  display: flex;
  flex-direction: column;
  position: relative;
  transition: width 0.3s ease;
}

.filter-panel.collapsed {
  width: 40px;
  min-width: 40px;
}

.toggle-button {
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  background: #63e2b7;
  color: #0f1419;
  width: 30px;
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 0 8px 8px 0;
  z-index: 10;
  transition: all 0.2s;
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.2);
}

.toggle-button:hover {
  background: #4dd09a;
  width: 35px;
  box-shadow: 3px 0 12px rgba(99, 226, 183, 0.4);
}

.toggle-icon {
  font-size: 1rem;
  font-weight: bold;
}

.panel-inner {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding-left: 35px;
}

.panel-header {
  padding: 20px;
  border-bottom: 1px solid #2d3548;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.panel-header h3 {
  margin: 0;
  color: #fff;
  font-size: 1.1rem;
}

.panel-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.empty-state {
  color: #8896a8;
  text-align: center;
  padding: 40px 20px;
}

.filter-item {
  background: rgba(99, 226, 183, 0.05);
  padding: 12px;
  border-radius: 6px;
  border: 1px solid rgba(99, 226, 183, 0.2);
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.badge {
  background: #63e2b7;
  color: #0f1419;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.7rem;
  font-weight: 700;
  margin-left: 8px;
}

.clause-preview {
  background: #000;
  color: #63e2b7;
  padding: 12px;
  border-radius: 6px;
  font-family: 'Courier New', monospace;
  font-size: 0.75rem;
  overflow-x: auto;
  border: 1px solid #2d3548;
}

.clause-preview pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
}

/* Collapse Item Headers - More Clickable & Aligned */
:deep(.n-collapse-item__header) {
  background: rgba(99, 226, 183, 0.08) !important;
  padding: 14px 16px !important;
  font-weight: 600;
  color: #fff !important;
  cursor: pointer !important;
  border-radius: 6px !important;
  margin-bottom: 8px !important;
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

:deep(.n-collapse-item__header:active) {
  transform: translateX(1px);
}

:deep(.n-collapse-item__header-main) {
  color: #fff !important;
  font-size: 0.9rem;
}

:deep(.n-collapse-item__content-inner) {
  padding: 15px !important;
  padding-top: 12px !important;
}

/* Arrow icon styling */
:deep(.n-collapse-item__header .n-collapse-item-arrow) {
  color: #63e2b7 !important;
  transition: transform 0.3s ease, color 0.2s ease;
}

:deep(.n-collapse-item__header:hover .n-collapse-item-arrow) {
  color: #4dd09a !important;
}

/* Collapse spacing */
:deep(.n-collapse) {
  display: flex;
  flex-direction: column;
  gap: 0;
}

:deep(.n-collapse-item) {
  margin-bottom: 0 !important;
}

/* Fix dropdown text overflow */
:deep(.n-base-selection) {
  width: 100%;
}

:deep(.n-base-select-menu) {
  min-width: 250px !important;
  max-width: 400px !important;
}

:deep(.n-base-select-option) {
  min-height: auto !important;
  padding: 8px 12px !important;
}

:deep(.n-base-select-option__content) {
  white-space: normal !important;
  word-wrap: break-word !important;
  word-break: break-word !important;
  line-height: 1.5 !important;
  overflow-wrap: break-word !important;
}

/* Group BY hint */
.group-by-hint {
  background: rgba(255, 193, 7, 0.1);
  border: 1px solid rgba(255, 193, 7, 0.4);
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 12px;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.group-by-hint .hint-icon {
  font-size: 0.9rem;
  flex-shrink: 0;
  margin-top: 1px;
}

.group-by-hint .hint-text {
  color: #ffc107;
  font-size: 0.75rem;
  line-height: 1.4;
  flex: 1;
}

/* Alias Item Row - Compact Design */
.alias-item-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
}

.alias-label-compact {
  color: #8896a8;
  font-size: 0.8rem;
  min-width: 80px;
  max-width: 140px;
  font-family: monospace;
  font-weight: 500;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: help;
}

.alias-input-compact {
  flex: 1;
  min-width: 100px;
}
</style>
