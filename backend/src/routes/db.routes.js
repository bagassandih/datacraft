import express from 'express';
import dbController from '../controllers/db.controller.js';

const router = express.Router();

// POST /api/databases - List available databases
router.post('/databases', (req, res) => dbController.listDatabases(req, res));

// POST /api/connect - Test and establish database connection
router.post('/connect', (req, res) => dbController.connect(req, res));

// GET /api/schema - Get database schema
router.get('/schema', (req, res) => dbController.getSchema(req, res));

export default router;
