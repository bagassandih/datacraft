# DataCraft Backend

Backend API for DataCraft - Visual SQL Query Builder

## Features

- Database connection management (PostgreSQL & MySQL)
- Schema exploration and metadata retrieval
- SQL query generation from visual structure
- Safe query execution with validation
- RESTful API with Swagger documentation

## Tech Stack

- Node.js + Express.js
- Knex.js (Query Builder)
- PostgreSQL / MySQL drivers
- Swagger UI for API documentation

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file in the backend directory:

```env
PORT=4000
NODE_ENV=development
```

## Running the Server

Development mode with auto-reload:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## API Endpoints

| Method | Endpoint       | Description                    |
|--------|----------------|--------------------------------|
| GET    | /health        | Health check                   |
| POST   | /api/connect   | Test database connection       |
| GET    | /api/schema    | Get database schema            |
| POST   | /api/generate  | Generate SQL from visual data  |
| POST   | /api/execute   | Execute SQL query              |

## API Documentation

Once the server is running, access Swagger UI at:
```
http://localhost:4000/api-docs
```

## Project Structure

```
backend/
├── src/
│   ├── app.js                 # Main application file
│   ├── config/
│   │   └── knex.js           # Database configuration
│   ├── routes/
│   │   ├── db.routes.js      # Database routes
│   │   └── query.routes.js   # Query routes
│   ├── controllers/
│   │   ├── db.controller.js  # Database controllers
│   │   └── query.controller.js
│   ├── services/
│   │   ├── db.service.js     # Database services
│   │   └── query.service.js  # Query services
│   ├── utils/
│   │   ├── schema-reader.js  # Schema reading utilities
│   │   ├── query-builder.js  # Query building utilities
│   │   └── validator.js      # Validation utilities
│   └── swagger.json          # API documentation
├── .env
├── package.json
└── README.md
```

## Security Features

- Only SELECT queries allowed
- Query result limit (100 rows max)
- Input validation and sanitization
- Helmet.js for security headers
- CORS configuration

## License

ISC
