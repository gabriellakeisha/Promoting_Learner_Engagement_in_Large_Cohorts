/**
 * 
 * Run from project root:
 *   node scripts/demo-data.js
 * 
 * 
 *  LECTURER ACCOUNTS:
 *  ┌─────────────────────────────┬──────────────┬────────────────────┐
 *  │ Email                       │ Password     │ Name               │
 *  ├─────────────────────────────┼──────────────┼────────────────────┤
 *  │ rthompson42@qub.ac.uk       │ Demo2026!    │ Dr. Rachel Thompson│
 *  │ mclark17@qub.ac.uk          │ Demo2026!    │ Dr. Mark Clark     │
 *  └─────────────────────────────┴──────────────┴────────────────────┘
 * 
 *  STUDENT ACCOUNTS:
 *  ┌────────────────────────────┬──────────────┬────────────────────┐
 *  │ Email                      │ Password     │ Name               │
 *  ├────────────────────────────┼──────────────┼────────────────────┤
 *  │ esullivan14@qub.ac.uk      │ Demo2026!    │ Emma Sullivan      │
 *  │ lobrien23@qub.ac.uk        │ Demo2026!    │ Liam O'Brien       │
 *  │ amurphy08@qub.ac.uk        │ Demo2026!    │ Aoife Murphy       │
 *  │ cwalsh31@qub.ac.uk         │ Demo2026!    │ Conor Walsh        │
 *  │ nkelly19@qub.ac.uk         │ Demo2026!    │ Niamh Kelly        │
 *  │ sgallagher05@qub.ac.uk     │ Demo2026!    │ Sean Gallagher     │
 *  │ cbyrne27@qub.ac.uk         │ Demo2026!    │ Ciara Byrne        │
 *  │ odoyle11@qub.ac.uk         │ Demo2026!    │ Oisin Doyle        │
 *  │ squinn33@qub.ac.uk         │ Demo2026!    │ Saoirse Quinn      │
 *  │ rmccarthy09@qub.ac.uk      │ Demo2026!    │ Rory McCarthy      │
 *  │ flynch22@qub.ac.uk         │ Demo2026!    │ Fiona Lynch        │
 *  │ doneill16@qub.ac.uk        │ Demo2026!    │ Darragh O'Neill    │
 *  │ mconnolly04@qub.ac.uk      │ Demo2026!    │ Maeve Connolly     │
 *  │ pryan28@qub.ac.uk          │ Demo2026!    │ Patrick Ryan       │
 *  │ sdaly13@qub.ac.uk          │ Demo2026!    │ Siobhan Daly       │
 *  │ ckennedy07@qub.ac.uk       │ Demo2026!    │ Cillian Kennedy    │
 *  │ amoore35@qub.ac.uk         │ Demo2026!    │ Aisling Moore      │
 *  │ dmurray21@qub.ac.uk        │ Demo2026!    │ Declan Murray      │
 *  │ obrennan10@qub.ac.uk       │ Demo2026!    │ Orla Brennan       │
 *  │ ehughes26@qub.ac.uk        │ Demo2026!    │ Eoin Hughes        │
 *  └─────────────────────────────┴──────────────┴────────────────────┘
 * 
 *  All passwords: Demo2026!
 * ═══════════════════════════════════════════════════════════
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lecture-engagement';

// ============================================
// SCHEMAS (self-contained like test-data.js)
// ============================================

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  displayName: { type: String, required: true, trim: true },
  role: { type: String, enum: ['student', 'lecturer', 'admin'], default: 'student' },
  lastLogin: { type: Date, default: null },
  loginCount: { type: Number, default: 0 },
  isOnline: { type: Boolean, default: false },
  avatar: {
    type: { type: String, enum: ['generated', 'uploaded'], default: 'generated' },
    initials: String,
    backgroundColor: String,
    imageUrl: String
  },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

const sessionSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  joinCode: { type: String, required: true, unique: true, uppercase: true },
  lecturer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  moduleCode: { type: String, trim: true },
  description: { type: String, trim: true },
  status: { type: String, enum: ['active', 'ended', 'scheduled'], default: 'active' },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date, default: null },
  settings: {
    allowAnonymous: { type: Boolean, default: true },
    messageHistoryLimit: { type: Number, default: 50 },
  },
  createdAt: { type: Date, default: Date.now },
}, { timestamps: true });

const membershipSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  joinedAt: { type: Date, default: Date.now },
  messageCount: { type: Number, default: 0 },
}, { timestamps: true });
membershipSchema.index({ userId: 1, sessionId: 1 }, { unique: true });

const messageSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true },
  type: { type: String, enum: ['QUESTION', 'COMMENT', 'CONFUSION', 'POLL', 'NONE'], default: 'COMMENT' },
  identityMode: { type: String, enum: ['anonymous', 'pseudonymous', 'identified'], default: 'anonymous' },
  alias: { type: String, default: null },
  timestamp: { type: Date, default: Date.now },
  isAnnouncement: { type: Boolean, default: false },
  isPinned: { type: Boolean, default: false },
  isDeleted: { type: Boolean, default: false },
  isEdited: { type: Boolean, default: false },
  reactions: { type: Map, of: [String], default: new Map() },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', userSchema);
const Session = mongoose.models.Session || mongoose.model('Session', sessionSchema);
const Membership = mongoose.models.Membership || mongoose.model('Membership', membershipSchema);
const Message = mongoose.models.Message || mongoose.model('Message', messageSchema);

// ============================================
// DEMO ACCOUNTS
// ============================================

const DEMO_PASSWORD = 'Demo2026!';

const DEMO_LECTURERS = [
  { email: 'rthompson42@qub.ac.uk', displayName: 'Dr. Rachel Thompson' },
  { email: 'mclark17@qub.ac.uk', displayName: 'Dr. Mark Clark' },
];

const DEMO_STUDENTS = [
  { email: 'esullivan14@qub.ac.uk', displayName: 'Emma Sullivan' },
  { email: 'lobrien23@qub.ac.uk', displayName: "Liam O'Brien" },
  { email: 'amurphy08@qub.ac.uk', displayName: 'Aoife Murphy' },
  { email: 'cwalsh31@qub.ac.uk', displayName: 'Conor Walsh' },
  { email: 'nkelly19@qub.ac.uk', displayName: 'Niamh Kelly' },
  { email: 'sgallagher05@qub.ac.uk', displayName: 'Sean Gallagher' },
  { email: 'cbyrne27@qub.ac.uk', displayName: 'Ciara Byrne' },
  { email: 'odoyle11@qub.ac.uk', displayName: 'Oisin Doyle' },
  { email: 'squinn33@qub.ac.uk', displayName: 'Saoirse Quinn' },
  { email: 'rmccarthy09@qub.ac.uk', displayName: 'Rory McCarthy' },
  { email: 'flynch22@qub.ac.uk', displayName: 'Fiona Lynch' },
  { email: 'doneill16@qub.ac.uk', displayName: "Darragh O'Neill" },
  { email: 'mconnolly04@qub.ac.uk', displayName: 'Maeve Connolly' },
  { email: 'pryan28@qub.ac.uk', displayName: 'Patrick Ryan' },
  { email: 'sdaly13@qub.ac.uk', displayName: 'Siobhan Daly' },
  { email: 'ckennedy07@qub.ac.uk', displayName: 'Cillian Kennedy' },
  { email: 'amoore35@qub.ac.uk', displayName: 'Aisling Moore' },
  { email: 'dmurray21@qub.ac.uk', displayName: 'Declan Murray' },
  { email: 'obrennan10@qub.ac.uk', displayName: 'Orla Brennan' },
  { email: 'ehughes26@qub.ac.uk', displayName: 'Eoin Hughes' },
];

// ============================================
// DEMO SESSIONS — Realistic university schedule
// ============================================

function getRealisticSchedule() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // Sessions spread across the last 3 weeks like a real timetable
  return [
    {
      title: 'Introduction to Web Technologies',
      moduleCode: 'CSC1028',
      lecturerIdx: 0,
      status: 'ended',
      topic: 'web',
      // 3 weeks ago, Monday 10:00
      startTime: new Date(today.getTime() - 21 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000),
      msgCount: 55,
    },
    {
      title: 'Database Systems & SQL',
      moduleCode: 'CSC2032',
      lecturerIdx: 0,
      status: 'ended',
      topic: 'db',
      // 2 weeks ago, Wednesday 14:00
      startTime: new Date(today.getTime() - 12 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000),
      msgCount: 62,
    },
    {
      title: 'Object-Oriented Programming',
      moduleCode: 'CSC1023',
      lecturerIdx: 1,
      status: 'ended',
      topic: 'oop',
      // 2 weeks ago, Thursday 11:00
      startTime: new Date(today.getTime() - 11 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000),
      msgCount: 48,
    },
    {
      title: 'Software Testing & QA',
      moduleCode: 'CSC3065',
      lecturerIdx: 0,
      status: 'ended',
      topic: 'testing',
      // 1 week ago, Monday 10:00
      startTime: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000),
      msgCount: 70,
    },
    {
      title: 'Human-Computer Interaction',
      moduleCode: 'CSC3002',
      lecturerIdx: 0,
      status: 'ended',
      topic: 'hci',
      // 1 week ago, Wednesday 14:00
      startTime: new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000 + 14 * 60 * 60 * 1000),
      msgCount: 58,
    },
    {
      title: 'Cloud Computing Fundamentals',
      moduleCode: 'CSC3056',
      lecturerIdx: 1,
      status: 'ended',
      topic: 'cloud',
      // 4 days ago, Thursday 11:00
      startTime: new Date(today.getTime() - 4 * 24 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000),
      msgCount: 45,
    },
    {
      title: 'Data Structures & Algorithms',
      moduleCode: 'CSC2025',
      lecturerIdx: 0,
      status: 'active',
      topic: 'dsa',
      // Yesterday 10:00 (active = can still chat)
      startTime: new Date(today.getTime() - 1 * 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000),
      msgCount: 65,
    },
    {
      title: 'Machine Learning Fundamentals',
      moduleCode: 'CSC3064',
      lecturerIdx: 0,
      status: 'active',
      topic: 'ml',
      // Today 9:00 (active = live demo session)
      startTime: new Date(today.getTime() + 9 * 60 * 60 * 1000),
      msgCount: 40,
    },
  ];
}

// ============================================
// MESSAGE CONTENT
// ============================================

const QUESTION_MSGS = [
  "Can you explain how binary search trees maintain their ordering property?",
  "What's the difference between TCP and UDP in terms of reliability?",
  "How does garbage collection work in Java compared to manual memory management in C?",
  "Could you go over the time complexity of quicksort vs mergesort again?",
  "When would we choose a hash table over a balanced BST?",
  "Is polymorphism the same as method overriding or does it cover more?",
  "How do SQL joins actually work under the hood?",
  "What's the practical difference between REST and GraphQL APIs?",
  "Can you explain how CSS flexbox differs from grid layout?",
  "Why do we need both authentication and authorisation?",
  "How does recursion use the call stack differently from iteration?",
  "What happens when a deadlock occurs in a multithreaded program?",
  "Could you clarify the difference between normalisation forms 2NF and 3NF?",
  "How do containerised applications differ from virtual machines?",
  "What's the significance of Big O notation in real-world performance?",
  "How does a load balancer distribute traffic across servers?",
  "Can you explain the CAP theorem with a practical example?",
  "Why is HTTPS important and how does the TLS handshake work?",
  "What's the difference between unit testing and integration testing?",
  "How do microservices communicate compared to monolithic architectures?",
  "Is there a performance penalty for using an ORM instead of raw SQL?",
  "How does the browser render a page from HTML to pixels on screen?",
  "What's the advantage of using a message queue like RabbitMQ?",
  "Can you explain how WebSocket connections differ from HTTP polling?",
  "Why are functional programming concepts becoming popular in JavaScript?",
  "What's the role of the DNS resolver when we type a URL in the browser?",
  "How does Docker networking work between containers?",
  "Could you explain what eventual consistency means in distributed databases?",
  "What's the trade-off between normalising and denormalising a database?",
  "How does the event loop in Node.js handle asynchronous operations?",
  "Why would we use Redis for caching instead of just querying the database?",
  "What exactly does a reverse proxy do and when would we need one?",
  "How does React's virtual DOM improve rendering performance?",
  "Can you explain the difference between symmetric and asymmetric encryption?",
  "What are the benefits of using TypeScript over plain JavaScript?",
  "How does Git handle merge conflicts internally?",
  "What's the difference between horizontal and vertical scaling?",
  "Why is input validation important on both client and server side?",
  "How does a CDN reduce page load time for users in different regions?",
  "Can you explain the difference between PUT and PATCH in REST APIs?",
];

const COMMENT_MSGS = [
  "Great explanation, the diagram really helped clarify the concept",
  "This makes much more sense now after seeing the code example",
  "I found a good Stack Overflow thread about this if anyone wants the link",
  "The analogy to a library catalogue was really helpful for understanding indexing",
  "Just tested this in my local environment and it works as described",
  "This connects well to what we covered in last week's practical",
  "The visual representation of the algorithm steps is really clear",
  "Thanks for the clarification, I was overthinking this",
  "Interesting how this relates to the design patterns we discussed earlier",
  "I noticed the example code in the slides has a small typo on line 15",
  "I agree, this approach is much cleaner than the alternative",
  "Good point about error handling, I hadn't considered that edge case",
  "The textbook chapter on this was confusing but your explanation is clear",
  "I implemented this for my coursework and it reduced the runtime significantly",
  "Worth noting this is also covered in the MIT OpenCourseWare lectures",
  "The debugging tip about using breakpoints saved me hours on the assignment",
  "Really useful real-world application example, thanks for sharing",
  "That Netflix analogy makes the recommendation system much easier to grasp",
  "Makes sense now, thanks for breaking it down step by step",
  "The practice problems on Canvas are really helpful for revision",
  "I tried a different approach using a while loop and got the same result",
  "Adding that try-catch block fixed the crash I was getting in my project",
  "The comparison table between SQL and NoSQL was very useful",
  "I appreciate the live coding demo, it's easier to follow than slides",
  "Bookmarked the documentation link you shared, looks comprehensive",
  "The refactored version is so much more readable than the original",
  "I ran the benchmark and the optimised version is roughly 3x faster",
  "That's a clever use of the observer pattern for the notification system",
  "The accessibility tips for forms are something I hadn't thought about before",
  "Using semantic HTML actually improved my SEO score quite a bit",
  "Good reminder about CORS headers, that was causing my fetch errors too",
  "The mock API approach for testing the frontend is really practical",
  "I switched from callbacks to async/await and my code is so much cleaner now",
  "The ER diagram on the board clarified the table relationships perfectly",
  "Learned something new about CSS specificity today, cheers",
  "This is exactly the pattern I needed for my group project API layer",
  "The Chrome DevTools network tab tip was a game changer for debugging",
  "Version control branching strategies make way more sense after this lecture",
  "Really helpful to see the before-and-after comparison of the refactored code",
  "The Postman walkthrough made testing API endpoints much less intimidating",
];

const CONFUSION_MSGS = [
  "I'm lost on how the recursion base case works here",
  "Can we slow down? The pointer arithmetic is confusing me",
  "Not sure I understand how the foreign key relationship works",
  "This is going quite fast, could we see another example?",
  "Confused about why we need both a stack and a queue here",
  "Need more explanation on how the hashing function distributes keys",
  "The inheritance hierarchy isn't clicking for me yet",
  "I don't get how the middleware chain processes requests",
  "Can we revisit the normalisation steps? Still unclear on 3NF",
  "Still struggling with the difference between processes and threads",
  "The Big O analysis for this algorithm doesn't make sense to me",
  "I'm confused about when to use async/await vs plain promises",
  "Not following the DNS resolution process at all",
  "Could we go through the SQL subquery example one more time?",
  "The dependency injection concept is hard to grasp",
  "I can't see how the binary representation converts back to decimal here",
  "The difference between composition and inheritance is unclear to me",
  "How does the callback queue relate to the microtask queue exactly?",
  "I'm struggling to understand why we need database transactions",
  "The regular expression syntax is really confusing",
  "Not sure I follow the difference between shallow and deep copy",
  "Can you re-explain how the routing table decides where to forward packets?",
  "The closure example doesn't make sense, why does the variable persist?",
  "I'm confused about the difference between authorisation and authentication",
  "Can we go over how the CSS cascade determines which style wins?",
  "The difference between let, const, and var scoping is tripping me up",
  "I don't understand how the linked list reversal algorithm works",
  "Having trouble grasping how promises chain together with .then()",
  "The polymorphism example with shapes was confusing, can we revisit?",
  "I still don't see why immutability matters in state management",
];

const LECTURER_MSGS = [
  "Good question! Let me break that down with a diagram",
  "Remember, the assignment deadline is next Friday at 4pm",
  "I'll post the code examples from today's lecture on Canvas",
  "Excellent observation, that's exactly the kind of critical thinking we need",
  "Let's take a 5-minute break and come back to this topic",
  "This will be covered in more detail in next week's practical",
  "Great discussion today, keep the questions coming",
  "Check the recommended reading list for deeper coverage of this topic",
  "I'll address that question after we finish this section",
  "Important: the lab session has moved to room 01/009 this week",
  "Does everyone follow so far? Let me know if you need me to slow down",
  "That's a common misconception, let me clarify the distinction",
  "I've added some additional practice exercises to the Canvas module",
  "Notice how this pattern appears in many different areas of computing",
  "For the exam, focus on understanding the concepts rather than memorising syntax",
  "Let me show you a live demo of how this works in practice",
  "The peer review for the group project is open until Sunday evening",
  "I'll share the recording of today's session by tomorrow morning",
  "Any other questions before we move on to the next topic?",
  "Good use of the chat for asking questions, keep it up",
];

// Topic-specific message pools. Picker prefers these when session.topic matches,
// then falls back to the generic pool for ~20% of messages (off-topic chatter is realistic).
const TOPIC_MSGS = {
  web: {
    questions: [
      "Can you explain how CSS flexbox differs from grid layout?",
      "How does the browser actually render HTML into pixels on the screen?",
      "What happens when we type a URL and hit enter, step by step?",
      "Why do we need both client-side and server-side validation?",
      "How does event propagation decide which handler fires first?",
      "Is it better to use cookies or localStorage for a login token?",
      "What's the real difference between inline, block, and inline-block?",
      "How does CSS specificity decide which rule wins a conflict?",
    ],
    comments: [
      "The flexbox cheat sheet on CSS-Tricks is genuinely lifesaving",
      "Using semantic HTML actually improved my Lighthouse score quite a bit",
      "That responsive navigation demo was really clean",
      "I bookmarked the MDN reference you showed in the lecture",
      "Good reminder about CORS headers, that was causing my fetch errors too",
      "The DevTools network tab tip was a game changer for debugging",
      "Media queries finally click for me after seeing the breakpoints example",
      "I refactored my layout with grid and removed half the CSS",
    ],
    confusion: [
      "I'm lost on how CSS specificity decides which rule wins",
      "Why does my flexbox item not align the way I expect?",
      "Can we revisit how event bubbling differs from event capturing?",
      "Still confused about when to use relative vs absolute positioning",
      "I don't get why my fetch call is blocked by CORS",
      "The box model with padding and margin is still tripping me up",
    ],
  },
  db: {
    questions: [
      "How do SQL joins actually work under the hood?",
      "Could you clarify the difference between normalisation forms 2NF and 3NF?",
      "What's the trade-off between normalising and denormalising a table?",
      "When should we add an index to a column and when should we not?",
      "What's the difference between a clustered and non-clustered index?",
      "Is there a performance penalty for using an ORM instead of raw SQL?",
      "Why would we use Redis for caching instead of just querying the database?",
      "Can you explain eventual consistency with a practical example?",
    ],
    comments: [
      "The ER diagram on the board clarified the table relationships perfectly",
      "Our query went from 4 seconds to 200ms after adding that index",
      "The comparison table between SQL and NoSQL was really useful",
      "I implemented the normalisation steps for my coursework and it helped a lot",
      "Transactions finally clicked after the bank-transfer example",
      "Seeing the EXPLAIN plan in action made query tuning much less mysterious",
      "The library-catalogue analogy for indexing really stuck with me",
      "Postgres documentation is surprisingly readable compared to what I expected",
    ],
    confusion: [
      "Not sure I understand how the foreign key relationship works",
      "Can we revisit the normalisation steps? Still unclear on 3NF",
      "The difference between INNER JOIN and LEFT JOIN confuses me",
      "I'm struggling to understand why we need database transactions",
      "Could we go through the SQL subquery example one more time?",
      "I don't get when to use a view vs a materialised view",
    ],
  },
  oop: {
    questions: [
      "Is polymorphism the same as method overriding or does it cover more?",
      "When should we use composition over inheritance?",
      "Could you explain the SOLID principles with a concrete example?",
      "What's the practical difference between an abstract class and an interface?",
      "Why is encapsulation considered so important in OOP?",
      "How do access modifiers actually affect inheritance in Java?",
      "Can you explain how method resolution works with multiple interfaces?",
      "How does garbage collection work in Java compared to manual memory in C?",
    ],
    comments: [
      "The inheritance diagram on the slide was really clean",
      "Finally understood polymorphism after the shape-drawing example",
      "Composition over inheritance makes so much more sense now",
      "I refactored my assignment to use interfaces and it's way cleaner",
      "Seeing a Liskov substitution violation in real code was eye-opening",
      "The Strategy pattern is exactly what I needed for my project",
      "The Gang of Four book is officially on my reading list now",
      "That encapsulation example made the 'why private' question finally clear",
    ],
    confusion: [
      "The inheritance hierarchy isn't clicking for me yet",
      "The difference between composition and inheritance is unclear to me",
      "The polymorphism example with shapes was confusing, can we revisit?",
      "I'm lost on when to use an abstract class vs an interface",
      "Private vs protected access — when do we pick which?",
      "The dependency injection concept is hard to grasp",
    ],
  },
  testing: {
    questions: [
      "What's the difference between unit testing and integration testing?",
      "How do we decide what to mock and what to use the real thing?",
      "When should we write tests — before or after the code?",
      "Is 100% code coverage actually a good goal?",
      "How does TDD differ from BDD in practice?",
      "What's a good strategy for testing asynchronous code?",
      "How do snapshot tests compare to assertion-based tests?",
      "Can you explain what a flaky test is and how to fix one?",
    ],
    comments: [
      "The Jest walkthrough made writing unit tests much less intimidating",
      "I finally see the value of writing tests first",
      "Mocking the database instead of hitting a real one saved our CI time",
      "The red-green-refactor cycle is simpler than I expected",
      "Good point about testing behaviour, not implementation details",
      "Our flaky tests turned out to be shared state — that example was spot on",
      "Integration tests with a real DB caught bugs our unit tests missed",
      "I'm going to try TDD on the next assignment",
    ],
    confusion: [
      "I don't get when to mock a dependency vs use the real one",
      "The distinction between unit and integration tests is fuzzy for me",
      "Why does my async test pass sometimes and fail other times?",
      "Still unclear on how to test private methods",
      "Code coverage numbers don't mean much to me yet",
      "I'm confused about the difference between stubs and mocks",
    ],
  },
  hci: {
    questions: [
      "How do we measure usability in a formal study?",
      "What's the difference between a heuristic evaluation and a usability test?",
      "When should we use a wireframe versus a high-fidelity prototype?",
      "Could you explain Fitts's Law and where it applies in UI design?",
      "How do we run a cognitive walkthrough in practice?",
      "What makes an interface 'accessible' beyond just screen reader support?",
      "Why is consistency considered a core usability principle?",
      "How many users do we actually need for a usability test?",
    ],
    comments: [
      "The Nielsen heuristics list is genuinely useful for critiquing any UI",
      "That before-and-after redesign example was really compelling",
      "I never considered error recovery as a design principle",
      "Figma's prototyping features are great for quick user flows",
      "Accessibility as a constraint made my designs better overall",
      "The think-aloud protocol sounds simple but it's surprisingly hard",
      "Good reminder that users rarely read anything on a screen",
      "The persona exercise helped focus my design decisions",
    ],
    confusion: [
      "The difference between formative and summative evaluation is unclear",
      "I don't get when to use a paper prototype vs a digital one",
      "How do you avoid leading questions in a user interview?",
      "The terms 'usability' and 'user experience' seem to overlap a lot",
      "I'm lost on what counts as a 'critical incident' in a usability study",
      "Not sure how to report findings without introducing bias",
    ],
  },
  cloud: {
    questions: [
      "How do containerised applications differ from virtual machines?",
      "How does a load balancer distribute traffic across servers?",
      "Can you explain the CAP theorem with a practical example?",
      "How do microservices communicate compared to monolithic architectures?",
      "What's the advantage of using a message queue like RabbitMQ?",
      "What exactly does a reverse proxy do and when would we need one?",
      "What's the difference between horizontal and vertical scaling?",
      "How does auto-scaling decide when to add more instances?",
    ],
    comments: [
      "Docker finally clicked after seeing the layered file system explanation",
      "The CAP theorem diagram really simplified a confusing topic",
      "Kubernetes is intimidating but the pod-service-deployment story helped",
      "I appreciated the cost comparison between on-prem and cloud",
      "Serverless is cool but cold starts are a real pain",
      "That horizontal scaling diagram made the trade-offs obvious",
      "The blue-green deployment demo was really clear",
      "Good point that microservices are an organisational choice as much as a technical one",
    ],
    confusion: [
      "I don't get how Docker networking works between containers",
      "Still struggling with the difference between a pod and a container",
      "The CAP theorem tradeoffs are confusing me",
      "When should we actually use a message queue vs direct calls?",
      "Not sure how Kubernetes schedules pods across nodes",
      "The reverse proxy vs API gateway distinction is unclear to me",
    ],
  },
  dsa: {
    questions: [
      "Can you explain how binary search trees maintain their ordering property?",
      "Could you go over the time complexity of quicksort vs mergesort again?",
      "When would we choose a hash table over a balanced BST?",
      "How does recursion use the call stack differently from iteration?",
      "What's the significance of Big O notation in real-world performance?",
      "How does memoization speed up recursive algorithms?",
      "When should we use a min-heap versus a max-heap?",
      "Why is dynamic programming considered 'smart recursion'?",
    ],
    comments: [
      "The visual representation of the quicksort partition step was really clear",
      "That visualiser website made tree rotations make sense",
      "Big O finally clicks after seeing the growth rate graph",
      "I implemented a hash table for my coursework and debugging collisions was fun",
      "Memoization cut my runtime from 10s to 40ms, wild",
      "The stack vs heap explanation tied together a lot of earlier concepts",
      "I finally see why we care about amortised cost",
      "Seeing the cache locality impact on arrays vs linked lists was eye-opening",
    ],
    confusion: [
      "I'm lost on how the recursion base case works here",
      "The Big O analysis for this algorithm doesn't make sense to me",
      "I don't understand how the linked list reversal algorithm works",
      "Confused about why we need both a stack and a queue here",
      "Still struggling with when a greedy algorithm actually works",
      "The tree rotation steps are going too fast for me",
    ],
  },
  ml: {
    questions: [
      "How does gradient descent actually update the weights step by step?",
      "What's the difference between supervised and unsupervised learning in practice?",
      "When should we use random forests over a single decision tree?",
      "Why do we split data into train, validation, and test sets?",
      "Can you explain overfitting with a concrete example?",
      "How does cross-validation help us pick a better model?",
      "What's the role of the loss function in training a neural network?",
      "Why do we one-hot encode categorical variables?",
    ],
    comments: [
      "The gradient descent animation made a confusing concept finally click",
      "I finally see why we need feature scaling",
      "That overfitting example with the polynomial curve was perfect",
      "scikit-learn's pipeline API is really clean once you get it",
      "The bias-variance trade-off is clearer after the target-shooting analogy",
      "The confusion matrix example made precision vs recall obvious",
      "Jupyter notebooks are so much nicer for exploring data than plain scripts",
      "I ran the MNIST demo locally and it worked first try",
    ],
    confusion: [
      "I'm confused about when to use classification vs regression",
      "The backpropagation math is really confusing",
      "Why do we need a validation set if we already have a test set?",
      "Not sure I follow how regularisation prevents overfitting",
      "The difference between a model's bias and variance is fuzzy",
      "I don't get why we split the data the way we do",
    ],
  },
};

const ALIAS_ADJECTIVES = ['Clever', 'Swift', 'Bright', 'Calm', 'Bold', 'Wise', 'Quick', 'Sharp', 'Keen', 'Brave'];
const ALIAS_ANIMALS = ['Fox', 'Owl', 'Eagle', 'Wolf', 'Bear', 'Hawk', 'Lion', 'Tiger', 'Falcon', 'Panda'];

// ============================================
// HELPERS
// ============================================

function generateJoinCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

function generateAlias() {
  const adj = ALIAS_ADJECTIVES[Math.floor(Math.random() * ALIAS_ADJECTIVES.length)];
  const animal = ALIAS_ANIMALS[Math.floor(Math.random() * ALIAS_ANIMALS.length)];
  return `${adj}${animal}${Math.floor(Math.random() * 999) + 1}`;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getTimestampInLecture(sessionStart, durationMinutes, position) {
  // position: 0-1 representing how far through the lecture
  // Add some jitter so messages aren't perfectly spaced
  const jitter = (Math.random() - 0.5) * 2 * 60 * 1000; // ±1 minute
  const offset = position * durationMinutes * 60 * 1000 + jitter;
  return new Date(sessionStart.getTime() + Math.max(0, Math.min(offset, durationMinutes * 60 * 1000)));
}

// ============================================
// MAIN
// ============================================

async function seedDemoData() {
  try {
    console.log('');
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║          EchoClass — Demo Data Seed Script                ║');
    console.log('║   Creates demo accounts + realistic lecture sessions      ║');
    console.log('║   Does NOT delete existing data                           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('');

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected\n');

    const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);

    // ============================================
    // CREATE LECTURERS
    // ============================================
    console.log('👨‍🏫 Creating lecturer accounts...');
    const lecturers = [];
    for (const l of DEMO_LECTURERS) {
      let user = await User.findOne({ email: l.email });
      if (user) {
        console.log(`   ⏭️  ${l.email} already exists, skipping`);
      } else {
        user = await User.create({
          email: l.email,
          password: hashedPassword,
          displayName: l.displayName,
          role: 'lecturer',
          loginCount: Math.floor(Math.random() * 20) + 5,
          lastLogin: new Date(),
        });
        console.log(`   ✅ ${l.email} — ${l.displayName}`);
      }
      lecturers.push(user);
    }
    console.log('');

    // ============================================
    // CREATE STUDENTS
    // ============================================
    console.log('👩‍🎓 Creating student accounts...');
    const students = [];
    for (const s of DEMO_STUDENTS) {
      let user = await User.findOne({ email: s.email });
      if (user) {
        console.log(`   ⏭️  ${s.email} already exists, skipping`);
      } else {
        user = await User.create({
          email: s.email,
          password: hashedPassword,
          displayName: s.displayName,
          role: 'student',
          loginCount: Math.floor(Math.random() * 30) + 1,
          lastLogin: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        });
        console.log(`   ✅ ${s.email} — ${s.displayName}`);
      }
      students.push(user);
    }
    console.log('');

    // ============================================
    // CREATE SESSIONS WITH REALISTIC SCHEDULE
    // ============================================
    console.log('📚 Creating demo sessions...');
    const schedule = getRealisticSchedule();
    const sessions = [];
    const usedCodes = new Set();

    for (const sd of schedule) {
      let joinCode;
      do { joinCode = generateJoinCode(); } while (usedCodes.has(joinCode));
      usedCodes.add(joinCode);

      const session = await Session.create({
        title: sd.title,
        joinCode,
        lecturer: lecturers[sd.lecturerIdx]._id,
        moduleCode: sd.moduleCode,
        description: `${sd.title} — Week ${Math.floor(Math.random() * 12) + 1}`,
        status: sd.status,
        startTime: sd.startTime,
        endTime: sd.status === 'ended' ? new Date(sd.startTime.getTime() + 50 * 60 * 1000) : null,
        createdAt: sd.startTime,
      });

      sessions.push({ ...sd, _id: session._id, joinCode, lecturerId: lecturers[sd.lecturerIdx]._id });
      console.log(`   ✅ ${sd.title} [${joinCode}] — ${sd.status} — ${sd.startTime.toLocaleDateString()} ${sd.startTime.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`);
    }
    console.log('');

    // ============================================
    // CREATE MEMBERSHIPS
    // ============================================
    console.log('🔗 Enrolling students...');
    let totalMemberships = 0;

    for (const session of sessions) {
      // 15-20 students per session
      const numStudents = Math.floor(Math.random() * 6) + 15;
      const shuffled = [...students].sort(() => Math.random() - 0.5);
      const enrolled = shuffled.slice(0, numStudents);

      for (const student of enrolled) {
        try {
          await Membership.create({
            userId: student._id,
            sessionId: session._id,
            joinedAt: new Date(session.startTime.getTime() + Math.random() * 3 * 60 * 1000),
          });
          totalMemberships++;
        } catch (e) { /* duplicate, skip */ }
      }

      // Lecturer as member
      try {
        await Membership.create({
          userId: session.lecturerId,
          sessionId: session._id,
          joinedAt: session.startTime,
        });
        totalMemberships++;
      } catch (e) { }

      console.log(`   ✅ ${session.title}: ${enrolled.length} students`);
    }
    console.log('');

    // ============================================
    // CREATE MESSAGES — realistic 50-min window
    // ============================================
    console.log('💬 Generating realistic messages...');
    let totalMessages = 0;

    for (const session of sessions) {
      const memberships = await Membership.find({ sessionId: session._id });
      const studentMembers = memberships.filter(m => m.userId.toString() !== session.lecturerId.toString());
      const lecturerMember = memberships.find(m => m.userId.toString() === session.lecturerId.toString());

      // Active students (30% send most messages), casual (rest send fewer)
      const active = studentMembers.slice(0, Math.ceil(studentMembers.length * 0.35));
      const casual = studentMembers.slice(Math.ceil(studentMembers.length * 0.35));

      const numMessages = session.msgCount;
      const messages = [];
      const LECTURE_DURATION = 50; // minutes

      for (let i = 0; i < numMessages; i++) {
        const position = i / numMessages; // 0 to 1 through the lecture
        let userId, isLecturer = false;

        const roll = Math.random();
        if (roll < 0.12 && lecturerMember) {
          userId = lecturerMember.userId;
          isLecturer = true;
        } else if (roll < 0.35 && casual.length > 0) {
          userId = pickRandom(casual).userId;
        } else if (active.length > 0) {
          userId = pickRandom(active).userId;
        } else continue;

        // Message type distribution: 15% confusion, 25% question, 60% comment
        let type;
        if (isLecturer) {
          type = 'COMMENT';
        } else {
          const typeRoll = Math.random();
          // More confusion in middle of lecture, more questions at start
          if (position < 0.3) {
            type = typeRoll < 0.30 ? 'QUESTION' : typeRoll < 0.40 ? 'CONFUSION' : 'COMMENT';
          } else if (position < 0.7) {
            type = typeRoll < 0.20 ? 'QUESTION' : typeRoll < 0.40 ? 'CONFUSION' : 'COMMENT';
          } else {
            type = typeRoll < 0.25 ? 'QUESTION' : typeRoll < 0.35 ? 'CONFUSION' : 'COMMENT';
          }
        }

        // Identity mode
        let identityMode, alias = null;
        if (isLecturer) {
          identityMode = 'identified';
        } else {
          const modeRoll = Math.random();
          if (modeRoll < 0.40) identityMode = 'anonymous';
          else if (modeRoll < 0.75) { identityMode = 'pseudonymous'; alias = generateAlias(); }
          else identityMode = 'identified';
        }

        // Pick message text — prefer topic-specific pool, 20% fall-through to generic
        // so realistic off-topic chatter still appears ("thanks for the clarification", etc).
        let text;
        const topicPool = session.topic && TOPIC_MSGS[session.topic];
        const useTopic = topicPool && Math.random() < 0.8;
        if (isLecturer) {
          text = pickRandom(LECTURER_MSGS);
        } else if (type === 'QUESTION') {
          text = useTopic ? pickRandom(topicPool.questions) : pickRandom(QUESTION_MSGS);
        } else if (type === 'CONFUSION') {
          text = useTopic ? pickRandom(topicPool.confusion) : pickRandom(CONFUSION_MSGS);
        } else {
          text = useTopic ? pickRandom(topicPool.comments) : pickRandom(COMMENT_MSGS);
        }

        const timestamp = getTimestampInLecture(session.startTime, LECTURE_DURATION, position);

        messages.push({
          sessionId: session._id,
          userId,
          text,
          type,
          identityMode,
          alias,
          timestamp,
          isAnnouncement: isLecturer && Math.random() < 0.15,
        });
      }

      messages.sort((a, b) => a.timestamp - b.timestamp);
      await Message.insertMany(messages);
      totalMessages += messages.length;
      console.log(`   ✅ ${session.title}: ${messages.length} messages (50-min window)`);
    }
    console.log('');

    // ============================================
    // SUMMARY
    // ============================================
    console.log('═'.repeat(60));
    console.log('📊 DEMO DATA SEED COMPLETE');
    console.log('═'.repeat(60));
    console.log(`\n👨‍🏫 Lecturers: ${lecturers.length}`);
    console.log(`👩‍🎓 Students: ${students.length}`);
    console.log(`📚 Sessions: ${sessions.length}`);
    console.log(`🔗 Memberships: ${totalMemberships}`);
    console.log(`💬 Messages: ${totalMessages}`);

    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║              DEMO LOGIN CREDENTIALS                         ║');
    console.log('╠═══════════════════════════════════════════════════════════==╣');
    console.log('║  All passwords: Demo2026!                                   ║');
    console.log('╠═══════════════════════════════════════════════════════════==╣');
    console.log('║  LECTURERS:                                                 ║');
    lecturers.forEach(l => {
      const line = `║  ${l.email.padEnd(30)} ${l.displayName.padEnd(22)}║`;
      console.log(line);
    });
    console.log('╠═══════════════════════════════════════════════════════════==╣');
    console.log('║  STUDENTS (use these during live demo):                     ║');
    students.slice(0, 5).forEach(s => {
      const line = `║  ${s.email.padEnd(30)} ${s.displayName.padEnd(22)}║`;
      console.log(line);
    });
    console.log('║  ... and 15 more                                            ║');
    console.log('╠═══════════════════════════════════════════════════════════==╣');
    console.log('║  SESSIONS:                                                  ║');
    sessions.forEach(s => {
      const line = `║  ${s.joinCode}  ${s.title.substring(0, 35).padEnd(35)} ${s.status.padEnd(8)}║`;
      console.log(line);
    });
    console.log('╚═══════════════════════════════════════════════════════════===╝');
    console.log('');
    console.log('✅ Ready! Start your server and login with the accounts above.');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

seedDemoData();