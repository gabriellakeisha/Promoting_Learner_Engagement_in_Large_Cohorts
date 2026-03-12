// runs ai keyword extraction on test data and compares hugging face vs RAKE
// shows which one is better based on accuracy, latency, and overlap
// run with: node scripts/test-ai-comparison.js

require('dotenv').config();
const { runComparison } = require('../server/services/ai-comparison');
const { LECTURE_SCENARIOS } = require('./generate-test-data');

// expected keywords per topic (ground truth for scoring)
const GROUND_TRUTH = {
  neural_networks: ['neural network', 'backpropagation', 'activation', 'gradient', 'cnn', 'rnn', 'dropout', 'overfitting', 'layers', 'optimizer'],
  databases: ['normalization', 'primary key', 'foreign key', 'index', 'sql', 'query', 'join', 'acid', 'schema', 'relational'],
  security: ['authentication', 'authorization', 'jwt', 'xss', 'injection', 'https', 'csrf', 'oauth', 'hashing', 'encryption'],
  algorithms: ['time complexity', 'big o', 'sorting', 'binary search', 'hash table', 'recursion', 'dynamic programming', 'graph', 'tree', 'heap'],
  software_engineering: ['agile', 'design pattern', 'unit test', 'ci/cd', 'refactoring', 'solid', 'version control', 'microservice', 'code review', 'technical debt']
};

// check how many ground truth keywords appear in extracted results
function scoreAccuracy(extracted, groundTruth) {
  if (!extracted || extracted.length === 0) return { hits: 0, total: groundTruth.length, score: 0 };

  const extractedWords = extracted.map(k => k.word.toLowerCase());
  let hits = 0;

  for (const truth of groundTruth) {
    const found = extractedWords.some(w => w.includes(truth) || truth.includes(w));
    if (found) hits++;
  }

  return {
    hits,
    total: groundTruth.length,
    score: ((hits / groundTruth.length) * 100).toFixed(1)
  };
}

async function runTest() {
  console.log('========================================');
  console.log('  AI KEYWORD EXTRACTION COMPARISON');
  console.log('  Hugging Face (KBIR) vs RAKE');
  console.log('========================================\n');

  // check which providers are available
  console.log('Provider status:');
  console.log(`  Hugging Face: ${process.env.HUGGINGFACE_API_KEY ? 'configured' : 'NOT configured (set HUGGINGFACE_API_KEY)'}`);
  console.log(`  RAKE:         always available (local)\n`);

  const totals = { huggingface: { latency: [], accuracy: [] }, rake: { latency: [], accuracy: [] } };

  for (const scenario of LECTURE_SCENARIOS) {
    const text = scenario.messages.map(m => m.text).join('. ');
    const groundTruth = GROUND_TRUTH[scenario.topic] || [];

    console.log('────────────────────────────────────────');
    console.log(`Topic: ${scenario.title}`);
    console.log(`Text: ${text.length} chars, ${scenario.messages.length} messages`);
    console.log('────────────────────────────────────────\n');

    const result = await runComparison(text, 10);

    // print each provider's results
    for (const [name, data] of Object.entries(result.providers)) {
      if (!data.available) {
        console.log(`  ${name.toUpperCase()}: not available (${data.reason})\n`);
        continue;
      }

      if (data.error) {
        console.log(`  ${name.toUpperCase()}: error - ${data.error}\n`);
        continue;
      }

      const keywords = data.keywords || [];
      const accuracy = scoreAccuracy(keywords, groundTruth);

      console.log(`  ${name.toUpperCase()} (${data.latency}ms):`);
      console.log(`    Keywords: ${keywords.map(k => k.word).join(', ')}`);
      console.log(`    Accuracy: ${accuracy.hits}/${accuracy.total} ground truth matches (${accuracy.score}%)\n`);

      // track totals
      if (totals[name]) {
        totals[name].latency.push(data.latency);
        totals[name].accuracy.push(parseFloat(accuracy.score));
      }
    }

    // overlap
    if (result.analysis.keywordOverlap) {
      console.log('  Keyword Overlap (Jaccard Similarity):');
      for (const [pair, data] of Object.entries(result.analysis.keywordOverlap)) {
        const shared = data.sharedKeywords.length > 0 ? data.sharedKeywords.join(', ') : 'none';
        console.log(`    ${pair}: ${data.similarity} (shared: ${shared})`);
      }
      console.log('');
    }
  }

  // final summary
  console.log('========================================');
  console.log('  OVERALL RESULTS');
  console.log('========================================\n');

  const summary = [];

  for (const [name, data] of Object.entries(totals)) {
    if (data.latency.length === 0) {
      console.log(`  ${name.toUpperCase()}: no data (provider not available)\n`);
      continue;
    }

    const avgLatency = Math.round(data.latency.reduce((a, b) => a + b, 0) / data.latency.length);
    const avgAccuracy = (data.accuracy.reduce((a, b) => a + b, 0) / data.accuracy.length).toFixed(1);
    const minLatency = Math.min(...data.latency);
    const maxLatency = Math.max(...data.latency);

    console.log(`  ${name.toUpperCase()}:`);
    console.log(`    Avg accuracy:  ${avgAccuracy}%`);
    console.log(`    Avg latency:   ${avgLatency}ms (range: ${minLatency}-${maxLatency}ms)`);
    console.log(`    Tests run:     ${data.latency.length}/${LECTURE_SCENARIOS.length}\n`);

    summary.push({ name, avgAccuracy: parseFloat(avgAccuracy), avgLatency });
  }

  // pick the best
  if (summary.length > 0) {
    const bestAccuracy = summary.reduce((a, b) => a.avgAccuracy > b.avgAccuracy ? a : b);
    const bestLatency = summary.reduce((a, b) => a.avgLatency < b.avgLatency ? a : b);

    console.log('  Verdict:');
    console.log(`    Best accuracy: ${bestAccuracy.name.toUpperCase()} (${bestAccuracy.avgAccuracy}%)`);
    console.log(`    Best speed:    ${bestLatency.name.toUpperCase()} (${bestLatency.avgLatency}ms)`);

    if (bestAccuracy.name === bestLatency.name) {
      console.log(`    Winner:        ${bestAccuracy.name.toUpperCase()} (best at both)\n`);
    } else {
      console.log(`    Trade-off:     ${bestAccuracy.name.toUpperCase()} is more accurate, ${bestLatency.name.toUpperCase()} is faster\n`);
    }
  }

  console.log('========================================');
  console.log('  COMPARISON COMPLETE');
  console.log('========================================\n');
}

runTest().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
