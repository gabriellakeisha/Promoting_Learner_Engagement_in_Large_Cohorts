// server/middleware/auth.js

// Check if user is authenticated
const isAuthenticated = (req, res, next) => {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({ 
    success: false, 
    message: 'Authentication required. Please login.' 
  });
};

// Check if user is lecturer
const isLecturer = (req, res, next) => {
  if (req.session && req.session.userRole === 'lecturer') {
    return next();
  }
  return res.status(403).json({ 
    success: false, 
    message: 'Access denied. Lecturer role required.' 
  });
};

// Check if user is student
const isStudent = (req, res, next) => {
  if (req.session && req.session.userRole === 'student') {
    return next();
  }
  return res.status(403).json({ 
    success: false, 
    message: 'Access denied. Student role required.' 
  });
};

// Check if user is admin
const isAdmin = (req, res, next) => {
  if (req.session && req.session.userRole === 'admin') {
    return next();
  }
  return res.status(403).json({ 
    success: false, 
    message: 'Access denied. Admin role required.' 
  });
};

module.exports = {
  isAuthenticated,
  isLecturer,
  isStudent,
  isAdmin,
};
