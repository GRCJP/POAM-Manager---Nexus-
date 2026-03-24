# POAM Nexus API Server

REST API backend for POAM Nexus with PostgreSQL, JWT authentication, and role-based access control.

## Quick Start

### Prerequisites
- Node.js 20+
- PostgreSQL 16+ (or use Docker Compose)
- npm or yarn

### Local Development (with Docker)

1. **Copy environment file:**
```bash
cp .env.example .env
# Edit .env and set your secrets
```

2. **Start all services:**
```bash
cd ..
docker-compose up -d
```

3. **Run database migrations:**
```bash
cd server
npm install
npx prisma migrate dev
```

4. **API is now running at:**
- API: http://localhost:3000
- Frontend: http://localhost:80
- Database: localhost:5432

### Local Development (without Docker)

1. **Install dependencies:**
```bash
npm install
```

2. **Set up PostgreSQL:**
```bash
# Create database
createdb poam_nexus

# Update .env with your database URL
DATABASE_URL="postgresql://username:password@localhost:5432/poam_nexus"
```

3. **Run migrations:**
```bash
npx prisma migrate dev
```

4. **Start development server:**
```bash
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT token
- `POST /api/auth/refresh` - Refresh access token
- `GET /api/auth/me` - Get current user info

### POAMs
- `GET /api/poams` - Get all POAMs (filtered by user access)
- `GET /api/poams/:id` - Get single POAM
- `POST /api/poams` - Create new POAM
- `PUT /api/poams/:id` - Update POAM
- `DELETE /api/poams/:id` - Delete POAM (admin only)
- `POST /api/poams/:id/milestones` - Add milestone
- `POST /api/poams/:id/comments` - Add comment

### Systems
- `GET /api/systems` - Get all systems
- `GET /api/systems/:id` - Get single system
- `POST /api/systems` - Create new system
- `PUT /api/systems/:id` - Update system
- `DELETE /api/systems/:id` - Delete system (admin only)
- `POST /api/systems/:id/owners` - Assign user to system
- `DELETE /api/systems/:id/owners/:userId` - Remove user from system

### Scans
- `GET /api/scans?systemId=xxx` - Get scan runs for system
- `GET /api/scans/:id` - Get scan run with findings
- `POST /api/scans` - Create scan run
- `DELETE /api/scans/:id` - Delete scan run

### Workbook
- `GET /api/workbook?systemId=xxx` - Get workbook items
- `GET /api/workbook/:id` - Get single workbook item
- `POST /api/workbook` - Create workbook item
- `PUT /api/workbook/:id` - Update workbook item
- `DELETE /api/workbook/:id` - Delete workbook item
- `POST /api/workbook/bulk` - Bulk import workbook items

### Reports
- `GET /api/reports` - Get all reports
- `GET /api/reports/:id` - Get single report
- `POST /api/reports` - Generate and save report
- `DELETE /api/reports/:id` - Delete report (admin only)

## Authentication

All API endpoints (except `/api/auth/login` and `/api/auth/register`) require JWT authentication.

**Include token in Authorization header:**
```
Authorization: Bearer <your-jwt-token>
```

**Token expires in 15 minutes.** Use refresh token to get new access token.

## Role-Based Access Control

| Role | Permissions |
|------|-------------|
| **ADMIN** | Full access to all systems and data |
| **SYSTEM_OWNER** | Manage assigned systems and their POAMs |
| **ENGINEER** | Edit POAMs within assigned systems |
| **EXECUTIVE** | Read-only access to all systems (dashboards, reports) |

## Database Schema

See `prisma/schema.prisma` for complete schema.

**Key tables:**
- `users` - User accounts with roles
- `organizations` - Multi-tenant organizations
- `systems` - IT systems being monitored
- `poams` - Plan of Action & Milestones
- `poam_assets` - Assets affected by POAMs
- `poam_milestones` - Remediation milestones
- `poam_status_history` - Audit trail of changes
- `scan_runs` - Vulnerability scan imports
- `workbook_items` - Security control monitoring
- `audit_logs` - System-wide audit logging

## Prisma Commands

```bash
# Generate Prisma Client
npx prisma generate

# Create migration
npx prisma migrate dev --name migration_name

# Apply migrations (production)
npx prisma migrate deploy

# Open Prisma Studio (database GUI)
npx prisma studio

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

## Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/poam_nexus"

# JWT
JWT_SECRET="your-super-secret-key"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# Server
PORT=3000
NODE_ENV="development"

# CORS
CORS_ORIGIN="http://localhost:8080"
```

## Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Production Deployment

### Docker Compose (Recommended)

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop services
docker-compose down
```

### Manual Deployment

1. Set `NODE_ENV=production`
2. Set strong `JWT_SECRET`
3. Use managed PostgreSQL (AWS RDS, Azure Database, etc.)
4. Enable SSL for database connections
5. Set up reverse proxy (Nginx) with HTTPS
6. Configure monitoring and logging

## Security Considerations

- ✅ Passwords hashed with bcrypt (cost factor 12)
- ✅ JWT tokens with short expiry (15 minutes)
- ✅ Rate limiting on all API endpoints
- ✅ Stricter rate limiting on auth endpoints
- ✅ CORS configured for specific origin
- ✅ Helmet.js security headers
- ✅ SQL injection prevention via Prisma ORM
- ✅ Audit logging for all critical operations
- ✅ Role-based access control (RBAC)

## Troubleshooting

**Database connection error:**
```bash
# Check PostgreSQL is running
docker-compose ps

# Check DATABASE_URL in .env
echo $DATABASE_URL
```

**Prisma migration error:**
```bash
# Reset database (WARNING: deletes data)
npx prisma migrate reset

# Or manually drop and recreate
dropdb poam_nexus
createdb poam_nexus
npx prisma migrate deploy
```

**Port already in use:**
```bash
# Change PORT in .env or docker-compose.yml
PORT=3001
```

## License

MIT
