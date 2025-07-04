// State management
let allArticles = [];
let filteredArticles = [];
let currentPage = 0;
const articlesPerPage = 20;
let uniqueSourceCount = 0;

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
    // Load today's date by default (get the selected date from the dropdown)
    const dateSelect = document.getElementById('dateSelect');
    const selectedOption = dateSelect?.querySelector('option[selected]');
    const defaultDate = selectedOption?.value || null;
    
    await loadData(defaultDate);
    console.log('🔍 DEBUG: After loadData, allArticles.length =', allArticles.length);
    
    setupEventListeners();
    initializeTheme();
    updatePageMetadata(defaultDate);
    
    console.log('🔍 DEBUG: Initial filter state =', filters);
    
    // Initialize filter button states to match JavaScript state
    initializeFilterStates();
    
    updateFilterCounts();
    console.log('🔍 DEBUG: After updateFilterCounts');
    
    applyFilters();
    console.log('🔍 DEBUG: After applyFilters, filteredArticles.length =', filteredArticles.length);
    
    updateDisplay();
    console.log('🔍 DEBUG: After updateDisplay');
    
    // Enhance accessibility after everything is loaded
    enhanceAccessibility();
    console.log('🔍 DEBUG: Accessibility enhancements applied');
  } catch (error) {
    console.error('Failed to initialize app:', error);
    showError('Failed to load articles. Please refresh the page.');
  }
});

// Load article data for a specific date or all
async function loadData(selectedDate = null) {
  try {
    let dataUrl = 'data.json'; // Default to all
    
    if (selectedDate) {
      dataUrl = `data/${selectedDate}.json`;
    }
    
    const response = await fetch(dataUrl);
    const data = await response.json();
    allArticles = data.articles;
    filteredArticles = [...allArticles];
    
    // Calculate unique source count
    const uniqueSources = new Set();
    allArticles.forEach(article => {
      if (article.source) {
        uniqueSources.add(article.source);
      }
    });
    uniqueSourceCount = uniqueSources.size;
    
    console.log(`✅ Loaded ${allArticles.length} articles${selectedDate ? ` for ${selectedDate}` : ''}`);
    console.log(`🔗 Unique sources: ${uniqueSourceCount}`);
    console.log('📊 Source categories:', Object.keys(allArticles.reduce((acc, a) => { acc[a.source_category] = true; return acc; }, {})));
    console.log('🤖 AI categories:', Object.keys(allArticles.reduce((acc, a) => { acc[a.category] = true; return acc; }, {})));
  } catch (error) {
    console.error(`❌ Failed to load data${selectedDate ? ` for ${selectedDate}` : ''}:`, error);
    console.error('Error details:', error.message);
    console.error('URL attempted:', dataUrl);
    
    // If date-specific load fails, try all
    if (selectedDate) {
      console.log('🔄 Falling back to all data...');
      console.log('⚠️ WARNING: Date-specific file failed to load, using all articles instead');
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
    
    // Reset filters to "all"
    filters.category = 'all';
    filters.source = 'all';
    filters.difficulty = 'all';
    
    // Initialize filter button states
    initializeFilterStates();
    
    // Update page metadata for selected date
    updatePageMetadata(selectedDate);
    
    // Update display
    updateFilterCounts();
    applyFilters();
    updateDisplay();
    
    console.log(`✅ Switched to ${selectedDate || 'all'} data`);
  } catch (error) {
    console.error('❌ Failed to change date:', error);
    showError('Failed to load articles for selected date. Please try again.');
  }
}

// Update page metadata when switching dates
function updatePageMetadata(selectedDate) {
  const isAll = !selectedDate;
  const articleCount = allArticles.length;
  const sourceCount = [...new Set(allArticles.map(a => a.source))].length;
  
  // Format date for display (use yyyy-mm-dd format)
  let dateText = '';
  let shortDateText = '';
  if (selectedDate) {
    dateText = selectedDate; // Keep yyyy-mm-dd format
    shortDateText = selectedDate; // Keep yyyy-mm-dd format
  }
  
  // Update meta description
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) {
    const baseDesc = `AI news aggregator collecting ${articleCount} articles from ${sourceCount}+ sources.`;
    const dateDesc = isAll ? 'All articles' : `Updated ${shortDateText}`;
    metaDesc.setAttribute('content', `${baseDesc} ${dateDesc}.`);
  }
  
  // Update page title
  const title = isAll 
    ? 'AI News Daily - Latest AI News from 50+ Sources'
    : `AI News Daily - Latest AI News for ${dateText}`;
  document.title = title;
  
  // Update all brand subtitle variants
  const logoSubtitleFull = document.querySelector('.brand-subtitle-full');
  const logoSubtitleMedium = document.querySelector('.brand-subtitle-medium');
  const logoSubtitleShort = document.querySelector('.brand-subtitle-short');
  
  if (logoSubtitleFull) {
    logoSubtitleFull.textContent = `Your daily source for cutting-edge AI breakthroughs • ${articleCount}+ stories curated`;
  }
  if (logoSubtitleMedium) {
    logoSubtitleMedium.textContent = `${articleCount}+ AI stories`;
  }
  if (logoSubtitleShort) {
    logoSubtitleShort.textContent = `${articleCount}+ stories`;
  }
}

// Initialize filter button states to match current filter state
function initializeFilterStates() {
  // Set category buttons
  document.querySelectorAll('[data-category]').forEach(btn => {
    btn.classList.remove('active', 'btn-primary');
    btn.classList.add('btn-outline-light');
    if (btn.dataset.category === filters.category) {
      btn.classList.add('active', 'btn-primary');
      btn.classList.remove('btn-outline-light');
    }
  });
  
  // Set source buttons
  document.querySelectorAll('[data-source]').forEach(btn => {
    btn.classList.remove('active', 'btn-primary');
    btn.classList.add('btn-outline-light');
    if (btn.dataset.source === filters.source) {
      btn.classList.add('active', 'btn-primary');
      btn.classList.remove('btn-outline-light');
    }
  });
  
  // Set difficulty buttons
  document.querySelectorAll('[data-difficulty]').forEach(btn => {
    btn.classList.remove('active', 'btn-primary');
    btn.classList.add('btn-outline-light');
    if (btn.dataset.difficulty === filters.difficulty) {
      btn.classList.add('active', 'btn-primary');
      btn.classList.remove('btn-outline-light');
    }
  });
}

// Setup event listeners
function setupEventListeners() {
  // Filter buttons (both desktop and mobile)
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', handleFilterClick);
  });
  
  // Filter section toggles (both desktop and mobile)
  document.querySelectorAll('.filter-header').forEach(header => {
    header.addEventListener('click', handleFilterToggle);
  });
  
  // Search
  if (searchInput) {
    searchInput.addEventListener('input', debounce(handleSearch, 300));
  }
  
  // Clear search buttons (both desktop and mobile)
  const clearSearchBtns = document.querySelectorAll('#clearSearch, #clearSearchMobile');
  clearSearchBtns.forEach(btn => {
    if (btn) {
      btn.addEventListener('click', clearSearch);
    }
  });
  
  // Date selection
  if (dateSelect) {
    dateSelect.addEventListener('change', handleDateChange);
  }
  
  // Theme toggle - add null check
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
  
  // Load more
  loadMoreBtn.addEventListener('click', loadMore);
  
  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboard);
  
  // Initialize mobile menu
  initializeMobileMenu();
}

// Handle filter button clicks
function handleFilterClick(event) {
  const btn = event.target;
  const filterType = btn.dataset.category ? 'category' : 
                    btn.dataset.source ? 'source' : 'difficulty';
  const filterValue = btn.dataset.category || btn.dataset.source || btn.dataset.difficulty;
  
  // Remove active class and Bootstrap primary class from ALL buttons of the same filter type
  const allFilterButtons = document.querySelectorAll(`[data-${filterType}]`);
  allFilterButtons.forEach(b => {
    b.classList.remove('active', 'btn-primary');
    b.classList.add('btn-outline-light');
  });
  
  // Add active class and Bootstrap primary class to ALL buttons with the same filter value
  const matchingButtons = document.querySelectorAll(`[data-${filterType}="${filterValue}"]`);
  matchingButtons.forEach(b => {
    b.classList.add('active', 'btn-primary');
    b.classList.remove('btn-outline-light');
  });
  
  // Update filter state
  filters[filterType] = filterValue;
  
  // Apply filters and reset pagination
  currentPage = 0;
  updateFilterCounts();
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

// Initialize Bootstrap navbar and mobile functionality
function initializeMobileMenu() {
  // Sync mobile controls with desktop controls
  syncMobileControls();
  
  // Bootstrap handles the navbar toggle automatically
  // No need for custom mobile menu logic
}

// Sync mobile controls with desktop controls
function syncMobileControls() {
  const searchInput = document.getElementById('searchInput');
  const searchInputMobile = document.getElementById('searchInputMobile');
  const dateSelect = document.getElementById('dateSelect');
  const dateSelectMobile = document.getElementById('dateSelectMobile');
  const themeToggle = document.getElementById('themeToggle');
  const themeToggleMobile = document.getElementById('themeToggleMobile');
  
  // Remove existing event listeners to prevent duplicates
  if (searchInputMobile && !searchInputMobile.hasAttribute('data-synced')) {
    searchInputMobile.setAttribute('data-synced', 'true');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchInputMobile.value = e.target.value;
      });
      searchInputMobile.addEventListener('input', (e) => {
        searchInput.value = e.target.value;
        handleSearch(e);
      });
    }
  }
  
  // Sync date selectors
  if (dateSelectMobile && !dateSelectMobile.hasAttribute('data-synced')) {
    dateSelectMobile.setAttribute('data-synced', 'true');
    if (dateSelect) {
      dateSelect.addEventListener('change', (e) => {
        dateSelectMobile.value = e.target.value;
      });
      dateSelectMobile.addEventListener('change', (e) => {
        dateSelect.value = e.target.value;
        handleDateChange(e);
      });
    }
  }
  
  // Sync theme toggles - prevent duplicate listeners and add mobile reliability
  if (themeToggleMobile && !themeToggleMobile.hasAttribute('data-synced')) {
    themeToggleMobile.setAttribute('data-synced', 'true');
    
    // Add multiple event types for better mobile compatibility
    ['click', 'touchend'].forEach(eventType => {
      themeToggleMobile.addEventListener(eventType, (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Force theme toggle with mobile-specific handling
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        // Double-check theme change on mobile
        setTheme(newTheme);
        
        // Verify theme change after a brief delay (mobile-specific)
        setTimeout(() => {
          const actualTheme = document.documentElement.getAttribute('data-theme');
          if (actualTheme !== newTheme) {
            // Force the theme change if it didn't take effect
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            
            // Force icon update
            const icons = document.querySelectorAll('.theme-icon');
            icons.forEach(icon => {
              icon.textContent = newTheme === 'dark' ? '☀️' : '🌙';
            });
          }
        }, 50);
      }, { passive: false });
    });
  }
  
  // Mobile theme hint button
  const mobileThemeHint = document.getElementById('mobileThemeHint');
  if (mobileThemeHint && !mobileThemeHint.hasAttribute('data-synced')) {
    mobileThemeHint.setAttribute('data-synced', 'true');
    mobileThemeHint.addEventListener('click', (e) => {
      e.preventDefault();
      toggleTheme();
    });
  }
}

// Handle window resize to reinitialize mobile state and equalize card heights
window.addEventListener('resize', debounce(() => {
  initializeMobileMenu();
  equalizeCardHeights();
}, 250));

// Handle search input
function handleSearch(event) {
  filters.search = event.target.value.toLowerCase().trim();
  currentPage = 0;
  updateFilterCounts();
  applyFilters();
  updateDisplay();
}

// Clear search
function clearSearch() {
  const searchInput = document.getElementById('searchInput');
  const searchInputMobile = document.getElementById('searchInputMobile');
  
  // Clear both desktop and mobile search inputs
  if (searchInput) {
    searchInput.value = '';
  }
  if (searchInputMobile) {
    searchInputMobile.value = '';
  }
  
  filters.search = '';
  currentPage = 0;
  updateFilterCounts();
  applyFilters();
  updateDisplay();
}

// Apply filters and search
function applyFilters() {
  filteredArticles = allArticles.filter(article => {
    // Category filter
    if (filters.category !== 'all') {
      const matchesSourceCategory = article.source_category === filters.category;
      const matchesAICategory = article.category === filters.category;
      if (!matchesSourceCategory && !matchesAICategory) return false;
    }
    
    // Source type filter
    if (filters.source !== 'all' && article.source_category !== filters.source) return false;
    
    // Difficulty filter
    if (filters.difficulty !== 'all' && article.difficulty) {
      const difficulty = article.difficulty;
      if (filters.difficulty === 'easy' && difficulty > 3) return false;
      if (filters.difficulty === 'medium' && (difficulty < 4 || difficulty > 7)) return false;
      if (filters.difficulty === 'hard' && difficulty < 8) return false;
    }
    
    // Search filter
    if (filters.search) {
      const searchableText = [
        article.title, article.source, article.category || article.source_category,
        ...((article.entities && article.entities.organizations) || []), 
        ...((article.entities && article.entities.products) || []),
        ...((article.entities && article.entities.technologies) || [])
      ].join(' ').toLowerCase();
      if (!searchableText.includes(filters.search)) return false;
    }
    
    return true;
  });
  

  
  // Sort articles: Time first (newest first), then by confidence and quality
  filteredArticles.sort((a, b) => {
    // 1. PRIORITY: Sort by recency (newest first)
    const aTime = new Date(a.pubDate || a.published_at).getTime();
    const bTime = new Date(b.pubDate || b.published_at).getTime();
    
    if (aTime !== bTime) {
      return bTime - aTime;
    }
    
    // 2. If same time, high confidence articles first
    const aHighConfidence = (a.confidence || 0) > 0.8;
    const bHighConfidence = (b.confidence || 0) > 0.8;
    
    if (aHighConfidence && !bHighConfidence) return -1;
    if (!aHighConfidence && bHighConfidence) return 1;
    
    // 3. If same time and confidence, deprioritize Reddit for quality
    const aIsReddit = a.source_category === 'reddit';
    const bIsReddit = b.source_category === 'reddit';
    
    if (!aIsReddit && bIsReddit) return -1;
    if (aIsReddit && !bIsReddit) return 1;
    
    // 4. Final tie-breaker: sort by title for consistency
    return (a.title || '').localeCompare(b.title || '');
  });
  
  // Reset pagination
  currentPage = 0;
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
            ...((article.entities && article.entities.organizations) || []), ...((article.entities && article.entities.products) || []),
            ...((article.entities && article.entities.technologies) || [])
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
          ...((article.entities && article.entities.organizations) || []), ...((article.entities && article.entities.products) || []),
          ...((article.entities && article.entities.technologies) || [])
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
            ...((article.entities && article.entities.organizations) || []), ...((article.entities && article.entities.products) || []),
            ...((article.entities && article.entities.technologies) || [])
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
          ...((article.entities && article.entities.organizations) || []), ...((article.entities && article.entities.products) || []),
          ...((article.entities && article.entities.technologies) || [])
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
            ...((article.entities && article.entities.organizations) || []), ...((article.entities && article.entities.products) || []),
            ...((article.entities && article.entities.technologies) || [])
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
          ...((article.entities && article.entities.organizations) || []), ...((article.entities && article.entities.products) || []),
          ...((article.entities && article.entities.technologies) || [])
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
  
  articlesToShow.forEach((article, index) => {
    const articleElement = createArticleElement(article);
    articlesGrid.appendChild(articleElement);
  });
  
  // Update counters (both desktop and mobile)
  showCount.textContent = articlesToShow.length;
  totalCount.textContent = filteredArticles.length;
  
  // Update mobile counts too
  const showCountMobile = document.getElementById('showCountMobile');
  const totalCountMobile = document.getElementById('totalCountMobile');
  const mobileContextCount = document.getElementById('mobileContextCount');
  if (showCountMobile) showCountMobile.textContent = articlesToShow.length;
  if (totalCountMobile) totalCountMobile.textContent = filteredArticles.length;
  if (mobileContextCount) mobileContextCount.textContent = filteredArticles.length;
  
  // Update mobile context subtitle based on active filters
  updateMobileContextSubtitle();
  
  // Update load more button
  const hasMore = articlesToShow.length < filteredArticles.length;
  loadMoreBtn.style.display = hasMore ? 'block' : 'none';
  loadMoreBtn.disabled = !hasMore;
  
  // Equalize card heights after a short delay to allow rendering
  setTimeout(equalizeCardHeights, 100);
}

// Equalize card heights to make all cards the same size
function equalizeCardHeights() {
  const cards = document.querySelectorAll('.news-item');
  if (cards.length === 0) return;
  
  // Reset heights first
  cards.forEach(card => {
    card.style.height = 'auto';
  });
  
  // Get the maximum height
  let maxHeight = 0;
  cards.forEach(card => {
    const height = card.offsetHeight;
    if (height > maxHeight) {
      maxHeight = height;
    }
  });
  
  // Set all cards to the maximum height
  cards.forEach(card => {
    card.style.height = `${maxHeight}px`;
  });
  
  console.log(`✅ Equalized ${cards.length} cards to ${maxHeight}px height`);
}

// Update mobile context subtitle based on active filters
function updateMobileContextSubtitle() {
  const subtitleEl = document.querySelector('.context-subtitle');
  if (!subtitleEl) return;
  
  const activeFilters = [];
  
  if (filters.category !== 'all') {
    activeFilters.push(`${filters.category.replace('-', ' ')}`);
  }
  
  if (filters.source !== 'all') {
    activeFilters.push(`${filters.source} sources`);
  }
  
  if (filters.difficulty !== 'all') {
    activeFilters.push(`${filters.difficulty} level`);
  }
  
  if (filters.search) {
    activeFilters.push(`matching "${filters.search}"`);
  }
  
  let subtitle;
  if (activeFilters.length > 0) {
    subtitle = `Filtered: ${activeFilters.join(' • ')}`;
  } else {
    subtitle = `Curated from ${uniqueSourceCount}+ trusted sources`;
  }
  
  subtitleEl.textContent = subtitle;
}

// Create article DOM element - full AI-enhanced version
function createArticleElement(article) {
  
  const articleDiv = document.createElement('article');
  articleDiv.className = 'news-item';
  
  // Use AI category if available, fallback to source category
  const category = article.category || article.source_category;
  const difficulty = article.difficulty || 5;
  const confidence = article.confidence || 0;
  
  articleDiv.dataset.category = category;
  articleDiv.dataset.difficulty = difficulty <= 3 ? 'easy' : difficulty <= 7 ? 'medium' : 'hard';
  articleDiv.dataset.source = article.source_category;
  
  // AI confidence and difficulty indicators
  const confidenceIcon = confidence > 0.8 ? '✅' : '❓';
  
  // Process entities safely
  const entities = article.entities || [];
  const orgEntities = entities.filter(e => e.entity && e.entity.includes('ORG')).map(e => e.word).filter((v, i, a) => a.indexOf(v) === i);
  const productEntities = entities.filter(e => e.entity && (e.entity.includes('PRODUCT') || e.entity.includes('MISC'))).map(e => e.word).filter((v, i, a) => a.indexOf(v) === i);
  const techEntities = entities.filter(e => e.entity && (e.entity.includes('TECH') || e.entity.includes('PER'))).map(e => e.word).filter((v, i, a) => a.indexOf(v) === i);
  
  // Build entity tags HTML
  const entityTagsHTML = [
    ...orgEntities.map(entity => `<span class="entity-tag org">${entity}</span>`),
    ...productEntities.map(entity => `<span class="entity-tag product">${entity}</span>`),
    ...techEntities.map(entity => `<span class="entity-tag tech">${entity}</span>`)
  ].join('');
  
  // AI summary
  const summary = article.summary || '';
  const summaryHTML = summary ? `<hr><p class="article-summary">${summary.trim()}</p>` : '';
  
  // Entity section
  const entitiesHTML = entityTagsHTML ? `<div class="entities">${entityTagsHTML}</div>` : '';
  
  try {
    const finalHTML = `
      <div class="source-bar">
        <img src="https://www.google.com/s2/favicons?domain=${article.source_domain || 'example.com'}" alt="${article.source || 'Unknown'}" width="16" height="16">
        <span class="source-name">${article.source || 'Unknown Source'}</span>
        <time class="pub-time">${timeAgo(article.pubDate || article.published_at || new Date())}</time>
      </div>
      
      <h3 class="article-title">
        <span class="indicator-label">Title:</span>
        ${article.title || 'Untitled Article'}
      </h3>
      
      ${summaryHTML}
      
      ${entitiesHTML}
      
      <div class="metadata">
        <span class="category category-${category.replace(/[^a-z0-9]/gi, '-')}">${category}</span>
        <div class="indicators">
          <span class="indicator-item">
            <span class="indicator-label">Difficulty:</span>
            <span class="difficulty">★${difficulty}</span>
          </span>
          <span class="indicator-item">
            <span class="indicator-label">Confidence:</span>
            <span class="confidence">${confidenceIcon}</span>
          </span>
        </div>
      </div>
      
      <div class="article-actions">
        <a href="${article.url || '#'}" target="_blank" rel="noopener" class="read-more-btn">
          Read full article ↗
        </a>
      </div>
    `;
    
    articleDiv.innerHTML = finalHTML;
    
  } catch (error) {
    console.error('🚨 ERROR creating article element:', error);
    console.error('🚨 Article data:', article);
    
    // Fallback simple article
    articleDiv.innerHTML = `
      <div class="article-title">
        <a href="${article.url || '#'}" target="_blank">
          ${article.title || 'Untitled Article'}
        </a>
      </div>
      <div class="article-summary">${article.summary || 'No summary available'}</div>
    `;
  }
  
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
  
  // Update mobile counts too
  const showCountMobile = document.getElementById('showCountMobile');
  const totalCountMobile = document.getElementById('totalCountMobile');
  const mobileContextCount = document.getElementById('mobileContextCount');
  if (showCountMobile) showCountMobile.textContent = '0';
  if (totalCountMobile) totalCountMobile.textContent = allArticles.length;
  if (mobileContextCount) mobileContextCount.textContent = '0';
  
  // Update mobile context subtitle for empty state
  updateMobileContextSubtitle();
  
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
  
  // Handle invalid dates
  if (isNaN(date.getTime())) {
    return 'unknown';
  }
  
  const diffMs = now - date;
  
  // Handle future dates or negative timestamps
  if (diffMs < 0) {
    return 'just now';
  }
  
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
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

// Enhanced keyboard shortcuts and navigation
function handleKeyboard(event) {
  // Skip if user is typing in an input
  if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.tagName === 'SELECT') {
    // Allow Escape to exit inputs
    if (event.key === 'Escape') {
      event.target.blur();
      clearSearch();
    }
    return;
  }
  
  // Escape to clear search and focus
  if (event.key === 'Escape') {
    clearSearch();
    document.activeElement?.blur();
  }
  
  // Ctrl/Cmd + K to focus search
  if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
    event.preventDefault();
    const searchEl = document.getElementById('searchInput') || document.getElementById('searchInputMobile');
    if (searchEl) searchEl.focus();
  }
  
  // Ctrl/Cmd + / to toggle theme
  if ((event.ctrlKey || event.metaKey) && event.key === '/') {
    event.preventDefault();
    toggleTheme();
  }
  
  // M key to toggle mobile menu
  if (event.key === 'm' || event.key === 'M') {
    const navbarToggle = document.querySelector('.navbar-toggler');
    if (navbarToggle && !navbarToggle.classList.contains('d-none')) {
      event.preventDefault();
      navbarToggle.click();
    }
  }
  
  // L key to load more articles
  if (event.key === 'l' || event.key === 'L') {
    const loadMoreBtn = document.getElementById('loadMoreBtn');
    if (loadMoreBtn && loadMoreBtn.style.display !== 'none' && !loadMoreBtn.disabled) {
      event.preventDefault();
      loadMoreBtn.click();
    }
  }
  
  // Number keys (1-9) to activate category filters
  if (event.key >= '1' && event.key <= '9') {
    event.preventDefault();
    const filterIndex = parseInt(event.key) - 1;
    const categoryButtons = document.querySelectorAll('[data-category]');
    if (categoryButtons[filterIndex]) {
      categoryButtons[filterIndex].click();
      categoryButtons[filterIndex].focus();
    }
  }
  
  // Arrow key navigation for filter buttons
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    const focusedElement = document.activeElement;
    
    if (focusedElement && focusedElement.classList.contains('filter-btn')) {
      event.preventDefault();
      navigateFilters(focusedElement, event.key);
    }
  }
}

// Navigate between filter buttons with arrow keys
function navigateFilters(currentButton, direction) {
  const allFilterButtons = Array.from(document.querySelectorAll('.filter-btn:not([style*="display: none"])'));
  const currentIndex = allFilterButtons.indexOf(currentButton);
  
  if (currentIndex === -1) return;
  
  let nextIndex;
  
  switch (direction) {
    case 'ArrowLeft':
    case 'ArrowUp':
      nextIndex = currentIndex > 0 ? currentIndex - 1 : allFilterButtons.length - 1;
      break;
    case 'ArrowRight':
    case 'ArrowDown':
      nextIndex = currentIndex < allFilterButtons.length - 1 ? currentIndex + 1 : 0;
      break;
    default:
      return;
  }
  
  if (allFilterButtons[nextIndex]) {
    allFilterButtons[nextIndex].focus();
  }
}

// Add ARIA attributes and improve keyboard accessibility
function enhanceAccessibility() {
  // Add ARIA labels to filter buttons
  document.querySelectorAll('.filter-btn').forEach((btn, index) => {
    btn.setAttribute('role', 'button');
    btn.setAttribute('tabindex', '0');
    btn.setAttribute('aria-pressed', btn.classList.contains('active') ? 'true' : 'false');
    
    // Add keyboard support for filter buttons
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        btn.click();
      }
    });
  });
  
  // Add ARIA labels to theme toggles
  document.querySelectorAll('[id*="themeToggle"]').forEach(btn => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    btn.setAttribute('aria-label', `Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} theme`);
    btn.setAttribute('role', 'button');
  });
  
  // Add ARIA labels to mobile context buttons
  document.querySelectorAll('.mobile-filter-hint, .mobile-theme-hint').forEach(btn => {
    btn.setAttribute('role', 'button');
    btn.setAttribute('tabindex', '0');
    
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        btn.click();
      }
    });
  });
  
  // Improve accordion accessibility
  document.querySelectorAll('.accordion-button').forEach(btn => {
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        btn.click();
      }
    });
  });
  
  // Add skip link functionality
  const skipLink = document.querySelector('.skip-link');
  if (skipLink) {
    skipLink.addEventListener('click', (e) => {
      e.preventDefault();
      const mainContent = document.getElementById('main-content');
      if (mainContent) {
        mainContent.focus();
        mainContent.scrollIntoView({ behavior: 'smooth' });
      }
    });
  }
  
  // Make main content focusable for skip link
  const mainContent = document.getElementById('main-content');
  if (mainContent) {
    mainContent.setAttribute('tabindex', '-1');
  }
  
  // Add focus management for article read-more buttons
  document.querySelectorAll('.read-more-btn').forEach(btn => {
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        // Let the default link behavior happen
        return;
      }
    });
  });
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

// Make toggleTheme available globally for inline onclick handlers
window.toggleTheme = toggleTheme;

function setTheme(theme) {
  // Set the theme attribute immediately
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  
  // Force a small delay to ensure DOM is ready on mobile devices
  setTimeout(() => {
    // Update theme toggle icons (both desktop and mobile) with force refresh
    const themeIcons = document.querySelectorAll('.theme-icon');
    const newIcon = theme === 'dark' ? '☀️' : '🌙';
    
    themeIcons.forEach(icon => {
      icon.textContent = newIcon;
      // Force reflow on mobile to ensure the change takes effect
      icon.offsetHeight;
    });
    
    // Update ARIA labels for accessibility
    document.querySelectorAll('[id*="themeToggle"]').forEach(btn => {
      btn.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
    });
    
    // Force theme refresh on mobile by toggling a class
    if (window.innerWidth <= 768) {
      document.body.classList.toggle('theme-refresh', true);
      setTimeout(() => {
        document.body.classList.toggle('theme-refresh', false);
      }, 10);
    }
  }, 10);
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
  // Re-enhance accessibility for dynamically created elements
  setTimeout(() => enhanceAccessibility(), 100);
};

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    applyFilters,
    timeAgo,
    debounce
  };
} 