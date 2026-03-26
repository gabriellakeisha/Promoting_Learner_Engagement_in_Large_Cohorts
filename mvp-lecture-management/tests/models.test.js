// tests for mongoose model schema validation
// validates required fields, enum values, defaults, and constraints
// no database connection needed - tests schema logic only

const mongoose = require('mongoose');

// we need the schema definitions but not the database
// so we test by creating model instances and checking validation

describe('User Model Schema', () => {
  let User;

  beforeAll(() => {
    // clear any cached model to avoid OverwriteModelError
    if (mongoose.models.User) {
      delete mongoose.models.User;
      delete mongoose.modelSchemas.User;
    }
    User = require('../server/models/User');
  });

  test('should require email field', () => {
    const user = new User({ password: 'test123', displayName: 'Test' });
    const errors = user.validateSync();
    expect(errors.errors.email).toBeDefined();
  });

  test('should require password field', () => {
    const user = new User({ email: 'test@test.com', displayName: 'Test' });
    const errors = user.validateSync();
    expect(errors.errors.password).toBeDefined();
  });

  test('should require displayName field', () => {
    const user = new User({ email: 'test@test.com', password: 'test123' });
    const errors = user.validateSync();
    expect(errors.errors.displayName).toBeDefined();
  });

  test('should default role to student', () => {
    const user = new User({ email: 'test@test.com', password: 'test123', displayName: 'Test' });
    expect(user.role).toBe('student');
  });

  test('should only allow valid roles', () => {
    const user = new User({ email: 'test@test.com', password: 'test123', displayName: 'Test', role: 'superadmin' });
    const errors = user.validateSync();
    expect(errors.errors.role).toBeDefined();
  });

  test('should accept valid roles: student, lecturer, admin', () => {
    ['student', 'lecturer', 'admin'].forEach(role => {
      const user = new User({ email: 'test@test.com', password: 'test123', displayName: 'Test', role });
      const errors = user.validateSync();
      expect(errors).toBeUndefined();
    });
  });

  test('should default loginCount to 0', () => {
    const user = new User({ email: 'test@test.com', password: 'test123', displayName: 'Test' });
    expect(user.loginCount).toBe(0);
  });

  test('should default isOnline to false', () => {
    const user = new User({ email: 'test@test.com', password: 'test123', displayName: 'Test' });
    expect(user.isOnline).toBe(false);
  });

  test('should lowercase email', () => {
    const user = new User({ email: 'TEST@Test.COM', password: 'test123', displayName: 'Test' });
    expect(user.email).toBe('test@test.com');
  });

  test('should trim displayName', () => {
    const user = new User({ email: 'test@test.com', password: 'test123', displayName: '  Test User  ' });
    expect(user.displayName).toBe('Test User');
  });
});

describe('Message Model Schema', () => {
  let Message;

  beforeAll(() => {
    if (mongoose.models.Message) {
      delete mongoose.models.Message;
      delete mongoose.modelSchemas.Message;
    }
    Message = require('../server/models/Message');
  });

  const validId = new mongoose.Types.ObjectId();

  test('should require sessionId', () => {
    const msg = new Message({ userId: validId, text: 'hello' });
    const errors = msg.validateSync();
    expect(errors.errors.sessionId).toBeDefined();
  });

  test('should require userId', () => {
    const msg = new Message({ sessionId: validId, text: 'hello' });
    const errors = msg.validateSync();
    expect(errors.errors.userId).toBeDefined();
  });

  test('should default type to NONE', () => {
    const msg = new Message({ sessionId: validId, userId: validId, text: 'hello' });
    expect(msg.type).toBe('NONE');
  });

  test('should only allow valid message types', () => {
    const msg = new Message({ sessionId: validId, userId: validId, text: 'hello', type: 'INVALID' });
    const errors = msg.validateSync();
    expect(errors.errors.type).toBeDefined();
  });

  test('should accept all valid message types', () => {
    ['NONE', 'QUESTION', 'COMMENT', 'CONFUSION', 'POLL'].forEach(type => {
      const msg = new Message({ sessionId: validId, userId: validId, text: 'hello', type });
      const errors = msg.validateSync();
      expect(errors).toBeUndefined();
    });
  });

  test('should default identityMode to anonymous', () => {
    const msg = new Message({ sessionId: validId, userId: validId, text: 'hello' });
    expect(msg.identityMode).toBe('anonymous');
  });

  test('should only allow valid identity modes', () => {
    const msg = new Message({ sessionId: validId, userId: validId, text: 'hello', identityMode: 'secret' });
    const errors = msg.validateSync();
    expect(errors.errors.identityMode).toBeDefined();
  });

  test('should accept all three identity modes (RQ1)', () => {
    ['anonymous', 'pseudonymous', 'identified'].forEach(mode => {
      const msg = new Message({ sessionId: validId, userId: validId, text: 'hello', identityMode: mode });
      const errors = msg.validateSync();
      expect(errors).toBeUndefined();
    });
  });

  test('should default isDeleted to false', () => {
    const msg = new Message({ sessionId: validId, userId: validId, text: 'hello' });
    expect(msg.isDeleted).toBe(false);
  });

  test('should default isPinned to false', () => {
    const msg = new Message({ sessionId: validId, userId: validId, text: 'hello' });
    expect(msg.isPinned).toBe(false);
  });

  test('should default isAnnouncement to false', () => {
    const msg = new Message({ sessionId: validId, userId: validId, text: 'hello' });
    expect(msg.isAnnouncement).toBe(false);
  });

  test('should default isPoll to false', () => {
    const msg = new Message({ sessionId: validId, userId: validId, text: 'hello' });
    expect(msg.isPoll).toBe(false);
  });

  test('should enforce maxLength 1000 on text', () => {
    const longText = 'a'.repeat(1001);
    const msg = new Message({ sessionId: validId, userId: validId, text: longText });
    const errors = msg.validateSync();
    expect(errors.errors.text).toBeDefined();
  });

  test('should enforce maxLength 50 on alias', () => {
    const longAlias = 'a'.repeat(51);
    const msg = new Message({ sessionId: validId, userId: validId, text: 'hello', alias: longAlias });
    const errors = msg.validateSync();
    expect(errors.errors.alias).toBeDefined();
  });

  test('should initialise empty editHistory array', () => {
    const msg = new Message({ sessionId: validId, userId: validId, text: 'hello' });
    expect(msg.editHistory).toBeDefined();
    expect(Array.isArray(msg.editHistory)).toBe(true);
  });

  test('should initialise empty reactions map', () => {
    const msg = new Message({ sessionId: validId, userId: validId, text: 'hello' });
    expect(msg.reactions).toBeDefined();
  });
});

describe('Session Model Schema', () => {
  let Session;

  beforeAll(() => {
    if (mongoose.models.Session) {
      delete mongoose.models.Session;
      delete mongoose.modelSchemas.Session;
    }
    Session = require('../server/models/Session');
  });

  const validId = new mongoose.Types.ObjectId();

  test('should require title', () => {
    const s = new Session({ joinCode: 'ABC123', lecturer: validId });
    const errors = s.validateSync();
    expect(errors.errors.title).toBeDefined();
  });

  test('should require joinCode', () => {
    const s = new Session({ title: 'Test', lecturer: validId });
    const errors = s.validateSync();
    expect(errors.errors.joinCode).toBeDefined();
  });

  test('should require lecturer', () => {
    const s = new Session({ title: 'Test', joinCode: 'ABC123' });
    const errors = s.validateSync();
    expect(errors.errors.lecturer).toBeDefined();
  });

  test('should default status to active', () => {
    const s = new Session({ title: 'Test', joinCode: 'ABC123', lecturer: validId });
    expect(s.status).toBe('active');
  });

  test('should only allow valid status values', () => {
    const s = new Session({ title: 'Test', joinCode: 'ABC123', lecturer: validId, status: 'paused' });
    const errors = s.validateSync();
    expect(errors.errors.status).toBeDefined();
  });

  test('should accept valid statuses: active, ended, scheduled', () => {
    ['active', 'ended', 'scheduled'].forEach(status => {
      const s = new Session({ title: 'Test', joinCode: 'ABC123', lecturer: validId, status });
      const errors = s.validateSync();
      expect(errors).toBeUndefined();
    });
  });

  test('should uppercase joinCode', () => {
    const s = new Session({ title: 'Test', joinCode: 'abc123', lecturer: validId });
    expect(s.joinCode).toBe('ABC123');
  });

  test('should default allowAnonymous to true', () => {
    const s = new Session({ title: 'Test', joinCode: 'ABC123', lecturer: validId });
    expect(s.settings.allowAnonymous).toBe(true);
  });

  test('should generate a 6-character join code', () => {
    const code = Session.generateJoinCode();
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
  });

  test('should generate unique join codes', () => {
    const codes = new Set();
    for (let i = 0; i < 50; i++) {
      codes.add(Session.generateJoinCode());
    }
    // with 36^6 possibilities, 50 codes should all be unique
    expect(codes.size).toBe(50);
  });
});

describe('Membership Model Schema', () => {
  let Membership;

  beforeAll(() => {
    if (mongoose.models.Membership) {
      delete mongoose.models.Membership;
      delete mongoose.modelSchemas.Membership;
    }
    Membership = require('../server/models/Membership');
  });

  const validId = new mongoose.Types.ObjectId();

  test('should require userId', () => {
    const m = new Membership({ sessionId: validId });
    const errors = m.validateSync();
    expect(errors.errors.userId).toBeDefined();
  });

  test('should require sessionId', () => {
    const m = new Membership({ userId: validId });
    const errors = m.validateSync();
    expect(errors.errors.sessionId).toBeDefined();
  });

  test('should default messageCount to 0', () => {
    const m = new Membership({ userId: validId, sessionId: validId });
    expect(m.messageCount).toBe(0);
  });

  test('should set joinedAt to current date by default', () => {
    const m = new Membership({ userId: validId, sessionId: validId });
    expect(m.joinedAt).toBeDefined();
    expect(m.joinedAt instanceof Date).toBe(true);
  });
});

describe('StudentReflection Model Schema', () => {
  let StudentReflection;

  beforeAll(() => {
    if (mongoose.models.StudentReflection) {
      delete mongoose.models.StudentReflection;
      delete mongoose.modelSchemas.StudentReflection;
    }
    StudentReflection = require('../server/models/studentreflection');
  });

  const validId = new mongoose.Types.ObjectId();

  test('should require userId', () => {
    const r = new StudentReflection({ sessionId: validId });
    const errors = r.validateSync();
    expect(errors.errors.userId).toBeDefined();
  });

  test('should require sessionId', () => {
    const r = new StudentReflection({ userId: validId });
    const errors = r.validateSync();
    expect(errors.errors.sessionId).toBeDefined();
  });

  test('should accept a valid goal object', () => {
    const r = new StudentReflection({
      userId: validId,
      sessionId: validId,
      goal: { text: 'Ask 3 questions', targetCount: 3, achievedCount: 0 }
    });
    expect(r.goal.text).toBe('Ask 3 questions');
    expect(r.goal.targetCount).toBe(3);
    expect(r.goal.achievedCount).toBe(0);
  });

  test('should accept a valid reflection object', () => {
    const r = new StudentReflection({
      userId: validId,
      sessionId: validId,
      reflection: { understanding: 4, confusingTopic: 'Recursion', improvement: 'Ask more questions' }
    });
    expect(r.reflection.understanding).toBe(4);
    expect(r.reflection.confusingTopic).toBe('Recursion');
  });

  test('should default goal targetCount to 0', () => {
    const r = new StudentReflection({
      userId: validId,
      sessionId: validId,
      goal: { text: 'Participate more' }
    });
    expect(r.goal.targetCount).toBe(0);
  });

  test('should set createdAt by default', () => {
    const r = new StudentReflection({ userId: validId, sessionId: validId });
    expect(r.createdAt).toBeDefined();
    expect(r.createdAt instanceof Date).toBe(true);
  });
});
