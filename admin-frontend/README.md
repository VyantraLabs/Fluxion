# Fluxion Admin Frontend

A comprehensive Next.js 14 administrative dashboard for the Fluxion Web3 payment platform. This application provides admin users with powerful tools to manage organizations, users, templates, system settings, and monitor platform activity.

## Features

### ✅ Completed Features

- **🔐 Web3 Authentication**: Wallet-based admin authentication with JWT tokens
- **📊 System Dashboard**: Real-time statistics and system health monitoring
- **🏢 Organization Management**: View and manage platform organizations
- **👥 User Management**: Admin privilege controls and user oversight
- **📋 Template Management**: System template administration
- **📈 Activity Logs**: Comprehensive audit trail and activity monitoring
- **⚙️ System Settings**: Platform configuration management
- **🛡️ Permission System**: Role-based access control (Admin vs Super Admin)

### 🎨 UI/UX Features

- **Responsive Design**: Mobile-friendly admin interface
- **Dark/Light Theme**: Professional admin styling with Tailwind CSS
- **Real-time Updates**: Auto-refreshing statistics and notifications
- **Advanced Filtering**: Search, sort, and filter across all data tables
- **Bulk Operations**: Multi-select actions for efficient management
- **Empty States**: Professional empty states with clear CTAs

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript for type safety
- **Styling**: Tailwind CSS with custom admin components
- **State Management**: React Context API
- **Authentication**: Ethers.js for Web3 wallet integration
- **API Client**: Custom admin API client with error handling
- **Icons**: Heroicons for consistent iconography
- **Notifications**: React Hot Toast for user feedback

## Project Structure

```
admin-frontend/
├── src/
│   ├── app/                    # Next.js 14 app router
│   │   ├── dashboard/         # Main admin dashboard
│   │   ├── organizations/     # Organization management
│   │   ├── users/            # User management
│   │   ├── templates/        # Template management
│   │   ├── settings/         # System settings
│   │   ├── activity/         # Activity logs
│   │   ├── login/            # Authentication
│   │   └── unauthorized/     # Access denied page
│   ├── components/
│   │   ├── admin/            # Admin-specific components
│   │   ├── tables/           # Data table components
│   │   ├── forms/            # Form components
│   │   └── ui/               # Base UI components
│   ├── contexts/
│   │   └── AdminAuthContext.tsx  # Authentication context
│   ├── hooks/
│   │   ├── useAdminAuth.ts   # Auth hook
│   │   ├── useSystemStats.ts # System stats hook
│   │   └── useOrganizations.ts # Organization data hook
│   ├── services/
│   │   └── adminApi.ts       # Admin API client
│   ├── types/
│   │   └── admin.ts          # TypeScript type definitions
│   └── utils/
│       └── permissions.ts    # Permission utilities
├── public/                   # Static assets
└── package.json             # Dependencies and scripts
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Running Fluxion backend API (main-lambda)
- Web3 wallet (MetaMask recommended)

### Installation

1. **Install dependencies**:
   ```bash
   cd admin-frontend
   npm install
   ```

2. **Environment setup**:
   ```bash
   cp .env.example .env.local
   ```

3. **Configure environment variables**:
   ```bash
   # .env.local
   NEXT_PUBLIC_API_URL=http://localhost:3000
   NEXT_PUBLIC_ADMIN_API_BASE=/admin
   NODE_ENV=development
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

5. **Access the admin dashboard**:
   - Open [http://localhost:3001](http://localhost:3001)
   - Connect your admin wallet
   - Sign the authentication message

## Authentication Flow

1. **Wallet Connection**: Users connect their Web3 wallet (MetaMask, etc.)
2. **Message Signing**: Backend provides a unique message to sign
3. **Signature Verification**: Backend validates signature and returns JWT
4. **Admin Check**: Only users with `is_admin: true` can access the dashboard
5. **Permission Enforcement**: Role-based access control throughout the app

## API Integration

The admin frontend connects to the main Fluxion API through a comprehensive admin API client:

### System Management
- `GET /admin/system/stats` - Platform statistics
- `GET /admin/system/health` - System health check
- `POST /admin/system/maintenance` - Toggle maintenance mode

### Organization Management
- `GET /admin/organizations` - List organizations
- `GET /admin/organizations/:id` - Organization details
- `GET /admin/organizations/:id/users` - Organization users

### User Management
- `GET /admin/users` - List users with filtering
- `PUT /admin/users/:id/admin-status` - Grant/revoke admin privileges
- `GET /admin/users/:id/activity` - User activity logs

### Template & Settings Management
- `GET /admin/templates` - System templates
- `PUT /admin/templates/:id` - Update templates
- `GET /admin/settings` - System configuration
- `GET /admin/activity` - Activity logs with filtering

## Component Architecture

### Core Components

- **AdminLayout**: Main layout with navigation and permission guards
- **AdminNavigation**: Sidebar navigation with role-based visibility
- **PermissionGuard**: Component-level permission enforcement
- **DataTable**: Reusable data table with sorting and pagination
- **StatisticsCard**: Dashboard statistics display
- **SystemHealthWidget**: Real-time system health monitoring

### Hooks

- **useAdminAuth**: Authentication state and permissions
- **useSystemStats**: System statistics and health data
- **useOrganizations**: Organization data with filtering/pagination

## Deployment

### Development
```bash
npm run dev          # Start development server on port 3001
npm run build        # Build for production
npm run start        # Start production server
```

### Production

1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Deploy to Vercel/AWS/etc**:
   - Configure environment variables
   - Set API URLs for production backend
   - Enable proper CORS settings

3. **Environment variables for production**:
   ```bash
   NEXT_PUBLIC_API_URL=https://your-api-domain.com
   NEXT_PUBLIC_ADMIN_API_BASE=/admin
   NODE_ENV=production
   ```

## Security Considerations

- **JWT Token Storage**: Tokens stored in localStorage with expiration
- **Permission Checks**: Server-side and client-side authorization
- **Admin Verification**: Only verified admin accounts can access
- **HTTPS Required**: Production requires HTTPS for Web3 wallet security
- **CORS Configuration**: Proper CORS settings for API communication

## Development Guidelines

### Adding New Admin Pages

1. **Create page component** in `src/app/[page-name]/page.tsx`
2. **Wrap with AdminLayout** and set required permissions
3. **Add navigation item** in `AdminNavigation.tsx`
4. **Create hooks** for data fetching if needed
5. **Implement permission guards** for sensitive operations

### Permission Levels

- **Regular Admin**: Can manage users, organizations, templates, view activity
- **Super Admin**: All admin permissions plus system settings and maintenance mode

### Code Quality

- **TypeScript**: Full type safety across all components
- **ESLint**: Code linting with Next.js configuration
- **Prettier**: Consistent code formatting
- **Component Testing**: Test critical admin components

## Troubleshooting

### Common Issues

1. **Authentication Fails**: Verify wallet connection and admin status
2. **API Errors**: Check backend is running and environment variables are correct
3. **Permission Denied**: Ensure user has proper admin privileges in database
4. **Styling Issues**: Verify Tailwind CSS is properly configured

### Debugging

```bash
# Check API connectivity
curl http://localhost:3000/admin/system/health

# Verify admin user in backend
psql -d fluxion_dev -c "SELECT * FROM users WHERE is_admin = true;"

# Check browser console for JavaScript errors
# Network tab for API request failures
```

## Future Enhancements

- **Real-time WebSocket Updates**: Live dashboard updates
- **Advanced Analytics**: Charts and detailed platform metrics
- **Bulk User Operations**: Mass user management tools
- **System Monitoring**: Enhanced health monitoring and alerting
- **Export Functionality**: Data export capabilities
- **Multi-language Support**: Internationalization
- **Mobile App**: React Native admin companion app

---

## Contributing

This admin frontend is part of the larger Fluxion Web3 payment platform. For development questions or issues, refer to the main project documentation or contact the development team.

Built with ❤️ for the future of Web3 payments.