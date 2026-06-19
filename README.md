# TaskForge

TaskForge is a freelance project marketplace platform where clients can post projects, freelancers can bid on them, clients can pick winning bids, freelancers can submit work, clients can complete the projects, and reviews are exchanged.

## Features
- **Client Workspace**: Post projects, browse bids, assign freelancers, and mark projects as completed.
- **Freelancer Workspace**: Submit competitive bids, review assigned tasks, and deliver completed work.
- **Admin Workspace**: Moderate platform users (ban/unban clients and freelancers).
- **OTP Email Verification**: Staged verification using a 6-digit OTP code on registration.
- **Role-Based Access**: Secure JWT authentication (access and refresh tokens).

## System Credentials (Seeded on startup)
- **Admin**: `admin@taskforge.com` / `adminpassword123`

---

## Developer Setup Instructions

Follow these steps to configure and run the application locally.

### 1. Environment Configuration (Backend)
The database connection and SMTP details must be configured via environment variables.

1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```
2. Copy the `.env.example` file to create your own `.env` configuration file:
   ```bash
   cp .env.example .env
   ```
3. Open the `.env` file and customize the variables:
   - **`DATABASE_URL`**: Your PostgreSQL connection string.
   - **`JWT_SECRET` & `JWT_REFRESH_SECRET`**: Secure keys for JWT authentication.
   - **`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`**: Your SMTP server configuration (e.g. Gmail App Passwords) to send verification OTPs and password reset links.

### 2. Database Initialization
Initialize the PostgreSQL database tables using Prisma:
```bash
npx prisma db push
```
*(The system seeder will automatically create the system administrator account inside the database upon starting the backend server).*

### 3. Running the Backend Server
From the `backend` folder, run:
```bash
npm install
npm run dev
```
The backend API server will start at `http://localhost:5000`.

### 4. Running the Frontend Client
1. Open a new terminal window and navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```
2. Run the Next.js development server:
   ```bash
   npm install
   npm run dev
   ```
3. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Running Integration Tests
To run the automated backend integration test suite:
```bash
cd backend
npm test
```