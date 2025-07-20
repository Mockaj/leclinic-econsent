# Internal E-Consent Forms App

A comprehensive Next.js application for managing electronic consent forms with QR code workflows and tablet-based signature capture. Built for internal use by healthcare staff to streamline the consent process.

## Features

### 🔐 Authentication & Security
- **Supabase Authentication**: Secure staff login with email/password
- **Protected Routes**: Middleware-based route protection
- **Role-based Access**: Admin and staff user roles
- **Secure Form Links**: Unique token-based access for client forms

### 📋 Template Management
- **PDF Upload**: Batch upload of consent form templates
- **Template Organization**: Name, edit, and delete templates
- **Metadata Tracking**: Page count, upload date, and modification history

### 📱 QR Code Workflow
- **Dynamic QR Generation**: Create unique links for each consent session
- **Tablet-Optimized**: Touch and stylus-friendly form filling
- **Real-time Status**: Track pending vs completed forms

### ✍️ Digital Signatures
- **PDF Annotation**: Draw directly on PDF forms
- **Signature Capture**: Handwriting and signature support
- **Tool Selection**: Pen, eraser, and clear functions
- **Auto-Save**: Secure storage of completed forms

### 👥 User Management (Admin)
- **User Creation**: Add new staff accounts
- **Role Assignment**: Admin and staff permissions
- **Account Management**: View and manage user accounts

### 🌐 Localization
- **Czech Interface**: All UI elements in Czech language
- **Date Formatting**: Czech date/time formats
- **Error Messages**: Localized error and success messages

## Technology Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS with custom theme
- **UI Components**: Shadcn/ui with Radix UI primitives
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage for PDF files
- **PDF Handling**: Canvas-based annotation system

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account and project

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd leclinic-econsent
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Update `.env.local` with your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   ```

4. **Set up the database**
   
   Run the SQL schema in your Supabase SQL editor:
   ```bash
   # Copy contents of supabase-schema.sql to Supabase SQL Editor
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in your browser.

## Database Schema

### Tables

#### `templates`
- Stores PDF template metadata
- Links to files in `consent-templates` storage bucket
- Tracks upload and modification dates

#### `completed_consents`
- Manages consent form sessions
- Links templates to completed forms
- Stores unique access tokens for QR workflow
- Tracks completion status and timestamps

### Storage Buckets

- **`consent-templates`**: Original PDF templates
- **`completed-consents`**: Filled and signed PDF forms

## User Workflow

### Staff Workflow
1. **Login** to the dashboard
2. **Upload** PDF consent templates
3. **Generate QR code** for specific template
4. **Name the consent** session (e.g., "Consent - John Doe")
5. **Show QR code** to client on tablet
6. **Monitor** completion in dashboard
7. **Download** completed forms as needed

### Client Workflow
1. **Scan QR code** with tablet
2. **View PDF** consent form
3. **Fill and sign** using touch/stylus
4. **Submit** completed form
5. **See confirmation** message

## API Routes

The application uses Supabase for all data operations. No custom API routes are required as Supabase provides:

- Real-time database operations
- File upload/download
- Authentication
- Row Level Security (RLS)

## Security Features

- **Row Level Security**: Database-level access control
- **Signed URLs**: Temporary access to storage files
- **Token-based Access**: Unique tokens for form sessions
- **Protected Routes**: Middleware authentication
- **HTTPS Required**: Secure data transmission

## Deployment

### Vercel (Recommended)

1. **Connect repository** to Vercel
2. **Set environment variables** in Vercel dashboard
3. **Deploy** automatically on push to main branch

### Manual Deployment

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Start production server**
   ```bash
   npm start
   ```

## Configuration

### Supabase Setup

1. **Create project** in Supabase dashboard
2. **Run database schema** from `supabase-schema.sql`
3. **Create storage buckets**:
   - `consent-templates` (private)
   - `completed-consents` (private)
4. **Configure RLS policies** (included in schema)
5. **Set up authentication** providers

### Admin User Setup

To create the first admin user:

1. Sign up through Supabase Auth dashboard, or
2. Use the application signup with an email containing "admin", or
3. Manually set `user_metadata.role = 'admin'` in Supabase

## Troubleshooting

### Common Issues

**Authentication Issues**
- Verify Supabase URL and keys
- Check RLS policies are enabled
- Ensure user has proper role assignment

**File Upload Issues**
- Verify storage buckets exist
- Check storage policies
- Ensure file size limits

**QR Code Issues**
- Verify unique tokens are generated
- Check consent record creation
- Ensure proper URL formatting

### Development Tips

- Use Supabase dashboard to monitor database operations
- Check browser console for client-side errors
- Monitor Supabase logs for server-side issues
- Test QR workflow on actual tablet devices

## Contributing

1. **Fork** the repository
2. **Create** feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** changes (`git commit -m 'Add amazing feature'`)
4. **Push** to branch (`git push origin feature/amazing-feature`)
5. **Open** Pull Request

## License

This project is proprietary software for internal use.

## Support

For technical support or questions, contact the development team.

---

**Note**: This application handles sensitive medical consent data. Ensure compliance with relevant healthcare data protection regulations (GDPR, HIPAA, etc.) in your jurisdiction.
