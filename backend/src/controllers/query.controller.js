import queryService from '../services/query.service.js';

/**
 * Controller for query operations
 */
export class QueryController {
  /**
   * Generate SQL query from visual structure
   * POST /api/generate
   */
  async generate(req, res) {
    try {
      const { nodes, edges, filters, orderBy, groupBy, having } = req.body;

      // Support both new format (object with clauses) and old format (array of filters)
      let clauses = {};
      if (filters || orderBy || groupBy || having) {
        clauses = {
          filters: filters || [],
          orderBy: orderBy || [],
          groupBy: groupBy || [],
          having: having || []
        };
      }

      const result = queryService.generateQuery(nodes, edges || [], clauses);

      res.status(200).json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Execute SQL query
   * POST /api/execute
   */
  async execute(req, res) {
    try {
      const { query } = req.body;

      if (!query) {
        return res.status(400).json({
          success: false,
          message: 'Query is required'
        });
      }

      const result = await queryService.executeQuery(query);

      res.status(200).json(result);
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
}

export default new QueryController();
