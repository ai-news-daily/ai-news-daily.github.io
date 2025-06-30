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

let classifier, summarizer, ner, languageDetector;

// Initialize all pipelines with lightweight models
async function initializeModels() {
  console.log('🧠 Loading AI models...');
  
  try {
    // Use the smallest available models for GitHub Actions
    console.log('Loading classifier...');
    classifier = await pipeline('zero-shot-classification', 'Xenova/distilbert-base-uncased-mnli', {
      quantized: true
    });
    console.log('✓ Classifier loaded');
    
    console.log('Loading summarizer...');
    summarizer = await pipeline('summarization', 'Xenova/distilbart-cnn-6-6', {
      quantized: true
    });
    console.log('✓ Summarizer loaded');
    
    console.log('Loading NER...');
    ner = await pipeline('ner', 'Xenova/bert-base-NER', {
      quantized: true
    });
    console.log('✓ NER loaded');
    
    console.log('Loading language detector...');
    // Use a simpler language detection approach
    languageDetector = await pipeline('text-classification', 'Xenova/lang-detect-200', {
      quantized: true
    });
    console.log('✓ Language detector loaded');
    
    console.log('✅ All AI models loaded successfully');
  } catch (error) {
    console.error('❌ Failed to load models:', error);
    console.log('🔄 Falling back to lightweight models...');
    
    // Fallback to even smaller models
    try {
      classifier = await pipeline('sentiment-analysis', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english');
      console.log('✓ Fallback classifier loaded');
    } catch (fallbackError) {
      console.error('❌ Even fallback models failed:', fallbackError);
      throw fallbackError;
    }
  }
}

// Enhanced rule-based classification as backup
function classifyWithRules(title, description) {
  const text = `${title} ${description}`.toLowerCase();
  
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
    confidence: Math.min(0.6 + (bestScore * 0.08), 0.92)
  };
}

// Process articles with LLM
async function processArticles() {
  try {
    console.log('🧠 Starting AI-powered processing...');
    
    // Initialize models
    await initializeModels();
    
    // Read raw data
    const rawDataPath = path.join(__dirname, '../data/latest-raw.json');
    const rawData = JSON.parse(await fs.readFile(rawDataPath, 'utf8'));
    
    console.log(`📊 Processing ${rawData.articles.length} articles with AI...`);
    
    const processedArticles = [];
    const seenHashes = new Set();
    
    for (let i = 0; i < rawData.articles.length; i++) {
      const article = rawData.articles[i];
      
      try {
        console.log(`Processing ${i + 1}/${rawData.articles.length}: ${article.title.substring(0, 50)}...`);
        
        // Generate unique ID
        const id = crypto.createHash('md5').update(`${article.title}${article.url}`).digest('hex').substring(0, 8);
        
        // 1. Language Detection (with fallback)
        let language = 'en';
        let languageConfidence = 0.95;
        
        try {
          if (languageDetector) {
            const langResult = await languageDetector(article.title);
            if (langResult && langResult[0]) {
              language = langResult[0].label;
              languageConfidence = langResult[0].score;
            }
          }
        } catch (langError) {
          console.log(`Language detection failed, assuming English: ${langError.message}`);
        }
        
        // Skip non-English articles
        if (language !== 'en' && languageConfidence > 0.9) {
          console.log(`Skipping non-English article: ${language}`);
          continue;
        }
        
        // 2. Duplicate Detection
        const contentHash = crypto
          .createHash('md5')
          .update(article.title.toLowerCase().replace(/[^a-z0-9]/g, ''))
          .digest('hex');
        
        let duplicateOf = null;
        if (seenHashes.has(contentHash)) {
          duplicateOf = contentHash;
          console.log(`Duplicate detected: ${article.title.substring(0, 30)}...`);
        } else {
          seenHashes.add(contentHash);
        }
        
        // 3. AI Classification
        let category = 'industry-news';
        let confidence = 0.5;
        
        try {
          if (classifier) {
            const classificationText = `${article.title} ${article.metaDescription || ''}`.substring(0, 500);
            const categoryResult = await classifier(classificationText, categories, {
              multi_label: false,
              hypothesis_template: "This article is about {}"
            });
            
            if (categoryResult && categoryResult.labels && categoryResult.labels[0]) {
              category = categoryResult.labels[0];
              confidence = categoryResult.scores[0];
            }
          }
        } catch (classError) {
          console.log(`AI classification failed, using rules: ${classError.message}`);
          const ruleResult = classifyWithRules(article.title, article.metaDescription || '');
          category = ruleResult.category;
          confidence = ruleResult.confidence;
        }
        
        // 4. Entity Extraction with NER
        let entities = {
          organizations: [],
          products: [],
          technologies: []
        };
        
        try {
          if (ner) {
            const nerResult = await ner(article.title);
            if (nerResult && Array.isArray(nerResult)) {
              for (const entity of nerResult) {
                if (entity.entity_group === 'ORG' || entity.entity === 'B-ORG' || entity.entity === 'I-ORG') {
                  entities.organizations.push(entity.word);
                }
                // Add more entity types as needed
              }
            }
          }
        } catch (nerError) {
          console.log(`NER failed, using regex: ${nerError.message}`);
        }
        
        // Fallback entity extraction with regex
        const text = `${article.title} ${article.metaDescription || ''}`;
        const orgPatterns = [
          /\b(OpenAI|Anthropic|Google|Meta|Microsoft|Apple|Amazon|NVIDIA|Intel|IBM|Tesla|Salesforce)\b/gi,
          /\b(DeepMind|Hugging Face|Stability AI|Midjourney|Replicate|Cohere|Together AI)\b/gi,
          /\b(Stanford|MIT|Berkeley|Carnegie Mellon|Harvard|Oxford|Cambridge)\b/gi
        ];
        
        const productPatterns = [
          /\b(ChatGPT|GPT-[0-9]+|Claude|Gemini|LLaMA|DALL-E|Midjourney|Stable Diffusion)\b/gi,
          /\b(TensorFlow|PyTorch|Transformers|LangChain|AutoGPT|GitHub Copilot)\b/gi
        ];
        
        const techPatterns = [
          /\b(AI|Machine Learning|Deep Learning|Neural Networks|Transformer|LSTM|CNN|GAN)\b/gi,
          /\b(Natural Language Processing|Computer Vision|Reinforcement Learning|MLOps)\b/gi
        ];
        
        // Extract with regex
        for (const pattern of orgPatterns) {
          const matches = text.match(pattern) || [];
          entities.organizations.push(...matches);
        }
        
        for (const pattern of productPatterns) {
          const matches = text.match(pattern) || [];
          entities.products.push(...matches);
        }
        
        for (const pattern of techPatterns) {
          const matches = text.match(pattern) || [];
          entities.technologies.push(...matches);
        }
        
        // Clean up entities
        entities.organizations = [...new Set(entities.organizations)].slice(0, 5);
        entities.products = [...new Set(entities.products)].slice(0, 5);
        entities.technologies = [...new Set(entities.technologies)].slice(0, 8);
        
        // 5. Generate meta description
        let metaDescription = article.metaDescription;
        
        try {
          if (summarizer && !metaDescription) {
            const summaryText = article.title.length > 50 ? article.title : `${article.title}. This article discusses ${category.replace('-', ' ')}.`;
            const summary = await summarizer(summaryText, {
              max_length: 100,
              min_length: 50
            });
            
            if (summary && summary[0] && summary[0].summary_text) {
              metaDescription = summary[0].summary_text;
            }
          }
        } catch (summaryError) {
          console.log(`Summarization failed: ${summaryError.message}`);
        }
        
        if (!metaDescription) {
          metaDescription = `${article.title}. Latest ${category.replace('-', ' ')} news and updates in artificial intelligence.`;
        }
        
        // 6. Difficulty estimation
        const difficulty = estimateDifficulty(article.title, category);
        
        // Add processed article
        processedArticles.push({
          ...article,
          id,
          category,
          confidence,
          metaDescription: metaDescription.substring(0, 160),
          entities,
          difficulty,
          language,
          languageConfidence,
          duplicateOf,
          processedAt: new Date().toISOString()
        });
        
      } catch (error) {
        console.error(`Error processing article: ${error.message}`);
        
        // Add with basic processing
        processedArticles.push({
          ...article,
          id: crypto.createHash('md5').update(`${article.title}${article.url}`).digest('hex').substring(0, 8),
          category: 'industry-news',
          confidence: 0.5,
          metaDescription: article.title,
          entities: { organizations: [], products: [], technologies: [] },
          difficulty: 5,
          language: 'en',
          languageConfidence: 0.9,
          duplicateOf: null,
          error: error.message
        });
      }
    }
    
    // Create processed data structure
    const processedData = {
      processedAt: new Date().toISOString(),
      totalArticles: processedArticles.length,
      categories,
      processingMethod: 'ai-powered',
      articles: processedArticles
    };

    // Save processed data
    const outputPath = path.join(__dirname, '../data/latest-processed.json');
    await fs.writeFile(outputPath, JSON.stringify(processedData, null, 2));

    // Also save with date
    const dateStr = new Date().toISOString().split('T')[0];
    const dateOutputPath = path.join(__dirname, `../data/${dateStr}-processed.json`);
    await fs.writeFile(dateOutputPath, JSON.stringify(processedData, null, 2));

    console.log(`✅ Successfully processed ${processedArticles.length} articles with AI`);
    console.log(`📊 Categories found: ${[...new Set(processedArticles.map(a => a.category))].join(', ')}`);
    console.log(`🔄 Duplicates found: ${processedArticles.filter(a => a.duplicateOf).length}`);
    console.log(`💾 Saved to: ${outputPath}`);

    return processedData;

  } catch (error) {
    console.error('❌ AI processing failed:', error.message);
    throw error;
  }
}

// Estimate difficulty based on category and content
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

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  processArticles()
    .then(() => {
      console.log('🎉 AI processing completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 AI processing failed:', error);
      process.exit(1);
    });
}

export { processArticles }; 