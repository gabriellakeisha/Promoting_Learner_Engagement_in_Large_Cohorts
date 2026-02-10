# Promoting Learner Engagement in Large Cohorts

**Student:** Gabriella Keisha Andini (40392749)  
**Module:** CSC3002 – Computer Science Project  
**Supervisor:** Andrew McDowell  
**University:** Queen's University Belfast  

---

## Overview

A real-time backchannel web application designed to promote student engagement in large university lecture cohorts (100–500 students). The system addresses well-documented barriers to participation — social anxiety, fear of peer judgement, and the "feedback vacuum" that forms when lecturers cannot gauge comprehension in real time (Barr, 2017; Harunasari & Halim, 2019).

Unlike existing tools (Vevox, Padlet, Slido, Mentimeter) which offer partial solutions, this platform provides three novel contributions:

1. **Configurable identity modes** (anonymous, pseudonymous, identified) switchable per-message within a single session — enabling within-platform comparison of how each affects engagement.
2. **Dual-dashboard analytics** — lecturer-facing dashboards for real-time pedagogical adaptation and student-facing dashboards for self-reflection aligned with Zimmerman's (2002) Self-Regulated Learning (SRL) framework.
3. **Integrated micro/macro analytics** — combining per-session confusion detection with semester-wide engagement trends, addressing Wise and Jung's (2019) call for "situated inquiry."

---

## Key Features

### Real-Time Backchannel Chat Interface (~40% of project focus)
- **Message Classification:** Students tag messages as Question, Comment, Confusion, or None — prompting metacognitive reflection and enabling lecturer-side filtering.
- **Configurable Identity Modes:** Anonymous (no identifier), Pseudonymous (consistent alias per session), Identified (real display name). Switchable per-message via the `+` menu.
- **Message Threading & Replies:** Visual reply chains for peer-to-peer support and lecturer responses.
- **Announcements & Pinned Messages:** Lecturer-only message types with distinct styling and filter support.
- **Polls:** WhatsApp-style polls for quick comprehension checks with real-time anonymous voting.
- **Emoji Reactions:** Low-barrier participation without adding to message volume.
- **Edit & Delete:** Students edit/delete own messages; lecturers can moderate any message.
- **Report Messages:** Lecturer can flag inappropriate content.
- **Message Type Filtering:** Lecturer can filter chat by Question/Comment/Confusion via the ⋮ header menu with real-time badge counts.
- **Responsive Design:** Functional on mobile (320px) and desktop.

### Analytics Dashboards 

**Lecturer Dashboard (Micro-level — per session):**
- Message frequency over 5-minute intervals (engagement timeline)
- Message type distribution (Question/Comment/Confusion breakdown)
- Active contributors vs total participants (lurker ratio)
- Identity mode usage breakdown
- Top keywords cloud
- Peak activity detection
- Confusion and question rate indicators with alerts
- CSV export for research analysis

**Lecturer Dashboard (Macro-level — cross-session):**
- Engagement trends over a 12-week semester
- Cross-session comparison of participation rates
- Recurring confusion topic identification

**Student Self-Reflection Dashboard (SRL-aligned):**
- Personal message count and type distribution
- Comparison to class average via percentile ranking
- Engagement trend over time
- Session-by-session history

### Session & User Management (~20% of project focus)
- Email/password registration with role-based access (Student/Lecturer)
- Secure authentication with bcrypt password hashing
- Lecturer creates sessions and adds students via email (closed enrolment)
- Bulk student upload (CSV/email list)
- Student profile editing (avatar, display name, password)
- Session status control (active/ended)
- Dark mode support

---

## Research Questions

- **RQ1:** How does anonymous versus pseudonymous versus identified participation affect student engagement behaviour?
- **RQ2:** What real-time analytics — both micro (per-session patterns) and macro (semester-wide trends) — are most valuable for lecturers?
- **RQ3:** How can student dashboards support self-reflection aligned with Zimmerman's (2002) SRL theory?

---

## Technology Stack

| Layer | Technology | Justification |
|-------|-----------|---------------|
| Frontend | HTML5, CSS3, JavaScript (ES6+) | Universal browser support, no installation |
| Visualisation | Chart.js | Lightweight responsive charting |
| Backend | Node.js + Express.js | Event-driven I/O for real-time applications |
| Real-time | Socket.IO v4 | WebSocket with HTTP long-polling fallback |
| Database | MongoDB + Mongoose | Flexible schema, aggregation pipelines |
| Authentication | bcrypt.js | Industry-standard password hashing |
| Session Store | connect-mongo | Server-side session persistence |
| Version Control | Git (QUB GitLab) | Source control with supervisor repository access |

---

## Prerequisites

- **Node.js** v18+ ([Download](https://nodejs.org/))
- **MongoDB** installed and running ([Download](https://www.mongodb.com/try/download/community))
- **Git** (for cloning)

---

## Installation & Setup

```bash
# 1. Clone the repository
git clone <repository-url>
cd mvp-lecture-management

# 2. Install dependencies
npm install

# 3. Configure environment
# The .env file is pre-configured for local MongoDB:
# MONGODB_URI=mongodb://localhost:27017/lecture_engagement_mvp

# 4. Start MongoDB can be locally or via app -- MongoDB
# 5. Start the server
npm start

```

The application will be available at: **http://localhost:3000**

---

## Application Routes

| URL | Description |
|-----|-------------|
| `/` | Login page |
| `/register` | Registration page |
| `/lecturer-dashboard.html` | Lecturer session management + analytics |
| `/student-dashboard.html` | Student session list |
| `/chat-room.html?sessionId=<id>` | Real-time chat interface |

---

## API Endpoints

### Authentication
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/register` | POST | Create new user |
| `/api/auth/login` | POST | Login |
| `/api/auth/logout` | POST | Logout |
| `/api/auth/me` | GET | Current user info |

### Sessions
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/sessions/create` | POST | Lecturer | Create session |
| `/api/sessions/join` | POST | Any | Join by code |
| `/api/sessions/my-sessions` | GET | Any | List user's sessions |
| `/api/sessions/:id` | GET | Member | Session details |
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
| `/api/messages/:id/reaction` | POST | Member | Add/remove reaction |
| `/api/messages/poll/create` | POST | Lecturer | Create poll |

### Analytics
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/analytics/lecturer/:sessionId` | GET | Lecturer | Full dashboard data |
| `/api/analytics/student/:sessionId` | GET | Student | Personal stats |
| `/api/analytics/live/:sessionId` | GET | Member | Real-time stats |
| `/api/analytics/export-csv/:sessionId` | GET | Lecturer | CSV export |

### WebSocket Events

**Client → Server:**
`join-session`, `send-message`, `edit-message`, `delete-message`, `toggle-pin`, `typing`, `profile-update`

**Server → Client:**
`joined-session`, `new-message`, `message-edited`, `message-deleted`, `message-pinned`, `message-reaction`, `user-joined`, `user-left`, `user-typing`, `error`

---


## Key Success Criteria

| RQ | Success Criterion | Acceptance Test |
|----|-------------------|-----------------|
| RQ1 | Anonymous mode hides all user identity | No identifier shown when anonymous selected |
| RQ1 | Pseudonymous mode shows consistent alias | Same alias across all messages within session |
| RQ1 | Identified mode shows real display name | Registered name visible on messages |
| RQ2 | Micro: per-session engagement timeline | Chart.js renders messages per 5-min interval |
| RQ2 | Macro: cross-session trend analysis | Chart compares engagement across sessions |
| RQ2 | Message type filter for lecturers | Filter by Question/Comment/Confusion with badge counts |
| RQ2 | Confusion and Question detection highlighted | CONFUSION/QUESTION messages flagged for lecturer |
| RQ3 | Student sees participation statistics | Personal count, type breakdown, class average |
| Core | Real-time messaging <1s latency | Message Device A to B within 1 second |
| Core | Lecturer-controlled session access | Only lecturer-added students can join |

---

## Functional Requirements (MoSCoW)

| Priority | ID | Requirement | Status |
|----------|-----|-------------|--------|
| Must | FR-01 | User registration with role selection | ✅ Done |
| Must | FR-02 | Secure authentication with bcrypt | ✅ Done |
| Must | FR-03 | Lecturer creates sessions, adds students via email | ✅ Done |
| Must | FR-04 | Real-time WebSocket messaging <1s latency | ✅ Done |
| Must | FR-05 | Student message classification (Question/Comment/Confusion/None) | ✅ Done |
| Must | FR-06 | Lecturer-only: Announcements, Polls, Pinned messages | ✅ Done |
| Must | FR-07 | Configurable identity modes (anon/pseudo/identified) | ✅ Done |
| Must | FR-08 | Lecturer analytics dashboard | ✅ Done |
| Should | FR-09 | Message threading and replies | ✅ Done |
| Should | FR-10 | Edit and delete own messages | ✅ Done |
| Should | FR-11 | Emoji reactions on messages | ✅ Done |
| Should | FR-12 | Report inappropriate messages | ✅ Done |
| Should | FR-13 | Message type filtering (Question/Confusion/Pinned) | ✅ Done |
| Should | FR-14 | Micro/macro analytics | 🔄 In Progress |
| Should | FR-15 | Student self-reflection dashboard | 🔄 In Progress |
| Could | FR-16 | AI-generated session summary | Planned |
| Could | FR-17 | CSV export of analytics data | ✅ Done |

---
