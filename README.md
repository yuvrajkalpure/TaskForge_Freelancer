# TaskForge

TaskForge is a freelance project marketplace platform where clients can post projects, freelancers can bid on them, clients can pick winning bids, freelancers can submit work, clients can complete the projects, and reviews are exchanged.

## Features
- **Client Workspace**: Post projects, browse bids, assign freelancers, and mark projects as completed.
- **Freelancer Workspace**: Submit competitive bids, review assigned tasks, and deliver completed work.
- **Admin Workspace**: Moderate platform users (ban/unban clients and freelancers).
- **OTP Email Verification**: Staged verification using a 6-digit OTP code on registration.
- **Role-Based Access**: Secure JWT authentication (access and refresh tokens).

## Seeded Admin Credentials
- **Admin**: `admin@taskforge.com` / `adminpassword123`

## Running the Application

### 1. Start the Backend Server
Open a terminal, navigate to the `backend` folder, and start the development server:
```bash
cd backend
npm run dev
```
The backend server runs at `http://localhost:5000`.

### 2. Start the Frontend Client
Open another terminal, navigate to the `frontend` folder, and start the Next.js development server:
```bash
cd frontend
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

## Running Integration Tests
To run the automated backend tests:
```bash
cd backend
npm test
```