/**
 * FULL RESET & SEED SCRIPT
 * Creates:
 * - 10 Lecturers (@qub.ac.uk)
 * - 50 Students (@qub.ac.uk)
 * - 8 Sessions
 * - ~40-70 messages per session
 * 
 * All passwords: "password123"
 * 
 * only run this script once - will reset all data 
 * 
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/lecture-engagement';

// ============================================
// SCHEMAS
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
  text: { type: String, required: true, maxLength: 1000 },
  type: { type: String, enum: ['QUESTION', 'COMMENT', 'CONFUSION'], default: 'COMMENT' },
  identityMode: { type: String, enum: ['anonymous', 'pseudonymous', 'identified'], default: 'identified' },
  alias: { type: String, default: null, maxLength: 50 },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
  timestamp: { type: Date, default: Date.now },
  isDeleted: { type: Boolean, default: false },
  isEdited: { type: Boolean, default: false },
  isPinned: { type: Boolean, default: false },
  isAnnouncement: { type: Boolean, default: false },
  isReported: { type: Boolean, default: false },
  reactions: { type: Map, of: Number, default: {} },
});
messageSchema.index({ sessionId: 1, timestamp: -1 });

const User = mongoose.model('User', userSchema);
const Session = mongoose.model('Session', sessionSchema);
const Membership = mongoose.model('Membership', membershipSchema);
const Message = mongoose.model('Message', messageSchema);

// ============================================
// TEST DATA
// ============================================

const LECTURERS = [
  { email: 'dr.smith@qub.ac.uk', displayName: 'Dr. Sarah Smith' },
  { email: 'prof.jones@qub.ac.uk', displayName: 'Prof. Michael Jones' },
  { email: 'dr.wilson@qub.ac.uk', displayName: 'Dr. Emma Wilson' },
  { email: 'dr.brown@qub.ac.uk', displayName: 'Dr. James Brown' },
  { email: 'prof.taylor@qub.ac.uk', displayName: 'Prof. Lisa Taylor' },
  { email: 'dr.anderson@qub.ac.uk', displayName: 'Dr. David Anderson' },
  { email: 'dr.thomas@qub.ac.uk', displayName: 'Dr. Rachel Thomas' },
  { email: 'prof.jackson@qub.ac.uk', displayName: 'Prof. Robert Jackson' },
  { email: 'dr.white@qub.ac.uk', displayName: 'Dr. Jennifer White' },
  { email: 'dr.harris@qub.ac.uk', displayName: 'Dr. Christopher Harris' },
];

const STUDENT_FIRST_NAMES = [
  'Oliver', 'Emma', 'Liam', 'Sophia', 'Noah', 'Ava', 'James', 'Isabella', 'William', 'Mia',
  'Benjamin', 'Charlotte', 'Lucas', 'Amelia', 'Henry', 'Harper', 'Alexander', 'Evelyn', 'Mason', 'Abigail',
  'Ethan', 'Emily', 'Jacob', 'Elizabeth', 'Michael', 'Sofia', 'Daniel', 'Avery', 'Logan', 'Ella',
  'Jackson', 'Scarlett', 'Sebastian', 'Grace', 'Jack', 'Chloe', 'Aiden', 'Victoria', 'Owen', 'Riley',
  'Samuel', 'Aria', 'Ryan', 'Lily', 'Nathan', 'Aurora', 'Carter', 'Zoey', 'Luke', 'Penelope'
];

const STUDENT_LAST_NAMES = [
  'Murphy', 'Kelly', 'Sullivan', 'Walsh', 'Smith', 'OBrien', 'Byrne', 'Ryan', 'OConnor', 'ONeill',
  'OReilly', 'Doyle', 'McCarthy', 'Gallagher', 'ODoherty', 'Kennedy', 'Lynch', 'Murray', 'Quinn', 'Moore',
  'McLaughlin', 'OCarroll', 'Connolly', 'Daly', 'OConnell', 'Wilson', 'Dunne', 'Brennan', 'Burke', 'Collins',
  'Campbell', 'Clarke', 'Johnston', 'Hughes', 'OFarrell', 'Fitzgerald', 'Brown', 'Martin', 'Maguire', 'Nolan',
  'Flynn', 'Thompson', 'OCallaghan', 'ODonnell', 'Duffy', 'OShea', 'White', 'Sweeney', 'Hayes', 'Kavanagh'
];

const SESSIONS_DATA = [
  { title: 'Introduction to Programming', moduleCode: 'CSC1001', lecturerIdx: 0, status: 'active' },
  { title: 'Data Structures & Algorithms', moduleCode: 'CSC2002', lecturerIdx: 0, status: 'active' },
  { title: 'Database Design', moduleCode: 'CSC3003', lecturerIdx: 1, status: 'active' },
  { title: 'Web Development Fundamentals', moduleCode: 'CSC1002', lecturerIdx: 2, status: 'ended' },
  { title: 'Operating Systems', moduleCode: 'CSC2001', lecturerIdx: 3, status: 'active' },
  { title: 'Machine Learning Basics', moduleCode: 'CSC3001', lecturerIdx: 4, status: 'active' },
  { title: 'Computer Networks', moduleCode: 'CSC3002', lecturerIdx: 4, status: 'ended' },
  { title: 'Software Engineering', moduleCode: 'CSC4001', lecturerIdx: 7, status: 'active' },
];

const QUESTION_TEMPLATES = [
  "Can you explain {topic} again?",
  "What's the difference between {topic} and {topic2}?",
  "How does {topic} work in practice?",
  "Is {topic} going to be on the exam?",
  "Could you give an example of {topic}?",
  "Why do we use {topic} instead of {topic2}?",
  "When would we actually use {topic}?",
  "I'm confused about {topic}, can you clarify?",
  "What happens if {topic} fails?",
  "How is {topic} related to what we learned last week?",
  "Can you recommend resources for learning more about {topic}?",
  "What are common mistakes with {topic}?",
];

const COMMENT_TEMPLATES = [
  "Great explanation of {topic}!",
  "This makes sense now, thanks!",
  "I found a good article about {topic}",
  "The example really helped clarify {topic}",
  "Interesting connection between {topic} and {topic2}",
  "I think {topic} is similar to what we did in {module}",
  "This is clearer than the textbook explanation",
  "Good point about {topic}",
  "I agree with the previous comment",
  "The slides are really helpful for {topic}",
  "Just realized how {topic} connects to real-world applications",
  "Thanks for the clarification!",
];

const CONFUSION_TEMPLATES = [
  "I'm lost on {topic}",
  "Can we slow down? {topic} is confusing",
  "Not sure I understand {topic}",
  "This is going too fast",
  "Confused about the {topic} part",
  "Need more explanation on {topic}",
  "The {topic} concept isn't clicking for me",
  "I don't get how {topic} works",
  "Can we revisit {topic}?",
  "Still struggling with {topic}",
];

const TOPICS = [
  'variables', 'functions', 'loops', 'arrays', 'objects', 'classes', 'inheritance',
  'recursion', 'pointers', 'memory allocation', 'sorting algorithms', 'binary trees',
  'hash tables', 'SQL queries', 'normalization', 'indexes', 'transactions',
  'HTTP requests', 'REST APIs', 'authentication', 'sessions', 'cookies',
  'processes', 'threads', 'deadlocks', 'scheduling', 'virtual memory',
  'neural networks', 'regression', 'classification', 'clustering', 'overfitting',
  'TCP/IP', 'routing', 'DNS', 'firewalls', 'encryption',
  'agile methodology', 'testing', 'CI/CD', 'version control', 'code review'
];

const ALIAS_ADJECTIVES = ['Clever', 'Swift', 'Bright', 'Calm', 'Bold', 'Wise', 'Quick', 'Sharp', 'Keen', 'Brave'];
const ALIAS_ANIMALS = ['Fox', 'Owl', 'Eagle', 'Wolf', 'Bear', 'Hawk', 'Lion', 'Tiger', 'Falcon', 'Panda'];

// ============================================
// HELPER FUNCTIONS
// ============================================

function generateJoinCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generateAlias() {
  const adj = ALIAS_ADJECTIVES[Math.floor(Math.random() * ALIAS_ADJECTIVES.length)];
  const animal = ALIAS_ANIMALS[Math.floor(Math.random() * ALIAS_ANIMALS.length)];
  const num = Math.floor(Math.random() * 999) + 1;
  return `${adj}${animal}${num}`;
}

function fillTemplate(template) {
  let result = template;
  while (result.includes('{topic}')) {
    result = result.replace('{topic}', TOPICS[Math.floor(Math.random() * TOPICS.length)]);
  }
  while (result.includes('{topic2}')) {
    result = result.replace('{topic2}', TOPICS[Math.floor(Math.random() * TOPICS.length)]);
  }
  while (result.includes('{module}')) {
    result = result.replace('{module}', `CSC${Math.floor(Math.random() * 4) + 1}00${Math.floor(Math.random() * 4) + 1}`);
  }
  return result;
}

function getRandomMessage(type) {
  let templates;
  switch (type) {
    case 'QUESTION': templates = QUESTION_TEMPLATES; break;
    case 'CONFUSION': templates = CONFUSION_TEMPLATES; break;
    default: templates = COMMENT_TEMPLATES;
  }
  return fillTemplate(templates[Math.floor(Math.random() * templates.length)]);
}

function getRandomTimestamp(sessionStart, sessionDurationMinutes = 60) {
  const offset = Math.floor(Math.random() * sessionDurationMinutes * 60 * 1000);
  return new Date(sessionStart.getTime() + offset);
}

// ============================================
// MAIN FUNCTION
// ============================================

async function resetAndSeed() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // ============================================
    // DELETE ALL EXISTING DATA
    // ============================================
    console.log('🗑️  DELETING ALL EXISTING DATA...');
    await Message.deleteMany({});
    console.log('   ✓ Deleted all messages');
    await Membership.deleteMany({});
    console.log('   ✓ Deleted all memberships');
    await Session.deleteMany({});
    console.log('   ✓ Deleted all sessions');
    await User.deleteMany({});
    console.log('   ✓ Deleted all users');
    console.log('✅ Database cleared!\n');

    // Hash password once
    const hashedPassword = await bcrypt.hash('password123', 10);

    // ============================================
    // CREATE LECTURERS
    // ============================================
    console.log('👨‍🏫 Creating lecturers...');
    const lecturers = [];
    
    for (const lecturer of LECTURERS) {
      const user = await User.create({
        email: lecturer.email,
        password: hashedPassword,
        displayName: lecturer.displayName,
        role: 'lecturer',
        loginCount: Math.floor(Math.random() * 20) + 5,
        lastLogin: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      });
      lecturers.push({ ...lecturer, _id: user._id });
      console.log(`   ✓ ${lecturer.displayName} (${lecturer.email})`);
    }
    console.log(`✅ Created ${lecturers.length} lecturers\n`);

    // ============================================
    // CREATE STUDENTS
    // ============================================
    console.log('👩‍🎓 Creating students...');
    const students = [];
    
    for (let i = 0; i < 50; i++) {
      const firstName = STUDENT_FIRST_NAMES[i % STUDENT_FIRST_NAMES.length];
      const lastName = STUDENT_LAST_NAMES[i % STUDENT_LAST_NAMES.length];
      const displayName = `${firstName} ${lastName}`;
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i + 1}@qub.ac.uk`;
      
      const user = await User.create({
        email,
        password: hashedPassword,
        displayName,
        role: 'student',
        loginCount: Math.floor(Math.random() * 30) + 1,
        lastLogin: new Date(Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000),
      });
      students.push({ _id: user._id, displayName, email });
      
      if ((i + 1) % 10 === 0) {
        console.log(`   ✓ Created ${i + 1} students...`);
      }
    }
    console.log(`✅ Created ${students.length} students\n`);

    // ============================================
    // CREATE SESSIONS
    // ============================================
    console.log('📚 Creating sessions...');
    const sessions = [];
    const usedCodes = new Set();
    
    for (const sessionData of SESSIONS_DATA) {
      let joinCode;
      do {
        joinCode = generateJoinCode();
      } while (usedCodes.has(joinCode));
      usedCodes.add(joinCode);

      const sessionStart = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
      
      const session = await Session.create({
        title: sessionData.title,
        joinCode,
        lecturer: lecturers[sessionData.lecturerIdx]._id,
        moduleCode: sessionData.moduleCode,
        description: `${sessionData.title} - Week ${Math.floor(Math.random() * 12) + 1}`,
        status: sessionData.status,
        startTime: sessionStart,
        endTime: sessionData.status === 'ended' ? new Date(sessionStart.getTime() + 60 * 60 * 1000) : null,
        createdAt: sessionStart,
      });
      
      sessions.push({
        ...sessionData,
        _id: session._id,
        joinCode,
        lecturerId: lecturers[sessionData.lecturerIdx]._id,
        startTime: sessionStart,
      });
      
      console.log(`   ✓ ${sessionData.title} (${joinCode}) - ${lecturers[sessionData.lecturerIdx].displayName}`);
    }
    console.log(`✅ Created ${sessions.length} sessions\n`);

    // ============================================
    // CREATE MEMBERSHIPS
    // ============================================
    console.log('🔗 Creating memberships...');
    let totalMemberships = 0;
    
    for (const session of sessions) {
      const numStudents = Math.floor(Math.random() * 21) + 25;
      const shuffledStudents = [...students].sort(() => Math.random() - 0.5);
      const sessionStudents = shuffledStudents.slice(0, numStudents);
      
      for (const student of sessionStudents) {
        await Membership.create({
          userId: student._id,
          sessionId: session._id,
          joinedAt: new Date(session.startTime.getTime() + Math.random() * 5 * 60 * 1000),
        });
        totalMemberships++;
      }
      
      // Add lecturer as member
      await Membership.create({
        userId: session.lecturerId,
        sessionId: session._id,
        joinedAt: session.startTime,
      });
      totalMemberships++;
      
      console.log(`   ✓ ${session.title}: ${sessionStudents.length} students enrolled`);
    }
    console.log(`✅ Created ${totalMemberships} memberships\n`);

    // ============================================
    // CREATE MESSAGES
    // ============================================
    console.log('💬 Generating messages...');
    let totalMessages = 0;
    
    for (const session of sessions) {
      const memberships = await Membership.find({ sessionId: session._id });
      const studentMembers = memberships.filter(m => m.userId.toString() !== session.lecturerId.toString());
      const lecturerMembership = memberships.find(m => m.userId.toString() === session.lecturerId.toString());
      
      const numMessages = Math.floor(Math.random() * 31) + 40;
      const activeStudents = studentMembers.slice(0, Math.ceil(studentMembers.length * 0.3));
      const casualStudents = studentMembers.slice(Math.ceil(studentMembers.length * 0.3));
      
      const messages = [];
      
      for (let i = 0; i < numMessages; i++) {
        let userId, isLecturer = false;
        const roll = Math.random();
        
        if (roll < 0.1 && lecturerMembership) {
          userId = lecturerMembership.userId;
          isLecturer = true;
        } else if (roll < 0.3 && casualStudents.length > 0) {
          userId = casualStudents[Math.floor(Math.random() * casualStudents.length)].userId;
        } else if (activeStudents.length > 0) {
          userId = activeStudents[Math.floor(Math.random() * activeStudents.length)].userId;
        } else {
          continue;
        }
        
        let type;
        const typeRoll = Math.random();
        if (typeRoll < 0.15) type = 'CONFUSION';
        else if (typeRoll < 0.40) type = 'QUESTION';
        else type = 'COMMENT';
        
        if (isLecturer) type = 'COMMENT';
        
        let identityMode, alias = null;
        if (isLecturer) {
          identityMode = 'identified';
        } else {
          const modeRoll = Math.random();
          if (modeRoll < 0.40) {
            identityMode = 'anonymous';
          } else if (modeRoll < 0.75) {
            identityMode = 'pseudonymous';
            alias = generateAlias();
          } else {
            identityMode = 'identified';
          }
        }
        
        const timestamp = getRandomTimestamp(session.startTime, 55);
        
        messages.push({
          sessionId: session._id,
          userId,
          text: getRandomMessage(type),
          type,
          identityMode,
          alias,
          timestamp,
          isAnnouncement: isLecturer && Math.random() < 0.2,
        });
      }
      
      messages.sort((a, b) => a.timestamp - b.timestamp);
      await Message.insertMany(messages);
      totalMessages += messages.length;
      
      console.log(`   ✓ ${session.title}: ${messages.length} messages`);
    }
    console.log(`✅ Created ${totalMessages} messages\n`);

    // ============================================
    // FINAL SUMMARY
    // ============================================
    console.log('='.repeat(60));
    console.log('📊 RESET & SEED COMPLETE');
    console.log('='.repeat(60));
    console.log(`\n👨‍🏫 Lecturers: ${lecturers.length}`);
    console.log(`👩‍🎓 Students: ${students.length}`);
    console.log(`📚 Sessions: ${sessions.length}`);
    console.log(`🔗 Memberships: ${totalMemberships}`);
    console.log(`💬 Messages: ${totalMessages}`);
    
    console.log('\n📋 ALL ACCOUNTS (Password: password123)');
    console.log('-'.repeat(60));
    console.log('\nLECTURERS:');
    lecturers.forEach(l => console.log(`   ${l.email} - ${l.displayName}`));
    
    console.log('\nSTUDENTS (first 10):');
    students.slice(0, 10).forEach(s => console.log(`   ${s.email} - ${s.displayName}`));
    console.log(`   ... and ${students.length - 10} more`);
    
    console.log('\nSESSIONS:');
    sessions.forEach(s => console.log(`   ${s.joinCode} - ${s.title} (${s.status})`));
    
    console.log('\n✅ All done! Start your server and login.');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

resetAndSeed();