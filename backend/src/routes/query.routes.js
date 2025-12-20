import express from 'express';
import queryController from '../controllers/query.controller.js';

const router = express.Router();

// POST /api/generate - Generate SQL from visual structure
router.post('/generate', (req, res) => queryController.generate(req, res));

// POST /api/execute - Execute SQL query
router.post('/execute', (req, res) => queryController.execute(req, res));

// POST /api/execute-ddl - Execute DDL statement (CREATE TABLE, ALTER TABLE, etc.)
router.post('/execute-ddl', (req, res) => queryController.executeDDL(req, res));

export default router;
