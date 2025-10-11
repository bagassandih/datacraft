# 📚 DataCraft

## 💭 Background Story

**DataCraft** was born out of a simple frustration familiar to most backend developers — forgetting column names, second-guessing table relationships, and spending too much time writing complex JOIN queries by hand.

In many projects, a single feature page often involves three or more tables, each connected through multiple relationships. Navigating those connections manually — switching between documentation, ER diagrams, and SQL consoles — becomes a repetitive and time-consuming process.

The goal behind DataCraft is to make query building **visual, intuitive, and error-proof**.  
A tool that helps developers focus on **what they want to extract**, not **how to write it**.

> In short: **less typing, more thinking.**

---

## 📷 Screenshot

### Full Panel
<img width="1679" alt="Full Panel" src="https://github.com/user-attachments/assets/78623d92-abf4-4729-8afe-8809e7e2f60d" />

### Canvas Panel
<img width="932" alt="Canvas Panel" src="https://github.com/user-attachments/assets/4391a763-7c85-427c-9c0e-d365fe6089d8" />

### Detail Panels
<table align="center">
  <tr>
     <td align="center">
        Database Schema/List Table Panel
     </td>
     <td align="center">
        Query Builder/Filter Panel
    </td>
     <td align="center">
        Query Generator & Preview Panel
    </td>
  </tr>
  <tr>
    <td align="center">
      <img width="300" src="https://github.com/user-attachments/assets/c03a74de-bab8-4441-9de5-671f7aececfe" /><br/>
    </td>
    <td align="center">
      <img width="300" src="https://github.com/user-attachments/assets/76626c06-2c89-4a3c-8937-dd01ab4192af" /><br/>
    </td>
    <td align="center">
      <img width="300" src="https://github.com/user-attachments/assets/32ce6e8c-ce25-4693-b260-01c32597e651" /><br/>
    </td>
  </tr>
</table>

---

## 🧱 1. Technical Challenges & Solutions Summary

| Challenge | Root Cause | Solution | Impact |
|-----------|------------|----------|---------|
| **Vue Flow Performance Degradation** | Rendering 20+ table nodes with 100+ edges causes frame drops | Implemented virtual rendering with viewport-based culling and lazy edge loading | 60fps maintained even with 50+ tables |
| **Complex JOIN Query Generation** | Self-referencing and circular relationships broke query logic | Built dependency graph resolver with cycle detection and topological sorting | Handles recursive CTEs and complex joins |
| **Schema Introspection Latency** | Full schema load for large databases (500+ tables) takes 15–30s | Cached metadata with incremental updates + lazy loading | Initial load <2s, subsequent <100ms |
| **State Synchronization Issues** | Canvas (nodes/edges) and SQL state fell out of sync during edits | Implemented single source of truth with reactive state validation | Real-time consistency and preview |
| **Query Execution Security** | Direct query execution risked SQL injection | Parameterized validation + read-only mode | Zero attack surface in production |

---

## ⚡ 2. Performance Benchmark

| Test Case | Description | Result |
|-----------|-------------|--------|
| **Schema Load (Medium DB)** | 150 tables with relationships | 1.2s avg |
| **Schema Load (Large DB)** | 500+ tables, 1000+ relationships | 2.8s (paginated) |
| **Node Render (Initial)** | 30 nodes rendered | 180ms |
| **Node Render (Incremental)** | Add single node | 15–25ms |
| **Query Generation** | 5-table JOIN with filters | 8–12ms |
| **Query Execution (Simple)** | 2-table JOIN SELECT | 45–80ms |
| **Query Execution (Complex)** | 5-table JOIN with aggregation | 120–250ms |
| **Canvas Pan/Zoom** | 40+ nodes | Constant 60fps |

> Benchmarked on MacBook M2, Node 20, MySQL 8.0.

---

## 🔒 3. Security Considerations

- **SQL Injection Prevention**: Parameterized queries via Knex.js  
- **Read-Only Mode**: Only SELECT operations allowed  
- **Secure Credentials**: Stored as encrypted environment variables  
- **Rate Limiting**: `express-rate-limit` (100 req / 15 min / IP)  
- **Strict CORS**: Only whitelisted domains allowed  
- **Session Timeout**: 30 minutes of inactivity  
- **Audit Logging**: Timestamps, user context, and query fingerprinting  
- **Future Plan**: Role-based access control (RBAC)

---

## 🎨 4. UI Overview

### 1. **Connection Page**
Minimal and focused. Supports MySQL & PostgreSQL with instant connection testing.

### 2. **Canvas View**
Interactive workspace built with Vue Flow — draggable tables, relationship edges, and auto-layout.

### 3. **Query Modifier Panel**
Column selector, JOIN configurator, and WHERE builder with real-time query preview.

### 4. **SQL Preview**
Syntax-highlighted SQL display with execution results and performance metrics.

---

## 🧠 5. Design Philosophy

**Clarity over complexity.**  
Every element of DataCraft is designed to reduce mental overhead while writing queries.  

- Visual-first, code-transparent  
- Instant feedback on every change  
- Constraint-based actions to ensure valid SQL  
- Performance that feels instant through incremental rendering  

DataCraft isn’t trying to replace SQL — it’s here to make it **easier to think in SQL**.

---

## 🚀 6. Deployment Notes

### Frontend (Vite)
```bash
cd frontend
npm install
npm run build
```

### Backend (Express)
```bash
cd backend
npm install
npm run build
npm run start
```

### Environment Variables Backend
```bash
PORT=4000
NODE_ENV=development
```

---

## 🧩 7. Directory Structure
```lua
datacraft/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── composables/
│   │   ├── stores/
│   │   └── utils/
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── middleware/
│   │   ├── routes/
│   │   └── index.js
└── docs/
```

---

## 📘 8. User Guide

### 1. Start Backend
```bash
cd backend
npm run dev
```

### 2. Start Frontend
```bash
cd frontend
npm run dev
```

### 3. Connect to Database
Fill in host, port, user, password  
Test → Connect → Visualize schema

### 4. Build Queries Visually
Drag tables to canvas  
Link relationships  
Adjust JOIN type, add filters, and preview SQL

### 5. Execute or Export
Run query  
View results in table  

---

## 🧩 9. Lessons Learned
The hardest challenge wasn’t query logic — it was maintaining perfect synchronization between the canvas state and SQL representation.

The key insight: treat the canvas as a view, not the source of truth.

Another takeaway: perceived speed matters more than real speed. Smooth incremental rendering and feedback loops make users feel in control.

Finally, developers love visual tools, but they trust code. That’s why DataCraft always shows the generated SQL — transparent, editable, and honest.

---

## 💬 10. Final Note
DataCraft is an experiment in making SQL feel human again.  
It doesn’t aim to hide complexity — just to make it manageable, visual, and intuitive.

Born from the everyday challenges of backend development, DataCraft stands for one philosophy:

> **Less typing. More thinking.**

Built with coffee, code, and curiosity.
