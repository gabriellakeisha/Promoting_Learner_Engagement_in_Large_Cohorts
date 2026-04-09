# EchoClass — Real-Time Student Engagement Platform

**Student:** Gabriella Keisha Andini (40392749)  
**Module:** CSC3002 – Computer Science Project  
**Supervisor:** Andrew McDowell  
**University:** Queen's University Belfast  

---

## Overview

A real-time backchannel web application for large university lectures (100–500 students). Students can ask questions, flag confusion, and participate through configurable identity modes — all while lecturers monitor engagement through live analytics.

The platform addresses common barriers to participation: social anxiety, fear of judgement, and the lack of real-time feedback in large cohorts (Auerbach & Andrews, 2018; Sun et al., 2022).

Three things set it apart from available tools like Vevox, Slido, or Mentimeter:

1. **Switchable identity modes** — anonymous, pseudonymous, or identified, changeable per-message within a session.
2. **Dual dashboards** — lecturer-facing analytics for live adaptation, student-facing stats for self-reflection (Zimmerman's SRL framework).
3. **Micro + macro analytics** — per-session confusion detection and semester-wide engagement trends.

## Research Questions

- **RQ1:** How do configurable identity modes (anonymous, pseudonymous, identified) affect student engagement behaviour?
- **RQ2:** What real-time analytics — both micro (per-session) and macro (semester-wide) — are most valuable for lecturers?
- **RQ3:** How can student dashboards support self-reflection aligned with Panadero et al.'s (2022) Self-Regulated Learning theory?

## Tech Stack

| Technology | Purpose |
|---|---|
| Node.js + Express.js | Backend server and RESTful API |
| Socket.IO | Real-time WebSocket communication |
| MongoDB + Mongoose | Database and ODM |
| Vanilla HTML/CSS/JS | Frontend (no framework overhead) |
| Chart.js | Data visualisation on dashboards |
| Hugging Face Inference API | AI session summarisation (DistilBART) and keyword extraction (KBIR-Inspec) |
| RAKE (keyword-extractor) | Local offline keyword extraction fallback |
| bcrypt + express-session | Authentication and session management |
| express-rate-limit | Rate limiting |
| validator | XSS input sanitisation |
| Jest | Automated testing framework |
| SBT | manual testing framework |

## Getting Started

### Prerequisites

- **Node.js** v18+ and npm
- **MongoDB** running locally or a MongoDB Atlas connection string
- **Hugging Face API key** (free tier) — system works without it using RAKE fallback

### Installation

```bash
# 1. Clone the repository
git clone <gitlab-repo-url>
cd mvp-lecture-management

# 2. Install dependencies
npm install

# 3. Create environment file
#    Copy the template below into a new file called .env in the project root

# 4. Start the server
npm start

# 5. Open in browser
# Navigate to http://localhost:3000
```

### Environment Variables

Create a `.env` file in the project root with the following variables:
 
```
# Server
PORT=3000
NODE_ENV=development
 
# MongoDB
MONGODB_URI=mongodb://localhost:27017/lecture_engagement_mvp
 
# Session
SESSION_SECRET=your-random-secret-string-here
SESSION_MAX_AGE=86400000
 
# Lecturer Registration
LECTURER_ACCESS_CODE=set_lecture_private_code_here
 
# Hugging Face AI (optional — system uses RAKE fallback if not set)
HUGGINGFACE_API_KEY=hf_your_api_key_here

- `MONGODB_URI` — your MongoDB connection string (local or Atlas)
- `SESSION_SECRET` — any random string for session encryption
- `LECTURER_CODE` — code required to register as a lecturer (prevents students from creating lecturer accounts)
- `HUGGINGFACE_API_KEY` — get one free at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens). If not set, the system uses RAKE for keywords and auto skips AI summaries.

```

## Running Tests

```bash
# Run all automated tests (no database or API key needed)
npm test
```

This runs 97 Jest tests across 5 suites:

| Suite | Tests | What It Covers |
|---|---|---|
| security.test.js | 18 | XSS sanitisation, recursive sanitisation, security headers |
| auth-routes.test.js | 14 | Registration, login, logout, session management |
| auth-middleware.test.js | 11 | isAuthenticated, isLecturer, isStudent, isAdmin |
| ai-services.test.js | 8 | RAKE keyword extraction, AI comparison service |
| models.test.js | 46 | All 5 Mongoose model schemas (User, Session, Message, Membership, StudentReflection) |

All tests run offline in under a minute with zero external dependencies.

### AI Comparison Experiment

```bash
# Requires HUGGINGFACE_API_KEY in .env
node scripts/ai-experiment.js
```

Runs 6 simulated lecture scenarios comparing Hugging Face KBIR-Inspec vs RAKE keyword extraction accuracy against ground truth keywords (take more time to run - around 5-10 minutes)

### Other Test Scripts

```bash
# Performance test (requires server running in another terminal)
node scripts/performance-test.js

Runs 5, 10, 20, 50 users

# Rate limit verification (requires server running)
node scripts/test-rate-limit.js
```

## Project Structure

```
mvp-lecture-management/
│
├── client/                              # Frontend (Vanilla HTML/CSS/JS)
│   ├── css/
│   │   ├── analytics.css               # Analytics cards, charts, keywords
│   │   ├── announcement-pin.css        # Announcement and pin feature styles
│   │   ├── auth.css                    # Login and register pages
│   │   ├── base.css                    # CSS variables, reset, layout, utilities
│   │   ├── chat.css                    # Chat container, input area, identity selector
│   │   ├── compact.css                 # Compact layout overrides
│   │   ├── dark-mode.css               # Dark mode overrides
│   │   ├── forms.css                   # Form inputs, buttons, profile fields
│   │   ├── messages.css                # Message bubbles, replies, attachments
│   │   ├── navbar.css                  # Navigation bar and avatar
│   │   ├── polls.css                   # Poll-related styles
│   │   ├── reflection.css              # Self-reflection dashboard styles
│   │   └── responsive.css              # Responsive breakpoints
│   ├── js/
│   │   ├── announcement-pin.js         # Announcement and pin functionality
│   │   ├── auth.js                     # Login and register form handling
│   │   ├── chat-avatar.js              # Avatar generation and display
│   │   ├── dark-mode.js                # Theme toggle
│   │   ├── identity-mode.js            # Anonymous/pseudonymous/identified switching
│   │   ├── lecturer-dashboard.js       # Micro-analytics dashboard
│   │   ├── macro-analytics.js          # Semester-wide trends and comparisons
│   │   ├── manage-students.js          # Bulk upload and student administration
│   │   ├── profile.js                  # User profile management
│   │   ├── student-chat.js             # Real-time chat interface for students
│   │   ├── student-reflection.js       # Self-reflection dashboard (SRL)
│   │   └── utils.js                    # Helper functions
│   ├── chat-room.html                  # Real-time chat interface
│   ├── lecturer-dashboard.html         # Lecturer analytics dashboard
│   ├── login.html                      # Authentication page
│   ├── register.html                   # Registration page
│   └── student-dashboard.html          # Student UI (chat + reflection)
│
├── scripts/                            # Utility and test scripts
│   ├── ai-experiment.js                # AI accuracy comparison experiment
│   ├── demo-data.js                    # Generate demo lecture data
│   ├── generate-test-data.js           # Create test data
│   ├── performance-test.js             # Load testing (5-50 concurrent users)
│   ├── test-ai-comparison.js           # AI service benchmarking
│   └── test-rate-limit.js              # Rate limit verification
│
├── server/                              # Backend (Node.js + Express)
│   ├── config/
│   │   └── database.js                 # MongoDB connection configuration
│   ├── middleware/
│   │   ├── auth.js                     # Authentication and role-based access control
│   │   └── security.js                 # XSS sanitisation, rate limiting, security headers
│   ├── models/
│   │   ├── membership.js               # Session-user relationship schema
│   │   ├── message.js                  # Chat message schema (type, identityMode, alias)
│   │   ├── session.js                  # Lecture session schema (joinCode, status, settings)
│   │   ├── studentreflection.js        # Self-regulated learning (goals, achievements, trends)
│   │   └── user.js                     # User schema (email, password, role, avatar)
│   ├── routes/
│   │   ├── analytics.js                # Micro and macro analytics endpoints
│   │   ├── auth.js                     # Register, login, logout, session check
│   │   ├── bulk-upload.js              # CSV bulk student upload
│   │   ├── messages.js                 # Message posting, fetching, classification
│   │   ├── profile.js                  # User profile and avatar management
│   │   ├── reflection.js               # Student self-reflection data
│   │   └── sessions.js                 # CRUD for lecture sessions
│   ├── services/
│   │   ├── ai-comparison.js            # AI accuracy comparison and benchmarking
│   │   ├── ai-keywords.js              # Hugging Face KBIR-Inspec and RAKE keyword extraction
│   │   └── ai-summary.js               # DistilBART session summarisation with fallback
│   └── server.js                       # Main entry point (Express + Socket.IO setup)
│
├── tests/                               # Jest automated tests (97 tests)
│   ├── ai-services.test.js             # RAKE and AI comparison
│   ├── auth-middleware.test.js          # Role-based access control
│   ├── auth-routes.test.js             # Registration, login, logout
│   ├── models.test.js                  # All 5 Mongoose model schemas
│   └── security.test.js                # XSS sanitisation and security headers
│
├── .env.example                        # Environment variable template
├── .gitignore                          # Git ignore rules
├── package.json                        # Dependencies and npm scripts
└── README.md                           # This file
```

## Key Features

### For Students
- Real-time chat with message classification (Question / Comment / Confusion)
- Per-message identity mode switching (Anonymous / Pseudonymous / Identified)
- Self-reflection dashboard with personal stats, achievement badges, and personalised tips
- Goal setting and progress tracking (SRL Forethought Phase)
- Semester engagement trend tracking

### For Lecturers
- Micro-analytics: engagement timeline, confusion spike detection, message type distribution, lurker ratio, keyword cloud
- Macro-analytics: cross-session comparison, module filtering, recurring confusion topics
- AI-powered session summary (DistilBART) with automatic RAKE fallback
- AI keyword extraction (KBIR-Inspec) with RAKE fallback
- CSV data export for external analysis
- Session management with join codes, bulk student upload

### Security
- bcrypt password hashing (salt factor 10)
- Three-tier rate limiting (auth: 10/15min, messages: 30/1min, general: 100/15min)
- Recursive XSS input sanitisation
- Security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, X-XSS-Protection)
- Role-based access control (student, lecturer, admin)
