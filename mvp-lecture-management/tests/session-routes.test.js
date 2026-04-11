// integration tests for session routes
// mocks the database no need a real mongodb connection

const express = require('express');
const request = require('supertest');

jest.mock('../server/models/Session');
jest.mock('../server/models/Membership');
jest.mock('../server/models/User');

const Session = require('../server/models/Session');
const Membership = require('../server/models/Membership');

function createTestApp(sessionData = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.session = { userId: sessionData.userId || 'lect1', userRole: sessionData.userRole || 'lecturer', ...sessionData };
    next();
  });
  const sessionRoutes = require('../server/routes/sessions');
  app.use('/api/sessions', sessionRoutes);
  return app;
}

// POST /api/sessions/create
describe('POST /api/sessions/create', () => {
  let app;
  beforeEach(() => { jest.clearAllMocks(); app = createTestApp({ userId: 'lect1', userRole: 'lecturer' }); });

  test('should return 400 if title is missing', async () => {
    const res = await request(app).post('/api/sessions/create').send({ moduleCode: 'CSC3002' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('should create session successfully with valid title', async () => {
    Session.generateJoinCode = jest.fn().mockReturnValue('ABC123');
    Session.findOne = jest.fn().mockResolvedValue(null);
    const mock = { _id: 'sess1', title: 'Intro to Recursion', joinCode: 'ABC123', lecturer: 'lect1', moduleCode: 'CSC3002', description: '', status: 'active', startTime: new Date(), endTime: null, save: jest.fn().mockResolvedValue(true) };
    Session.mockImplementation(() => mock);
    const res = await request(app).post('/api/sessions/create').send({ title: 'Intro to Recursion', moduleCode: 'CSC3002' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.session.joinCode).toBe('ABC123');
  });

  test('should return 403 if user is not a lecturer', async () => {
    app = createTestApp({ userId: 'student123', userRole: 'student' });
    const res = await request(app).post('/api/sessions/create').send({ title: 'Test' });
    expect(res.status).toBe(403);
  });
});

// POST /api/sessions/join
describe('POST /api/sessions/join', () => {
  let app;
  beforeEach(() => { jest.clearAllMocks(); app = createTestApp({ userId: 'student123', userRole: 'student' }); });

  test('should return 400 if join code is missing', async () => {
    const res = await request(app).post('/api/sessions/join').send({});
    expect(res.status).toBe(400);
  });

  test('should return 404 if session not found', async () => {
    Session.findOne = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });
    const res = await request(app).post('/api/sessions/join').send({ joinCode: 'INVALID' });
    expect(res.status).toBe(404);
  });

  test('should return success if already a member', async () => {
    Session.findOne = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue({ _id: 'sess1', title: 'Test', joinCode: 'ABC123', moduleCode: 'CSC', lecturer: { displayName: 'Dr Test' }, startTime: new Date() }) });
    Membership.findOne = jest.fn().mockResolvedValue({ userId: 'student123', sessionId: 'sess1' });
    const res = await request(app).post('/api/sessions/join').send({ joinCode: 'ABC123' });
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Already');
  });

  test('should join session successfully with valid code', async () => {
    Session.findOne = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue({ _id: 'sess1', title: 'Test', joinCode: 'ABC123', moduleCode: 'CSC', description: 'A test', lecturer: { displayName: 'Dr Test' }, startTime: new Date() }) });
    Membership.findOne = jest.fn().mockResolvedValue(null);
    const mockMem = { userId: 'student123', sessionId: 'sess1', save: jest.fn().mockResolvedValue(true) };
    Membership.mockImplementation(() => mockMem);
    const res = await request(app).post('/api/sessions/join').send({ joinCode: 'ABC123' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockMem.save).toHaveBeenCalled();
  });
});

// POST /api/sessions/:sessionId/activate
describe('POST /api/sessions/:sessionId/activate', () => {
  let app;
  beforeEach(() => { jest.clearAllMocks(); app = createTestApp({ userId: 'lect1', userRole: 'lecturer' }); });

  test('should return 404 if session not found', async () => {
    Session.findById = jest.fn().mockResolvedValue(null);
    const res = await request(app).post('/api/sessions/sess999/activate');
    expect(res.status).toBe(404);
  });

  test('should return 403 if user is not session owner', async () => {
    Session.findById = jest.fn().mockResolvedValue({ _id: 'sess1', lecturer: { toString: () => 'otherLect' }, status: 'scheduled' });
    const res = await request(app).post('/api/sessions/sess1/activate');
    expect(res.status).toBe(403);
  });

  test('should return 400 if session is not scheduled', async () => {
    Session.findById = jest.fn().mockResolvedValue({ _id: 'sess1', lecturer: { toString: () => 'lect1' }, status: 'active' });
    const res = await request(app).post('/api/sessions/sess1/activate');
    expect(res.status).toBe(400);
  });

  test('should activate session successfully', async () => {
    const mock = { _id: 'sess1', lecturer: { toString: () => 'lect1' }, status: 'scheduled', startTime: null, save: jest.fn().mockResolvedValue(true) };
    Session.findById = jest.fn().mockResolvedValue(mock);
    const res = await request(app).post('/api/sessions/sess1/activate');
    expect(res.status).toBe(200);
    expect(mock.status).toBe('active');
  });
});

// POST /api/sessions/:sessionId/end
describe('POST /api/sessions/:sessionId/end', () => {
  let app;
  beforeEach(() => { jest.clearAllMocks(); app = createTestApp({ userId: 'lect1', userRole: 'lecturer' }); });

  test('should return 404 if session not found', async () => {
    Session.findById = jest.fn().mockResolvedValue(null);
    const res = await request(app).post('/api/sessions/sess999/end');
    expect(res.status).toBe(404);
  });

  test('should return 403 if not session owner', async () => {
    Session.findById = jest.fn().mockResolvedValue({ _id: 'sess1', lecturer: { toString: () => 'otherLect' } });
    const res = await request(app).post('/api/sessions/sess1/end');
    expect(res.status).toBe(403);
  });

  test('should end session successfully', async () => {
    const mock = {
      _id: 'sess1', lecturer: { toString: () => 'lect1' }, status: 'active', endTime: null,
      endSession: jest.fn().mockImplementation(async function() { this.status = 'ended'; this.endTime = new Date(); }),
    };
    Session.findById = jest.fn().mockResolvedValue(mock);
    const res = await request(app).post('/api/sessions/sess1/end');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mock.endSession).toHaveBeenCalled();
  });
});

// GET /api/sessions/my-sessions
describe('GET /api/sessions/my-sessions', () => {
  test('should return lecturer sessions', async () => {
    const app = createTestApp({ userId: 'lect1', userRole: 'lecturer' });
    Session.find = jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([{ _id: 'sess1', title: 'Week 1', status: 'ended' }, { _id: 'sess2', title: 'Week 2', status: 'active' }]) });
    const res = await request(app).get('/api/sessions/my-sessions');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.sessions).toHaveLength(2);
  });
});

// GET /api/sessions/:sessionId
describe('GET /api/sessions/:sessionId', () => {
  test('should return 404 if session not found', async () => {
    const app = createTestApp({ userId: 'student123', userRole: 'student' });
    Session.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });
    const res = await request(app).get('/api/sessions/sess999');
    expect(res.status).toBe(404);
  });

  test('should return session details for a member', async () => {
    const app = createTestApp({ userId: 'student123', userRole: 'student' });
    Session.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue({ _id: 'sess1', title: 'Intro', joinCode: 'ABC', moduleCode: 'CSC', description: 'Test', status: 'active', startTime: new Date(), endTime: null, lecturer: { _id: 'lect1', displayName: 'Dr Test', email: 'dr@test.com' } }) });
    Membership.findOne = jest.fn().mockResolvedValue({ userId: 'student123', sessionId: 'sess1' });
    Membership.countDocuments = jest.fn().mockResolvedValue(25);
    const res = await request(app).get('/api/sessions/sess1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.session.title).toBe('Intro');
  });
});
