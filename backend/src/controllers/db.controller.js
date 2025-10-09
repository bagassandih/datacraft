import dbService from '../services/db.service.js';

/**
 * Controller for database operations
 */
export class DbController {
  /**
   * List available databases
   * POST /api/databases
   */
  async listDatabases(req, res) {
    try {
      const config = req.body;
      const result = await dbService.listDatabases(config);

      res.status(200).json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Handle database connection request
   * POST /api/connect
   */
  async connect(req, res) {
    try {
      const config = req.body;
      const result = await dbService.connect(config);

      res.status(200).json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get database schema
   * GET /api/schema
   */
  async getSchema(req, res) {
    try {
      const schema = await dbService.getSchema();

      res.status(200).json({
        success: true,
        data: schema
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

export default new DbController();
