# Final-Year-Project - 40392749

Real-Time Student Engagement Platform for Large-Scale Lectures

## Project Structure

```
final-year-project/
│
├── mvp-lecture-management/             # Main application (active development)
│   │
│   ├── client/                         # Frontend (Vanilla HTML/CSS/JS)
│   │   ├── css/
│   │   │   ├── analytics.css           # Analytics cards, charts, keywords
│   │   │   ├── announcement-pin.css    # Announcement and pin feature styles
│   │   │   ├── auth.css                # Login and register pages
│   │   │   ├── base.css                # CSS variables, reset, layout, utilities
│   │   │   ├── chat.css                # Chat container, input area, identity selector
│   │   │   ├── compact.css             # Compact layout overrides
│   │   │   ├── dark-mode.css           # Dark mode overrides
│   │   │   ├── forms.css               # Form inputs, buttons, profile fields
│   │   │   ├── messages.css            # Message bubbles, replies, attachments
│   │   │   ├── navbar.css              # Navigation bar and avatar
│   │   │   ├── polls.css               # Poll-related styles
│   │   │   ├── reflection.css          # Self-reflection dashboard styles
│   │   │   └── responsive.css          # Responsive breakpoints
│   │   ├── js/
│   │   │   ├── announcement-pin.js     # Announcement and pin functionality
│   │   │   ├── auth.js                 # Login and register form handling
│   │   │   ├── chat-avatar.js          # Avatar generation and display
│   │   │   ├── dark-mode.js            # Theme toggle
│   │   │   ├── identity-mode.js        # Anonymous/pseudonymous/identified switching
│   │   │   ├── lecturer-dashboard.js   # Micro-analytics dashboard
│   │   │   ├── macro-analytics.js      # Semester-wide trends and comparisons
│   │   │   ├── manage-students.js      # Bulk upload and student administration
│   │   │   ├── profile.js              # User profile management
│   │   │   ├── student-chat.js         # Real-time chat interface for students
│   │   │   ├── student-reflection.js   # Self-reflection dashboard (SRL)
│   │   │   └── utils.js                # Helper functions
│   │   ├── chat-room.html              # Real-time chat interface
│   │   ├── lecturer-dashboard.html     # Lecturer analytics dashboard
│   │   ├── login.html                  # Authentication page
│   │   ├── register.html               # Registration page
│   │   └── student-dashboard.html      # Student UI (chat + reflection)
│   │
│   ├── scripts/                        # Utility and test scripts
│   │   ├── ai-experiment.js            # AI accuracy comparison experiment
│   │   ├── demo-data.js                # Generate demo lecture data
│   │   ├── generate-test-data.js       # Create test data
│   │   ├── performance-test.js         # Load testing (5-50 concurrent users)
│   │   ├── test-ai-comparison.js       # AI service benchmarking
│   │   └── test-rate-limit.js          # Rate limit verification
│   │
│   ├── server/                         # Backend (Node.js + Express)
│   │   ├── config/
│   │   │   └── database.js             # MongoDB connection configuration
│   │   ├── middleware/
│   │   │   ├── auth.js                 # Authentication and role-based access control
│   │   │   └── security.js             # XSS sanitisation, rate limiting, security headers
│   │   ├── models/
│   │   │   ├── membership.js           # Session-user relationship schema
│   │   │   ├── message.js              # Chat message schema (type, identityMode, alias)
│   │   │   ├── session.js              # Lecture session schema (joinCode, status, settings)
│   │   │   ├── studentreflection.js    # Self-regulated learning (goals, achievements, trends)
│   │   │   └── user.js                 # User schema (email, password, role, avatar)
│   │   ├── routes/
│   │   │   ├── analytics.js            # Micro and macro analytics endpoints
│   │   │   ├── auth.js                 # Register, login, logout, session check
│   │   │   ├── bulk-upload.js          # CSV bulk student upload
│   │   │   ├── messages.js             # Message posting, fetching, classification
│   │   │   ├── profile.js              # User profile and avatar management
│   │   │   ├── reflection.js           # Student self-reflection data
│   │   │   └── sessions.js             # CRUD for lecture sessions
│   │   ├── services/
│   │   │   ├── ai-comparison.js        # AI accuracy comparison and benchmarking
│   │   │   ├── ai-keywords.js          # Hugging Face KBIR-Inspec and RAKE keyword extraction
│   │   │   └── ai-summary.js           # DistilBART session summarisation with fallback
│   │   └── server.js                   # Main entry point (Express + Socket.IO setup)
│   │
│   ├── tests/                          # Jest automated tests (145 tests)
│   │   ├── ai-services.test.js         # RAKE and AI comparison
│   │   ├── auth-middleware.test.js     # Role-based access control
│   │   ├── auth-routes.test.js         # Registration, login, logout
│   │   ├── models.test.js              # All 5 Mongoose model schemas
│   │   └── security.test.js            # XSS sanitisation and security headers
│   │
│   ├── .env.example                    # Environment variable template
│   ├── .gitignore                      # Git ignore rules
│   ├── package.json                    # Dependencies and npm scripts
│   └── README.md                       # MVP documentation
│
├── mvp_livechat/                       # Earlier live chat prototype
├── websocket_test/                     # Initial WebSocket testing
│
├── docs/                               # Minutes of meetings
│   ├── MinutesofProjectMeetings_Feb26-Apr26.docx
│   └── MinutesofProjectMeetings_Oct25-Jan26.docx
│
└── README.md                           # This file
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

