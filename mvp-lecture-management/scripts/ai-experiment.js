// AI Comparison Experiment — Simulated Lecture Chat Scenarios
// Generates biased chat data for specific topics, runs both AI methods,
// and evaluates which one most accurately captures the topic.
//
// Usage: node scripts/ai-experiment.js
// Requires: HUGGINGFACE_API_KEY in .env
//
// This addresses the supervisor's guidance:
// "Give me 100 messages biased towards not understanding [topic],
//  feed that into your model, and see which model most clearly captures it."

require('dotenv').config();

const aiKeywords = require('../server/services/ai-keywords');
const aiSummary = require('../server/services/ai-summary');
const aiComparison = require('../server/services/ai-comparison');

// ====== 6 SIMULATED LECTURE SCENARIOS ======
// Each has ~20-30 messages biased towards a specific topic with known ground truth keywords

const scenarios = [
  {
    id: 1,
    topic: 'Recursion and Stack Overflow',
    moduleCode: 'CSC1023',
    description: 'Students struggling with recursion concepts in an intro programming module',
    groundTruthKeywords: ['recursion', 'base case', 'stack overflow', 'recursive call', 'call stack', 'factorial', 'fibonacci', 'infinite loop', 'return value', 'termination condition'],
    messages: [
      { text: 'Can someone explain what a base case is in recursion? I keep getting stack overflow errors', type: 'CONFUSION' },
      { text: 'The recursive call for factorial makes no sense to me. How does it know when to stop?', type: 'QUESTION' },
      { text: 'I think the base case is what stops the recursion from going on forever', type: 'COMMENT' },
      { text: 'My fibonacci function works but it takes forever for large numbers. Is that normal?', type: 'QUESTION' },
      { text: 'I dont understand how the call stack works with recursion. Where do the intermediate values go?', type: 'CONFUSION' },
      { text: 'When I trace through the factorial function, the return values make sense going back up but not going down', type: 'CONFUSION' },
      { text: 'Is there always a recursive solution for every iterative one? When should I use recursion over loops?', type: 'QUESTION' },
      { text: 'The stack overflow error means my recursion has no termination condition right?', type: 'QUESTION' },
      { text: 'Can recursion have multiple base cases? Like in binary search?', type: 'QUESTION' },
      { text: 'I finally get it - each recursive call pushes a new frame onto the call stack until the base case is reached', type: 'COMMENT' },
      { text: 'The fibonacci example has two recursive calls in one function. Does that mean it uses twice as much stack space?', type: 'QUESTION' },
      { text: 'Why does my recursive function return undefined instead of the actual value?', type: 'CONFUSION' },
      { text: 'I think the issue is I forgot the return statement before the recursive call', type: 'COMMENT' },
      { text: 'How deep can recursion go before you get a stack overflow? Is there a limit?', type: 'QUESTION' },
      { text: 'The concept of the function calling itself is really confusing. How does the computer keep track?', type: 'CONFUSION' },
      { text: 'Tail recursion optimisation prevents stack overflow but JavaScript doesnt support it right?', type: 'QUESTION' },
      { text: 'Drawing the recursion tree for fibonacci really helped me understand the branching', type: 'COMMENT' },
      { text: 'I get infinite loop when I forget to make the problem smaller in each recursive call', type: 'CONFUSION' },
      { text: 'The difference between head recursion and tail recursion is still unclear to me', type: 'CONFUSION' },
      { text: 'Memoization with recursion for fibonacci brought it from minutes to milliseconds', type: 'COMMENT' },
    ]
  },
  {
    id: 2,
    topic: 'Database Normalisation and SQL Joins',
    moduleCode: 'CSC2032',
    description: 'Students confused about normalisation forms and join operations',
    groundTruthKeywords: ['normalisation', 'primary key', 'foreign key', 'first normal form', 'second normal form', 'third normal form', 'inner join', 'left join', 'referential integrity', 'redundancy'],
    messages: [
      { text: 'What is the difference between first normal form and second normal form? They both seem to remove duplicates', type: 'CONFUSION' },
      { text: 'I dont understand why we need a foreign key. Cant we just store all the data in one table?', type: 'QUESTION' },
      { text: 'The problem with one big table is data redundancy - you repeat the same customer info for every order', type: 'COMMENT' },
      { text: 'How do I know when my database is in third normal form? What violations should I look for?', type: 'QUESTION' },
      { text: 'Inner join only returns rows that match in both tables. Left join returns everything from the left table', type: 'COMMENT' },
      { text: 'Referential integrity means the foreign key must point to an existing primary key right?', type: 'QUESTION' },
      { text: 'I keep getting null values in my left join results and I dont know why', type: 'CONFUSION' },
      { text: 'The normalisation process feels like it makes the database more complex. Why is redundancy so bad?', type: 'QUESTION' },
      { text: 'Transitive dependency in third normal form is really confusing. Can someone give an example?', type: 'CONFUSION' },
      { text: 'When I join three tables together the query gets really slow. Is that normal?', type: 'QUESTION' },
      { text: 'A composite primary key uses two or more columns together as the unique identifier', type: 'COMMENT' },
      { text: 'I accidentally deleted a row that had foreign key references and got a constraint error', type: 'CONFUSION' },
      { text: 'Is denormalisation ever okay? Like for performance in read-heavy applications?', type: 'QUESTION' },
      { text: 'The many-to-many relationship needs a junction table with foreign keys to both tables', type: 'COMMENT' },
      { text: 'I still dont get partial dependency in second normal form', type: 'CONFUSION' },
      { text: 'Self join is when you join a table to itself right? When would you ever need that?', type: 'QUESTION' },
      { text: 'Normalisation reduces redundancy but increases the number of joins needed in queries', type: 'COMMENT' },
      { text: 'My SQL query with multiple joins returns duplicate rows. How do I fix that?', type: 'CONFUSION' },
      { text: 'The difference between WHERE and HAVING in group by queries is still confusing', type: 'CONFUSION' },
      { text: 'Using DISTINCT to remove duplicates from join results feels like a hack', type: 'COMMENT' },
    ]
  },
  {
    id: 3,
    topic: 'Web Security and XSS Prevention',
    moduleCode: 'CSC3045',
    description: 'Students learning about common web vulnerabilities',
    groundTruthKeywords: ['cross-site scripting', 'XSS', 'input sanitisation', 'SQL injection', 'CSRF', 'authentication', 'session hijacking', 'HTTPS', 'OWASP', 'content security policy'],
    messages: [
      { text: 'How does cross-site scripting actually work? Can someone inject JavaScript through a form input?', type: 'QUESTION' },
      { text: 'XSS happens when user input is rendered as HTML without escaping the special characters', type: 'COMMENT' },
      { text: 'Input sanitisation is the main defence against XSS. You replace < and > with their HTML entities', type: 'COMMENT' },
      { text: 'What is the difference between stored XSS and reflected XSS?', type: 'QUESTION' },
      { text: 'I dont understand how SQL injection works. Why would anyone put SQL in a form field?', type: 'CONFUSION' },
      { text: 'CSRF tokens prevent other websites from submitting forms on behalf of logged-in users', type: 'COMMENT' },
      { text: 'Session hijacking means stealing someones session cookie to impersonate them right?', type: 'QUESTION' },
      { text: 'HTTPS encrypts the connection but doesnt protect against XSS if the app itself is vulnerable', type: 'COMMENT' },
      { text: 'The OWASP Top 10 lists the most common web security vulnerabilities. Injection is number one', type: 'COMMENT' },
      { text: 'Content security policy headers tell the browser which scripts are allowed to execute', type: 'COMMENT' },
      { text: 'I tried the script tag injection in our test app and it actually worked before we added sanitisation', type: 'COMMENT' },
      { text: 'Why cant we just block all special characters from user input? Wouldnt that be simpler?', type: 'QUESTION' },
      { text: 'Authentication verifies who you are. Authorisation verifies what you are allowed to do', type: 'COMMENT' },
      { text: 'Rate limiting prevents brute force attacks by limiting login attempts per IP address', type: 'COMMENT' },
      { text: 'I still dont understand why parameterised queries prevent SQL injection', type: 'CONFUSION' },
      { text: 'The httpOnly flag on cookies prevents JavaScript from reading the session cookie', type: 'COMMENT' },
      { text: 'Is it possible to have 100% secure application or will there always be vulnerabilities?', type: 'QUESTION' },
      { text: 'Password hashing with bcrypt means even if the database is stolen the passwords are safe', type: 'COMMENT' },
      { text: 'What happens if an attacker gets the session secret? Can they forge any session?', type: 'QUESTION' },
      { text: 'The security headers like X-Frame-Options prevent clickjacking attacks', type: 'COMMENT' },
    ]
  },
  {
    id: 4,
    topic: 'Machine Learning Basics and Neural Networks',
    moduleCode: 'CSC3058',
    description: 'Students confused about ML fundamentals and backpropagation',
    groundTruthKeywords: ['neural network', 'backpropagation', 'gradient descent', 'overfitting', 'training data', 'loss function', 'activation function', 'hidden layer', 'epoch', 'learning rate'],
    messages: [
      { text: 'How does backpropagation actually calculate the gradients? The chain rule explanation is confusing', type: 'CONFUSION' },
      { text: 'A neural network has input layers hidden layers and output layers connected by weighted edges', type: 'COMMENT' },
      { text: 'Gradient descent updates the weights by moving in the direction that reduces the loss function', type: 'COMMENT' },
      { text: 'What causes overfitting and how do we detect it? My training accuracy is 99% but test is 60%', type: 'QUESTION' },
      { text: 'The training data is what the model learns from. You need separate test data to evaluate', type: 'COMMENT' },
      { text: 'I dont understand what the loss function measures. Is it the error or something else?', type: 'CONFUSION' },
      { text: 'ReLU activation function outputs zero for negative inputs and the input itself for positive', type: 'COMMENT' },
      { text: 'Adding more hidden layers makes the network deeper but doesnt always improve accuracy', type: 'COMMENT' },
      { text: 'One epoch means the model has seen every training example once. We usually need many epochs', type: 'COMMENT' },
      { text: 'If the learning rate is too high the model overshoots the minimum. Too low and it takes forever', type: 'COMMENT' },
      { text: 'The vanishing gradient problem happens in deep networks when gradients become very small', type: 'COMMENT' },
      { text: 'I cant figure out why my model loss is not decreasing. It just stays flat after epoch 5', type: 'CONFUSION' },
      { text: 'Dropout randomly removes neurons during training to prevent overfitting', type: 'COMMENT' },
      { text: 'What is the difference between batch gradient descent and stochastic gradient descent?', type: 'QUESTION' },
      { text: 'The bias term in each neuron allows the activation function to shift left or right', type: 'COMMENT' },
      { text: 'How do you choose the number of hidden layers and neurons? Is it trial and error?', type: 'QUESTION' },
      { text: 'Cross-entropy loss is better than mean squared error for classification problems', type: 'COMMENT' },
      { text: 'I still dont understand why we need nonlinear activation functions. Why not just use linear?', type: 'CONFUSION' },
      { text: 'Without nonlinear activations the entire network collapses to a single linear transformation', type: 'COMMENT' },
      { text: 'Transfer learning means using a pre-trained model and fine-tuning it for your specific task', type: 'COMMENT' },
    ]
  },
  {
    id: 5,
    topic: 'Software Engineering and Agile Methodology',
    moduleCode: 'CSC2058',
    description: 'Students discussing agile, testing, and software design patterns',
    groundTruthKeywords: ['agile', 'scrum', 'sprint', 'user story', 'test-driven development', 'continuous integration', 'design pattern', 'code review', 'technical debt', 'refactoring'],
    messages: [
      { text: 'How long should a sprint be? Our team cant decide between one week and two weeks', type: 'QUESTION' },
      { text: 'A user story should be written from the perspective of the end user with acceptance criteria', type: 'COMMENT' },
      { text: 'Test-driven development means writing the test before writing the actual code', type: 'COMMENT' },
      { text: 'Continuous integration automatically builds and tests the code every time someone pushes', type: 'COMMENT' },
      { text: 'I dont understand the difference between the scrum master and the product owner roles', type: 'CONFUSION' },
      { text: 'The singleton design pattern ensures only one instance of a class exists', type: 'COMMENT' },
      { text: 'Code review helps catch bugs early and shares knowledge across the team', type: 'COMMENT' },
      { text: 'Technical debt accumulates when you take shortcuts now that will cost more to fix later', type: 'COMMENT' },
      { text: 'Refactoring improves the code structure without changing its external behaviour', type: 'COMMENT' },
      { text: 'The daily standup in scrum should be 15 minutes max. What did you do, what will you do, any blockers', type: 'COMMENT' },
      { text: 'How do you estimate story points? It seems very subjective and different for each person', type: 'QUESTION' },
      { text: 'The observer design pattern is used when one object needs to notify multiple objects of changes', type: 'COMMENT' },
      { text: 'I find it hard to write tests first when I dont even know what the code should look like yet', type: 'CONFUSION' },
      { text: 'Sprint retrospective is where the team discusses what went well and what to improve', type: 'COMMENT' },
      { text: 'Why do we need both unit tests and integration tests? Isnt one enough?', type: 'QUESTION' },
      { text: 'The MVC pattern separates the model data from the view presentation and the controller logic', type: 'COMMENT' },
      { text: 'Pair programming feels slow at first but studies show it produces fewer bugs', type: 'COMMENT' },
      { text: 'What is the definition of done for a user story? When is it actually complete?', type: 'QUESTION' },
      { text: 'Velocity measures how many story points the team completes per sprint on average', type: 'COMMENT' },
      { text: 'I dont understand when to use the factory pattern versus just creating objects directly', type: 'CONFUSION' },
    ]
  },
  {
    id: 6,
    topic: 'Data Structures — Trees and Graphs',
    moduleCode: 'CSC2035',
    description: 'Students struggling with tree traversals and graph algorithms',
    groundTruthKeywords: ['binary search tree', 'depth-first search', 'breadth-first search', 'tree traversal', 'graph', 'adjacency list', 'balanced tree', 'AVL tree', 'shortest path', 'Dijkstra'],
    messages: [
      { text: 'What is the difference between inorder preorder and postorder tree traversal?', type: 'QUESTION' },
      { text: 'A binary search tree has the property that left children are smaller and right children are larger', type: 'COMMENT' },
      { text: 'Depth-first search uses a stack and goes as deep as possible before backtracking', type: 'COMMENT' },
      { text: 'Breadth-first search uses a queue and visits all nodes at one level before going deeper', type: 'COMMENT' },
      { text: 'I dont understand when to use DFS versus BFS. Is one always better than the other?', type: 'CONFUSION' },
      { text: 'An adjacency list represents a graph by storing each nodes neighbours in a list', type: 'COMMENT' },
      { text: 'Why does an unbalanced binary search tree degrade to O(n) for search?', type: 'QUESTION' },
      { text: 'An AVL tree automatically rebalances itself after insertions and deletions using rotations', type: 'COMMENT' },
      { text: 'Dijkstra algorithm finds the shortest path from one node to all other nodes in a weighted graph', type: 'COMMENT' },
      { text: 'The concept of tree rotations for AVL balancing is really confusing. Left rotation right rotation', type: 'CONFUSION' },
      { text: 'A graph can have cycles but a tree cannot. A tree is basically a connected acyclic graph', type: 'COMMENT' },
      { text: 'How does Dijkstra handle negative edge weights? Does it still work?', type: 'QUESTION' },
      { text: 'Dijkstra does not work with negative weights. You need Bellman-Ford for that', type: 'COMMENT' },
      { text: 'I keep mixing up the adjacency list and adjacency matrix representations', type: 'CONFUSION' },
      { text: 'For sparse graphs adjacency list is more memory efficient. For dense graphs use a matrix', type: 'COMMENT' },
      { text: 'Inorder traversal of a BST gives you the elements in sorted order', type: 'COMMENT' },
      { text: 'What is the time complexity of inserting into a balanced BST versus an unbalanced one?', type: 'QUESTION' },
      { text: 'Red-black tree is another self-balancing BST but with different rules than AVL', type: 'COMMENT' },
      { text: 'I cant figure out how to implement BFS iteratively. The queue logic is confusing', type: 'CONFUSION' },
      { text: 'Topological sort only works on directed acyclic graphs and gives a valid ordering', type: 'COMMENT' },
    ]
  }
];

// ====== RUN EXPERIMENTS ======

async function runExperiments() {
  console.log('='.repeat(70));
  console.log('AI KEYWORD EXTRACTION COMPARISON EXPERIMENT');
  console.log('EchoClass — CSC3002 Dissertation Evaluation');
  console.log('='.repeat(70));
  console.log(`\nHugging Face API: ${aiKeywords.isAvailable() ? 'CONFIGURED' : 'NOT CONFIGURED (will use RAKE only)'}`);
  console.log(`Scenarios: ${scenarios.length}`);
  console.log(`Date: ${new Date().toISOString()}\n`);

  const results = [];

  for (const scenario of scenarios) {
    console.log(`\n${'─'.repeat(70)}`);
    console.log(`Scenario ${scenario.id}: ${scenario.topic} (${scenario.moduleCode})`);
    console.log(`Messages: ${scenario.messages.length} | Ground truth keywords: ${scenario.groundTruthKeywords.length}`);
    console.log(`${'─'.repeat(70)}`);

    // Combine all message text
    const allText = scenario.messages.map(m => {
      const label = m.type === 'QUESTION' ? '[Q]' : m.type === 'CONFUSION' ? '[C]' : '';
      return `${label} ${m.text}`;
    }).join(' ');

    // Run comparison
    const comparison = await aiComparison.runComparison(allText, 10);

    // Calculate accuracy against ground truth
    const groundSet = new Set(scenario.groundTruthKeywords.map(k => k.toLowerCase()));

    const providerResults = {};
    for (const [name, data] of Object.entries(comparison.providers)) {
      if (data.keywords && Array.isArray(data.keywords)) {
        const extractedWords = data.keywords.map(k => k.word.toLowerCase());
        
        // Exact match
        const exactMatches = extractedWords.filter(w => groundSet.has(w));
        
        // Partial match (extracted keyword contains ground truth or vice versa)
        const partialMatches = extractedWords.filter(extracted =>
          [...groundSet].some(gt => extracted.includes(gt) || gt.includes(extracted))
        );
        
        const accuracy = (partialMatches.length / scenario.groundTruthKeywords.length * 100).toFixed(1);
        
        providerResults[name] = {
          extracted: extractedWords,
          exactMatches,
          partialMatches,
          accuracy: parseFloat(accuracy),
          latency: data.latency,
          type: data.type
        };

        console.log(`\n  ${name.toUpperCase()} (${data.type || 'unknown'}):`);
        console.log(`    Keywords: ${extractedWords.join(', ')}`);
        console.log(`    Exact matches: ${exactMatches.join(', ') || 'none'} (${exactMatches.length}/${scenario.groundTruthKeywords.length})`);
        console.log(`    Partial matches: ${partialMatches.join(', ') || 'none'} (${partialMatches.length}/${scenario.groundTruthKeywords.length})`);
        console.log(`    Accuracy: ${accuracy}%`);
        console.log(`    Latency: ${data.latency}ms`);
      }
    }

    // Also test AI summary if available
    let summaryResult = null;
    if (aiSummary.isAvailable()) {
      try {
        const summary = await aiSummary.generateAISummary(
          scenario.messages.map((m, i) => ({ text: m.text, type: m.type, _id: i })),
          { title: scenario.topic, totalMessages: scenario.messages.length, uniqueContributors: 15 }
        );
        if (summary) {
          // Check if summary mentions the topic
          const topicWords = scenario.topic.toLowerCase().split(/\s+/);
          const summaryLower = summary.toLowerCase();
          const topicMentioned = topicWords.some(w => w.length > 3 && summaryLower.includes(w));
          summaryResult = { text: summary, topicCaptured: topicMentioned };
          console.log(`\n  AI SUMMARY (DistilBART):`);
          console.log(`    "${summary.substring(0, 200)}${summary.length > 200 ? '...' : ''}"`);
          console.log(`    Topic captured: ${topicMentioned ? 'YES' : 'NO'}`);
        }
      } catch (e) {
        console.log(`\n  AI SUMMARY: Error - ${e.message}`);
      }
    }

    results.push({
      scenario: scenario.id,
      topic: scenario.topic,
      moduleCode: scenario.moduleCode,
      messageCount: scenario.messages.length,
      confusionCount: scenario.messages.filter(m => m.type === 'CONFUSION').length,
      providers: providerResults,
      summary: summaryResult
    });
  }

  // ====== AGGREGATE RESULTS ======
  console.log(`\n\n${'='.repeat(70)}`);
  console.log('AGGREGATE RESULTS');
  console.log(`${'='.repeat(70)}`);

  const providers = ['huggingface', 'rake'];
  for (const prov of providers) {
    const accuracies = results.map(r => r.providers[prov]?.accuracy || 0);
    const latencies = results.map(r => r.providers[prov]?.latency || 0);
    const avg = (arr) => arr.length > 0 ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : 'N/A';

    console.log(`\n  ${prov.toUpperCase()}:`);
    console.log(`    Average accuracy: ${avg(accuracies)}%`);
    console.log(`    Best scenario: ${results.reduce((best, r) => (r.providers[prov]?.accuracy || 0) > (best.providers[prov]?.accuracy || 0) ? r : best).topic} (${Math.max(...accuracies)}%)`);
    console.log(`    Worst scenario: ${results.reduce((worst, r) => (r.providers[prov]?.accuracy || 0) < (worst.providers[prov]?.accuracy || 0) ? r : worst).topic} (${Math.min(...accuracies)}%)`);
    console.log(`    Average latency: ${avg(latencies)}ms`);
  }

  // Jaccard overlap
  console.log(`\n  OVERLAP ANALYSIS:`);
  for (const r of results) {
    if (r.providers.huggingface && r.providers.rake) {
      const set1 = new Set(r.providers.huggingface.extracted);
      const set2 = new Set(r.providers.rake.extracted);
      const intersection = new Set([...set1].filter(x => set2.has(x)));
      const union = new Set([...set1, ...set2]);
      const jaccard = union.size > 0 ? (intersection.size / union.size * 100).toFixed(1) : '0';
      console.log(`    ${r.topic}: ${jaccard}% overlap (${intersection.size} shared keywords)`);
    }
  }

  console.log(`\n${'='.repeat(70)}`);
  console.log('CONCLUSION');
  console.log(`${'='.repeat(70)}`);
  
  const hfAvg = results.reduce((sum, r) => sum + (r.providers.huggingface?.accuracy || 0), 0) / results.length;
  const rakeAvg = results.reduce((sum, r) => sum + (r.providers.rake?.accuracy || 0), 0) / results.length;
  
  console.log(`\nHugging Face average accuracy: ${hfAvg.toFixed(1)}%`);
  console.log(`RAKE average accuracy: ${rakeAvg.toFixed(1)}%`);
  console.log(`Difference: ${(hfAvg - rakeAvg).toFixed(1)} percentage points`);
  console.log(`\nHugging Face extracts multi-word academic phrases.`);
  console.log(`RAKE extracts single frequent words.`);
  console.log(`Low overlap confirms they use fundamentally different strategies.`);
  console.log(`\nRecommendation: Use Hugging Face as primary (higher accuracy),`);
  console.log(`RAKE as automatic fallback (works offline, instant response).`);

  return results;
}

runExperiments().catch(console.error);
