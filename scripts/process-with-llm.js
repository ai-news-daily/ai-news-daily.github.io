import { pipeline, env } from '@xenova/transformers';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure transformers for offline usage
env.allowRemoteFiles = false;
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

let classifier, summarizer, ner, languageDetector;

// Initialize all pipelines
async function initializeModels() {
  console.log('🧠 Loading AI models...');
  
  try {
    // Use smaller, faster models for GitHub Actions
    classifier = await pipeline('zero-shot-classification', 'Xenova/bart-large-mnli');
    console.log('✓ Classifier loaded');
    
    // Language detection
    languageDetector = await pipeline('text-classification', 'Xenova/xlm-roberta-base-language-detection');
    console.log('✓ Language detector loaded');
    
    console.log('✅ All models loaded successfully');
  } catch (error) {
    console.error('❌ Failed to load models:', error);
    throw error;
  }
}

// Main processing function
async function processArticles(articles) {
  const processed = [];
  const seenHashes = new Set();
  
  console.log(`🔄 Processing ${articles.length} articles with AI...`);
  
  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    
    try {
      console.log(`Processing ${i + 1}/${articles.length}: ${article.title.substring(0, 50)}...`);
      
      // 1. Language Detection
      const langResult = await languageDetector(article.title);
      if (langResult[0].label !== 'en' && langResult[0].score > 0.9) {
        console.log(`Skipping non-English: ${article.title}`);
        continue;
      }
      
      // 2. Duplicate Detection
      const contentHash = crypto
        .createHash('md5')
        .update(article.title.toLowerCase().replace(/[^a-z0-9]/g, ''))
        .digest('hex');
      
      if (seenHashes.has(contentHash)) {
        console.log(`Skipping duplicate: ${article.title}`);
        continue;
      }
      seenHashes.add(contentHash);
      
      // 3. Categorization
      const categoryResult = await classifier(article.title, categories, {
        multi_label: false,
        hypothesis_template: "This article is about {}"
      });
      
      // 4. Meta Description for SEO
      const metaDesc = generateMetaDescription(article.title, categoryResult.labels[0]);
      
      // 5. Entity Extraction (simple keyword-based for now)
      const entities = extractEntities(article.title);
      
      // 6. Difficulty Estimation
      const difficulty = estimateDifficulty(article.title, categoryResult.labels[0]);
      
      // Combine all processing
      processed.push({
        ...article,
        category: categoryResult.labels[0],
        confidence: categoryResult.scores[0],
        metaDescription: metaDesc,
        entities: entities,
        difficulty: difficulty,
        language: langResult[0].label,
        languageConfidence: langResult[0].score,
        contentHash: contentHash,
        processedAt: new Date().toISOString()
      });
      
    } catch (error) {
      console.error(`Error processing ${article.title}:`, error);
      // Add with basic processing
      processed.push({
        ...article,
        category: 'industry-news',
        confidence: 0.5,
        metaDescription: article.title,
        entities: { organizations: [], products: [], people: [], technologies: [] },
        difficulty: 5,
        error: error.message
      });
    }
  }
  
  console.log(`✅ Processed ${processed.length} articles`);
  return processed;
}

// Generate SEO-friendly meta descriptions
function generateMetaDescription(title, category) {
  const categoryDescriptions = {
    'model-release': 'Latest AI model releases and updates',
    'research-paper': 'New AI research papers and findings',
    'developer-tool': 'AI development tools and frameworks',
    'product-launch': 'New AI product launches and announcements',
    'tutorial-guide': 'AI tutorials and learning resources',
    'industry-news': 'AI industry news and updates',
    'ai-agents': 'AI agents and autonomous systems',
    'creative-ai': 'AI for creativity and content generation',
    'infrastructure': 'AI infrastructure and deployment',
    'safety-ethics': 'AI safety, ethics, and governance'
  };
  
  const baseDesc = categoryDescriptions[category] || 'AI news and updates';
  const desc = `${title}. ${baseDesc}. Stay updated with the latest in artificial intelligence.`;
  
  return desc.length > 160 ? desc.substring(0, 157) + '...' : desc;
}

// Extract named entities (simple keyword-based approach)
function extractEntities(text) {
  const entities = {
    organizations: [],
    products: [],
    people: [],
    technologies: []
  };
  
  // Organization patterns
  const orgPatterns = [
    /\b(OpenAI|Anthropic|Google|Meta|Microsoft|Apple|Amazon|NVIDIA|DeepMind|Hugging Face|LangChain|Stability AI|Midjourney|Runway|Character\.AI|Cohere|Inflection|Together AI)\b/gi
  ];
  
  // Product patterns
  const productPatterns = [
    /\b(GPT-?[0-9\.]+|Claude|Gemini|LLaMA|BERT|PaLM|Bard|Copilot|DALL-E|Midjourney|Stable Diffusion|RunwayML)\b/gi
  ];
  
  // Technology patterns
  const techPatterns = [
    /\b(AI|ML|LLM|NLP|Computer Vision|Deep Learning|Machine Learning|Neural Network|Transformer|CNN|RNN|GAN|VAE|RL|Reinforcement Learning)\b/gi
  ];
  
  // Extract organizations
  for (const pattern of orgPatterns) {
    const matches = text.match(pattern) || [];
    entities.organizations.push(...matches);
  }
  
  // Extract products
  for (const pattern of productPatterns) {
    const matches = text.match(pattern) || [];
    entities.products.push(...matches);
  }
  
  // Extract technologies
  for (const pattern of techPatterns) {
    const matches = text.match(pattern) || [];
    entities.technologies.push(...matches);
  }
  
  // Remove duplicates and clean up
  entities.organizations = [...new Set(entities.organizations)];
  entities.products = [...new Set(entities.products)];
  entities.technologies = [...new Set(entities.technologies)];
  
  return entities;
}

// Enhanced difficulty estimation
function estimateDifficulty(title, category) {
  let score = 5; // Base score
  
  // Category-based adjustments
  const categoryDifficulty = {
    'research-paper': 8,
    'tutorial-guide': 3,
    'product-launch': 4,
    'developer-tool': 6,
    'model-release': 7,
    'industry-news': 4,
    'ai-agents': 7,
    'creative-ai': 5,
    'infrastructure': 8,
    'safety-ethics': 6
  };
  
  score = categoryDifficulty[category] || 5;
  
  // Adjust based on technical terms
  const technicalTerms = (title.match(/architecture|optimization|embedding|gradient|benchmark|ablation|fine-tun|hyperparameter|transformer|neural|deep learning/gi) || []).length;
  const beginnerTerms = (title.match(/introduction|beginner|basic|101|getting started|simple|easy|tutorial|guide/gi) || []).length;
  
  score += technicalTerms * 0.5;
  score -= beginnerTerms * 1.5;
  
  return Math.max(1, Math.min(10, Math.round(score)));
}

// Deduplicate articles with fuzzy matching
function findDuplicates(articles) {
  const groups = [];
  const used = new Set();
  
  for (let i = 0; i < articles.length; i++) {
    if (used.has(i)) continue;
    
    const group = [articles[i]];
    used.add(i);
    
    for (let j = i + 1; j < articles.length; j++) {
      if (used.has(j)) continue;
      
      const similarity = calculateSimilarity(
        articles[i].title.toLowerCase(),
        articles[j].title.toLowerCase()
      );
      
      if (similarity > 0.8) { // 80% similar
        group.push(articles[j]);
        used.add(j);
      }
    }
    
    if (group.length > 1) {
      groups.push(group);
    }
  }
  
  return groups;
}

function calculateSimilarity(str1, str2) {
  const words1 = new Set(str1.split(/\s+/));
  const words2 = new Set(str2.split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

// Main function to process latest crawled data
async function processLatestData() {
  try {
    // Initialize models
    await initializeModels();
    
    // Load latest raw data
    const dataDir = path.join(__dirname, '../data');
    const rawDataPath = path.join(dataDir, 'latest-raw.json');
    
    console.log('📖 Loading latest crawled data...');
    const rawData = JSON.parse(await fs.readFile(rawDataPath, 'utf-8'));
    
    // Process articles with LLM
    const processed = await processArticles(rawData.articles);
    
    // Find and mark duplicates
    const duplicateGroups = findDuplicates(processed);
    console.log(`🔍 Found ${duplicateGroups.length} duplicate groups`);
    
    // Mark duplicates
    for (const group of duplicateGroups) {
      const original = group[0]; // Keep first as original
      for (let i = 1; i < group.length; i++) {
        const duplicate = processed.find(a => a.id === group[i].id);
        if (duplicate) {
          duplicate.duplicateOf = original.id;
        }
      }
    }
    
    // Sort by confidence and publication date
    processed.sort((a, b) => {
      if (Math.abs(a.confidence - b.confidence) > 0.1) {
        return b.confidence - a.confidence;
      }
      return new Date(b.pubDate) - new Date(a.pubDate);
    });
    
    // Save processed data
    const today = new Date().toISOString().split('T')[0];
    const processedData = {
      processedAt: new Date().toISOString(),
      totalArticles: processed.length,
      duplicateGroups: duplicateGroups.length,
      categories: [...new Set(processed.map(a => a.category))],
      articles: processed
    };
    
    // Save with date
    await fs.writeFile(
      path.join(dataDir, `${today}-processed.json`),
      JSON.stringify(processedData, null, 2)
    );
    
    // Save as latest
    await fs.writeFile(
      path.join(dataDir, 'latest.json'),
      JSON.stringify(processedData, null, 2)
    );
    
    console.log(`💾 Saved processed data: ${processed.length} articles`);
    
    // Print summary
    const categoryStats = {};
    processed.forEach(article => {
      categoryStats[article.category] = (categoryStats[article.category] || 0) + 1;
    });
    
    console.log('\n📊 Category breakdown:');
    Object.entries(categoryStats).forEach(([cat, count]) => {
      console.log(`  ${cat}: ${count}`);
    });
    
    return processed;
    
  } catch (error) {
    console.error('❌ Processing failed:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  processLatestData()
    .then(articles => {
      console.log(`✅ Processing complete! ${articles.length} articles ready`);
    })
    .catch(error => {
      console.error('❌ Processing failed:', error);
      process.exit(1);
    });
}

export { processLatestData, processArticles, findDuplicates }; 