import { pipeline, env } from '@xenova/transformers';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure transformers for GitHub Actions
env.allowRemoteFiles = true;
env.allowLocalFiles = true;
env.cacheDir = path.join(__dirname, '../.cache');

// Categories for classification
const categories = [
  'model-release',
  'research-paper', 
  'developer-tool',
  'product-launch',
  'tutorial-guide',
  'industry-news',
  'ai-agents',
  'creative-ai',
  'infrastructure',
  'safety-ethics'
];

let classifier, summarizer, ner;

// Initialize pipelines with working models only
async function initializeModels() {
  try {
    console.log('Loading classifier...');
    classifier = await pipeline('zero-shot-classification', 'Xenova/distilbert-base-uncased-mnli', {
      cache_dir: env.cacheDir,
      quantized: true
    });
    console.log('✓ Classifier loaded');

    console.log('Loading summarizer...');
    summarizer = await pipeline('summarization', 'Xenova/distilbart-cnn-6-6', {
      cache_dir: env.cacheDir,
      quantized: true
    });
    console.log('✓ Summarizer loaded');

    console.log('Loading NER...');
    ner = await pipeline('ner', 'Xenova/bert-base-NER', {
      cache_dir: env.cacheDir,
      quantized: true
    });
    console.log('✓ NER loaded');

    return true;
  } catch (error) {
    console.log('❌ Failed to load models:', error.message);
    console.log('🔄 Using rule-based processing...');
    return false;
  }
}

// Rule-based category classification as fallback
function classifyCategory(title, source) {
  const titleLower = title.toLowerCase();
  const sourceLower = source.toLowerCase();
  
  // Model releases
  if (titleLower.match(/\b(gpt-\d+|claude|gemini|llama|mistral|release|model)\b/) ||
      sourceLower.includes('openai') || sourceLower.includes('anthropic')) {
    return { category: 'model-release', confidence: 0.85 };
  }
  
  // Research papers
  if (titleLower.match(/\b(paper|arxiv|research|study|analysis)\b/) ||
      sourceLower.includes('arxiv')) {
    return { category: 'research-paper', confidence: 0.9 };
  }
  
  // Developer tools
  if (titleLower.match(/\b(api|sdk|framework|tool|library|code|programming)\b/) ||
      sourceLower.includes('hugging')) {
    return { category: 'developer-tool', confidence: 0.8 };
  }
  
  // AI Agents
  if (titleLower.match(/\b(agent|workflow|automation|autonomous)\b/)) {
    return { category: 'ai-agents', confidence: 0.85 };
  }
  
  // Tutorials
  if (titleLower.match(/\b(tutorial|guide|how to|step by step|learn)\b/) ||
      sourceLower.includes('data science') || sourceLower.includes('mastery')) {
    return { category: 'tutorial-guide', confidence: 0.8 };
  }
  
  // Creative AI
  if (titleLower.match(/\b(image|video|audio|creative|art|generate)\b/)) {
    return { category: 'creative-ai', confidence: 0.75 };
  }
  
  // Default to industry news
  return { category: 'industry-news', confidence: 0.6 };
}

// Extract entities using simple regex patterns
function extractEntities(title) {
  const entities = [];
  
  // Companies/Organizations
  const companies = ['OpenAI', 'Anthropic', 'Google', 'Meta', 'Microsoft', 'NVIDIA', 'Apple', 'Amazon', 'Tesla', 'Hugging Face', 'LangChain', 'Pinecone', 'Weights & Biases', 'DeepMind', 'Stability AI', 'Midjourney', 'RunwayML'];
  companies.forEach(company => {
    if (title.toLowerCase().includes(company.toLowerCase())) {
      entities.push({ text: company, label: 'ORG' });
    }
  });
  
  // AI Models/Products
  const models = ['GPT-4', 'GPT-5', 'Claude', 'Gemini', 'LLaMA', 'Llama', 'ChatGPT', 'DALL-E', 'Midjourney', 'Stable Diffusion', 'BERT', 'Transformer'];
  models.forEach(model => {
    if (title.toLowerCase().includes(model.toLowerCase())) {
      entities.push({ text: model, label: 'PRODUCT' });
    }
  });
  
  // Technologies
  const technologies = ['AI', 'ML', 'NLP', 'Computer Vision', 'Deep Learning', 'Machine Learning', 'Neural Network', 'Transformer', 'LLM', 'API', 'SDK'];
  technologies.forEach(tech => {
    if (title.toLowerCase().includes(tech.toLowerCase())) {
      entities.push({ text: tech, label: 'TECH' });
    }
  });
  
  return entities;
}

// Calculate difficulty based on technical terms
function calculateDifficulty(title, entities) {
  const technicalTerms = ['transformer', 'neural', 'deep learning', 'api', 'sdk', 'algorithm', 'model', 'training', 'inference'];
  const researchTerms = ['paper', 'study', 'research', 'analysis', 'arxiv'];
  const advancedTerms = ['rlhf', 'fine-tuning', 'quantization', 'distillation', 'embedding'];
  
  let difficulty = 3; // Base difficulty
  
  const titleLower = title.toLowerCase();
  
  // Increase for technical terms
  technicalTerms.forEach(term => {
    if (titleLower.includes(term)) difficulty += 1;
  });
  
  // Increase for research terms
  researchTerms.forEach(term => {
    if (titleLower.includes(term)) difficulty += 2;
  });
  
  // Increase for advanced terms
  advancedTerms.forEach(term => {
    if (titleLower.includes(term)) difficulty += 3;
  });
  
  // Increase based on entities
  difficulty += entities.length * 0.5;
  
  return Math.min(Math.max(Math.round(difficulty), 1), 10);
}

// Generate summary
async function generateSummary(title, useAI = false) {
  if (!useAI || !summarizer) {
    // Simple rule-based summary
    return `AI news article: ${title.substring(0, 100)}...`;
  }
  
  try {
    const summary = await summarizer(title, {
      max_length: 50,
      min_length: 20
    });
    return summary[0].summary_text;
  } catch (error) {
    return `AI news article: ${title.substring(0, 100)}...`;
  }
}

// Main processing function
async function processArticlesWithAI() {
  console.log('🤖 Starting AI processing...');
  
  // Load raw articles
  const rawDataPath = path.join(__dirname, '../data/latest-raw.json');
  const rawData = JSON.parse(await fs.readFile(rawDataPath, 'utf-8'));
  
  // Initialize AI models
  const useAI = await initializeModels();
  
  console.log(`📊 Processing ${rawData.articles.length} articles with ${useAI ? 'AI' : 'rule-based'} analysis...`);
  
  const processedArticles = [];
  const categoryStats = {};
  let duplicateCount = 0;
  
  for (let i = 0; i < rawData.articles.length; i++) {
    const article = rawData.articles[i];
    console.log(`Processing ${i+1}/${rawData.articles.length}: ${article.title.substring(0, 50)}...`);
    
    let result;
    
    if (useAI && classifier) {
      try {
        // AI-powered classification
        const classification = await classifier(article.title, categories);
        const topLabel = classification.labels[0];
        const confidence = classification.scores[0];
        
        result = {
          category: topLabel,
          confidence: confidence
        };
      } catch (error) {
        // Fallback to rule-based
        result = classifyCategory(article.title, article.source);
      }
    } else {
      // Rule-based classification
      result = classifyCategory(article.title, article.source);
    }
    
    // Extract entities
    let entities = [];
    if (useAI && ner) {
      try {
        const nerResults = await ner(article.title);
        entities = nerResults.filter(entity => entity.score > 0.8);
      } catch (error) {
        entities = extractEntities(article.title);
      }
    } else {
      entities = extractEntities(article.title);
    }
    
    // Calculate difficulty
    const difficulty = calculateDifficulty(article.title, entities);
    
    // Generate summary
    const summary = await generateSummary(article.title, useAI);
    
    // Create processed article
    const processedArticle = {
      ...article,
      category: result.category,
      confidence: result.confidence,
      difficulty: difficulty,
      entities: entities,
      summary: summary,
      language: 'en', // Default to English since we removed language detection
      processed_at: new Date().toISOString()
    };
    
    processedArticles.push(processedArticle);
    
    // Update stats
    categoryStats[result.category] = (categoryStats[result.category] || 0) + 1;
  }
  
  // Save processed data
  const outputData = {
    ...rawData,
    articles: processedArticles,
    processed_at: new Date().toISOString(),
    processing_method: useAI ? 'ai' : 'rule-based',
    category_stats: categoryStats,
    duplicates_found: duplicateCount
  };
  
  const outputPath = path.join(__dirname, '../data/latest-processed.json');
  await fs.writeFile(outputPath, JSON.stringify(outputData, null, 2));
  
  console.log(`✅ Successfully processed ${processedArticles.length} articles with ${useAI ? 'AI' : 'rule-based'} analysis`);
  console.log(`📊 Categories found:`, Object.keys(categoryStats).join(', '));
  console.log(`🔄 Duplicates found: ${duplicateCount}`);
  console.log(`💾 Saved to: ${outputPath}`);
  console.log('🎉 AI processing completed successfully!');
  
  return outputData;
}

// Run if called directly
if (import.meta.url === `file://${__filename}`) {
  processArticlesWithAI().catch(console.error);
}

export default processArticlesWithAI; 