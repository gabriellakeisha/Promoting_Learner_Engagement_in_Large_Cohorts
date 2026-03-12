// test data generator - creates fake lecture chat data for testing
// run with: node scripts/generate-test-data.js

require('dotenv').config();
const mongoose = require('mongoose');

// Simulated lecture topics with realistic student messages
const LECTURE_SCENARIOS = [
  {
    title: 'Introduction to Neural Networks',
    topic: 'neural_networks',
    messages: [
      { type: 'QUESTION', text: 'How many layers does a typical deep neural network have?' },
      { type: 'CONFUSION', text: 'I\'m confused about the difference between CNN and RNN architectures' },
      { type: 'COMMENT', text: 'The backpropagation explanation was really clear' },
      { type: 'QUESTION', text: 'What is the vanishing gradient problem?' },
      { type: 'CONFUSION', text: 'Not sure how activation functions affect learning' },
      { type: 'COMMENT', text: 'The visual diagram of feed-forward networks helped a lot' },
      { type: 'QUESTION', text: 'Can neural networks be used for time series prediction?' },
      { type: 'CONFUSION', text: 'Still unclear on how dropout prevents overfitting' },
      { type: 'QUESTION', text: 'What optimizers work best for training deep networks?' },
      { type: 'COMMENT', text: 'The comparison between sigmoid and ReLU was useful' },
      { type: 'QUESTION', text: 'How do we decide the number of hidden layers?' },
      { type: 'CONFUSION', text: 'Confused about batch normalization purpose' },
      { type: 'COMMENT', text: 'The MNIST example made the concept concrete' },
      { type: 'QUESTION', text: 'What is transfer learning in neural networks?' },
      { type: 'CONFUSION', text: 'Not understanding weight initialization strategies' }
    ]
  },
  {
    title: 'Database Design and Normalization',
    topic: 'databases',
    messages: [
      { type: 'QUESTION', text: 'What is the difference between 2NF and 3NF?' },
      { type: 'CONFUSION', text: 'I\'m confused about transitive dependencies' },
      { type: 'COMMENT', text: 'The ER diagram example was helpful' },
      { type: 'QUESTION', text: 'When should we denormalize a database?' },
      { type: 'CONFUSION', text: 'Not clear on functional dependencies' },
      { type: 'COMMENT', text: 'Good explanation of primary vs foreign keys' },
      { type: 'QUESTION', text: 'How does indexing improve query performance?' },
      { type: 'CONFUSION', text: 'Confused about BCNF vs 3NF differences' },
      { type: 'QUESTION', text: 'What is referential integrity?' },
      { type: 'COMMENT', text: 'The SQL examples clarified JOIN operations' },
      { type: 'QUESTION', text: 'Should we always use surrogate keys?' },
      { type: 'CONFUSION', text: 'Unclear when to use composite keys' },
      { type: 'COMMENT', text: 'The normalization step-by-step process was clear' },
      { type: 'QUESTION', text: 'How do NoSQL databases handle relationships?' },
      { type: 'CONFUSION', text: 'Not sure about ACID properties in practice' }
    ]
  },
  {
    title: 'Web Security and Authentication',
    topic: 'security',
    messages: [
      { type: 'QUESTION', text: 'How does JWT authentication work?' },
      { type: 'CONFUSION', text: 'Confused about the difference between authentication and authorization' },
      { type: 'COMMENT', text: 'The OWASP top 10 overview was informative' },
      { type: 'QUESTION', text: 'What is cross-site scripting (XSS)?' },
      { type: 'CONFUSION', text: 'Not clear on how SQL injection attacks work' },
      { type: 'COMMENT', text: 'Good demonstration of password hashing with bcrypt' },
      { type: 'QUESTION', text: 'Why do we need HTTPS for authentication?' },
      { type: 'CONFUSION', text: 'Confused about session vs token-based auth' },
      { type: 'QUESTION', text: 'What is CSRF and how to prevent it?' },
      { type: 'COMMENT', text: 'The OAuth flow diagram helped understand the process' },
      { type: 'QUESTION', text: 'How do rate limiters protect against brute force?' },
      { type: 'CONFUSION', text: 'Unclear on how to store API keys securely' },
      { type: 'COMMENT', text: 'The security headers explanation was practical' },
      { type: 'QUESTION', text: 'What is two-factor authentication?' },
      { type: 'CONFUSION', text: 'Not understanding certificate pinning' }
    ]
  },
  {
    title: 'Algorithms and Data Structures',
    topic: 'algorithms',
    messages: [
      { type: 'QUESTION', text: 'What is the time complexity of quicksort?' },
      { type: 'CONFUSION', text: 'Confused about when to use BFS vs DFS' },
      { type: 'COMMENT', text: 'The Big O notation examples were helpful' },
      { type: 'QUESTION', text: 'How does a hash table handle collisions?' },
      { type: 'CONFUSION', text: 'Not clear on recursion vs iteration trade-offs' },
      { type: 'COMMENT', text: 'Good visualization of binary search tree operations' },
      { type: 'QUESTION', text: 'When should we use a heap data structure?' },
      { type: 'CONFUSION', text: 'Confused about dynamic programming approach' },
      { type: 'QUESTION', text: 'What is the difference between stack and queue?' },
      { type: 'COMMENT', text: 'The sorting algorithm comparison table was useful' },
      { type: 'QUESTION', text: 'How does Dijkstra\'s algorithm find shortest path?' },
      { type: 'CONFUSION', text: 'Unclear on graph representation methods' },
      { type: 'COMMENT', text: 'The linked list implementation example was clear' },
      { type: 'QUESTION', text: 'What is memoization in dynamic programming?' },
      { type: 'CONFUSION', text: 'Not understanding amortized analysis' }
    ]
  },
  {
    title: 'Software Engineering Principles',
    topic: 'software_engineering',
    messages: [
      { type: 'QUESTION', text: 'What is the difference between Agile and Waterfall?' },
      { type: 'CONFUSION', text: 'Confused about SOLID principles application' },
      { type: 'COMMENT', text: 'The design patterns overview was comprehensive' },
      { type: 'QUESTION', text: 'How do we write effective unit tests?' },
      { type: 'CONFUSION', text: 'Not clear on dependency injection benefits' },
      { type: 'COMMENT', text: 'Good explanation of version control workflows' },
      { type: 'QUESTION', text: 'What is continuous integration/deployment?' },
      { type: 'CONFUSION', text: 'Confused about microservices vs monolith' },
      { type: 'QUESTION', text: 'How do code reviews improve quality?' },
      { type: 'COMMENT', text: 'The refactoring examples were practical' },
      { type: 'QUESTION', text: 'What is technical debt?' },
      { type: 'CONFUSION', text: 'Unclear on when to use inheritance vs composition' },
      { type: 'COMMENT', text: 'The UML diagram conventions were helpful' },
      { type: 'QUESTION', text: 'How do we estimate software project timelines?' },
      { type: 'CONFUSION', text: 'Not understanding the observer pattern' }
    ]
  }
];

// Identity modes for variety
const IDENTITY_MODES = ['anonymous', 'pseudonymous', 'identified'];

// Pseudonyms for pseudonymous mode
const PSEUDONYMS = [
  'BluePhoenix', 'CodeNinja', 'DataWizard', 'TechExplorer', 'CuriousMind',
  'DigitalOwl', 'LogicLion', 'ByteHunter', 'QueryQueen', 'AlgoAce'
];

// random date within session duration
function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// generate session data for one scenario
function generateSessionData(scenario, sessionDurationMinutes = 60) {
  const sessionStart = new Date();
  sessionStart.setHours(sessionStart.getHours() - 2); // Started 2 hours ago
  const sessionEnd = new Date(sessionStart.getTime() + sessionDurationMinutes * 60 * 1000);

  const messages = scenario.messages.map((msg, index) => {
    const identityMode = IDENTITY_MODES[Math.floor(Math.random() * IDENTITY_MODES.length)];

    return {
      text: msg.text,
      type: msg.type,
      identityMode: identityMode,
      pseudonym: identityMode === 'pseudonymous'
        ? PSEUDONYMS[Math.floor(Math.random() * PSEUDONYMS.length)]
        : null,
      timestamp: randomDate(sessionStart, sessionEnd),
      upvotes: Math.floor(Math.random() * 5)
    };
  });

  // Sort by timestamp
  messages.sort((a, b) => a.timestamp - b.timestamp);

  return {
    title: scenario.title,
    topic: scenario.topic,
    duration: sessionDurationMinutes,
    messageCount: messages.length,
    messages: messages,
    expectedKeywords: getExpectedKeywords(scenario.topic)
  };
}

// expected keywords for each topic (ground truth to compare against)
function getExpectedKeywords(topic) {
  const keywords = {
    neural_networks: ['neural network', 'backpropagation', 'activation function', 'gradient', 'layers', 'CNN', 'RNN', 'dropout', 'optimizer', 'overfitting'],
    databases: ['normalization', 'primary key', 'foreign key', 'index', 'SQL', 'query', 'join', 'ACID', 'schema', 'relational'],
    security: ['authentication', 'authorization', 'JWT', 'XSS', 'SQL injection', 'HTTPS', 'CSRF', 'OAuth', 'hashing', 'encryption'],
    algorithms: ['time complexity', 'Big O', 'sorting', 'binary search', 'hash table', 'recursion', 'dynamic programming', 'graph', 'tree', 'heap'],
    software_engineering: ['Agile', 'design patterns', 'unit test', 'CI/CD', 'refactoring', 'SOLID', 'version control', 'microservices', 'code review', 'technical debt']
  };
  return keywords[topic] || [];
}

// main - generate all test data and save to json
async function generateAllTestData() {
  console.log('========================================');
  console.log('SIMULATED TEST DATA GENERATOR');
  console.log('========================================\n');

  const allData = LECTURE_SCENARIOS.map(scenario => generateSessionData(scenario));

  // Output summary
  console.log('Generated test data for', allData.length, 'lecture scenarios:\n');

  allData.forEach(data => {
    console.log(`📚 ${data.title}`);
    console.log(`   Messages: ${data.messageCount}`);
    console.log(`   Duration: ${data.duration} minutes`);
    console.log(`   Expected Keywords: ${data.expectedKeywords.slice(0, 5).join(', ')}...`);
    console.log('');
  });

  // Output JSON for testing
  const outputPath = './scripts/test-data.json';
  const fs = require('fs');
  fs.writeFileSync(outputPath, JSON.stringify(allData, null, 2));
  console.log(`\n✅ Test data saved to ${outputPath}`);

  // Generate combined text for AI testing
  console.log('\n========================================');
  console.log('SAMPLE TEXT FOR AI KEYWORD TESTING');
  console.log('========================================\n');

  const sampleText = allData[0].messages.map(m => m.text).join(' ');
  console.log('Topic:', allData[0].title);
  console.log('Combined text length:', sampleText.length, 'characters');
  console.log('\nFirst 500 characters:');
  console.log(sampleText.substring(0, 500) + '...\n');

  return allData;
}

// Run if called directly
if (require.main === module) {
  generateAllTestData()
    .then(() => {
      console.log('========================================');
      console.log('GENERATION COMPLETE');
      console.log('========================================');
      process.exit(0);
    })
    .catch(err => {
      console.error('Error:', err);
      process.exit(1);
    });
}

module.exports = { generateSessionData, LECTURE_SCENARIOS };
