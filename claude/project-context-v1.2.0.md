# DataCraft - Project Context & History

> **Last Updated**: December 8, 2025
> **Version**: 1.2.0
> **Status**: Production Ready - Export/Import & Collation Warning

---

## Quick Overview

**DataCraft** is a full-stack **Visual SQL Query Builder** that enables developers to create complex SQL queries visually using a drag-and-drop interface. This project was born from the frustration developers often face when forgetting column names, table relationships, and having to write repetitive JOIN queries manually.

### Core Philosophy
> **"Less typing, more thinking."**

---

## What's New in v1.2.0

### Feature Release - Export/Import & Collation Warning

This release adds **craft persistence** and **collation mismatch detection** to help users save their work and identify potential query issues.

### New Features

#### 1. Export/Import Craft
- **Export Craft** - Save current canvas state (tables, joins, positions) to JSON file
- **Import Craft** - Load previously saved craft with table validation
- **Position Preservation** - Table positions restored exactly as saved
- **Viewport Restore** - Canvas zoom/pan state restored on import

#### 2. Collation Mismatch Warning
- **Visual Warning Icon** - Shows warning icon on edges with collation mismatch
- **Yellow Edge Styling** - Edges with collation mismatch displayed in yellow
- **Collation Detection** - Automatically detects different collations between joined columns
- **COLLATE Option** - Configure COLLATE in join modal to fix mismatch

#### 3. Performance Optimizations
- **Debounced Session Save** - 500ms delay to prevent blocking during drag
- **Debounced Node Changes** - 100ms delay for smoother drag experience
- **Debounced Viewport Changes** - 150ms delay for pan/zoom
- **Optimized Watchers** - Removed deep watchers where not needed

### Changed Files

**Frontend:**
- `frontend/src/components/CanvasCraft.vue` - EdgeLabelRenderer, collation detection, performance optimizations
- `frontend/src/components/SidebarDB.vue` - Export/Import buttons and handlers
- `frontend/src/store/craftStore.js` - exportCraft(), importCraft(), debounced session save

**Backend:**
- `backend/src/utils/schema-reader.js` - Added collation info to column data
- `backend/src/utils/query-builder.js` - COLLATE support in JOIN conditions

**Config:**
- `.gitignore` - Added dist/, docs/, IDE files, OS files

### Technical Details

**Export Format:**
```json
{
  "version": "1.0",
  "exportedAt": "2025-12-08T...",
  "craft": {
    "nodes": [...],
    "edges": [...],
    "queryClauses": {...},
    "viewport": { "x": 0, "y": 0, "zoom": 1 }
  }
}
```

**Collation Detection:**
```javascript
// In schema-reader.js - MySQL
SELECT COLLATION_NAME as collation FROM INFORMATION_SCHEMA.COLUMNS

// In CanvasCraft.vue - Mismatch check
if (sourceColInfo?.collation !== targetColInfo?.collation) {
  // Show warning icon and yellow edge
}
```

**Performance Optimizations:**
```javascript
// Debounced session save (craftStore.js)
const debouncedSaveSession = () => {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => saveSession(), 500)
}

// Debounced node changes (CanvasCraft.vue)
const onNodesChange = (changes) => {
  if (nodesChangeTimer) clearTimeout(nodesChangeTimer)
  nodesChangeTimer = setTimeout(() => {
    craftStore.setNodes(nodes.value)
  }, 100)
}
```

### Impact
- **Data Persistence**: Users can save and share their craft configurations
- **Query Safety**: Early warning for potential collation issues in joins
- **Better Performance**: Smoother drag experience especially with many connected tables
- **Cleaner Repository**: Proper .gitignore for build artifacts

### Breaking Changes
None - Fully backward compatible with v1.1.1

### Migration Guide
```bash
# No migration needed - just pull the latest code
git pull origin develop

# Or update dependencies if needed
npm run install:all
```

---

## Complete Feature List (v1.2.0)

### Core Features (v1.0.0)
- [x] Visual drag-and-drop canvas
- [x] Database connection system
- [x] Schema introspection
- [x] Custom table node component
- [x] Column selection & joins
- [x] Smart alias system
- [x] Query builder panels (WHERE, ORDER BY, GROUP BY, HAVING)
- [x] Query execution & result preview
- [x] Session persistence (localStorage)

### Visual Ordering (v1.1.0)
- [x] Position-based FROM clause (leftmost table)
- [x] Sorted JOIN order (left-to-right)
- [x] Sorted SELECT columns (visual order)
- [x] Position-based alias generation
- [x] Viewport-aware table placement

### UI Consistency (v1.1.1)
- [x] Table Aliases panel visual ordering
- [x] Computed property for efficient sorting
- [x] All components follow visual ordering

### Export/Import & Collation (v1.2.0)
- [x] **Export craft to JSON file**
- [x] **Import craft from JSON file**
- [x] **Table validation on import**
- [x] **Position & viewport restoration**
- [x] **Collation mismatch detection**
- [x] **Warning icon on edges**
- [x] **Yellow edge styling for mismatch**
- [x] **COLLATE option in join modal**
- [x] **Performance optimizations**
- [x] **Updated .gitignore**

---

## Architecture Overview

### Tech Stack

**Frontend**:
- **Vue 3** (Composition API)
- **Vue Flow** - Canvas drag-n-drop
- **Naive UI** - UI components
- **Pinia** - State management
- **Axios** - HTTP client
- **Vite** - Build tool

**Backend**:
- **Node.js** + **Express.js**
- **MySQL2** - Database driver
- **Knex.js** - Query builder

### Directory Structure
```
datacraft/
├── package.json
├── .gitignore                        # Updated in v1.2.0
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── CanvasCraft.vue      # EdgeLabelRenderer, collation (v1.2.0)
│   │   │   ├── TableNode.vue
│   │   │   ├── SidebarDB.vue        # Export/Import buttons (v1.2.0)
│   │   │   ├── FilterPanel.vue
│   │   │   └── GeneratePanel.vue
│   │   ├── store/
│   │   │   └── craftStore.js        # Export/Import, debounce (v1.2.0)
│   │   └── utils/
│   │       └── aliasGenerator.js
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── utils/
│   │   │   ├── query-builder.js     # COLLATE support (v1.2.0)
│   │   │   └── schema-reader.js     # Collation info (v1.2.0)
│   │   └── ...
│   └── package.json
└── claude/
    ├── project-context-v1.0.0.md
    ├── project-context-v1.1.0.md
    ├── project-context-v1.1.1.md
    └── project-context-v1.2.0.md    # This file
```

---

## Key Technical Decisions (v1.2.0)

### 1. EdgeLabelRenderer for Custom Labels
**Why**: VueFlow's edge-label slot wasn't rendering custom content properly
**Solution**: Use EdgeLabelRenderer component with manual position calculation
**Result**: Full control over edge label styling and content

### 2. Debounced Session Save
**Why**: Deep watcher on nodes caused localStorage writes on every drag pixel
**Solution**: 500ms debounce on session save
**Result**: Smooth drag performance, no blocking

### 3. Collation Detection at Schema Load
**Why**: Need collation info before joins are created
**Solution**: Fetch COLLATION_NAME from INFORMATION_SCHEMA.COLUMNS
**Result**: Immediate mismatch detection when connecting columns

### 4. JSON Export Format
**Why**: Need portable, human-readable format for craft sharing
**Solution**: JSON with version, timestamp, and complete craft state
**Result**: Easy to save, share, and version control queries

---

## Performance Optimizations (v1.2.0)

### Before vs After

| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Session save during drag | Every pixel | 500ms debounce | No blocking |
| Node position sync | Every pixel | 100ms debounce | Smoother drag |
| Viewport sync | Every pixel | 150ms debounce | Smoother pan/zoom |
| Edge label render | Computed every frame | Direct lookup | Reduced re-renders |

### Debounce Strategy
```
User drags table
    ↓
VueFlow updates node position internally (immediate, smooth)
    ↓
onNodesChange triggered
    ↓
100ms debounce timer starts
    ↓
If user still dragging → timer resets
    ↓
User stops dragging → 100ms passes
    ↓
craftStore.setNodes() called
    ↓
500ms debounce for session save
    ↓
localStorage updated (non-blocking)
```

---

## Known Issues & Solutions

### Issue: Edge Label Position Wrong (SOLVED - v1.2.0)
**Problem**: Custom edge labels appeared at wrong position
**Root Cause**: VueFlow edge-label slot didn't pass through custom data
**Solution**: Use EdgeLabelRenderer with manual position calculation from getEdges

### Issue: Drag Performance Lag (SOLVED - v1.2.0)
**Problem**: Dragging tables with joins was slow/laggy
**Root Cause**: Deep watchers triggering localStorage save on every pixel
**Solution**: Debounced watchers and session save

### Issue: Collation Mismatch Not Detected (SOLVED - v1.2.0)
**Problem**: Join queries failing due to different collations
**Root Cause**: No collation info fetched from database
**Solution**: Added COLLATION_NAME to schema reader, visual warning on edges

---

## UI/UX Changes (v1.2.0)

### Sidebar Footer
```
┌─────────────────────────┐
│  Export    │   Import   │  ← New buttons
├─────────────────────────┤
│       Disconnect        │
└─────────────────────────┘
```

### Edge Label with Warning
```
       ⚠️           ← Warning icon (if collation mismatch)
     INNER          ← Join type
```

### Edge Styling
- **Normal**: Green dashed line (#63e2b7)
- **Collation Mismatch**: Yellow dashed line (#ffc107)

---

## Development Notes

### Adding Collation Support to New Databases

When adding PostgreSQL or other database support, ensure:

1. **Schema Reader** fetches collation:
```javascript
// PostgreSQL example
SELECT collation_name FROM information_schema.columns
WHERE table_name = ? AND column_name = ?
```

2. **Query Builder** supports COLLATE syntax:
```javascript
// PostgreSQL uses different COLLATE syntax
`"${col1}" COLLATE "${collation}" = "${col2}"`
```

### Export/Import Validation

Import validates:
1. JSON structure (version, craft object)
2. Required node properties (id, position, data.table)
3. Tables exist in current database schema
4. Updates columns with current schema data

---

## Quick Reference

### Export/Import Usage
```javascript
// Export (in SidebarDB.vue)
craftStore.exportCraft()  // Downloads JSON file

// Import (in SidebarDB.vue)
const result = craftStore.importCraft(jsonData)
if (result.success) {
  // Craft loaded, viewport restored
} else {
  // Show error: result.error
}
```

### Collation Check
```javascript
// Check if edge has collation mismatch
const hasCollationMismatch = (edge) => {
  if (edge.data?.hasCollationMismatch) return true
  // Or check from column data...
}

// In template
<span v-if="showWarning(edge)">⚠️</span>
```

### Performance Patterns
```javascript
// Debounce pattern
let timer = null
const debouncedFn = () => {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    // Actual work here
  }, delay)
}
```

---

## Version History

### v1.2.0 (December 8, 2025)
**Theme**: Export/Import & Collation Warning

**New Features**:
- Export craft to JSON file
- Import craft from JSON file
- Collation mismatch detection
- Warning icon on edges
- COLLATE option in join configuration

**Performance**:
- Debounced session save (500ms)
- Debounced node changes (100ms)
- Debounced viewport changes (150ms)
- Optimized store watchers

**Maintenance**:
- Updated .gitignore (dist/, docs/, IDE files)

**Stats**:
- +600 lines of code
- 5 files modified
- 4 new features
- 3 performance optimizations

### v1.1.1 (October 17, 2025)
- Table Aliases panel visual ordering
- UI consistency completion

### v1.1.0 (October 15, 2025)
- Position-based query generation
- Viewport-aware table placement
- Unified development workflow

### v1.0.0 (October 9, 2025)
- Initial production release
- Complete visual SQL query builder

---

## Future Roadmap

### v1.3 - Query Management (Next)
- [ ] Save/load query templates
- [ ] Query history with search
- [ ] Export queries as .sql files
- [ ] Query favoriting system

### v1.5 - Database Support
- [ ] PostgreSQL support
- [ ] SQLite support
- [ ] SQL Server support

### v2.0 - Advanced Features
- [ ] AI-powered query explanation
- [ ] Natural language to SQL
- [ ] Query optimization suggestions

---

## Success Criteria (All Met)

### v1.2.0 Criteria
- [x] **Export craft to JSON** - Complete with version and timestamp
- [x] **Import craft from JSON** - With validation and error handling
- [x] **Position restoration** - Tables appear at saved positions
- [x] **Viewport restoration** - Canvas zoom/pan restored
- [x] **Collation detection** - Fetch from database schema
- [x] **Visual warning** - Icon and yellow edge styling
- [x] **COLLATE option** - Configurable in join modal
- [x] **Performance improvement** - Smooth drag with debouncing
- [x] **No breaking changes** - Backward compatible

---

**Built with** ❤️ **and** ☕
**License**: MIT
**Status**: Production Ready - Export/Import & Collation Warning
**Version**: 1.2.0
**Last Updated**: December 8, 2025
