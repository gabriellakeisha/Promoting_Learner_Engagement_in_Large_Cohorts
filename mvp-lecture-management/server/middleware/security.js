// security middleware - rate limiting, xss sanitisation, security headers

const rateLimit = require('express-rate-limit');
const validator = require('validator');

// general API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter for auth endpoints (login/register)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 attempts per window
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Message sending limiter (prevent spam)
const messageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 messages per minute
  message: {
    success: false,
    message: 'You are sending messages too quickly. Please slow down.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// sanitise text input to prevent xss
function sanitiseText(text) {
  if (!text || typeof text !== 'string') return '';
  // Escape HTML entities
  return validator.escape(text.trim());
}

// sanitise user input object (works recursively for nested stuff)
function sanitiseInput(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  const sanitised = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      // Sanitise strings (but preserve some fields that need special handling)
      const preserveRaw = ['password', 'token', 'sessionId'];
      sanitised[key] = preserveRaw.includes(key) ? value.trim() : sanitiseText(value);
    } else if (Array.isArray(value)) {
      sanitised[key] = value.map(item =>
        typeof item === 'string' ? sanitiseText(item) : sanitiseInput(item)
      );
    } else if (typeof value === 'object' && value !== null) {
      sanitised[key] = sanitiseInput(value);
    } else {
      sanitised[key] = value;
    }
  }
  return sanitised;
}

// middleware to sanitise request body
function sanitiseBody(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitiseInput(req.body);
  }
  next();
}

// security headers middleware
function securityHeaders(req, res, next) {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  // XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
}

module.exports = {
  apiLimiter,
  authLimiter,
  messageLimiter,
  sanitiseText,
  sanitiseInput,
  sanitiseBody,
  securityHeaders
};
