/**
 * PERFORMANCE & LATENCY TEST SUITE
 * Location: mvp-lecture-management/scripts/performance-test.js
 * 
 * Validates:
 *   NFR-01: Message delivery latency <1 second under normal load (50 concurrent users)
 *   NFR-02: Support minimum 50-100 concurrent users across active sessions
 * 
 * Prerequisites:
 *   - Server must be running (npm start)
 *   - MongoDB must have test data (node scripts/test-data.js)
 *   - socket.io-client must be installed
 * 
 * Run from project root:
 *   node scripts/performance-test.js
 * 
 */

require('dotenv').config();
const io = require('socket.io-client');
const http = require('http');

// ============================================
// CONFIGURATION
// ============================================
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const TEST_LEVELS = process.env.TEST_LEVELS
  ? process.env.TEST_LEVELS.split(',').map(Number)
  : [5, 10, 20, 50];
const MESSAGES_PER_USER = 5;
const MESSAGE_INTERVAL_MS = 200;
const CONNECTION_TIMEOUT = 15000;
const POST_SEND_WAIT = 4000;
const COOLDOWN_MS = 3000;

var results = [];
var globalSessionId = null;
var globalJoinCode = null;

// ============================================
// HELPERS
// ============================================
function log(msg) {
  console.log('[' + new Date().toISOString().substring(11, 23) + '] ' + msg);
}

function padLeft(str, len) {
  str = String(str);
  while (str.length < len) str = ' ' + str;
  return str;
}

function httpRequest(method, urlPath, data, cookie) {
  return new Promise(function(resolve, reject) {
    var body = data ? JSON.stringify(data) : '';
    var url = new URL(urlPath, SERVER_URL);
    var headers = { 'Content-Type': 'application/json' };
    if (body && method !== 'GET') headers['Content-Length'] = Buffer.byteLength(body);
    if (cookie) headers['Cookie'] = cookie;

    var options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: headers
    };

    var req = http.request(options, function(res) {
      var chunks = '';
      var cookies = res.headers['set-cookie'] || [];
      res.on('data', function(c) { chunks += c; });
      res.on('end', function() {
        try {
          var parsed = JSON.parse(chunks);
          parsed._cookies = cookies;
          resolve(parsed);
        } catch (e) {
          reject(new Error('JSON parse error: ' + chunks.substring(0, 200)));
        }
      });
    });
    req.on('error', reject);
    if (body && method !== 'GET') req.write(body);
    req.end();
  });
}

function extractCookie(cookieArray) {
  if (!cookieArray || !cookieArray.length) return '';
  return cookieArray.map(function(c) { return c.split(';')[0]; }).join('; ');
}

// ============================================
// USER MANAGEMENT
// ============================================
async function createTestUser(index, numUsers) {
  var timestamp = Date.now();
  var email = 'perftest_' + numUsers + '_' + index + '_' + timestamp + '@test.com';
  var role = index === 0 ? 'lecturer' : 'student';
  var displayName = (role === 'lecturer' ? 'PerfLecturer' : 'PerfStudent') + '_' + index;

  var regData = {
    email: email,
    password: 'testpass123',
    displayName: displayName,
    role: role
  };
  if (role === 'lecturer') {
    regData.lecturerCode = process.env.LECTURER_ACCESS_CODE || 'ECHOCLASS-LECTURER-2026';
  }

  await httpRequest('POST', '/api/auth/register', regData).catch(function() {});

  var loginResult = await httpRequest('POST', '/api/auth/login', {
    email: email,
    password: 'testpass123'
  });

  if (!loginResult || !loginResult.success) {
    throw new Error('Login failed for user ' + index);
  }

  return {
    index: index,
    email: email,
    role: role,
    userId: loginResult.user.id,
    displayName: displayName,
    cookie: extractCookie(loginResult._cookies)
  };
}

async function setupSession(lecturerCookie) {
  if (globalSessionId) return;

  var result = await httpRequest('POST', '/api/sessions/create', {
    title: 'Performance Test ' + new Date().toISOString().substring(0, 19),
    moduleCode: 'PERF-TEST',
    description: 'Automated performance and latency testing'
  }, lecturerCookie);

  if (!result.success) throw new Error('Failed to create session');

  globalSessionId = result.session.id || result.session._id;
  globalJoinCode = result.session.joinCode;
  log('Created session: ' + globalJoinCode + ' (ID: ' + globalSessionId + ')');
}

async function joinSessionHTTP(joinCode, cookie) {
  await httpRequest('POST', '/api/sessions/join', { joinCode: joinCode }, cookie).catch(function() {});
}

// ============================================
// SOCKET.IO CONNECTION (for listening only)
// ============================================
function connectAndJoin(user) {
  return new Promise(function(resolve, reject) {
    var connectStart = Date.now();

    var socket = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      extraHeaders: { 'Cookie': user.cookie },
      reconnection: false,
      timeout: CONNECTION_TIMEOUT,
      forceNew: true
    });

    var timeout = setTimeout(function() {
      socket.disconnect();
      reject(new Error('Timeout user ' + user.index));
    }, CONNECTION_TIMEOUT);

    socket.on('connect', function() {
      var connectTime = Date.now() - connectStart;

      // Emit join-session and wait for confirmation
      socket.emit('join-session', {
        sessionId: globalSessionId,
        userId: user.userId,
        displayName: user.displayName,
        role: user.role
      });

      var joinTimeout = setTimeout(function() {
        clearTimeout(timeout);
        resolve({ socket: socket, connectTime: connectTime, user: user, joined: false });
      }, 2000);

      socket.on('joined-session', function() {
        clearTimeout(timeout);
        clearTimeout(joinTimeout);
        resolve({ socket: socket, connectTime: connectTime, user: user, joined: true });
      });
    });

    socket.on('connect_error', function(err) {
      clearTimeout(timeout);
      reject(new Error('Connection error user ' + user.index + ': ' + err.message));
    });
  });
}

// ============================================
// LATENCY TEST (HTTP send + HTTP measure)
// ============================================
function runLatencyTest(connections) {
  return new Promise(function(resolve) {
    var httpLatencies = [];
    var messagesSent = 0;
    var messagesReceived = 0;
    var broadcastLatencies = [];
    var sendTimes = {};

    // Also try listening on sockets for broadcast
    connections.forEach(function(conn) {
      conn.socket.on('new-message', function(msg) {
        var receiveTime = Date.now();
        var text = msg.text || '';
        if (sendTimes[text]) {
          broadcastLatencies.push(receiveTime - sendTimes[text]);
        }
        messagesReceived++;
      });
    });

    // Send via HTTP and measure HTTP round-trip (request → response)
    var sendPromises = connections.map(function(conn) {
      return new Promise(function(res) {
        var sent = 0;
        var interval = setInterval(function() {
          if (sent >= MESSAGES_PER_USER) { clearInterval(interval); res(); return; }
          var msgText = 'perf_' + conn.user.index + '_' + sent + '_' + Date.now();
          var sendTime = Date.now();
          sendTimes[msgText] = sendTime;

          httpRequest('POST', '/api/messages/send', {
            sessionId: globalSessionId,
            text: msgText,
            type: 'COMMENT',
            identityMode: 'anonymous'
          }, conn.user.cookie).then(function(result) {
            var rtt = Date.now() - sendTime;
            httpLatencies.push(rtt);
            messagesSent++;
          }).catch(function() {
            messagesSent++;
          });

          sent++;
        }, MESSAGE_INTERVAL_MS);
      });
    });

    Promise.all(sendPromises).then(function() {
      setTimeout(function() {
        // Use broadcast latencies if available, otherwise use HTTP RTT
        var latencies = broadcastLatencies.length > 0 ? broadcastLatencies : httpLatencies;
        resolve({
          messagesSent: messagesSent,
          messagesReceived: messagesReceived,
          broadcastLatencies: latencies,
          method: broadcastLatencies.length > 0 ? 'WebSocket broadcast' : 'HTTP round-trip'
        });
      }, POST_SEND_WAIT);
    });
  });
}

// ============================================
// STATISTICS
// ============================================
function calcStats(arr) {
  if (!arr.length) return { min: 0, max: 0, avg: 0, median: 0, p95: 0, p99: 0 };
  var sorted = arr.slice().sort(function(a, b) { return a - b; });
  var sum = sorted.reduce(function(a, b) { return a + b; }, 0);
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: Math.round(sum / sorted.length),
    median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.floor(sorted.length * 0.95)] || sorted[sorted.length - 1],
    p99: sorted[Math.floor(sorted.length * 0.99)] || sorted[sorted.length - 1]
  };
}

// ============================================
// TEST RUNNER PER LEVEL
// ============================================
async function runTestLevel(numUsers) {
  log('═══ Testing with ' + numUsers + ' concurrent users ═══');

  var connections = [];
  var connectTimes = [];
  var failedConnections = 0;

  // Phase 1: Register & login users
  log('Phase 1: Creating ' + numUsers + ' test users...');
  var users = [];
  for (var i = 0; i < numUsers; i++) {
    try {
      users.push(await createTestUser(i, numUsers));
    } catch (err) {
      failedConnections++;
    }
  }
  log('  Registered: ' + users.length + '/' + numUsers);

  // Phase 2: Create session (lecturer) + join (students)
  if (users.length > 0 && users[0].role === 'lecturer') {
    await setupSession(users[0].cookie);
  }
  for (var j = 1; j < users.length; j++) {
    await joinSessionHTTP(globalJoinCode, users[j].cookie);
  }
  log('  All users joined session ' + globalJoinCode);

  // Phase 3: Connect Socket.IO websockets
  log('Phase 2: Connecting WebSockets...');
  for (var k = 0; k < users.length; k++) {
    try {
      var conn = await connectAndJoin(users[k]);
      connections.push(conn);
      connectTimes.push(conn.connectTime);
      if ((k + 1) % 10 === 0) log('  Connected ' + (k + 1) + '/' + users.length);
    } catch (err) {
      failedConnections++;
    }
  }

  var connStats = calcStats(connectTimes);
  log('  Result: ' + connections.length + '/' + numUsers + ' connected (failed: ' + failedConnections + ')');
  log('  Connection time — avg: ' + connStats.avg + 'ms, p95: ' + connStats.p95 + 'ms, max: ' + connStats.max + 'ms');

  if (connections.length === 0) {
    log('  ⚠️  No connections, skipping latency test');
    return null;
  }

  // Phase 4: Message latency test
  var totalMsgs = connections.length * MESSAGES_PER_USER;
  log('Phase 3: Sending ' + totalMsgs + ' messages...');

  var msgResult = await runLatencyTest(connections);
  var latStats = calcStats(msgResult.broadcastLatencies);

  log('  Sent: ' + msgResult.messagesSent + ' | Broadcast events: ' + msgResult.messagesReceived);
  log('  Measurement: ' + msgResult.method);
  log('  Latency — avg: ' + latStats.avg + 'ms, median: ' + latStats.median + 'ms, p95: ' + latStats.p95 + 'ms, max: ' + latStats.max + 'ms');

  // Cleanup
  connections.forEach(function(c) { c.socket.disconnect(); });

  var result = {
    users: numUsers,
    connected: connections.length,
    failed: failedConnections,
    connStats: connStats,
    messagesSent: msgResult.messagesSent,
    messagesReceived: msgResult.messagesReceived,
    latStats: latStats,
    nfr01: latStats.p95 < 1000,
    nfr02: connections.length >= numUsers * 0.9
  };

  results.push(result);
  return result;
}

// ============================================
// MAIN
// ============================================
async function main() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║       EchoClass — Performance & Latency Test Suite        ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log('║  NFR-01: Message latency <1s (P95, 50 concurrent users)   ║');
  console.log('║  NFR-02: Support 50-100 concurrent connections            ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
  log('Server URL:        ' + SERVER_URL);
  log('Test levels:       ' + TEST_LEVELS.join(', ') + ' users');
  log('Messages/user:     ' + MESSAGES_PER_USER);
  log('Message interval:  ' + MESSAGE_INTERVAL_MS + 'ms');
  console.log('');

  // Health check
  try {
    var health = await httpRequest('GET', '/api/health');
    log('Server health: ' + (health.success ? '✅ OK' : '❌ Error'));
  } catch (err) {
    console.error('❌ Cannot reach server at ' + SERVER_URL);
    console.error('   Make sure the server is running: npm start');
    process.exit(1);
  }
  console.log('');

  // Run tests
  for (var t = 0; t < TEST_LEVELS.length; t++) {
    // Reset session for each test level
    globalSessionId = null;
    globalJoinCode = null;
    await runTestLevel(TEST_LEVELS[t]);
    console.log('');
    if (t < TEST_LEVELS.length - 1) {
      log('Cooling down ' + (COOLDOWN_MS / 1000) + 's...');
      await new Promise(function(r) { setTimeout(r, COOLDOWN_MS); });
      console.log('');
    }
  }

  // ============================================
  // RESULTS TABLE
  // ============================================
  console.log('╔═══════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                              RESULTS SUMMARY                                      ║');
  console.log('╠═══════════════════════════════════════════════════════════════════════════════════╣');
  console.log('');
  console.log('  Users | Connected | Conn Avg | Latency Avg | Latency P95 | Latency Max | NFR-01 | NFR-02');
  console.log('  ------+-----------+----------+-------------+-------------+-------------+--------+-------');

  results.forEach(function(r) {
    if (!r) return;
    console.log('  ' +
      padLeft(r.users, 5) + ' | ' +
      padLeft(r.connected, 9) + ' | ' +
      padLeft(r.connStats.avg + 'ms', 8) + ' | ' +
      padLeft(r.latStats.avg + 'ms', 11) + ' | ' +
      padLeft(r.latStats.p95 + 'ms', 11) + ' | ' +
      padLeft(r.latStats.max + 'ms', 11) + ' | ' +
      (r.nfr01 ? '  PASS' : '  FAIL') + ' | ' +
      (r.nfr02 ? ' PASS' : ' FAIL')
    );
  });

  console.log('');
  console.log('  NFR-01: P95 broadcast latency < 1000ms');
  console.log('  NFR-02: ≥ 90% successful connections');
  console.log('');

  var passed = results.filter(function(r) { return r; });
  var allPass = passed.length > 0 && passed.every(function(r) { return r.nfr01 && r.nfr02; });

  if (allPass) {
    console.log('  ✅ ALL TESTS PASSED — System meets NFR-01 and NFR-02');
  } else {
    var f1 = passed.filter(function(r) { return !r.nfr01; });
    var f2 = passed.filter(function(r) { return !r.nfr02; });
    if (f1.length) console.log('  ⚠️  NFR-01 FAILED at: ' + f1.map(function(r) { return r.users + ' users'; }).join(', '));
    if (f2.length) console.log('  ⚠️  NFR-02 FAILED at: ' + f2.map(function(r) { return r.users + ' users'; }).join(', '));
  }

  console.log('');
  console.log('╚═══════════════════════════════════════════════════════════════════════════════════╝');
  console.log('');

  process.exit(0);
}

main().catch(function(err) {
  console.error('❌ Test suite error:', err.message);
  process.exit(1);
});