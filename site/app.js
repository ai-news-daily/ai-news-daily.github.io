// State management
let allArticles = [];
let filteredArticles = [];
let currentPage = 0;
const articlesPerPage = 20;

// DOM elements
const articlesGrid = document.getElementById('articlesGrid');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearch');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const showCount = document.getElementById('showCount');
const totalCount = document.getElementById('totalCount');
const themeToggle = document.getElementById('themeToggle');
const dateSelect = document.getElementById('dateSelect');

// Filters state
const filters = {
  category: 'all',
  source: 'all',
  difficulty: 'all',
  search: ''
};

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadData();
    setupEventListeners();
    initializeTheme();
    updateFilterCounts(); // Initialize filter counts
    applyFilters();
    updateDisplay();
  } catch (error) {
    console.error('Failed to initialize app:', error);
    showError('Failed to load articles. Please refresh the page.');
  }
});

// Load article data for a specific date or latest
async function loadData(selectedDate = null) {
  try {
    let dataUrl = 'data.json'; // Default to latest
    
    if (selectedDate) {
      dataUrl = `data/${selectedDate}.json`;
    }
    
    const response = await fetch(dataUrl);
    const data = await response.json();
    allArticles = data.articles;
    filteredArticles = [...allArticles];
    
    console.log(`✅ Loaded ${allArticles.length} articles${selectedDate ? ` for ${selectedDate}` : ''}`);
    console.log('📊 Source categories:', Object.keys(allArticles.reduce((acc, a) => { acc[a.source_category] = true; return acc; }, {})));
    console.log('🤖 AI categories:', Object.keys(allArticles.reduce((acc, a) => { acc[a.category] = true; return acc; }, {})));
  } catch (error) {
    console.error(`❌ Failed to load data${selectedDate ? ` for ${selectedDate}` : ''}:`, error);
    
    // If date-specific load fails, try latest
    if (selectedDate) {
      console.log('🔄 Falling back to latest data...');
      await loadData(); // Recursive call without date
      return;
    }
    
    throw error;
  }
}

// Handle date selection change
async function handleDateChange(event) {
  const selectedDate = event.target.value;
  
  try {
    // Show loading state
    articlesGrid.innerHTML = '<div class="loading">Loading articles...</div>';
    
    // Load new data
    await loadData(selectedDate || null);
    
    // Reset filters and pagination
    currentPage = 0;
    filters.search = '';
    if (searchInput) searchInput.value = '';
    
    // Reset filter buttons to "all"
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.category === 'all' || btn.dataset.source === 'all' || btn.dataset.difficulty === 'all') {
        btn.classList.add('active');
      }
    });
    
    filters.category = 'all';
    filters.source = 'all';
    filters.difficulty = 'all';
    
    // Update display
    updateFilterCounts();
    applyFilters();
    updateDisplay();
    
    console.log(`✅ Switched to ${selectedDate || 'latest'} data`);
  } catch (error) {
    console.error('❌ Failed to change date:', error);
    showError('Failed to load articles for selected date. Please try again.');
  }
}

// Setup event listeners
function setupEventListeners() {
  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', handleFilterClick);
  });
  
  // Filter section toggles
  document.querySelectorAll('.filter-header').forEach(header => {
    header.addEventListener('click', handleFilterToggle);
  });
  
  // Search
  searchInput.addEventListener('input', debounce(handleSearch, 300));
  clearSearchBtn.addEventListener('click', clearSearch);
  
  // Date selection
  if (dateSelect) {
    dateSelect.addEventListener('change', handleDateChange);
  }
  
  // Theme toggle
  themeToggle.addEventListener('click', toggleTheme);
  
  // Load more
  loadMoreBtn.addEventListener('click', loadMore);
  
  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboard);
  
  // Initialize mobile filter state
  initializeMobileFilters();
}

// Handle filter button clicks
function handleFilterClick(event) {
  const btn = event.target;
  const filterType = btn.dataset.category ? 'category' : 
                    btn.dataset.source ? 'source' : 'difficulty';
  const filterValue = btn.dataset.category || btn.dataset.source || btn.dataset.difficulty;
  
  // Remove active class from siblings
  btn.parentElement.querySelectorAll('.filter-btn').forEach(b => {
    b.classList.remove('active');
  });
  
  // Add active class to clicked button
  btn.classList.add('active');
  
  // Update filter state
  filters[filterType] = filterValue;
  
  // Apply filters and reset pagination
  currentPage = 0;
  applyFilters();
  updateDisplay();
}

// Handle filter section toggle (mobile collapse/expand)
function handleFilterToggle(event) {
  const header = event.target.closest('.filter-header');
  const filterGroup = header.parentElement;
  
  // Toggle expanded state
  filterGroup.classList.toggle('expanded');
  
  // Update toggle icon
  const toggle = header.querySelector('.filter-toggle');
  if (filterGroup.classList.contains('expanded')) {
    toggle.textContent = '▼';
  } else {
    toggle.textContent = '▶';
  }
}

// Initialize mobile filter state (collapsed by default on mobile)
function initializeMobileFilters() {
  const isMobile = window.innerWidth <= 768;
  
  if (isMobile) {
    // Collapse all filter groups on mobile
    document.querySelectorAll('.filter-group').forEach(group => {
      group.classList.remove('expanded');
      const toggle = group.querySelector('.filter-toggle');
      if (toggle) {
        toggle.textContent = '▶';
      }
    });
  } else {
    // Expand all filter groups on desktop
    document.querySelectorAll('.filter-group').forEach(group => {
      group.classList.add('expanded');
      const toggle = group.querySelector('.filter-toggle');
      if (toggle) {
        toggle.textContent = '▼';
      }
    });
  }
}

// Handle window resize to reinitialize mobile state
window.addEventListener('resize', debounce(() => {
  initializeMobileFilters();
}, 250));

// Handle search input
function handleSearch(event) {
  filters.search = event.target.value.toLowerCase().trim();
  currentPage = 0;
  applyFilters();
  updateDisplay();
}

// Clear search
function clearSearch() {
  searchInput.value = '';
  filters.search = '';
  currentPage = 0;
  applyFilters();
  updateDisplay();
}

// Apply all filters
function applyFilters() {
  filteredArticles = allArticles.filter(article => {
    // Category filter - prioritize source categories since filter buttons are based on them
    if (filters.category !== 'all') {
      // Check source category first (what the filter buttons are based on)
      const matchesSourceCategory = article.source_category === filters.category;
      const matchesAICategory = article.category === filters.category;
      
      if (!matchesSourceCategory && !matchesAICategory) {
        return false;
      }
    }
    
    // Source filter
    if (filters.source !== 'all' && article.source_category !== filters.source) {
      return false;
    }
    
    // Difficulty filter
    if (filters.difficulty !== 'all' && article.difficulty) {
      const difficulty = article.difficulty;
      if (filters.difficulty === 'easy' && difficulty > 3) return false;
      if (filters.difficulty === 'medium' && (difficulty < 4 || difficulty > 7)) return false;
      if (filters.difficulty === 'hard' && difficulty < 8) return false;
    }
    
    // Search filter
    if (filters.search) {
      const entities = article.entities || {};
      const searchableText = [
        article.title,
        article.source,
        article.category || article.source_category,
        ...(entities.organizations || []),
        ...(entities.products || []),
        ...(entities.technologies || [])
      ].join(' ').toLowerCase();
      
      if (!searchableText.includes(filters.search)) {
        return false;
      }
    }
    
    return true;
  });
  
  // Update filter button counts dynamically
  updateFilterCounts();
  
  console.log(`✅ Filtered to ${filteredArticles.length} articles`);
}

// Update filter button counts dynamically
function updateFilterCounts() {
  // Update source type counts
  document.querySelectorAll('[data-source]').forEach(btn => {
    const sourceType = btn.dataset.source;
    if (sourceType === 'all') {
      // Show current filtered count for "All Sources" button
      const currentCount = allArticles.filter(article => {
        if (filters.category !== 'all') {
          const matchesSourceCategory = article.source_category === filters.category;
          const matchesAICategory = article.category === filters.category;
          if (!matchesSourceCategory && !matchesAICategory) return false;
        }
        if (filters.difficulty !== 'all' && article.difficulty) {
          const difficulty = article.difficulty;
          if (filters.difficulty === 'easy' && difficulty > 3) return false;
          if (filters.difficulty === 'medium' && (difficulty < 4 || difficulty > 7)) return false;
          if (filters.difficulty === 'hard' && difficulty < 8) return false;
        }
        if (filters.search) {
          const searchableText = [
            article.title, article.source, article.category || article.source_category,
            ...(article.entities?.organizations || []), ...(article.entities?.products || []),
            ...(article.entities?.technologies || [])
          ].join(' ').toLowerCase();
          if (!searchableText.includes(filters.search)) return false;
        }
        return true;
      }).length;
      btn.textContent = `All Sources (${currentCount})`;
      return;
    }
    
    // Count articles that match current filters + this source type
    const count = allArticles.filter(article => {
      // Apply all current filters except source
      if (filters.category !== 'all') {
        const matchesSourceCategory = article.source_category === filters.category;
        const matchesAICategory = article.category === filters.category;
        if (!matchesSourceCategory && !matchesAICategory) return false;
      }
      
      if (filters.difficulty !== 'all' && article.difficulty) {
        const difficulty = article.difficulty;
        if (filters.difficulty === 'easy' && difficulty > 3) return false;
        if (filters.difficulty === 'medium' && (difficulty < 4 || difficulty > 7)) return false;
        if (filters.difficulty === 'hard' && difficulty < 8) return false;
      }
      
      if (filters.search) {
        const searchableText = [
          article.title, article.source, article.category || article.source_category,
          ...(article.entities?.organizations || []), ...(article.entities?.products || []),
          ...(article.entities?.technologies || [])
        ].join(' ').toLowerCase();
        if (!searchableText.includes(filters.search)) return false;
      }
      
      // Apply this specific source filter
      return article.source_category === sourceType;
    }).length;
    
    btn.textContent = `${sourceType} (${count})`;
  });
  
  // Update difficulty counts
  document.querySelectorAll('[data-difficulty]').forEach(btn => {
    const difficultyLevel = btn.dataset.difficulty;
    if (difficultyLevel === 'all') {
      // Show current filtered count for "All Levels" button
      const currentCount = allArticles.filter(article => {
        if (filters.category !== 'all') {
          const matchesSourceCategory = article.source_category === filters.category;
          const matchesAICategory = article.category === filters.category;
          if (!matchesSourceCategory && !matchesAICategory) return false;
        }
        if (filters.source !== 'all' && article.source_category !== filters.source) return false;
        if (filters.search) {
          const searchableText = [
            article.title, article.source, article.category || article.source_category,
            ...(article.entities?.organizations || []), ...(article.entities?.products || []),
            ...(article.entities?.technologies || [])
          ].join(' ').toLowerCase();
          if (!searchableText.includes(filters.search)) return false;
        }
        return true;
      }).length;
      btn.textContent = `All Levels (${currentCount})`;
      return;
    }
    
    const count = allArticles.filter(article => {
      // Apply all current filters except difficulty
      if (filters.category !== 'all') {
        const matchesSourceCategory = article.source_category === filters.category;
        const matchesAICategory = article.category === filters.category;
        if (!matchesSourceCategory && !matchesAICategory) return false;
      }
      
      if (filters.source !== 'all' && article.source_category !== filters.source) return false;
      
      if (filters.search) {
        const searchableText = [
          article.title, article.source, article.category || article.source_category,
          ...(article.entities?.organizations || []), ...(article.entities?.products || []),
          ...(article.entities?.technologies || [])
        ].join(' ').toLowerCase();
        if (!searchableText.includes(filters.search)) return false;
      }
      
      // Apply this specific difficulty filter
      if (!article.difficulty) return false;
      const difficulty = article.difficulty;
      if (difficultyLevel === 'easy' && difficulty > 3) return false;
      if (difficultyLevel === 'medium' && (difficulty < 4 || difficulty > 7)) return false;
      if (difficultyLevel === 'hard' && difficulty < 8) return false;
      
      return true;
    }).length;
    
    const label = difficultyLevel.charAt(0).toUpperCase() + difficultyLevel.slice(1);
    btn.textContent = `${label} (${count})`;
  });
  
  // Update category counts  
  document.querySelectorAll('[data-category]').forEach(btn => {
    const categoryType = btn.dataset.category;
    if (categoryType === 'all') {
      // Show current filtered count for "All" button
      const currentCount = allArticles.filter(article => {
        if (filters.source !== 'all' && article.source_category !== filters.source) return false;
        if (filters.difficulty !== 'all' && article.difficulty) {
          const difficulty = article.difficulty;
          if (filters.difficulty === 'easy' && difficulty > 3) return false;
          if (filters.difficulty === 'medium' && (difficulty < 4 || difficulty > 7)) return false;
          if (filters.difficulty === 'hard' && difficulty < 8) return false;
        }
        if (filters.search) {
          const searchableText = [
            article.title, article.source, article.category || article.source_category,
            ...(article.entities?.organizations || []), ...(article.entities?.products || []),
            ...(article.entities?.technologies || [])
          ].join(' ').toLowerCase();
          if (!searchableText.includes(filters.search)) return false;
        }
        return true;
      }).length;
      btn.textContent = `All (${currentCount})`;
      return;
    }
    
    const count = allArticles.filter(article => {
      // Apply all current filters except category
      if (filters.source !== 'all' && article.source_category !== filters.source) return false;
      
      if (filters.difficulty !== 'all' && article.difficulty) {
        const difficulty = article.difficulty;
        if (filters.difficulty === 'easy' && difficulty > 3) return false;
        if (filters.difficulty === 'medium' && (difficulty < 4 || difficulty > 7)) return false;
        if (filters.difficulty === 'hard' && difficulty < 8) return false;
      }
      
      if (filters.search) {
        const searchableText = [
          article.title, article.source, article.category || article.source_category,
          ...(article.entities?.organizations || []), ...(article.entities?.products || []),
          ...(article.entities?.technologies || [])
        ].join(' ').toLowerCase();
        if (!searchableText.includes(filters.search)) return false;
      }
      
      // Apply this specific category filter
      const matchesSourceCategory = article.source_category === categoryType;
      const matchesAICategory = article.category === categoryType;
      return matchesSourceCategory || matchesAICategory;
    }).length;
    
    btn.textContent = `${categoryType.replace('-', ' ')} (${count})`;
  });
}

// Update display
function updateDisplay() {
  // Clear current articles
  articlesGrid.innerHTML = '';
  
  // Show filtered articles (paginated)
  const articlesToShow = filteredArticles.slice(0, (currentPage + 1) * articlesPerPage);
  
  if (articlesToShow.length === 0) {
    showEmptyState();
    return;
  }
  
  articlesToShow.forEach(article => {
    const articleElement = createArticleElement(article);
    articlesGrid.appendChild(articleElement);
  });
  
  // Update counters
  showCount.textContent = articlesToShow.length;
  totalCount.textContent = filteredArticles.length;
  
  // Update load more button
  const hasMore = articlesToShow.length < filteredArticles.length;
  loadMoreBtn.style.display = hasMore ? 'block' : 'none';
  loadMoreBtn.disabled = !hasMore;
}

// Create article DOM element - full AI-enhanced version
function createArticleElement(article) {
  const articleDiv = document.createElement('article');
  articleDiv.className = 'news-item';
  
  // Use source category for display since that's what filters are based on
  const category = article.source_category || article.category;
  const difficulty = article.difficulty || 5;
  const confidence = article.confidence || 0.5;
  
  articleDiv.dataset.category = category;
  articleDiv.dataset.difficulty = difficulty;
  articleDiv.dataset.source = article.source_category;
  
  // AI-enhanced features
  const duplicateBadge = article.duplicateOf ? '<span class="duplicate-badge">Duplicate</span>' : '';
  const difficultyDots = '●'.repeat(difficulty) + '○'.repeat(10 - difficulty);
  const confidenceIcon = confidence > 0.8 ? '✓' : '?';
  
  // Entity tags - safely handle undefined arrays
  const entities = article.entities || {};
  const entityTags = [
    ...(entities.organizations || []).map(org => `<span class="entity-tag org">${org}</span>`),
    ...(entities.products || []).map(product => `<span class="entity-tag product">${product}</span>`),
    ...(entities.technologies || []).slice(0, 3).map(tech => `<span class="entity-tag tech">${tech}</span>`)
  ].join('');

  articleDiv.innerHTML = `
    ${duplicateBadge}
    
    <div class="source-bar">
      <img src="https://www.google.com/s2/favicons?domain=${article.source_domain}" alt="${article.source}" width="16" height="16">
      <span class="source-name">${article.source}</span>
      <time class="pub-time">${timeAgo(article.pubDate)}</time>
    </div>
    
    <h3 class="article-title">
      <a href="${article.url}" target="_blank" rel="noopener" title="${article.metaDescription || article.title}">
        ${article.title} ↗
      </a>
    </h3>
    
    ${entityTags ? `<div class="entities">${entityTags}</div>` : ''}
    
    <div class="metadata">
      <span class="category category-${category}">${category.replace('-', ' ')}</span>
      ${article.difficulty ? `<span class="difficulty" title="Difficulty: ${difficulty}/10">${difficultyDots}</span>` : ''}
      ${article.confidence ? `<span class="confidence" title="AI confidence: ${(confidence*100).toFixed(0)}%">${confidenceIcon}</span>` : ''}
    </div>
  `;
  
  return articleDiv;
}

// Show empty state
function showEmptyState() {
  articlesGrid.innerHTML = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-secondary);">
      <h3>No articles found</h3>
      <p>Try adjusting your filters or search terms.</p>
    </div>
  `;
  
  showCount.textContent = '0';
  totalCount.textContent = allArticles.length;
  loadMoreBtn.style.display = 'none';
}

// Show error message
function showError(message) {
  articlesGrid.innerHTML = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--error);">
      <h3>Error</h3>
      <p>${message}</p>
    </div>
  `;
}

// Load more articles
function loadMore() {
  currentPage++;
  updateDisplay();
}

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

// Debounce helper
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Keyboard shortcuts
function handleKeyboard(event) {
  // Escape to clear search
  if (event.key === 'Escape') {
    clearSearch();
  }
  
  // Ctrl/Cmd + K to focus search
  if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
    event.preventDefault();
    searchInput.focus();
  }
  
  // Ctrl/Cmd + / to toggle theme
  if ((event.ctrlKey || event.metaKey) && event.key === '/') {
    event.preventDefault();
    toggleTheme();
  }
}

// Theme management
function initializeTheme() {
  // Check for saved theme preference or default to dark
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = savedTheme || (prefersDark ? 'dark' : 'light');
  
  setTheme(theme);
  
  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('theme')) {
      setTheme(e.matches ? 'dark' : 'light');
    }
  });
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  setTheme(newTheme);
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  
  // Update theme toggle icon
  const themeIcon = document.querySelector('.theme-icon');
  if (themeIcon) {
    themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
}

// Performance monitoring
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      // Track article views for analytics if needed
      // console.log('Article viewed:', entry.target.querySelector('.article-title a').textContent);
    }
  });
}, { threshold: 0.5 });

// Observe articles for analytics
function observeArticles() {
  document.querySelectorAll('.news-item').forEach(article => {
    observer.observe(article);
  });
}

// Initialize analytics after articles load
const originalUpdateDisplay = updateDisplay;
updateDisplay = function() {
  originalUpdateDisplay.call(this);
  observeArticles();
};

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    applyFilters,
    timeAgo,
    debounce
  };
} 