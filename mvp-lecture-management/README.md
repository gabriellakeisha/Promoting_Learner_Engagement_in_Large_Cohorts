# MVP Lecture Engagement Platform

**Student:** Gabriella Keisha Andini (40392749)  
**Project:** Promoting Learner Engagement in Large Cohorts  
**Supervisor:** Andrew McDowell  
**University:** Queen's University Belfast

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [Testing Guide](#testing-guide)
- [API Documentation](#api-documentation)
- [Troubleshooting](#troubleshooting)

---

## Overview

A real-time backchannel communication platform for large university lectures. Students can anonymously ask questions, make comments, and express confusion during live lectures. Lecturers receive real-time analytics on student engagement.

### Key Innovation
- **Dual Dashboard Analytics**: Separate analytics for lecturers (engagement metrics) and students (self-reflection)
- **Real-time MongoDB Aggregation**: Optimized queries for live analytics
- **Session-based WebSocket Rooms**: Isolated communication channels per lecture

---

## Features

### Authentication System
- Email/password registration
- Role-based access (Student/Lecturer/Admin)
- Session management with MongoDB store
- Login tracking (lastLogin, loginCount, isOnline)

### Classroom Management
- Create multiple lecture sessions
- Unique 6-character join codes
- Session status (active/ended)
- Member access control

### Real-time Chat
- Socket.IO with room-based architecture
- Message types: QUESTION, COMMENT, CONFUSION
- Edit own messages (within 5 minutes)
- Delete messages (own or lecturer can delete any)
- Pin important messages (lecturer only)
- Typing indicators
- Message pagination (load last 50 + scroll for more)

### Analytics Dashboard

**Lecturer View:**
- Total messages count
- Messages by type (Q/C/Confusion) with charts
- Active users vs total members
- Participation rate percentage
- Timeline chart (messages per 5-minute interval)
- Top 10 contributors
- Messages by type over time

**Student View:**
- Personal message count
- Class average comparison
- Participation rank & percentile
- Messages by type breakdown
- Above/below average indicator

### Bulk User Management
- CSV upload for creating multiple users
- Validation and error reporting
- Skip duplicate emails
- Detailed upload summary

---

## Tech Stack

### Backend
- **Node.js** v18+ with Express.js
- **Socket.IO** v4 for real-time communication
- **MongoDB** with Mongoose ODM
- **bcryptjs** for password hashing
- **express-session** with connect-mongo

### Frontend (To Be Built)
- HTML5, CSS3, JavaScript (ES6+)
- Chart.js for analytics visualization
- Native WebSocket client (Socket.IO client library)

---

## Prerequisites

Before you begin, ensure you have:

1. **Node.js** v18 or higher ([Download](https://nodejs.org/))
2. **MongoDB** installed and running ([Download](https://www.mongodb.com/try/download/community))
3. **Git** (optional, for cloning)
4. **MongoDB Compass** (optional, for database GUI)

---

## Installation

### Step 1: Clone or Download Project

```bash
git clone <this repository ssh>
cd mvp-lecture-engagement

```

### Step 2: Install Dependencies

```bash
npm install
```

This will install:
- express, socket.io, mongoose
- bcryptjs, express-session, connect-mongo
- multer, csv-parser, dotenv, cors

---

## Database Setup

### Option 1: Use Default Configuration

The `.env` file is already configured for local MongoDB:

```env
MONGODB_URI=mongodb://localhost:27017/lecture_engagement_mvp
```

### Option 2: Clean Old Database (Optional)

If you want to start fresh and remove old database:

```bash
# Run the cleanup script
node cleanup-database.js

```

### Option 3: Use MongoDB Atlas (Cloud)

1. Create free cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Get connection string
3. Update `.env`:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/lecture_engagement_mvp
```

---

## Running the Application

### Start MongoDB (if running locally)

```bash
# macOS/Linux
mongod

# Windows
"C:\Program Files\MongoDB\Server\<version>\bin\mongod.exe"

# Or use MongoDB Compass (GUI)
```

### Start the Server

```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

You should see something like this:

```
MVP Lecture Engagement Platform
Server running on: http://localhost:3000
Database: mongodb://localhost:27017/lecture_engagement_mvp
Environment: development
```

### Access the Application

Open your browser and go to:
- **Login Page:** http://localhost:3000
- **Register:** http://localhost:3000/register
- **Health Check:** http://localhost:3000/api/health

---

## Testing Guide

Run ./test-mvp.sh
---

## API Documentation

### Authentication

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Create new user |
| `/api/auth/login` | POST | Login user |
| `/api/auth/logout` | POST | Logout user |
| `/api/auth/me` | GET | Get current user |

### Sessions

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/sessions/create` | POST | Lecturer | Create session |
| `/api/sessions/join` | POST | Any | Join by code |
| `/api/sessions/my-sessions` | GET | Any | List my sessions |
| `/api/sessions/:id` | GET | Member | Get session details |
| `/api/sessions/:id/end` | POST | Lecturer | End session |
| `/api/sessions/:id/members` | GET | Lecturer | List members |

### Messages

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/messages/send` | POST | Member | Send message |
| `/api/messages/:sessionId` | GET | Member | Get messages |
| `/api/messages/:id` | PUT | Owner | Edit message |
| `/api/messages/:id` | DELETE | Owner/Lecturer | Delete message |
| `/api/messages/:id/pin` | POST | Lecturer | Toggle pin |
| `/api/messages/:sessionId/pinned` | GET | Member | Get pinned |

### Analytics

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/analytics/lecturer/:sessionId` | GET | Lecturer | Dashboard data |
| `/api/analytics/student/:sessionId` | GET | Student | Personal stats |
| `/api/analytics/live/:sessionId` | GET | Member | Real-time stats |

### WebSocket Events

**Client → Server:**
- `join-session` - Join a session room
- `send-message` - Send new message
- `edit-message` - Edit message
- `delete-message` - Delete message
- `toggle-pin` - Pin/unpin message
- `typing` - Typing indicator

**Server → Client:**
- `joined-session` - Confirmation
- `user-joined` - Someone joined
- `user-left` - Someone left
- `new-message` - New message broadcast
- `message-edited` - Message updated
- `message-deleted` - Message removed
- `message-pinned` - Pin status changed
- `user-typing` - Typing indicator
- `error` - Error message

---

## Project Structure

```
mvp-lecture-engagement/
├── server/                  # Backend code
│   ├── config/
│   │   └── database.js      # MongoDB connection
│   ├── models/
│   │   ├── user.js          # User schema
│   │   ├── session.js       # Session schema
│   │   ├── message.js       # Message schema
│   │   └── membership.js    # User-Session relationship
│   ├── routes/
│   │   ├── auth.js          # Authentication endpoints
│   │   ├── bulk-upload.js   # CSV upload
│   │   ├── sessions.js      # Session management
│   │   ├── messages.js      # Message CRUD
│   │   └── analytics.js     # Dashboard data
│   ├── middleware/
│   │   └── auth.js          # Auth middleware
│   └── server.js            # Main server + Socket.IO
├── client/                  # Frontend 
├── uploads/                 # Temporary CSV storage
├── test-data/
│   └── sample-users.csv     # 54 test users
├── package.json             # Dependencies
├── .env                     # Configuration
└── README.md                # This file
```

---

## Academic Context

### Research Questions
1. How can anonymity mechanisms balance safety with accountability?
2. What real-time analytics are most valuable for lecturers?
3. How can unified backchannel platforms improve upon fragmented tools?

### Novelty
- Dual analytics (lecturer engagement + student self-reflection)
- Optimised MongoDB aggregation for real-time educational analytics
- Within-session mode comparison (unlike Vevox/Padlet)

---

## Profile

**Gabriella Keisha Andini**  
Student ID: 40392749  
Email: gandini01@qub.ac.uk  

**Supervisor:**  
Andrew McDowell  

