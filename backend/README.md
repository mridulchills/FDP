# FDTS Backend API

Faculty Development Tracking System Backend - A robust Node.js/Express API with SQLite database.

## Features

- **RESTful API** with Express.js
- **SQLite Database** with optimized schema
- **JWT Authentication** with refresh tokens
- **Role-based Authorization** (Faculty, HoD, Admin)
- **File Upload Management** with security validation
- **Comprehensive Logging** with Winston
- **Input Validation** with Zod schemas
- **Rate Limiting** and security middleware
- **Database Migration** from Supabase
- **TypeScript** for type safety

## Project Structure

```
backend/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # API route controllers
│   ├── middleware/      # Express middleware
│   ├── models/          # Database models
│   ├── routes/          # API route definitions
│   ├── services/        # Business logic services
│   ├── scripts/         # Migration and utility scripts
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Utility functions
│   └── server.ts        # Main server file
├── data/                # SQLite database files
├── logs/                # Application logs
├── uploads/             # File uploads
└── dist/                # Compiled JavaScript
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment configuration:
```bash
cp .env.example .env
```

3. Update the `.env` file with your configuration values.

### Development

Start the development server:
```bash
npm run dev
```

The server will start on `http://localhost:4000` by default.

### Building for Production

```bash
npm run build
npm start
```

### Testing

Run tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

### Database Migration

To migrate data from Supabase:
```bash
npm run migrate
```

To seed the database with sample data:
```bash
npm run seed
```

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh JWT token
- `POST /api/auth/logout` - User logout

### Users
- `GET /api/users` - Get all users (Admin only)
- `POST /api/users` - Create new user (Admin only)
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user (Admin only)

### Submissions
- `GET /api/submissions` - Get submissions
- `POST /api/submissions` - Create submission
- `GET /api/submissions/:id` - Get submission by ID
- `PUT /api/submissions/:id` - Update submission
- `DELETE /api/submissions/:id` - Delete submission

### Departments
- `GET /api/departments` - Get all departments
- `POST /api/departments` - Create department (Admin only)
- `PUT /api/departments/:id` - Update department

### Files
- `POST /api/files/upload` - Upload file
- `GET /api/files/:path` - Download file
- `DELETE /api/files/:path` - Delete file

### System
- `GET /health` - Health check
- `GET /api/metrics` - System metrics (Admin only)

## Environment Variables

See `.env.example` for all available configuration options.

## Security Features

- JWT token authentication with refresh tokens
- Password hashing with bcrypt
- Rate limiting on API endpoints
- Input validation and sanitization
- File upload security checks
- CORS configuration
- Security headers with Helmet
- Audit logging for sensitive operations

## Logging

The application uses Winston for structured logging:
- Error logs: `logs/error.log`
- Combined logs: `logs/combined.log`
- Console output in development mode

## Contributing

1. Follow TypeScript best practices
2. Write tests for new features
3. Use ESLint for code formatting
4. Update documentation as needed

## License

MIT