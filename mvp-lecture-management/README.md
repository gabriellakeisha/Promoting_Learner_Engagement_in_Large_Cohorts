# EchoClass — Real-Time Student Engagement Platform

**Student:** Gabriella Keisha Andini (40392749)
**Module:** CSC3002 – Computer Science Project
**Supervisor:** Andrew McDowell
**University:** Queen's University Belfast

---

## Overview

A real-time backchannel web app for large university lectures (100–500 students). Students can ask questions, flag confusion, and participate through configurable identity modes — all while lecturers monitor engagement through live analytics.

The platform addresses common barriers to participation: social anxiety, fear of judgement, and the lack of real-time feedback in large cohorts (Auerbach & Andrews, 2018; Sun et al., 2022).

Three things set it apart from tools like Vevox, Slido, or Mentimeter:

1. **Switchable identity modes** — anonymous, pseudonymous, or identified, changeable per-message within a session.
2. **Dual dashboards** — lecturer-facing analytics for live adaptation, student-facing stats for self-reflection (Zimmerman's SRL framework).
3. **Micro + macro analytics** — per-session confusion detection and semester-wide engagement trends.

---

## Features

### Chat Interface
- Message tagging: Question, Comment, Confusion, or None
- Identity modes: Anonymous / Pseudonymous / Identified (switchable per message)
- Reply threads, emoji reactions, edit/delete (5-min window)
- Lecturer announcements, polls, pinned messages
- Message filtering by type with badge counts
- Report system for inappropriate content
- Responsive layout (320px mobile to desktop)

### Analytics

**Lecturer — per session:**
- Message frequency over 5-min intervals
- Type distribution (Question / Comment / Confusion)
- Active contributors vs total (lurker ratio)
- Identity mode usage breakdown
- Top keywords (AI-extracted or RAKE fallback)
- Peak activity detection
- Confusion/question rate alerts
- AI-generated session summary
- CSV export

**Lecturer — cross session (macro):**
- 12-week engagement trend
- Cross-session participation comparison
- Recurring confusion topics

**Student self-reflection (SRL-aligned):**
- Personal message count and type breakdown
- Percentile ranking vs class average
- Engagement trend over time
- Session history
- Achievement badges (6 types)
- Personalised tips (5 categories)

### AI Services
- **Hugging Face DistilBART** — session text summarisation
- **Hugging Face KBIR-Inspec** — keyword extraction
- **RAKE algorithm** — local fallback (no API needed)
- **AI comparison endpoint** — runs both providers, calculates Jaccard similarity overlap

### Security
- 3-tier rate limiting: auth (50/15min), API (100/15min), messages (30/min)
- XSS input sanitisation via `validator.escape()`
- 5 security headers (X-Frame-Options, X-XSS-Protection, X-Content-Type-Options, Referrer-Policy, X-Powered-By disabled)
- bcrypt password hashing (10 salt rounds)
- Server-side sessions with MongoDB store

### Session & User Management
- Email/password registration with role selection (Student / Lecturer)
- Lecturer access code for registration
- Session creation with join codes
- Bulk student upload (CSV / email list)
- Profile editing (avatar, display name, password)
- Session status control (active / ended)
- Dark mode

---

## Research Questions

- **RQ1:** How do anonymous vs pseudonymous vs identified modes affect engagement?
- **RQ2:** What micro and macro analytics are most useful for lecturers?
- **RQ3:** How can student dashboards support self-reflection (Zimmerman's SRL)?

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, vanilla JavaScript |
| Charts | Chart.js |
| Backend | Node.js + Express.js |
| Real-time | Socket.IO v4 |
| Database | MongoDB + Mongoose |
| Auth | bcrypt.js + express-session |
| Session store | connect-mongo |
| AI | Hugging Face API, RAKE |
| Security | express-rate-limit, validator |
| Testing | Jest + Supertest |

---

## Prerequisites

- Node.js v18+
- MongoDB running locally or via Atlas
- Git

---

## Setup

```bash
# clone and install
git clone <repository-url>
cd mvp-lecture-management
npm install

# configure .env (already set up for local dev)
# MONGODB_URI=mongodb://localhost:27017/lecture_engagement_mvp
# PORT=3000

# start MongoDB, then start the server
npm start
```

App runs at **http://localhost:3000**

---

## Running Tests

```bash
# run all 51 tests (no DB or API keys needed)
npm test
```

Four test suites:
- `security.test.js` — XSS sanitisation, input escaping, security headers (18 tests)
- `auth-middleware.test.js` — role-based access checks (10 tests)
- `auth-routes.test.js` — registration/login validation with Supertest (12 tests)
- `ai-services.test.js` — RAKE extraction, AI comparison structure (8 tests)

All tests run offline with mocked models.

---

## Routes

| URL | Page |
|-----|------|
| `/` | Login |
| `/register` | Registration |
| `/lecturer-dashboard` | Lecturer sessions + analytics |
| `/student-dashboard` | Student sessions + self-reflection |
| `/chat/:sessionId` | Chat room |

---

## API Endpoints

### Auth (`/api/auth`) — rate limited: 50 req / 15 min
| Method | Path | Description |
|--------|------|-------------|
| POST | `/register` | Create account |
| POST | `/login` | Log in |
| POST | `/logout` | Log out |
| GET | `/me` | Current user |

### Sessions (`/api/sessions`) — rate limited: 100 req / 15 min
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/create` | Lecturer | Create session |
| POST | `/join` | Any | Join by code |
| GET | `/my-sessions` | Any | List sessions |
| GET | `/:id` | Member | Session details |
| POST | `/:id/end` | Lecturer | End session |
| GET | `/:id/members` | Lecturer | List members |

### Messages (`/api/messages`) — rate limited: 30 req / min
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/send` | Member | Send message |
| GET | `/:sessionId` | Member | Get messages |
| PUT | `/:id` | Owner | Edit message |
| DELETE | `/:id` | Owner/Lecturer | Delete message |
| POST | `/:id/pin` | Lecturer | Toggle pin |
| POST | `/:id/reaction` | Member | Add/remove reaction |
| POST | `/poll/create` | Lecturer | Create poll |

### Analytics (`/api/analytics`) — rate limited: 100 req / 15 min
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/lecturer/:sessionId` | Lecturer | Full dashboard data |
| GET | `/student/:sessionId` | Student | Personal stats + achievements |
| GET | `/macro/:sessionId` | Lecturer | Cross-session trends |
| GET | `/ai-summary/:sessionId` | Lecturer | AI session summary |
| GET | `/ai-comparison/:sessionId` | Lecturer | Multi-provider keyword comparison |
| GET | `/export-csv/:sessionId` | Lecturer | CSV download |

### Reflection (`/api/reflection`) — rate limited: 100 req / 15 min
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/stats` | Student | Overall reflection stats |

### WebSocket Events

**Client → Server:**
`join-session`, `send-message`, `edit-message`, `delete-message`, `toggle-pin`, `typing`, `profile-update`

**Server → Client:**
`joined-session`, `new-message`, `message-edited`, `message-deleted`, `message-pinned`, `message-reaction`, `user-joined`, `user-left`, `user-typing`, `error`

---

## Functional Requirements

| Priority | ID | Requirement | Status |
|----------|-----|-------------|--------|
| Must | FR-01 | User registration with role selection | Done |
| Must | FR-02 | Secure authentication with bcrypt | Done |
| Must | FR-03 | Lecturer creates sessions, adds students | Done |
| Must | FR-04 | Real-time WebSocket messaging | Done |
| Must | FR-05 | Message classification (Question/Comment/Confusion) | Done |
| Must | FR-06 | Announcements, Polls, Pinned messages | Done |
| Must | FR-07 | Configurable identity modes | Done |
| Must | FR-08 | Lecturer analytics dashboard | Done |
| Should | FR-09 | Message threading and replies | Done |
| Should | FR-10 | Edit and delete messages | Done |
| Should | FR-11 | Emoji reactions | Done |
| Should | FR-12 | Report messages | Done |
| Should | FR-13 | Message type filtering | Done |
| Should | FR-14 | Micro/macro analytics | Done |
| Should | FR-15 | Student self-reflection dashboard | Done |
| Could | FR-16 | AI-generated session summary | Done |
| Could | FR-17 | CSV export | Done |
| Could | FR-18 | Achievement badges | Done |
| Could | FR-19 | AI keyword comparison | Done |

---

## Project Structure

```
mvp-lecture-management/
├── client/                  # frontend
│   ├── css/                 # stylesheets
│   ├── js/                  # page scripts
│   ├── login.html
│   ├── register.html
│   ├── student-dashboard.html
│   ├── lecturer-dashboard.html
│   └── chat-room.html
├── server/
│   ├── config/database.js   # MongoDB connection
│   ├── middleware/
│   │   ├── auth.js          # session auth checks
│   │   └── security.js      # rate limiting, XSS, headers
│   ├── models/              # Mongoose schemas
│   ├── routes/              # Express route handlers
│   ├── services/            # AI services (summary, keywords, comparison)
│   └── server.js            # app entry point
├── tests/                   # Jest test suites
├── scripts/                 # test data generators
├── uploads/                 # user avatars
└── package.json
```

---
