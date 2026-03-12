// tests for auth middleware - checks session-based access control

const { isAuthenticated, isLecturer, isStudent, isAdmin } = require('../server/middleware/auth');

// helper to create mock req/res/next
function mockReqResNext(sessionData = {}) {
  const req = { session: sessionData };
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; }
  };
  const next = jest.fn();
  return { req, res, next };
}

describe('isAuthenticated', () => {
  test('should call next if userId exists in session', () => {
    const { req, res, next } = mockReqResNext({ userId: 'abc123' });
    isAuthenticated(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('should return 401 if no session', () => {
    const { req, res, next } = mockReqResNext({});
    isAuthenticated(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 401 if session is null', () => {
    const req = { session: null };
    const res = {
      statusCode: null, body: null,
      status(code) { this.statusCode = code; return this; },
      json(data) { this.body = data; return this; }
    };
    const next = jest.fn();

    isAuthenticated(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('isLecturer', () => {
  test('should call next if role is lecturer', () => {
    const { req, res, next } = mockReqResNext({ userRole: 'lecturer' });
    isLecturer(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('should return 403 if role is student', () => {
    const { req, res, next } = mockReqResNext({ userRole: 'student' });
    isLecturer(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 403 if no role set', () => {
    const { req, res, next } = mockReqResNext({});
    isLecturer(req, res, next);
    expect(res.statusCode).toBe(403);
  });
});

describe('isStudent', () => {
  test('should call next if role is student', () => {
    const { req, res, next } = mockReqResNext({ userRole: 'student' });
    isStudent(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('should return 403 if role is lecturer', () => {
    const { req, res, next } = mockReqResNext({ userRole: 'lecturer' });
    isStudent(req, res, next);
    expect(res.statusCode).toBe(403);
  });
});

describe('isAdmin', () => {
  test('should call next if role is admin', () => {
    const { req, res, next } = mockReqResNext({ userRole: 'admin' });
    isAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('should return 403 if role is student', () => {
    const { req, res, next } = mockReqResNext({ userRole: 'student' });
    isAdmin(req, res, next);
    expect(res.statusCode).toBe(403);
  });

  test('should return 403 if role is lecturer', () => {
    const { req, res, next } = mockReqResNext({ userRole: 'lecturer' });
    isAdmin(req, res, next);
    expect(res.statusCode).toBe(403);
  });
});
