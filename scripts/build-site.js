import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Time ago helper
function timeAgo(dateString) {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Generate article HTML - simple version without AI processing for now
function generateArticleHTML(article) {
  const entities = article.entities || [];
  const summary = article.summary || '';
  const difficulty = article.difficulty || 5;
  const confidence = article.confidence || 0;
  const confidenceIcon = confidence > 0.8 ? '✅' : '❓';
  const confidenceTitle = confidence > 0.8 ? 'High confidence AI categorization' : 'Lower confidence - manual review suggested';
  
  // Group entities by type
  const orgEntities = entities.filter(e => e.entity.includes('ORG')).map(e => e.word).filter((v, i, a) => a.indexOf(v) === i);
  const productEntities = entities.filter(e => e.entity.includes('PRODUCT') || e.entity.includes('MISC')).map(e => e.word).filter((v, i, a) => a.indexOf(v) === i);
  const techEntities = entities.filter(e => e.entity.includes('TECH') || e.entity.includes('PER')).map(e => e.word).filter((v, i, a) => a.indexOf(v) === i);
  
  return `
    <article class="news-item" data-category="${article.category || article.source_category}" data-source="${article.source_category}" data-difficulty="${difficulty <= 3 ? 'easy' : difficulty <= 7 ? 'medium' : 'hard'}">
      <div class="source-bar">
        <img src="https://www.google.com/s2/favicons?domain=${article.source_domain}" alt="${article.source}" width="16" height="16">
        <span class="source-name">${article.source}</span>
        <time class="pub-time">${timeAgo(article.pubDate)}</time>
      </div>
      
      <h3 class="article-title">
        <a href="${article.url}" target="_blank" rel="noopener" title="${article.title}">
          ${article.title} ↗
        </a>
      </h3>
      
      ${summary ? `<p class="article-summary">${summary.trim()}</p>` : ''}
      
      ${entities.length > 0 ? `
      <div class="entities">
        ${orgEntities.map(entity => `<span class="entity-tag org">${entity}</span>`).join('')}
        ${productEntities.map(entity => `<span class="entity-tag product">${entity}</span>`).join('')}
        ${techEntities.map(entity => `<span class="entity-tag tech">${entity}</span>`).join('')}
      </div>
      ` : ''}
      
      <div class="metadata">
        <span class="category category-${(article.category || article.source_category).replace(/[^a-z0-9]/gi, '-')}">${article.category || article.source_category}</span>
        <span class="difficulty" title="Difficulty level: ${difficulty}/10">★${difficulty}</span>
        <span class="confidence" title="${confidenceTitle}">${confidenceIcon}</span>
      </div>
    </article>
  `;
}

// Get available dates from data directory
async function getAvailableDates() {
  const dataDir = path.join(__dirname, '../data');
  const files = await fs.readdir(dataDir);
  
  // Find all processed files with date format YYYY-MM-DD-processed.json
  const dateFiles = files
    .filter(file => file.match(/^\d{4}-\d{2}-\d{2}-processed\.json$/))
    .map(file => file.replace('-processed.json', ''))
    .sort()
    .reverse(); // Most recent first
  
  return dateFiles;
}

// Load data for a specific date
async function loadDateData(date = null) {
  const dataDir = path.join(__dirname, '../data');
  
  if (date) {
    // Load specific date
    const dateFile = path.join(dataDir, `${date}-processed.json`);
    try {
      return JSON.parse(await fs.readFile(dateFile, 'utf-8'));
    } catch (error) {
      console.log(`⚠️ No data found for ${date}, falling back to latest`);
    }
  }
  
  // Load latest
  const processedPath = path.join(dataDir, 'latest-processed.json');
  const rawPath = path.join(dataDir, 'latest-raw.json');
  
  try {
    return JSON.parse(await fs.readFile(processedPath, 'utf-8'));
  } catch (error) {
    console.log('⚠️ AI-processed data not found, using raw data');
    return JSON.parse(await fs.readFile(rawPath, 'utf-8'));
  }
}

// Main build function
async function buildSite(selectedDate = null) {
  console.log('🏗️ Building static site...');
  
  try {
    console.log('📖 Loading crawled data...');
    
    // Get available dates and load data
    const availableDates = await getAvailableDates();
    const articlesData = await loadDateData(selectedDate);
    
    if (selectedDate) {
      console.log(`✅ Using data for ${selectedDate}`);
    } else {
      console.log('✅ Using latest AI-processed data');
    }
    
    const articles = articlesData.articles || [];
    const crawledAt = articlesData.crawledAt || new Date().toISOString();
    
    console.log(`📊 Found ${articles.length} articles`);
    
    // Get category statistics with AI categories
    const categoryStats = {};
    const sourceStats = {};
    const difficultyStats = { easy: 0, medium: 0, hard: 0 };
    
    articles.forEach(article => {
      const category = article.category || article.source_category || 'uncategorized';
      const source = article.source_category || 'other';
      const difficulty = article.difficulty || 5;
      
      categoryStats[category] = (categoryStats[category] || 0) + 1;
      sourceStats[source] = (sourceStats[source] || 0) + 1;
      
      if (difficulty <= 3) difficultyStats.easy++;
      else if (difficulty <= 7) difficultyStats.medium++;
      else difficultyStats.hard++;
    });
    
    console.log('🎨 Generating HTML...');
    
    // Generate the full HTML
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI News Daily - Latest AI News from 50+ Sources</title>
  <meta name="description" content="AI news aggregator collecting ${articles.length} articles from ${Object.keys(sourceStats).length}+ sources. Updated ${new Date(crawledAt).toLocaleDateString()}.">
  
  <!-- Open Graph -->
  <meta property="og:title" content="AI News Daily - Latest AI News Aggregator">
  <meta property="og:description" content="AI news aggregator from ${Object.keys(sourceStats).length}+ sources including Reddit, arXiv, tech blogs, and YouTube">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://ai-news-daily.github.io">
  
  <!-- Favicon -->
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🤖</text></svg>">
  
  <!-- Bootstrap CSS -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet" integrity="sha384-T3c6CoIi6uLrA9TneNEoa7RxnatzjcDSCmG1MXxSR1GAsXEV/Dwwykc2MPK8M2HN" crossorigin="anonymous">
  
  <!-- Custom Styles -->
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <!-- Bootstrap Navbar -->
  <nav class="navbar navbar-expand-lg navbar-dark custom-navbar fixed-top">
    <div class="container-fluid">
      <!-- Brand -->
      <a class="navbar-brand d-flex align-items-center" href="#">
        <div class="logo-icon me-2">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <!-- Background with modern gradient -->
            <rect width="32" height="32" rx="10" fill="url(#modernGradient)"/>
            
            <!-- Neural network nodes -->
            <circle cx="8" cy="10" r="2" fill="#00D9FF" opacity="0.9"/>
            <circle cx="16" cy="8" r="1.5" fill="#FFB800" opacity="0.8"/>
            <circle cx="24" cy="11" r="1.5" fill="#00FFB8" opacity="0.8"/>
            <circle cx="12" cy="18" r="1.5" fill="#FF6B9D" opacity="0.8"/>
            <circle cx="20" cy="20" r="2" fill="#00D9FF" opacity="0.9"/>
            <circle cx="24" cy="24" r="1.5" fill="#FFB800" opacity="0.8"/>
            
            <!-- Neural connections -->
            <path d="M8 10L16 8M16 8L24 11M8 10L12 18M16 8L20 20M24 11L20 20M12 18L20 20M20 20L24 24" 
                  stroke="rgba(255,255,255,0.4)" stroke-width="1" opacity="0.7"/>
            
            <!-- RSS/News waves -->
            <path d="M6 24c0-4 2-8 6-8s6 4 6 8" stroke="white" stroke-width="1.5" fill="none" opacity="0.6"/>
            <path d="M6 26c0-2 1-4 3-4s3 2 3 4" stroke="white" stroke-width="1.5" fill="none" opacity="0.8"/>
            <circle cx="6" cy="26" r="1" fill="white" opacity="0.9"/>
            
            <defs>
              <linearGradient id="modernGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#1e3a8a;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#3730a3;stop-opacity:1" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div class="brand-text">
          <div class="brand-title">AI News Daily</div>
          <div class="brand-subtitle d-none d-sm-block">Curated AI news from ${Object.keys(sourceStats).length}+ sources • Updated ${new Date(crawledAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
        </div>
      </a>

            <!-- Desktop Controls (visible on lg+) -->
      <div class="d-none d-lg-flex align-items-center gap-3 flex-grow-1 justify-content-end">
        <!-- Search -->
        <div class="input-group" style="max-width: 300px;">
          <input type="text" id="searchInput" class="form-control" placeholder="Search articles...">
          <button id="clearSearch" class="btn btn-outline-secondary">Clear</button>
        </div>
        
        <!-- Date Selector -->
        <select id="dateSelect" class="form-select" style="max-width: 150px;" title="Select date">
          <option value="">Latest</option>
          ${availableDates.map(date => 
            `<option value="${date}" ${selectedDate === date ? 'selected' : ''}>${new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</option>`
          ).join('')}
        </select>
        
        <!-- Theme Toggle -->
        <button id="themeToggle" class="btn btn-outline-light" title="Toggle theme">
          <span class="theme-icon">🌙</span>
        </button>
        
        <!-- Stats -->
        <div class="text-light small">
          <span id="showCount">${articles.length}</span> of <span id="totalCount">${articles.length}</span> articles
        </div>
      </div>

      <!-- Mobile Toggle Button -->
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarCollapse" aria-controls="navbarCollapse" aria-expanded="false" aria-label="Toggle navigation">
        <span class="navbar-toggler-icon"></span>
      </button>

      <!-- Collapsible content -->
      <div class="collapse navbar-collapse" id="navbarCollapse">
        <div class="navbar-nav ms-auto">
          <!-- Mobile Search -->
          <div class="nav-item p-2 d-lg-none">
            <div class="input-group">
              <input type="text" id="searchInputMobile" class="form-control" placeholder="Search articles...">
              <button id="clearSearchMobile" class="btn btn-outline-secondary">Clear</button>
            </div>
          </div>

          <!-- Mobile Controls -->
          <div class="nav-item p-2 d-lg-none">
            <div class="d-flex gap-2 align-items-center flex-wrap">
              <select id="dateSelectMobile" class="form-select form-select-sm" style="max-width: 150px;">
                <option value="">Latest</option>
                ${availableDates.map(date => 
                  `<option value="${date}" ${selectedDate === date ? 'selected' : ''}>${new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</option>`
                ).join('')}
              </select>
              
              <button id="themeToggleMobile" class="btn btn-outline-light btn-sm">
                <span class="theme-icon">🌙</span>
              </button>
              
              <div class="text-light small">
                <span id="showCountMobile">${articles.length}</span> of <span id="totalCountMobile">${articles.length}</span>
              </div>
            </div>
          </div>
          
          <!-- Mobile Filters -->
          <div class="nav-item p-2 d-lg-none">
            <div class="accordion accordion-flush" id="mobileFiltersAccordion">
              <!-- Categories -->
              <div class="accordion-item bg-transparent">
                <h2 class="accordion-header">
                  <button class="accordion-button collapsed bg-transparent text-light border-0" type="button" data-bs-toggle="collapse" data-bs-target="#categoriesCollapse">
                    Categories
                  </button>
                </h2>
                <div id="categoriesCollapse" class="accordion-collapse collapse" data-bs-parent="#mobileFiltersAccordion">
                  <div class="accordion-body">
                    <div class="d-flex flex-wrap gap-1">
                      <button class="btn btn-sm btn-primary filter-btn active" data-category="all">All (${articles.length})</button>
                      ${Object.entries(categoryStats)
                        .sort(([,a], [,b]) => b - a)
                        .map(([category, count]) => 
                          `<button class="btn btn-sm btn-outline-light filter-btn" data-category="${category}">${category.replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase())} (${count})</button>`
                        ).join('')}
                    </div>
                  </div>
                </div>
              </div>
              
              <!-- Sources -->
              <div class="accordion-item bg-transparent">
                <h2 class="accordion-header">
                  <button class="accordion-button collapsed bg-transparent text-light border-0" type="button" data-bs-toggle="collapse" data-bs-target="#sourcesCollapse">
                    Sources
                  </button>
                </h2>
                <div id="sourcesCollapse" class="accordion-collapse collapse" data-bs-parent="#mobileFiltersAccordion">
                  <div class="accordion-body">
                    <div class="d-flex flex-wrap gap-1">
                      <button class="btn btn-sm btn-primary filter-btn active" data-source="all">All Sources</button>
                      ${Object.entries(sourceStats)
                        .sort(([,a], [,b]) => b - a)
                        .map(([source, count]) => 
                          `<button class="btn btn-sm btn-outline-light filter-btn" data-source="${source}">${source.charAt(0).toUpperCase() + source.slice(1)} (${count})</button>`
                        ).join('')}
                    </div>
                  </div>
                </div>
              </div>
               
              <!-- Difficulty Level -->
              <div class="accordion-item bg-transparent">
                <h2 class="accordion-header">
                  <button class="accordion-button collapsed bg-transparent text-light border-0" type="button" data-bs-toggle="collapse" data-bs-target="#difficultyCollapse">
                    Difficulty Level
                  </button>
                </h2>
                <div id="difficultyCollapse" class="accordion-collapse collapse" data-bs-parent="#mobileFiltersAccordion">
                  <div class="accordion-body">
                    <div class="d-flex flex-wrap gap-1">
                      <button class="btn btn-sm btn-primary filter-btn active" data-difficulty="all">All Levels</button>
                      <button class="btn btn-sm btn-outline-light filter-btn" data-difficulty="easy">Easy (${articles.filter(a => a.difficulty <= 3).length})</button>
                      <button class="btn btn-sm btn-outline-light filter-btn" data-difficulty="medium">Medium (${articles.filter(a => a.difficulty > 3 && a.difficulty <= 7).length})</button>
                      <button class="btn btn-sm btn-outline-light filter-btn" data-difficulty="hard">Hard (${articles.filter(a => a.difficulty > 7).length})</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </nav>

  <!-- Main Content with Bootstrap Layout -->
  <div class="container-fluid main-container">
    <div class="row">
      <!-- Desktop Sidebar Filters -->
      <div class="col-lg-3 d-none d-lg-block sidebar-filters">
        <div class="filters-content">
          <!-- Categories Card -->
          <div class="card bg-dark border-secondary mb-3">
            <div class="card-header">
              <h6 class="mb-0 text-light">Categories</h6>
            </div>
            <div class="card-body">
              <div class="d-flex flex-wrap gap-1">
                <button class="btn btn-sm btn-primary filter-btn active" data-category="all">All (${articles.length})</button>
                ${Object.entries(categoryStats)
                  .sort(([,a], [,b]) => b - a)
                  .map(([category, count]) => 
                    `<button class="btn btn-sm btn-outline-light filter-btn" data-category="${category}">${category.replace(/([A-Z])/g, ' $1').trim().replace(/^./, str => str.toUpperCase())} (${count})</button>`
                  ).join('')}
              </div>
            </div>
          </div>

          <!-- Sources Card -->
          <div class="card bg-dark border-secondary mb-3">
            <div class="card-header">
              <h6 class="mb-0 text-light">Sources</h6>
            </div>
            <div class="card-body">
              <div class="d-flex flex-wrap gap-1">
                <button class="btn btn-sm btn-primary filter-btn active" data-source="all">All Sources</button>
                ${Object.entries(sourceStats)
                  .sort(([,a], [,b]) => b - a)
                  .map(([source, count]) => 
                    `<button class="btn btn-sm btn-outline-light filter-btn" data-source="${source}">${source.charAt(0).toUpperCase() + source.slice(1)} (${count})</button>`
                  ).join('')}
              </div>
            </div>
          </div>

          <!-- Difficulty Card -->
          <div class="card bg-dark border-secondary mb-3">
            <div class="card-header">
              <h6 class="mb-0 text-light">Difficulty Level</h6>
            </div>
            <div class="card-body">
              <div class="d-flex flex-wrap gap-1">
                <button class="btn btn-sm btn-primary filter-btn active" data-difficulty="all">All Levels</button>
                <button class="btn btn-sm btn-outline-light filter-btn" data-difficulty="easy">Easy (${articles.filter(a => a.difficulty <= 3).length})</button>
                <button class="btn btn-sm btn-outline-light filter-btn" data-difficulty="medium">Medium (${articles.filter(a => a.difficulty > 3 && a.difficulty <= 7).length})</button>
                <button class="btn btn-sm btn-outline-light filter-btn" data-difficulty="hard">Hard (${articles.filter(a => a.difficulty > 7).length})</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Content -->
      <div class="col-lg-9">
        <main class="main-content">
          <!-- Articles Grid -->
          <div class="articles-grid" id="articlesGrid">
            ${articles.map(article => generateArticleHTML(article)).join('')}
          </div>
          
          <!-- Load More Button -->
          <button id="loadMoreBtn" class="btn btn-primary btn-lg d-block mx-auto mt-4">Load More Articles</button>
        </main>
      </div>
    </div>
  </div>
       
   <!-- Footer -->
   <footer class="site-footer">
     <div class="container">
       <p class="mb-0 text-center">© 2025 AI News Daily • Automated Intelligence</p>
     </div>
   </footer>

  <!-- Bootstrap JS -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js" integrity="sha384-C6RzsynM9kWDrMNeT87bh95OGNyZPhcTNXj1NW7RuBCsyN/o0jlpcV8Qyq46cDfL" crossorigin="anonymous"></script>
  
  <!-- Custom Scripts -->
  <script src="app.js"></script>
</body>
</html>`;

    // Write the HTML file
    const siteDir = path.join(__dirname, '../site');
    await fs.mkdir(siteDir, { recursive: true });
    await fs.writeFile(path.join(siteDir, 'index.html'), html);
    
    // Write the main data.json for the frontend
    await fs.writeFile(
      path.join(siteDir, 'data.json'), 
      JSON.stringify(articlesData, null, 2)
    );
    
    // Write available dates list for frontend
    await fs.writeFile(
      path.join(siteDir, 'dates.json'), 
      JSON.stringify({ availableDates }, null, 2)
    );
    
    // Copy individual date files for client-side access
    const dataDir = path.join(siteDir, 'data');
    await fs.mkdir(dataDir, { recursive: true });
    
    for (const date of availableDates) {
      const sourceFile = path.join(__dirname, `../data/${date}-processed.json`);
      const targetFile = path.join(dataDir, `${date}.json`);
      try {
        const dateData = await fs.readFile(sourceFile, 'utf-8');
        await fs.writeFile(targetFile, dateData);
      } catch (error) {
        console.log(`⚠️ Could not copy ${date} data file`);
      }
    }
    
    console.log('✅ Site built successfully!');
    console.log(`📊 Generated page with ${articles.length} articles`);
    console.log(`📈 Categories: ${Object.keys(categoryStats).length}`);
    console.log(`🔗 Sources: ${Object.keys(sourceStats).length}`);
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  buildSite()
    .then(() => {
      console.log('✅ Build complete! All features restored');
    })
    .catch((error) => {
      console.error('❌ Build failed:', error);
      process.exit(1);
    });
}

export default buildSite; 