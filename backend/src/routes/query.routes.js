import express from 'express';
import queryController from '../controllers/query.controller.js';

const router = express.Router();

// POST /api/generate - Generate SQL from visual structure
router.post('/generate', (req, res) => queryController.generate(req, res));

// POST /api/execute - Execute SQL query
router.post('/execute', (req, res) => queryController.execute(req, res));

export default router;
