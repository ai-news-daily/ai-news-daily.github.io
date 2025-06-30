import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Rule-based categorization keywords
const categoryKeywords = {
  'model-release': ['model', 'release', 'gpt', 'llama', 'claude', 'gemini', 'version', 'checkpoint', 'weights'],
  'research-paper': ['research', 'paper', 'arxiv', 'study', 'findings', 'analysis', 'investigation', 'methodology'],
  'developer-tool': ['api', 'sdk', 'framework', 'library', 'tool', 'development', 'coding', 'programming'],
  'product-launch': ['launch', 'announcing', 'introduces', 'unveils', 'product', 'feature', 'beta', 'available'],
  'tutorial-guide': ['tutorial', 'guide', 'how-to', 'learn', 'getting started', 'introduction', 'walkthrough'],
  'industry-news': ['acquisition', 'funding', 'partnership', 'market', 'industry', 'business', 'company', 'enterprise'],
  'ai-agents': ['agent', 'autonomous', 'chatbot', 'assistant', 'automation', 'workflow', 'task'],
  'creative-ai': ['art', 'image', 'video', 'music', 'creative', 'generation', 'dall-e', 'midjourney', 'stable diffusion'],
  'infrastructure': ['training', 'compute', 'gpu', 'cloud', 'infrastructure', 'scaling', 'performance', 'optimization'],
  'safety-ethics': ['safety', 'ethics', 'alignment', 'bias', 'responsible', 'governance', 'regulation', 'fairness']
};

// Organization extraction patterns
const organizationPatterns = [
  /\b(OpenAI|Anthropic|Google|Meta|Microsoft|Apple|Amazon|NVIDIA|Intel|IBM|Tesla|Salesforce)\b/gi,
  /\b(DeepMind|Hugging Face|Stability AI|Midjourney|Replicate|Cohere|Together AI)\b/gi,
  /\b(Stanford|MIT|Berkeley|Carnegie Mellon|Harvard|Oxford|Cambridge)\b/gi
];

// Product extraction patterns
const productPatterns = [
  /\b(ChatGPT|GPT-[0-9]+|Claude|Gemini|LLaMA|DALL-E|Midjourney|Stable Diffusion)\b/gi,
  /\b(TensorFlow|PyTorch|Transformers|LangChain|AutoGPT|GitHub Copilot)\b/gi,
  /\b(Kubernetes|Docker|AWS|Azure|GCP|Vercel|Netlify)\b/gi
];

// Technology extraction patterns
const technologyPatterns = [
  /\b(AI|Machine Learning|Deep Learning|Neural Networks|Transformer|LSTM|CNN|GAN)\b/gi,
  /\b(Natural Language Processing|Computer Vision|Reinforcement Learning|MLOps)\b/gi,
  /\b(Python|JavaScript|TypeScript|React|Next\.js|Node\.js|Docker|Kubernetes)\b/gi
];

// Simple rule-based classification
function classifyArticle(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  let bestCategory = 'industry-news';
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    let score = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  return {
    category: bestCategory,
    confidence: Math.min(0.6 + (bestScore * 0.1), 0.95)
  };
}

// Extract entities using regex patterns
function extractEntities(text) {
  const entities = {
    organizations: [],
    products: [],
    technologies: []
  };

  // Extract organizations
  for (const pattern of organizationPatterns) {
    const matches = text.match(pattern) || [];
    entities.organizations.push(...matches);
  }

  // Extract products
  for (const pattern of productPatterns) {
    const matches = text.match(pattern) || [];
    entities.products.push(...matches);
  }

  // Extract technologies
  for (const pattern of technologyPatterns) {
    const matches = text.match(pattern) || [];
    entities.technologies.push(...matches);
  }

  // Remove duplicates and clean up
  entities.organizations = [...new Set(entities.organizations)].slice(0, 5);
  entities.products = [...new Set(entities.products)].slice(0, 5);
  entities.technologies = [...new Set(entities.technologies)].slice(0, 8);

  return entities;
}

// Estimate difficulty based on content
function estimateDifficulty(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  let difficulty = 5; // Default medium difficulty

  // Technical indicators increase difficulty
  const technicalTerms = ['architecture', 'algorithm', 'optimization', 'implementation', 'neural', 'training'];
  const advancedTerms = ['transformer', 'attention', 'gradient', 'backpropagation', 'fine-tuning'];
  const researchTerms = ['methodology', 'empirical', 'evaluation', 'benchmark', 'baseline'];

  let score = 0;
  technicalTerms.forEach(term => text.includes(term) && score++);
  advancedTerms.forEach(term => text.includes(term) && (score += 2));
  researchTerms.forEach(term => text.includes(term) && (score += 2));

  // Beginner-friendly indicators decrease difficulty
  const beginnerTerms = ['tutorial', 'introduction', 'getting started', 'basics', 'beginner'];
  beginnerTerms.forEach(term => text.includes(term) && (score -= 2));

  difficulty = Math.max(1, Math.min(10, difficulty + score));
  return difficulty;
}

// Generate unique article ID
function generateArticleId(article) {
  const content = `${article.title}${article.url}${article.source}`;
  return crypto.createHash('md5').update(content).digest('hex').substring(0, 8);
}

// Detect duplicates
function findDuplicates(articles) {
  const duplicates = new Map();
  const titleMap = new Map();

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const normalizedTitle = article.title.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (titleMap.has(normalizedTitle)) {
      const originalIndex = titleMap.get(normalizedTitle);
      duplicates.set(i, originalIndex);
    } else {
      titleMap.set(normalizedTitle, i);
    }
  }

  return duplicates;
}

// Main processing function
async function processArticles() {
  try {
    console.log('🧠 Starting lightweight AI processing...');
    
    // Read raw data
    const rawDataPath = path.join(__dirname, '../data/latest-raw.json');
    const rawData = JSON.parse(await fs.readFile(rawDataPath, 'utf8'));
    
    console.log(`📊 Processing ${rawData.articles.length} articles...`);
    
    // Find duplicates
    const duplicates = findDuplicates(rawData.articles);
    
    // Process each article
    const processedArticles = rawData.articles.map((article, index) => {
      const id = generateArticleId(article);
      const text = `${article.title} ${article.metaDescription || ''}`;
      
      // Classify article
      const classification = classifyArticle(article.title, article.metaDescription || '');
      
      // Extract entities
      const entities = extractEntities(text);
      
      // Estimate difficulty
      const difficulty = estimateDifficulty(article.title, article.metaDescription || '');
      
      // Check for duplicates
      const duplicateOf = duplicates.has(index) ? rawData.articles[duplicates.get(index)].id : null;
      
      return {
        ...article,
        id,
        category: classification.category,
        confidence: classification.confidence,
        entities,
        difficulty,
        language: 'en',
        languageConfidence: 0.95,
        duplicateOf,
        processedAt: new Date().toISOString()
      };
    });

    // Create processed data structure
    const processedData = {
      processedAt: new Date().toISOString(),
      totalArticles: processedArticles.length,
      categories,
      processingMethod: 'rule-based',
      articles: processedArticles
    };

    // Save processed data
    const outputPath = path.join(__dirname, '../data/latest-processed.json');
    await fs.writeFile(outputPath, JSON.stringify(processedData, null, 2));

    // Also save with date
    const dateStr = new Date().toISOString().split('T')[0];
    const dateOutputPath = path.join(__dirname, `../data/${dateStr}-processed.json`);
    await fs.writeFile(dateOutputPath, JSON.stringify(processedData, null, 2));

    console.log(`✅ Successfully processed ${processedArticles.length} articles`);
    console.log(`📊 Categories found: ${[...new Set(processedArticles.map(a => a.category))].join(', ')}`);
    console.log(`🔄 Duplicates found: ${duplicates.size}`);
    console.log(`💾 Saved to: ${outputPath}`);

    return processedData;

  } catch (error) {
    console.error('❌ Processing failed:', error.message);
    
    // Fallback: copy raw data with minimal processing
    try {
      const rawDataPath = path.join(__dirname, '../data/latest-raw.json');
      const rawData = JSON.parse(await fs.readFile(rawDataPath, 'utf8'));
      
      const fallbackData = {
        processedAt: new Date().toISOString(),
        totalArticles: rawData.articles.length,
        categories,
        processingMethod: 'fallback',
        articles: rawData.articles.map(article => ({
          ...article,
          id: generateArticleId(article),
          category: 'industry-news',
          confidence: 0.5,
          entities: { organizations: [], products: [], technologies: [] },
          difficulty: 5,
          language: 'en',
          languageConfidence: 0.9,
          duplicateOf: null
        }))
      };

      const outputPath = path.join(__dirname, '../data/latest-processed.json');
      await fs.writeFile(outputPath, JSON.stringify(fallbackData, null, 2));
      
      console.log('⚠️ Used fallback processing - articles saved with basic metadata');
      return fallbackData;
      
    } catch (fallbackError) {
      console.error('❌ Fallback also failed:', fallbackError.message);
      throw fallbackError;
    }
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  processArticles()
    .then(() => {
      console.log('🎉 Article processing completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Article processing failed:', error);
      process.exit(1);
    });
}

export { processArticles }; 