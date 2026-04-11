// integration tests for reflection routes (RQ3 — SRL infrastructure)
// mocks the database so no need a real mongodb connection

const express = require('express');
const request = require('supertest');

jest.mock('../server/models/Message');
jest.mock('../server/models/Session');
jest.mock('../server/models/Membership');
jest.mock('../server/models/User');
jest.mock('../server/models/studentreflection');

const Message = require('../server/models/Message');
const Session = require('../server/models/Session');
const Membership = require('../server/models/Membership');
const StudentReflection = require('../server/models/studentreflection');

function createTestApp(sessionData = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.session = { userId: sessionData.userId || 'student123', userRole: sessionData.userRole || 'student', ...sessionData };
    next();
  });
  const reflectionRoutes = require('../server/routes/reflection');
  app.use('/api/reflection', reflectionRoutes);
  return app;
}

// POST /api/reflection/goal/:sessionId — set session goal
describe('POST /api/reflection/goal/:sessionId', () => {
  let app;
  beforeEach(() => { jest.clearAllMocks(); app = createTestApp(); });

  test('should return 403 if user is not a member', async () => {
    Membership.findOne = jest.fn().mockResolvedValue(null);
    const res = await request(app).post('/api/reflection/goal/sess1').send({ text: 'Ask 3 questions', targetCount: 3 });
    expect(res.status).toBe(403);
  });

  test('should return 400 if targetCount is less than 1', async () => {
    Membership.findOne = jest.fn().mockResolvedValue({ userId: 'student123', sessionId: 'sess1' });
    const res = await request(app).post('/api/reflection/goal/sess1').send({ text: 'Ask questions', targetCount: 0 });
    expect(res.status).toBe(400);
  });

  test('should return 400 if targetCount exceeds 50', async () => {
    Membership.findOne = jest.fn().mockResolvedValue({ userId: 'student123', sessionId: 'sess1' });
    const res = await request(app).post('/api/reflection/goal/sess1').send({ text: 'Ask questions', targetCount: 51 });
    expect(res.status).toBe(400);
  });

  test('should save goal successfully with valid targetCount', async () => {
    Membership.findOne = jest.fn().mockResolvedValue({ userId: 'student123', sessionId: 'sess1' });
    StudentReflection.findOne = jest.fn().mockResolvedValue(null);
    const mock = { userId: 'student123', sessionId: 'sess1', goal: null, updatedAt: null, save: jest.fn().mockResolvedValue(true) };
    StudentReflection.mockImplementation(() => mock);
    const res = await request(app).post('/api/reflection/goal/sess1').send({ text: 'Ask 3 questions', targetCount: 3 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mock.save).toHaveBeenCalled();
  });

  test('should update existing goal if reflection already exists', async () => {
    Membership.findOne = jest.fn().mockResolvedValue({ userId: 'student123', sessionId: 'sess1' });
    const existing = { userId: 'student123', sessionId: 'sess1', goal: { text: 'Old', targetCount: 1, achievedCount: 0, createdAt: new Date() }, updatedAt: new Date(), save: jest.fn().mockResolvedValue(true) };
    StudentReflection.findOne = jest.fn().mockResolvedValue(existing);
    const res = await request(app).post('/api/reflection/goal/sess1').send({ text: 'Ask 5 questions', targetCount: 5 });
    expect(res.status).toBe(200);
    expect(existing.goal.targetCount).toBe(5);
  });
});

// POST /api/reflection/reflection/:sessionId — submit reflection
describe('POST /api/reflection/reflection/:sessionId', () => {
  let app;
  beforeEach(() => { jest.clearAllMocks(); app = createTestApp(); });

  test('should return 403 if user is not a member', async () => {
    Membership.findOne = jest.fn().mockResolvedValue(null);
    const res = await request(app).post('/api/reflection/reflection/sess1').send({ understanding: 4 });
    expect(res.status).toBe(403);
  });

  test('should save reflection successfully', async () => {
    Membership.findOne = jest.fn().mockResolvedValue({ userId: 'student123', sessionId: 'sess1' });
    StudentReflection.findOne = jest.fn().mockResolvedValue(null);
    const mock = { userId: 'student123', sessionId: 'sess1', reflection: null, updatedAt: null, save: jest.fn().mockResolvedValue(true) };
    StudentReflection.mockImplementation(() => mock);
    const res = await request(app).post('/api/reflection/reflection/sess1').send({ understanding: 4, confusingTopic: 'Recursion', improvement: 'More examples' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mock.reflection.understanding).toBe(4);
  });
});

// GET /api/reflection/semester-trend
describe('GET /api/reflection/semester-trend', () => {
  let app;
  beforeEach(() => { jest.clearAllMocks(); app = createTestApp(); });

  test('should return empty trend if no memberships', async () => {
    Membership.find = jest.fn().mockReturnValue({ populate: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([]) }) });
    const res = await request(app).get('/api/reflection/semester-trend');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.trend).toHaveLength(0);
  });

  test('should return trend data for attended sessions', async () => {
    Membership.find = jest.fn().mockReturnValue({ populate: jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue([{ sessionId: { _id: 'sess1', title: 'Week 1', moduleCode: 'CSC', createdAt: new Date(), status: 'ended' } }]) }) });
    Message.countDocuments = jest.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(30);
    Membership.countDocuments = jest.fn().mockResolvedValue(10);
    const res = await request(app).get('/api/reflection/semester-trend');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
