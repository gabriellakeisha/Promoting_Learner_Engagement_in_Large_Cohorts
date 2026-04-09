# Final-Year-Project - 40392749

Real-Time Student Engagement Platform for Large-Scale Lectures

## Project Structure

```
final-year-project/
│
├── mvp-lecture-management/             # Main application (active current development)
│   │
│   ├── server/                         # Backend (Node.js + Express)
│   │   ├── config/
│   │   │   └── database.js             # MongoDB connection config
│   │   ├── middleware/
│   │   │   ├── auth.js                 # Authentication & role-based access control
│   │   │   └── security.js             # XSS sanitisation, rate limiting, security headers
│   │   ├── models/
│   │   │   ├── user.js                 # User schema (email, password, role, avatar)
│   │   │   ├── session.js              # Lecture session schema (joinCode, status, settings)
│   │   │   ├── message.js              # Chat message schema (type, identityMode, alias)
│   │   │   ├── membership.js           # Session-user relationship schema
│   │   │   └── studentreflection.js    # Self-regulated learning (goals, achievements, trends)
│   │   ├── routes/
│   │   │   ├── auth.js                 # Register, login, logout, session check
│   │   │   ├── profile.js              # User profile & avatar management
│   │   │   ├── sessions.js             # CRUD for lecture sessions
│   │   │   ├── messages.js             # Message posting, fetching, classification
│   │   │   ├── analytics.js            # Micro & macro analytics endpoints
│   │   │   ├── reflection.js           # Student self-reflection data
│   │   │   └── bulk-upload.js          # CSV bulk student upload
│   │   ├── services/
│   │   │   ├── ai-keywords.js          # Hugging Face KBIR-Inspec + RAKE keyword extraction
│   │   │   ├── ai-summary.js           # DistilBART session summarisation (with fallback)
│   │   │   └── ai-comparison.js        # AI accuracy comparison & benchmarking
│   │   └── server.js                   # Main entry point (Express + Socket.IO setup)
│   │
│   ├── client/                         # Frontend (Vanilla HTML/CSS/JS)
│   │   ├── css/
│   │   │   ├── styles.css              # Main stylesheet
│   │   │   ├── announcement-pin.css    # Pinned messages styling
│   │   │   └── compact.css             # Responsive/compact layout
│   │   ├── js/
│   │   │   ├── auth.js                 # Login/register form handling
│   │   │   ├── student-chat.js         # Real-time chat interface for students
│   │   │   ├── lecturer-dashboard.js   # Micro-analytics dashboard
│   │   │   ├── macro-analytics.js      # Semester-wide trends & comparisons
│   │   │   ├── student-reflection.js   # Self-reflection dashboard (SRL)
│   │   │   ├── profile.js              # User profile management
│   │   │   ├── identity-mode.js        # Anonymous/pseudonymous/identified switching
│   │   │   ├── announcement-pin.js     # Pinned message functionality
│   │   │   ├── chat-avatar.js          # Avatar generation & display
│   │   │   ├── dark-mode.js            # Theme toggle
│   │   │   ├── manage-students.js      # Bulk upload & student admin
│   │   │   └── utils.js                # Helper functions
│   │   ├── login.html                  # Authentication page
│   │   ├── register.html               # Registration page
│   │   ├── student-dashboard.html      # Student UI (chat + reflection)
│   │   ├── lecturer-dashboard.html     # Lecturer analytics dashboard
│   │   └── chat-room.html              # Real-time chat interface
│   │
│   ├── tests/                          # Jest automated tests (97 tests)
│   │   ├── security.test.js            # XSS sanitisation & security headers
│   │   ├── auth-routes.test.js         # Registration, login, logout
│   │   ├── auth-middleware.test.js     # Role-based access control
│   │   ├── ai-services.test.js         # RAKE & AI comparison
│   │   └── models.test.js              # All 5 Mongoose model schemas
│   │
│   ├── scripts/                        # Utility & test scripts
│   │   ├── ai-experiment.js            # AI accuracy comparison experiment
│   │   ├── demo-data.js                # Generate demo lecture data
│   │   ├── performance-test.js         # Load testing (5-50 concurrent users)
│   │   ├── test-rate-limit.js          # Rate limit verification
│   │   └── ...                         # Additional test data scripts
│   │
│   ├── package.json                    # Dependencies & npm scripts
│   ├── .env                            # Environment variables
│   └── README.md                       # MVP documentation
│
├── mvp_livechat/                        # Earlier live chat prototype
├── websocket_test/                      # Initial WebSocket testing
│
├── docs/                                # Minutes of Meeting 
│   ├── MinutesofProjectMeetings_Feb26-Apr26.docx
│   └── MinutesofProjectMeetings_Oct25-Jan26.docx
│
└── README.md                            # This file
```

## Technology Stack

| Layer       | Technology                                              |
|-------------|---------------------------------------------------------|
| Backend     | Node.js, Express.js, Socket.IO                         |
| Database    | MongoDB, Mongoose ODM                                  |
| Frontend    | Vanilla HTML/CSS/JavaScript, Chart.js                  |
| AI Services | Hugging Face (DistilBART, KBIR-Inspec), RAKE (fallback)|
| Security    | bcryptjs, express-rate-limit, XSS sanitisation         |
| Testing     | Jest, Supertest (97 automated tests)                   |

## Key Directories

- **`/websocket_test`** - Initial WebSocket test
- **`/mvp_livechat`** - Initial live chat development
- **`/docs`** - Documentation of progress (minutes of meetings)
- **`/mvp-lecture-management`** - Main software development

