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
cp .env.example .env
# Then edit .env with your actual values (explain below)

# 4. Start the server
npm start

# 5. Open in browser
# Navigate to http://localhost:3000
```

### Environment Variables

Copy `.env.example` to `.env` and fill in:

```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/echoclass
SESSION_SECRET=your-session-secret-here
LECTURER_CODE=your-lecturer-registration-code
HUGGINGFACE_API_KEY=hf_your_api_key_here
```

- `MONGODB_URI` — your MongoDB connection string (local or Atlas)
- `SESSION_SECRET` — any random string for session encryption
- `LECTURER_CODE` — code required to register as a lecturer (prevents students from creating lecturer accounts)
- `HUGGINGFACE_API_KEY` — get one free at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens). If not set, the system uses RAKE for keywords and auto skips AI summaries.

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
├── server/
│   ├── models/          # Mongoose schemas (user, session, message, membership, studentReflection)
│   ├── routes/          # Express route handlers (auth, sessions, messages, analytics, reflection, profile)
│   ├── middleware/      # Auth middleware, security middleware (sanitisation, rate limiting, headers)
│   └── services/        # AI services (ai-keywords, ai-summary, ai-comparison)
├── public/              # Frontend HTML, CSS, JS
│   ├── css/             # Stylesheets
│   └── js/              # Client-side JavaScript (student-chat, lecturer-dashboard, etc.)
├── tests/               # Jest test suites
├── scripts/             # Utility scripts (AI experiment, performance test, demo data)
├── server.js            # Main application entry point
├── package.json
├── .env.example         # Environment variable template
└── README.md
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
