// ============================================================
// IELTS Vocabulary Builder - Main Application
// ============================================================

let currentCluster = null;
let currentMode = 'flashcard';
let currentWordIndex = 0;
let currentClusterWords = [];
let currentQuizWord = null;
let currentQuizOptions = [];
let srsData = {};
let wrongBank = [];
let dailyGoal = { target: 15, streak: 0, lastStudyDate: null, todayCount: 0 };
let settings = { darkMode: false };
let streakData = {};
let earnedBadges = [];
let dueWordsOnly = false;
let currentFilteredWords = [];
let currentSpeed = 1.0;
let quizCorrectCount = 0;
let totalStudyCount = 0;

// Define all available badges
const allBadges = [
    { id: 'first_word', name: '第一歩', nameEn: 'First Step', icon: '🎯', desc: '最初の単語を学習', requirement: 'studyCount', target: 1 },
    { id: 'ten_words', name: '初心者', nameEn: 'Beginner', icon: '🌱', desc: '10単語学習', requirement: 'studyCount', target: 10 },
    { id: 'fifty_words', name: '熱心な学習者', nameEn: 'Dedicated Learner', icon: '📚', desc: '50単語学習', requirement: 'studyCount', target: 50 },
    { id: 'hundred_words', name: '単語マスター', nameEn: 'Word Master', icon: '🏆', desc: '100単語学習', requirement: 'studyCount', target: 100 },
    { id: 'three_day_streak', name: '継続は力なり', nameEn: 'Consistency', icon: '🔥', desc: '3日連続学習', requirement: 'streak', target: 3 },
    { id: 'seven_day_streak', name: '不屈の精神', nameEn: 'Unstoppable', icon: '⚡', desc: '7日連続学習', requirement: 'streak', target: 7 },
    { id: 'thirty_day_streak', name: '伝説', nameEn: 'Legendary', icon: '👑', desc: '30日連続学習', requirement: 'streak', target: 30 },
    { id: 'perfect_quiz', name: 'クイズ名人', nameEn: 'Quiz Champion', icon: '🧠', desc: 'クイズ10問正解', requirement: 'quizCorrect', target: 10 },
    { id: 'cluster_master', name: 'カテゴリーマスター', nameEn: 'Category Master', icon: '🎓', desc: '1カテゴリー完全制覇', requirement: 'clusterComplete', target: 1 },
    { id: 'wrong_bank_clear', name: '復習完了', nameEn: 'Review Complete', icon: '✨', desc: '間違い単語帳をクリア', requirement: 'wrongBankClear', target: 1 }
];


// DOM Elements
const clusterButtonsDiv = document.getElementById('clusterButtons');
const mainContent = document.getElementById('mainContent');
const darkModeToggle = document.getElementById('darkModeToggle');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const resetBtn = document.getElementById('resetBtn');
const dashboardBtn = document.getElementById('dashboardBtn');
const wrongBankBtn = document.getElementById('wrongBankBtn');
const importFileInput = document.getElementById('importFileInput');

// Initialize
function init() {
    loadLocalStorage();
    applyDarkMode();
    renderClusterButtons();
    setupEventListeners();
    
    // NEW: Restore last cluster and mode
    const savedCluster = localStorage.getItem('ielts_lastCluster');
    const savedMode = localStorage.getItem('ielts_lastMode');
    
    const clusters = Object.keys(vocabData);
    if (savedCluster && clusters.includes(savedCluster)) {
        currentCluster = savedCluster;
    } else if (clusters.length > 0) {
        currentCluster = clusters[0];
    }
    
    if (savedMode && ['flashcard', 'quiz', 'cloze', 'story', 'writing'].includes(savedMode)) {
        currentMode = savedMode;
        // Update active tab highlight
        document.querySelectorAll('.mode-tab').forEach(tab => {
            if (tab.dataset.mode === currentMode) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
    }
    
    loadCluster(currentCluster);
    renderMode();
    setupKeyboardShortcuts();  // ADD THIS LINE
    checkHonorLock();
}
function getDueWords() {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const dueWords = [];
    
    for (const wordObj of currentClusterWords) {
        const srs = srsData[currentCluster]?.[wordObj.word];
        if (srs) {
            // Word is due if:
            // 1. It has no nextReview date (new word)
            // 2. The nextReview date is today or in the past
            if (!srs.nextReview || srs.nextReview <= todayStr) {
                dueWords.push(wordObj);
            }
        } else {
            // No SRS data yet - treat as new word (due)
            dueWords.push(wordObj);
        }
    }
    
    return dueWords;
}
function markTodayStudied() {
    const today = new Date().toISOString().slice(0, 10);
    if (!streakData[today]) {
        streakData[today] = true;
        saveLocalStorage();
        updateStreakCount();
        checkBadges();
    }
}
function updateStreakCount() {
    const today = new Date().toISOString().slice(0, 10);
    let streak = 0;
    let checkDate = new Date();
    
    for (let i = 0; i < 365; i++) {
        const dateStr = checkDate.toISOString().slice(0, 10);
        if (streakData[dateStr]) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
    }
    dailyGoal.streak = streak;
    saveLocalStorage();
    checkBadges();  // ADD THIS LINE
    return streak;
}
function showStreakCalendar() {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    let html = `
        <div style="max-width: 500px;">
            <h2>📅 学習カレンダー <span class="en">Study Calendar</span></h2>
            <div class="streak-stats">
                🔥 現在の連続記録: <span>${dailyGoal.streak || 0}</span> 日 <span class="en">day streak</span>
            </div>
            <div class="streak-controls">
                <button onclick="showMonthCalendar(${currentYear}, ${currentMonth - 1})">◀ 前月 <span class="en">Prev</span></button>
                <button onclick="showMonthCalendar(${currentYear}, ${currentMonth})">今月 <span class="en">This Month</span></button>
                <button onclick="showMonthCalendar(${currentYear}, ${currentMonth + 1})">翌月 <span class="en">Next</span> ▶</button>
            </div>
            <div id="calendarContent"></div>
            <button onclick="this.closest('.modal').remove()" style="margin-top: 15px;">閉じる <span class="en">Close</span></button>
        </div>
    `;
    
    showModal(html);
    showMonthCalendar(currentYear, currentMonth);
}

function showMonthCalendar(year, month) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startWeekday = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    
    // Month names in Japanese
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    
    let calendarHtml = `
        <div style="text-align: center; font-size: 1.2rem; font-weight: bold; margin: 10px 0;">
            ${year}年 ${monthNames[month]}
        </div>
        <div class="calendar-grid">
    `;
    
    // Weekday headers
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    for (let i = 0; i < 7; i++) {
        calendarHtml += `<div class="calendar-weekday">${weekdays[i]}</div>`;
    }
    
    // Empty cells for days before month starts
    for (let i = 0; i < startWeekday; i++) {
        calendarHtml += '<div class="calendar-day"></div>';
    }
    
    // Get today's date in Japan timezone
    const now = new Date();
    const japanTime = new Date(now.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
    const todayYear = japanTime.getFullYear();
    const todayMonth = String(japanTime.getMonth() + 1).padStart(2, '0');
    const todayDay = String(japanTime.getDate()).padStart(2, '0');
    const todayStr = `${todayYear}-${todayMonth}-${todayDay}`;
    
    // Days of the month
    for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const isStudied = streakData[dateStr];
        const isToday = (dateStr === todayStr);
        const date = new Date(year, month, d);
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        
        let classes = 'calendar-day';
        if (isStudied) classes += ' studied';
        if (isToday) classes += ' today';
        if (isWeekend) classes += ' weekend';
        
        calendarHtml += `<div class="${classes}">${d}</div>`;
    }
    
    calendarHtml += '</div>';
    
    const calendarContent = document.getElementById('calendarContent');
    if (calendarContent) {
        calendarContent.innerHTML = calendarHtml;
    }
}
function loadLocalStorage() {
    const savedSRS = localStorage.getItem('ielts_srs');
    if (savedSRS) srsData = JSON.parse(savedSRS);
    
    const savedWrongBank = localStorage.getItem('ielts_wrongBank');
    if (savedWrongBank) wrongBank = JSON.parse(savedWrongBank);
    
    const savedGoal = localStorage.getItem('ielts_dailyGoal');
    if (savedGoal) dailyGoal = JSON.parse(savedGoal);
    
    const savedSettings = localStorage.getItem('ielts_settings');
    if (savedSettings) settings = JSON.parse(savedSettings);
    
    // Load streak data
    const savedStreak = localStorage.getItem('ielts_streakData');
    if (savedStreak) {
        streakData = JSON.parse(savedStreak);
    } else {
        streakData = {};
    }
    
    // Load earned badges (ONLY ONCE)
    const savedBadges = localStorage.getItem('ielts_badges');
    if (savedBadges) {
        earnedBadges = JSON.parse(savedBadges);
    } else {
        earnedBadges = [];
    }
    
    // Load quiz correct count
    const savedQuizCorrect = localStorage.getItem('ielts_quizCorrect');
    if (savedQuizCorrect) {
        quizCorrectCount = parseInt(savedQuizCorrect);
    } else {
        quizCorrectCount = 0;
    }
    
    // Load saved speed
    const savedSpeed = localStorage.getItem('ielts_speed');
    if (savedSpeed) {
        currentSpeed = parseFloat(savedSpeed);
    } else {
        currentSpeed = 1.0;
    }
    
    // Check daily reset
    const today = new Date().toDateString();
    if (dailyGoal.lastStudyDate !== today) {
        dailyGoal.todayCount = 0;
        dailyGoal.lastStudyDate = today;
        saveLocalStorage();
    }
}

function saveLocalStorage() {
    localStorage.setItem('ielts_srs', JSON.stringify(srsData));
    localStorage.setItem('ielts_wrongBank', JSON.stringify(wrongBank));
    localStorage.setItem('ielts_dailyGoal', JSON.stringify(dailyGoal));
    localStorage.setItem('ielts_settings', JSON.stringify(settings));
    // NEW: Save last cluster and mode
    localStorage.setItem('ielts_lastCluster', currentCluster);
    localStorage.setItem('ielts_lastMode', currentMode);
	localStorage.setItem('ielts_speed', currentSpeed);  
	localStorage.setItem('ielts_badges', JSON.stringify(earnedBadges));
    localStorage.setItem('ielts_quizCorrect', quizCorrectCount);
}

function applyDarkMode() {
    if (settings.darkMode) {
        document.body.classList.add('dark');
        darkModeToggle.textContent = '☀️';
    } else {
        document.body.classList.remove('dark');
        darkModeToggle.textContent = '🌙';
    }
}

function toggleDarkMode() {
    settings.darkMode = !settings.darkMode;
    applyDarkMode();
    saveLocalStorage();
}

function renderClusterButtons() {
    clusterButtonsDiv.innerHTML = '';
    const clusters = Object.keys(vocabData);
    
    for (const cluster of clusters) {
        const btn = document.createElement('button');
        btn.className = 'cluster-btn';
        if (currentCluster === cluster) btn.classList.add('active');
        
        // Simple display name
        let displayName = cluster;
        if (cluster === 'academic_foundations') displayName = '📚 学術基礎';
        else if (cluster === 'global_environment') displayName = '🌍 環境';
        else if (cluster === 'education__skills') displayName = '🎓 教育';
        else if (cluster === 'technology__innovation') displayName = '💻 技術';
        else if (cluster === 'health__well_being') displayName = '💚 健康';
        else if (cluster === 'society__globalization') displayName = '🌐 社会';
        else if (cluster === 'work__economy') displayName = '💼 経済';
        else if (cluster === 'government__ethics') displayName = '⚖️ 政府';
        else if (cluster === 'analytical_verbs') displayName = '🔍 動詞';
        else if (cluster === 'logical_connectors') displayName = '🔗 接続語';
        
        btn.innerHTML = `${displayName}<span class="en">${cluster}</span>`;
        btn.onclick = () => {
            currentCluster = cluster;
            loadCluster(cluster);
            document.querySelectorAll('.cluster-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderMode();
        };
        clusterButtonsDiv.appendChild(btn);
    }
}

function getClusterNameJa(clusterKey) {
    const names = {
        'academic_foundations': '📚 学術基礎',
        'global_environment': '🌍 環境',
        'education_skills': '🎓 教育',
        'technology_innovation': '💻 技術',
        'health_wellbeing': '💚 健康',
        'society_globalization': '🌐 社会',
        'work_economy': '💼 経済',
        'government_ethics': '⚖️ 政府',
        'analytical_verbs': '🔍 動詞',
        'logical_connectors': '🔗 接続語'
    };
    return names[clusterKey] || clusterKey;
}

function loadCluster(cluster) {
    currentClusterWords = vocabData[cluster] || [];
    currentWordIndex = 0;
    
    // Initialize SRS for new words if not exists
    if (!srsData[cluster]) srsData[cluster] = {};
    for (const wordObj of currentClusterWords) {
        if (!srsData[cluster][wordObj.word]) {
            srsData[cluster][wordObj.word] = { box: 1, nextReview: null, lastRating: null };
        }
    }
    
    // Reset filter when changing clusters
    dueWordsOnly = false;
    updateFilteredWords();
    
    saveLocalStorage();
}

function updateFilteredWords() {
    if (dueWordsOnly) {
        currentFilteredWords = getDueWords();
        // If no due words, show message
        if (currentFilteredWords.length === 0) {
            currentFilteredWords = [];
        }
    } else {
        currentFilteredWords = [...currentClusterWords];
    }
    
    // Reset index if out of bounds
    if (currentWordIndex >= currentFilteredWords.length) {
        currentWordIndex = Math.max(0, currentFilteredWords.length - 1);
    }
    
    renderMode();
}

function renderMode() {
    if (!currentFilteredWords.length) {
        mainContent.innerHTML = '<p>📚 単語がありません / No words available</p>';
        return;
    }
    
    switch(currentMode) {
        case 'flashcard': renderFlashcard(); break;
        case 'quiz': renderQuiz(); break;
        case 'cloze': renderCloze(); break;
        case 'story': renderStoryLab(); break;
        case 'writing': renderWritingChallenge(); break;
        default: renderFlashcard();
    }
}

// ========== FLASHCARD MODE ==========
function renderFlashcard() {
    if (currentFilteredWords.length === 0) {
        mainContent.innerHTML = `
            <div class="vocab-card">
                <h3>📚 レビュー完了！</h3>
                <p>現在のフィルターに該当する単語はありません。</p>
                <p><small>No words match the current filter.</small></p>
                <button onclick="dueWordsOnly=false; updateFilteredWords();" class="filter-btn">全て表示</button>
            </div>
        `;
        return;
    }
    
    const wordObj = currentFilteredWords[currentWordIndex];
    if (!wordObj) return;
    
    const dueCount = getDueWords().length;
    
    const html = `
        <div class="vocab-card">
            <div class="filter-bar">
                <div class="filter-info">
                    ${dueWordsOnly ? `📋 レビュー対象: ${currentFilteredWords.length} 単語` : `📚 全単語: ${currentFilteredWords.length} 単語`}
                </div>
                <div>
                    <button id="dueFilterBtn" class="filter-btn ${dueWordsOnly ? 'active due' : ''}" onclick="toggleDueFilter()">
                        ⏰ 復習が必要 <span class="en">Due for Review</span>
                        ${dueCount > 0 ? `<span class="due-count">${dueCount}</span>` : ''}
                    </button>
                    ${dueWordsOnly ? `<button class="filter-btn" onclick="clearDueFilter()">📖 全て表示 <span class="en">Show All</span></button>` : ''}
                </div>
            </div>
            
            <div class="word">${wordObj.word}</div>
            <div class="pronunciation">🎤 ${generatePronunciation(wordObj.word)}</div>
            <button class="reveal-btn" onclick="toggleReveal()">🔍 表示 / Reveal</button>
            <div class="details" id="details">
                <div class="synonym">📖 類義語: <strong>${wordObj.synonym}</strong></div>
                <div class="sentence">📝 学術例文:<br>${wordObj.sentences[0]}</div>
                <div class="sentence">💬 実用例文:<br>${wordObj.sentences[1]}</div>
            </div>
            <div class="action-buttons">
                <button onclick="playTTS('${wordObj.sentences[0].replace(/'/g, "\\'")}')">🔊 音声 / Listen</button>
			<div class="speed-controls">
				<button class="speed-btn ${currentSpeed === 0.75 ? 'active' : ''}" onclick="setSpeed(0.75)">🐢 0.75x</button>
				<button class="speed-btn ${currentSpeed === 1.0 ? 'active' : ''}" onclick="setSpeed(1.0)">▶️ 1x</button>
			</div>
            </div>
            <div class="srs-buttons">
                <button class="srs-easy" onclick="rateWord('easy')">✅ 簡単 / Easy</button>
                <button class="srs-hard" onclick="rateWord('hard')">⚠️ 普通 / Hard</button>
                <button class="srs-again" onclick="rateWord('again')">🔄 もう一度 / Again</button>
            </div>
            <div class="nav-buttons">
                <button onclick="prevWord()">◀ 前へ / Prev</button>
                <span>${currentWordIndex + 1} / ${currentFilteredWords.length}</span>
                <button onclick="nextWord()">次へ / Next ▶</button>
            </div>
        </div>
    `;
    mainContent.innerHTML = html;
}
function getEnglishVoice() {
    const voices = window.speechSynthesis.getVoices();
    // Prefer Google UK or US English voices
    const englishVoice = voices.find(voice => 
        voice.lang === 'en-US' && voice.name.includes('Google')
    ) || voices.find(voice => 
        voice.lang.startsWith('en')
    );
    return englishVoice || null;
}
function setSpeed(speed) {
    currentSpeed = speed;
    saveLocalStorage();
    
    // Update UI to show active button
    document.querySelectorAll('.speed-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.includes(`${speed}x`)) {
            btn.classList.add('active');
        }
    });
    
    // Test the new speed with a short phrase
     const testUtterance = new SpeechSynthesisUtterance(`Speed set to ${speed}`);
     testUtterance.lang = 'en-US';
     testUtterance.rate = currentSpeed;
     window.speechSynthesis.speak(testUtterance);
}
function toggleReveal() {
    const details = document.getElementById('details');
    if (details) details.classList.toggle('show');
}

function nextWord() {
    if (currentWordIndex < currentFilteredWords.length - 1) {
        currentWordIndex++;
        renderMode();
    }
}

function prevWord() {
    if (currentWordIndex > 0) {
        currentWordIndex--;
        renderMode();
    }
}
function toggleDueFilter() {
    dueWordsOnly = !dueWordsOnly;
    updateFilteredWords();
}

function clearDueFilter() {
    dueWordsOnly = false;
    updateFilteredWords();
}
function rateWord(rating) {
    // Use currentFilteredWords instead of currentClusterWords
    const wordObj = currentFilteredWords[currentWordIndex];
    if (!wordObj) return;
    
    // Make sure SRS exists for this word in the current cluster
    if (!srsData[currentCluster]) srsData[currentCluster] = {};
    if (!srsData[currentCluster][wordObj.word]) {
        srsData[currentCluster][wordObj.word] = { box: 1, nextReview: null, lastRating: null };
    }
    
    const srs = srsData[currentCluster][wordObj.word];
    
    if (rating === 'easy') {
        srs.box = Math.min(srs.box + 1, 5);
    } else if (rating === 'hard') {
        srs.box = Math.min(srs.box + 1, 5);
    } else if (rating === 'again') {
        srs.box = Math.max(srs.box - 1, 1);
    }
    srs.lastRating = rating;
    srs.nextReview = calculateNextReview(srs.box);
    
    // Increment today's study count
    dailyGoal.todayCount++;
    markTodayStudied();
    saveLocalStorage();
    checkBadges();
    
    // If in due filter mode, refresh the list (this word may no longer be due)
    if (dueWordsOnly) {
        updateFilteredWords();
    } else {
        // Move to next word
        setTimeout(() => nextWord(), 300);
    }
}
function exportClusterToPrint() {
    const clusterName = getClusterNameJa(currentCluster);
    const words = currentClusterWords;
    
    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>IELTS単語 - ${clusterName}</title>
            <style>
                body {
                    font-family: 'Helvetica Neue', Arial, sans-serif;
                    margin: 40px;
                    line-height: 1.6;
                    color: #333;
                }
                h1 {
                    color: #4CAF50;
                    border-bottom: 2px solid #4CAF50;
                    padding-bottom: 10px;
                }
                .vocab-print-card {
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    padding: 15px;
                    margin-bottom: 20px;
                    break-inside: avoid;
                    page-break-inside: avoid;
                }
                .word {
                    font-size: 1.5rem;
                    font-weight: bold;
                    color: #2c3e50;
                }
                .synonym {
                    color: #7f8c8d;
                    margin: 5px 0;
                }
                .sentence {
                    background: #f9f9f9;
                    padding: 10px;
                    margin: 10px 0;
                    border-left: 3px solid #4CAF50;
                }
                .sentence-label {
                    font-weight: bold;
                    color: #555;
                    font-size: 0.8rem;
                }
                .footer {
                    margin-top: 40px;
                    text-align: center;
                    font-size: 0.8rem;
                    color: #999;
                }
                @media print {
                    .vocab-print-card {
                        break-inside: avoid;
                    }
                }
            </style>
        </head>
        <body>
            <h1>📚 IELTS単語マスター - ${clusterName}</h1>
            <p>総単語数: ${words.length} 単語 | 生成日: ${new Date().toLocaleDateString('ja-JP')}</p>
            <hr>
    `;
    
    for (const word of words) {
        html += `
            <div class="vocab-print-card">
                <div class="word">${word.word}</div>
                <div class="synonym">📖 類義語: ${word.synonym}</div>
                <div class="sentence">
                    <div class="sentence-label">📝 学術例文:</div>
                    ${word.sentences[0]}
                </div>
                <div class="sentence">
                    <div class="sentence-label">💬 実用例文:</div>
                    ${word.sentences[1]}
                </div>
            </div>
        `;
    }
    
    html += `
            <div class="footer">
                IELTS Vocabulary Builder - 学習の記録としてご利用ください
            </div>
        </body>
        </html>
    `;
    
    // Open in new window for printing
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
}

function exportWrongBankToPrint() {
    if (wrongBank.length === 0) {
        showModal('<h2>⚠️ 間違い単語帳は空です</h2><p>間違えた単語がありません。</p>');
        return;
    }
    
    // Get full word objects for wrong bank words
    const wrongWords = [];
    for (const cluster in vocabData) {
        for (const word of vocabData[cluster]) {
            if (wrongBank.includes(word.word)) {
                wrongWords.push(word);
            }
        }
    }
    
    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>IELTS単語 - 間違い単語帳</title>
            <style>
                body {
                    font-family: 'Helvetica Neue', Arial, sans-serif;
                    margin: 40px;
                    line-height: 1.6;
                    color: #333;
                }
                h1 {
                    color: #f44336;
                    border-bottom: 2px solid #f44336;
                    padding-bottom: 10px;
                }
                .vocab-print-card {
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    padding: 15px;
                    margin-bottom: 20px;
                    break-inside: avoid;
                    page-break-inside: avoid;
                }
                .word {
                    font-size: 1.5rem;
                    font-weight: bold;
                    color: #c0392b;
                }
                .synonym {
                    color: #7f8c8d;
                    margin: 5px 0;
                }
                .sentence {
                    background: #f9f9f9;
                    padding: 10px;
                    margin: 10px 0;
                    border-left: 3px solid #f44336;
                }
                .footer {
                    margin-top: 40px;
                    text-align: center;
                    font-size: 0.8rem;
                    color: #999;
                }
            </style>
        </head>
        <body>
            <h1>⚠️ 間違い単語帳 - 復習用リスト</h1>
            <p>間違えた単語数: ${wrongWords.length} 単語 | 生成日: ${new Date().toLocaleDateString('ja-JP')}</p>
            <hr>
    `;
    
    for (const word of wrongWords) {
        html += `
            <div class="vocab-print-card">
                <div class="word">${word.word}</div>
                <div class="synonym">📖 類義語: ${word.synonym}</div>
                <div class="sentence">
                    <div class="sentence-label">📝 学術例文:</div>
                    ${word.sentences[0]}
                </div>
                <div class="sentence">
                    <div class="sentence-label">💬 実用例文:</div>
                    ${word.sentences[1]}
                </div>
            </div>
        `;
    }
    
    html += `
            <div class="footer">
                IELTS Vocabulary Builder - 復習用リスト | 間違えた単語を重点的に学習しましょう
            </div>
        </body>
        </html>
    `;
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
}
function calculateNextReview(box) {
    const days = [1, 3, 7, 14, 30];
    const date = new Date();
    date.setDate(date.getDate() + days[box - 1]);
    return date.toISOString();
}

function generatePronunciation(word) {
    // Simple katakana approximation – can be enhanced
    return word.slice(0, 8).toLowerCase();
}

// ========== TTS ==========
function playTTS(text) {
    if (!navigator.onLine) {
        showModal('インターネット接続が必要です', 'Internet connection required for text-to-speech.');
        return;
    }
    
    window.speechSynthesis.cancel();
    
    setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = currentSpeed;
        
        // Try to get a good voice
        const voice = getEnglishVoice();
        if (voice) utterance.voice = voice;
        
        console.log(`Playing at speed: ${currentSpeed}x, Voice: ${voice?.name || 'default'}`);
        
        window.speechSynthesis.speak(utterance);
    }, 100);
}

// ========== QUIZ MODE ==========
function renderQuiz() {
    // Get random word from current cluster
    const randomIndex = Math.floor(Math.random() * currentClusterWords.length);
    currentQuizWord = currentClusterWords[randomIndex];
    
    // Generate 2 distractors from other words
    const otherWords = currentClusterWords.filter(w => w.word !== currentQuizWord.word);
    const shuffled = [...otherWords].sort(() => 0.5 - Math.random());
    const distractors = shuffled.slice(0, 2).map(w => w.synonym);
    
    currentQuizOptions = [currentQuizWord.synonym, ...distractors];
    currentQuizOptions.sort(() => 0.5 - Math.random());
    
    const html = `
        <div class="vocab-card">
            <h3>❓ 類義語クイズ</h3>
            <div class="word" style="font-size: 2rem;">${currentQuizWord.word}</div>
            <p>この単語の類義語は？<br><small>What is the synonym?</small></p>
            <div class="quiz-options" id="quizOptions"></div>
            <div id="quizFeedback"></div>
            <button onclick="renderQuiz()" style="margin-top: 20px;">🔄 新しい問題 / New Question</button>
        </div>
    `;
    mainContent.innerHTML = html;
    
    const optionsDiv = document.getElementById('quizOptions');
    currentQuizOptions.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'quiz-option';
        btn.textContent = opt;
        btn.onclick = () => checkQuizAnswer(opt);
        optionsDiv.appendChild(btn);
    });
}

function checkQuizAnswer(selected) {
    const isCorrect = selected === currentQuizWord.synonym;
    const feedbackDiv = document.getElementById('quizFeedback');
    
if (isCorrect) {
    feedbackDiv.innerHTML = `<div class="quiz-feedback correct">✅ 正解！ Correct!<br>例文: ${currentQuizWord.sentences[0]}</div>`;
    dailyGoal.todayCount++;
    quizCorrectCount++;
    markTodayStudied();
    saveLocalStorage();
    checkBadges();  // ADD THIS LINE
} else {
        feedbackDiv.innerHTML = `<div class="quiz-feedback wrong">❌ 不正解... Wrong.<br>正解: ${currentQuizWord.synonym}<br>例文: ${currentQuizWord.sentences[0]}</div>`;
        // Add to wrong bank
        if (!wrongBank.includes(currentQuizWord.word)) {
            wrongBank.push(currentQuizWord.word);
            saveLocalStorage();
        }
    }
}

// ========== CLOZE TEST ==========
function renderCloze() {
    const randomIndex = Math.floor(Math.random() * currentClusterWords.length);
    const wordObj = currentClusterWords[randomIndex];
    const sentence = wordObj.sentences[0];
    const clozeSentence = sentence.replace(new RegExp(wordObj.word, 'gi'), '______');
    
    const html = `
        <div class="vocab-card">
            <h3>📝 穴埋め問題</h3>
            <div class="sentence" style="font-size: 1.1rem;">${clozeSentence}</div>
            <input type="text" id="clozeInput" placeholder="単語を入力..." style="width: 100%; padding: 12px; margin: 15px 0; border-radius: 8px; border: 1px solid var(--border); background: var(--bg); color: var(--text);">
            <button onclick="checkCloze('${wordObj.word}')">✅ 確認する / Check</button>
            <div id="clozeFeedback" style="margin-top: 15px;"></div>
            <button onclick="renderCloze()" style="margin-top: 20px;">🔄 次の問題 / Next</button>
        </div>
    `;
    mainContent.innerHTML = html;
}

function checkCloze(correctWord) {
    const input = document.getElementById('clozeInput');
    const userAnswer = input.value.trim().toLowerCase();
    const isCorrect = userAnswer === correctWord.toLowerCase();
    const feedbackDiv = document.getElementById('clozeFeedback');
    
    if (isCorrect) {
        feedbackDiv.innerHTML = `<div class="quiz-feedback correct">✅ 正解！ Correct!</div>`;
        dailyGoal.todayCount++;
		markTodayStudied();  // ADD THIS LINE
        saveLocalStorage();
    } else {
        feedbackDiv.innerHTML = `<div class="quiz-feedback wrong">❌ 不正解... 正解は "${correctWord}" です。</div>`;
        if (!wrongBank.includes(correctWord)) {
            wrongBank.push(correctWord);
            saveLocalStorage();
        }
    }
}

// ========== STORY LAB ==========
function renderStoryLab() {
    const html = `
        <div class="vocab-card">
            <h3>📖 ストーリーラボ</h3>
            <button onclick="generateStory()">✨ 新しいストーリーを生成 / Generate Story</button>
            <div id="storyOutput" class="story-output" style="margin-top: 20px;">
                ボタンをクリックしてストーリーを生成してください。<br>Click the button to generate a story.
            </div>
        </div>
    `;
    mainContent.innerHTML = html;
}

function generateStory() {
    const shuffled = [...currentClusterWords].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, 4);
    
    let story = '';
    selected.forEach(wordObj => {
        const sentence = wordObj.sentences[Math.floor(Math.random() * wordObj.sentences.length)];
        story += sentence + ' ';
    });
    
    // Highlight words
    selected.forEach(wordObj => {
        const regex = new RegExp(`\\b${wordObj.word}\\b`, 'gi');
        story = story.replace(regex, `<span class="highlight">${wordObj.word}</span>`);
    });
    
    document.getElementById('storyOutput').innerHTML = story;
}

// ========== WRITING CHALLENGE ==========
function renderWritingChallenge() {
    const randomWord1 = currentClusterWords[Math.floor(Math.random() * currentClusterWords.length)];
    let randomWord2 = currentClusterWords[Math.floor(Math.random() * currentClusterWords.length)];
    while (randomWord2.word === randomWord1.word) {
        randomWord2 = currentClusterWords[Math.floor(Math.random() * currentClusterWords.length)];
    }
    
    const html = `
        <div class="vocab-card">
            <h3>✍️ ライティングチャレンジ</h3>
            <div class="sentence">
                <strong>次の単語を使って段落を書きなさい (150語程度):</strong><br>
                📌 ${randomWord1.word} (${randomWord1.synonym})<br>
                📌 ${randomWord2.word} (${randomWord2.synonym})
            </div>
            <textarea id="writingInput" rows="8" style="width: 100%; margin: 15px 0; padding: 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg); color: var(--text);" placeholder="ここに文章を書いてください..."></textarea>
            <button onclick="saveWriting()">💾 保存 / Save</button>
            <button onclick="renderWritingChallenge()">🔄 新しいお題 / New Challenge</button>
            <div id="writingFeedback" style="margin-top: 10px;"></div>
        </div>
    `;
    mainContent.innerHTML = html;
    
    // Load saved writing if exists
    const saved = localStorage.getItem('ielts_lastWriting');
    if (saved) {
        document.getElementById('writingInput').value = saved;
    }
}

function saveWriting() {
    const input = document.getElementById('writingInput');
    localStorage.setItem('ielts_lastWriting', input.value);
    document.getElementById('writingFeedback').innerHTML = '<div class="quiz-feedback correct">✅ 保存しました / Saved!</div>';
    dailyGoal.todayCount++;
	markTodayStudied();  // ADD THIS LINE
    saveLocalStorage();
    setTimeout(() => {
        const feedback = document.getElementById('writingFeedback');
        if (feedback) feedback.innerHTML = '';
    }, 2000);
}

// ========== DASHBOARD ==========
function showDashboard() {
    let html = '<h2>📊 進捗ダッシュボード <span class="en">Progress Dashboard</span></h2>';
    
    for (const cluster in vocabData) {
        const total = vocabData[cluster].length;
        let mastered = 0;
        if (srsData[cluster]) {
            mastered = Object.values(srsData[cluster]).filter(srs => srs.box >= 4).length;
        }
        const percent = total > 0 ? (mastered / total * 100).toFixed(0) : 0;
        const clusterName = getClusterNameJa(cluster);
        
        html += `
            <div class="progress-cluster">
                <div>${clusterName}</div>
                <div class="progress-bar-container">
                    <div class="progress-bar-fill" style="width: ${percent}%;"></div>
                </div>
                <div class="progress-label">${mastered}/${total} <span class="en">words mastered</span></div>
            </div>
        `;
    }
    
    html += `
        <hr>
        <h3>📅 学習統計 <span class="en">Study Statistics</span></h3>
        <p><span class="jp">今日の学習単語数:</span> <span class="en">Words studied today:</span> ${dailyGoal.todayCount} / ${dailyGoal.target}</p>
        <p><span class="jp">連続学習日数:</span> <span class="en">Current streak:</span> ${dailyGoal.streak} <span class="jp">日</span> <span class="en">days</span></p>
        <p><span class="jp">間違い単語帳:</span> <span class="en">Wrong bank:</span> ${wrongBank.length} <span class="jp">単語</span> <span class="en">words</span></p>
        
        <div class="print-export-buttons">
            <button onclick="exportClusterToPrint()" class="print-btn">🖨️ 現在のカテゴリーを印刷 <span class="en">Print Current Category</span></button>
            <button onclick="exportWrongBankToPrint()" class="print-btn">⚠️ 間違い単語帳を印刷 <span class="en">Print Wrong Bank</span></button>
        </div>
        
        <!-- NEW: Export/Import Progress Buttons -->
        <div class="print-export-buttons" style="margin-top: 15px;">
            <button onclick="exportData()" class="print-btn">📤 エクスポート <span class="en">Export Progress</span></button>
            <button onclick="importData()" class="print-btn">📥 インポート <span class="en">Import Progress</span></button>
        </div>
        
        <div style="margin-top: 20px;">
            <label><span class="jp">目標設定</span> <span class="en">Daily Goal</span>: <input type="number" id="goalInput" value="${dailyGoal.target}" style="width: 80px;"> <span class="en">words/day</span></label>
            <button onclick="updateGoal()"><span class="jp">更新</span> <span class="en">Update</span></button>
        </div>
    `;
    
    // Add badges section
    html += `
        <hr>
        <h3>🏅 獲得実績 <span class="en">Achievements Earned</span></h3>
        <div class="badges-container">
    `;
    
    for (let i = 0; i < allBadges.length; i++) {
        const badge = allBadges[i];
        const isEarned = earnedBadges.includes(badge.id);
        html += `
            <div class="badge ${isEarned ? 'earned' : ''}">
                <div class="badge-icon">${badge.icon}</div>
                <div class="badge-name">${badge.name}<br><span class="en">${badge.nameEn}</span></div>
                <div class="badge-desc">${badge.desc}<br><span class="en">${getBadgeDescEn(badge)}</span></div>
            </div>
        `;
    }
    
    html += `</div>`;
    
    // Now call showModalContent with the complete html
    showModalContent(html);
}
function updateGoal() {
    const input = document.getElementById('goalInput');
    dailyGoal.target = parseInt(input.value) || 15;
    saveLocalStorage();
    showDashboard();
}

function checkBadges() {
    let newBadges = [];
    
    // Calculate total studied words - count words with ANY rating (easy/hard/again)
    let studiedWords = 0;
    for (const cluster in srsData) {
        if (srsData[cluster]) {
            // Count words that have been rated at least once
            const ratedWords = Object.values(srsData[cluster]).filter(srs => srs.lastRating !== null);
            studiedWords += ratedWords.length;
        }
    }
    totalStudyCount = studiedWords;
    
    console.log("Total studied words:", totalStudyCount); // Debug
    
    // Check each badge
    for (const badge of allBadges) {
        if (earnedBadges.includes(badge.id)) continue;
        
        let achieved = false;
        
        switch (badge.requirement) {
            case 'studyCount':
                if (totalStudyCount >= badge.target) achieved = true;
                break;
            case 'streak':
                if ((dailyGoal.streak || 0) >= badge.target) achieved = true;
                break;
            case 'quizCorrect':
                if (quizCorrectCount >= badge.target) achieved = true;
                break;
            case 'clusterComplete':
                for (const cluster in srsData) {
                    const total = vocabData[cluster]?.length || 0;
                    const mastered = Object.values(srsData[cluster] || {}).filter(s => s.box >= 4).length;
                    if (mastered >= total && total > 0) {
                        achieved = true;
                        break;
                    }
                }
                break;
            case 'wrongBankClear':
                // Only award when user has CLEARED the wrong bank (not just empty)
                // We track this with a flag in localStorage
                const wrongBankCleared = localStorage.getItem('ielts_wrongBankCleared') === 'true';
                if (wrongBankCleared && totalStudyCount > 0) achieved = true;
                break;
        }
        
        if (achieved) {
            earnedBadges.push(badge.id);
            newBadges.push(badge);
        }
    }
    
    if (newBadges.length > 0) {
        saveLocalStorage();
        showNewBadgeModal(newBadges);
    }
}

function showNewBadgeModal(newBadges) {
    let badgesHtml = '';
    for (const badge of newBadges) {
        badgesHtml += `
            <div class="badge earned" style="display: inline-flex; margin: 5px; padding: 15px; background: var(--primary); color: white; border-radius: 12px;">
                <div class="badge-icon" style="font-size: 2rem; margin-right: 10px;">${badge.icon}</div>
                <div>
                    <div class="badge-name" style="font-weight: bold;">${badge.name}<br><span class="en">${badge.nameEn}</span></div>
                    <div class="badge-desc" style="font-size: 0.8rem;">${badge.desc}<br><span class="en">${getBadgeDescEn(badge)}</span></div>
                </div>
            </div>
        `;
    }
    
    showModal(`
        <div style="text-align: center;">
            <h2>🎉 実績解除！ <span class="en">Achievement Unlocked!</span></h2>
            <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin: 20px 0;">
                ${badgesHtml}
            </div>
            <button onclick="this.closest('.modal').remove()" style="padding: 10px 20px; background: var(--primary); color: white; border: none; border-radius: 8px;">閉じる / Close</button>
        </div>
    `);
}

function getBadgeDescEn(badge) {
    const descMap = {
        'first_word': 'First word studied',
        'ten_words': '10 words studied',
        'fifty_words': '50 words studied',
        'hundred_words': '100 words studied',
        'three_day_streak': '3 day streak',
        'seven_day_streak': '7 day streak',
        'thirty_day_streak': '30 day streak',
        'perfect_quiz': '10 quiz questions correct',
        'cluster_master': 'Mastered an entire category',
        'wrong_bank_clear': 'Cleared the wrong bank'
    };
    return descMap[badge.id] || '';
}
// ========== WRONG BANK ==========
function showWrongBank() {
    if (wrongBank.length === 0) {
        showModalContent('<h2>⚠️ 間違い単語帳</h2><p>間違えた単語はありません。素晴らしい！</p>');
        return;
    }
    
    let html = '<h2>⚠️ 間違い単語帳</h2><p>復習が必要な単語:</p><ul>';
    for (const word of wrongBank) {
        html += `<li>${word}</li>`;
    }
    html += '</ul>';
    html += '<div class="print-export-buttons"><button onclick="exportWrongBankToPrint()" class="print-btn">🖨️ 印刷する <span class="en">Print</span></button></div>';
    html += '<button onclick="clearWrongBank()" style="margin-top: 10px;">間違い単語帳をクリア</button>';
    
    showModalContent(html);
}

function clearWrongBank() {
    wrongBank = [];
    localStorage.setItem('ielts_wrongBankCleared', 'true');  // ADD THIS
    saveLocalStorage();
    checkBadges();  
    showModalContent('<h2>✅ クリアしました</h2>');
}

// ========== EXPORT/IMPORT ==========
function exportData() {
    const exportObj = {
        srsData: srsData,
        wrongBank: wrongBank,
        dailyGoal: dailyGoal,
        settings: settings,
        exportDate: new Date().toISOString()
    };
    const dataStr = JSON.stringify(exportObj, null, 2);
    const blob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ielts_backup_${new Date().toISOString().slice(0,19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importData() {
    importFileInput.click();
    importFileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const imported = JSON.parse(event.target.result);
                if (imported.srsData) srsData = imported.srsData;
                if (imported.wrongBank) wrongBank = imported.wrongBank;
                if (imported.dailyGoal) dailyGoal = imported.dailyGoal;
                if (imported.settings) settings = imported.settings;
                saveLocalStorage();
                applyDarkMode();
                loadCluster(currentCluster);
                renderMode();
                showModalContent('✅ インポート完了！');
            } catch(err) {
                showModalContent('❌ ファイルが正しくありません');
            }
        };
        reader.readAsText(file);
    };
}

function resetAllProgress() {
    if (confirm('全ての学習データをリセットします。よろしいですか？\nThis will delete all your progress.')) {
        localStorage.clear();
		localStorage.setItem('ielts_wrongBankCleared', 'false');  
        location.reload();
    }
}

// ========== MODAL UTILITY ==========
function showModal(content) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.backgroundColor = 'rgba(0,0,0,0.8)';
    modal.innerHTML = `<div class="modal-content" style="background: var(--surface); border-radius: 16px; max-width: 500px; width: 90%; padding: 20px; max-height: 80vh; overflow-y: auto;">${content}</div>`;
    document.body.appendChild(modal);
}

function showModalContent(html) {
    const modalHtml = `
        <div style="text-align: left;">
            ${html}
            <button onclick="this.closest('.modal').remove()" style="margin-top: 20px; padding: 10px 20px; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer;">
                閉じる / Close
            </button>
        </div>
    `;
    showModal(modalHtml);
}

// ========== KEYBOARD SHORTCUTS ==========
function closeModal() {
    const modal = document.querySelector('.modal');
    if (modal) {
        modal.remove();
    }
}

function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Don't trigger shortcuts if user is typing in an input or textarea
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        
        switch(e.key) {
            // Navigation
            case 'ArrowLeft':
                e.preventDefault();
                prevWord();
                break;
            case 'ArrowRight':
                e.preventDefault();
                nextWord();
                break;
            case ' ':
            case 'Space':
                e.preventDefault();
                toggleReveal();
                break;
            // Mode shortcuts
            case 'f':
            case 'F':
                e.preventDefault();
                switchMode('flashcard');
                break;
            case 'q':
            case 'Q':
                e.preventDefault();
                switchMode('quiz');
                break;
            case 'c':
            case 'C':
                e.preventDefault();
                switchMode('cloze');
                break;
            case 's':
            case 'S':
                e.preventDefault();
                switchMode('story');
                break;
            case 'w':
            case 'W':
                e.preventDefault();
                switchMode('writing');
                break;
            // Dashboard shortcut
            case 'd':
            case 'D':
                e.preventDefault();
                showDashboard();
                break;
            // Close modal with Escape key
            case 'Escape':
                e.preventDefault();
                closeModal();
                break;
        }
    });
}

function switchMode(mode) {
    currentMode = mode;
    // Update active tab highlight
    document.querySelectorAll('.mode-tab').forEach(tab => {
        if (tab.dataset.mode === mode) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    renderMode();
}

function switchMode(mode) {
    currentMode = mode;
    // Update active tab highlight
    document.querySelectorAll('.mode-tab').forEach(tab => {
        if (tab.dataset.mode === mode) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    renderMode();
}
// ========== HONOR LOCK ==========
function checkHonorLock() {
    const firstUse = localStorage.getItem('ielts_firstUse');
    const now = Date.now();
    
    if (!firstUse) {
        localStorage.setItem('ielts_firstUse', now);
        return;
    }
    
    const daysSinceFirst = (now - parseInt(firstUse)) / (1000 * 60 * 60 * 24);
    const lastReminder = localStorage.getItem('ielts_lastReminder');
    const reminderDismissed = localStorage.getItem('ielts_reminderDismissed');
    
    if (reminderDismissed === 'true' && lastReminder && (now - parseInt(lastReminder)) < 7 * 24 * 60 * 60 * 1000) {
        return;
    }
    
    if (daysSinceFirst >= 3) {
        showHonorModal();
    }
}

function showHonorModal() {
    const html = `
        <h2>📚 応援のお願い</h2>
        <p>このアプリは役に立っていますか？</p>
        <p>開発者は無料で提供しています。もしサポートしていただけるなら、¥500のご寄付で開発が続けられます。</p>
        <p><small>Has this app been helpful? A small donation helps keep it going.</small></p>
        <div style="margin-top: 20px;">
            <button onclick="window.open('https://www.paypal.me/tonygariano', '_blank'); this.closest('.modal').remove();">💝 寄付する / Donate</button>
            <button onclick="this.closest('.modal').remove();">あとで / Later</button>
            <button onclick="localStorage.setItem('ielts_reminderDismissed', 'true'); localStorage.setItem('ielts_lastReminder', Date.now()); this.closest('.modal').remove();">1週間表示しない</button>
        </div>
    `;
    showModal(html);
}

// ========== HELP PAGES ==========
function showHowTo() {
    showModalContent(`
        <h2>📘 勉強マニュアル <span class="en">Study Manual</span></h2>
        
        <h3>📚 このアプリの学習アプローチ</h3>
        <p>IELTS Band 6 を目指すための効果的な語彙学習法:</p>
        <ul>
            <li><strong>テーマ別学習</strong> - 10のカテゴリーに分かれた650+単語</li>
            <li><strong>Spaced Repetition (SRS)</strong> - 忘却曲線に基づいた復習タイミング</li>
            <li><strong>能動的想起</strong> - クイズや穴埋めで記憶を定着</li>
            <li><strong>文脈学習</strong> - 各単語に2つの例文を提供</li>
            <li><strong>学習記録</strong> - 連続学習日数や実績でモチベーション維持</li>
        </ul>
        
        <h3>📅 おすすめの学習法</h3>
        <ol>
            <li><strong>毎日15-20単語を目標に学習</strong> - 無理のないペースで継続</li>
            <li><strong>フラッシュカードで意味を確認</strong> - Easy/Hard/AgainでSRS調整</li>
            <li><strong>クイズで類義語をテスト</strong> - 理解度をチェック</li>
            <li><strong>穴埋め問題で文脈理解</strong> - 実際の使用例で学習</li>
            <li><strong>ストーリーラボで復習</strong> - ランダムな単語で文章作成</li>
            <li><strong>ライティングチャレンジで実践</strong> - 自由英作文の練習</li>
        </ol>
        
        <h3>🎯 各モードの使い方</h3>
        <ul>
            <li><strong>📇 フラッシュカード:</strong> 単語を学習。Easy/Hard/AgainでSRSを調整。フィルターで復習が必要な単語のみ表示可能。</li>
            <li><strong>❓ クイズ:</strong> 類義語を4択から選択。間違えた単語は「間違い単語帳」に自動保存。</li>
            <li><strong>📝 穴埋め:</strong> 例文の空白に適切な単語を入力。</li>
            <li><strong>📖 ストーリーラボ:</strong> ランダムな単語からストーリーを自動生成。</li>
            <li><strong>✍️ ライティング:</strong> 指定された単語を使って段落を作成し保存可能。</li>
        </ul>
        
        <h3>🏆 実績システム</h3>
        <ul>
            <li>単語学習数に応じて10種類の実績を獲得</li>
            <li>連続学習日数で実績解除</li>
            <li>クイズ正解数、カテゴリー完全制覇など</li>
            <li>獲得した実績はダッシュボードで確認</li>
        </ul>
        
        <h3>⌨️ キーボードショートカット</h3>
        <ul>
            <li><kbd>←</kbd> / <kbd>→</kbd> - 前/次の単語</li>
            <li><kbd>Space</kbd> - 答えを表示/隠す</li>
            <li><kbd>Esc</kbd> - モーダルを閉じる</li>
            <li><kbd>F</kbd> <kbd>Q</kbd> <kbd>C</kbd> <kbd>S</kbd> <kbd>W</kbd> - モード切替</li>
            <li><kbd>D</kbd> - ダッシュボード表示</li>
        </ul>
        
        <h3>⚙️ その他の機能</h3>
        <ul>
            <li><strong>ダークモード:</strong> 右上の🌙/☀️ボタンで切替</li>
            <li><strong>音声速度調整:</strong> 0.75x / 1x から選択</li>
            <li><strong>印刷機能:</strong> カテゴリーや間違い単語帳を印刷可能</li>
            <li><strong>データ管理:</strong> エクスポート/インポートで学習データをバックアップ</li>
        </ul>
    `);
}

function showUserManual() {
    showModalContent(`
        <h2>📗 ユーザーマニュアル <span class="en">User Manual</span></h2>
        
        <h3>📌 はじめに</h3>
        <p>このアプリはIELTS Band 6 レベルの語彙力を効率的に習得するためのツールです。全ての機能はオフラインで動作します（音声読み上げのみインターネット接続が必要です）。</p>
        
        <h3>🎯 メイン画面の構成</h3>
        <ul>
            <li><strong>カテゴリー選択:</strong> 上部のボタンから学習テーマを選択（学術基礎、環境、教育、技術、健康、社会、経済、政府、動詞、接続語）</li>
            <li><strong>モード切替:</strong> 5つの学習モードをタブで切替</li>
            <li><strong>フッターボタン:</strong> ダッシュボード、間違い単語帳、データ管理、ヘルプ</li>
        </ul>
        
        <h3>📇 フラッシュカードモード</h3>
        <ul>
            <li>単語、類義語、2つの例文を表示</li>
            <li>「表示」ボタンで詳細を表示</li>
            <li>「音声」ボタンで発音を聞く（速度調整可能）</li>
            <li>「簡単/普通/もう一度」でSRS学習進度を記録</li>
            <li>「復習が必要」フィルターで未習得単語のみ表示</li>
        </ul>
        
        <h3>❓ クイズモード</h3>
        <ul>
            <li>表示された単語の類義語を4択から選択</li>
            <li>正解すると学習カウントに加算</li>
            <li>間違えると「間違い単語帳」に自動保存</li>
            <li>「新しい問題」ボタンで次の問題へ</li>
        </ul>
        
        <h3>📝 穴埋めモード</h3>
        <ul>
            <li>例文中の空白に適切な単語を入力</li>
            <li>大文字/小文字は区別されません</li>
            <li>正解すると学習カウントに加算</li>
        </ul>
        
        <h3>📖 ストーリーラボ</h3>
        <ul>
            <li>「新しいストーリーを生成」ボタンでランダムな単語から文章を自動生成</li>
            <li>学習した単語がハイライト表示されます</li>
            <li>文章構成の参考になります</li>
        </ul>
        
        <h3>✍️ ライティングチャレンジ</h3>
        <ul>
            <li>ランダムな2つの単語が提示されます</li>
            <li>その単語を使って150語程度の段落を作成</li>
            <li>「保存」ボタンで文章を保存（次回も表示）</li>
            <li>「新しいお題」で別の単語に変更</li>
        </ul>
        
        <h3>📊 ダッシュボード</h3>
        <ul>
            <li>各カテゴリーの習熟度を表示（バーと数値）</li>
            <li>今日の学習単語数と目標設定</li>
            <li>連続学習日数</li>
            <li>間違い単語帳の単語数</li>
            <li>獲得した実績一覧</li>
            <li>カテゴリー印刷 / 間違い単語帳印刷</li>
            <li>エクスポート / インポートボタン</li>
        </ul>
        
        <h3>⚠️ 間違い単語帳</h3>
        <ul>
            <li>クイズや穴埋めで間違えた単語が自動保存</li>
            <li>リストを確認して復習可能</li>
            <li>「クリア」ボタンでリセット（実績解除あり）</li>
            <li>印刷ボタンで復習リストを出力</li>
        </ul>
        
        <h3>📅 学習カレンダー</h3>
        <ul>
            <li>フッターの📅ボタンから表示</li>
            <li>学習した日が緑色で表示</li>
            <li>現在の連続記録を表示</li>
            <li>月単位で表示切替可能</li>
        </ul>
        
        <h3>💾 データ移行方法（複数デバイス間での引継ぎ）</h3>
        <p><strong>別のデバイスで学習を続ける場合：</strong></p>
        <ol>
            <li><strong>元のデバイス（例：スマートフォン）:</strong></li>
            <ul>
                <li>ダッシュボードを開く（📊 進捗ダッシュボード）</li>
                <li>「📤 エクスポート / Export Progress」をタップ</li>
                <li>JSONファイルがダウンロードされます</li>
                <li>そのファイルを新しいデバイスに転送（メール、クラウドストレージ、USBなど）</li>
            </ul>
            <li><strong>新しいデバイス（例：パソコン）:</strong></li>
            <ul>
                <li>IELTSアプリを開く</li>
                <li>ダッシュボードを開く（📊 進捗ダッシュボード）</li>
                <li>「📥 インポート / Import Progress」をクリック</li>
                <li>転送したJSONファイルを選択</li>
                <li>学習データが復元されます！</li>
            </ul>
        </ol>
        <p><small>※ エクスポート/インポート機能は全ての学習データ（SRS進度、連続記録、実績、間違い単語帳など）を保存します。</small></p>
        
        <h3>⚙️ データ管理</h3>
        <ul>
            <li><strong>エクスポート:</strong> 学習データをJSONファイルに保存（デバイス間の移行に使用）</li>
            <li><strong>インポート:</strong> 保存したデータを復元（別デバイス間の移行可能）</li>
            <li><strong>リセット:</strong> 全ての学習データを初期化</li>
        </ul>
        
        <h3>⌨️ キーボードショートカット</h3>
        <ul>
            <li><kbd>←</kbd> / <kbd>→</kbd> - 前/次の単語</li>
            <li><kbd>Space</kbd> - 答えを表示/隠す</li>
            <li><kbd>Esc</kbd> - モーダルを閉じる</li>
            <li><kbd>F</kbd> - フラッシュカード</li>
            <li><kbd>Q</kbd> - クイズ</li>
            <li><kbd>C</kbd> - 穴埋め</li>
            <li><kbd>S</kbd> - ストーリーラボ</li>
            <li><kbd>W</kbd> - ライティング</li>
            <li><kbd>D</kbd> - ダッシュボード</li>
        </ul>
        
        <h3>🔊 音声機能について</h3>
        <ul>
            <li>音声読み上げにはインターネット接続が必要です</li>
            <li>速度は0.75x（ゆっくり）と1x（通常）から選択可能</li>
            <li>オフライン時は通知が表示されます</li>
        </ul>
        
        <h3>📱 動作環境</h3>
        <ul>
            <li>推奨ブラウザ: Chrome, Firefox, Safari, Edge（最新版）</li>
            <li>オフライン動作: 大部分の機能がオフラインで動作</li>
            <li>データ保存: ブラウザのlocalStorageを使用</li>
        </ul>
    `);
}

function showDisclaimer() {
    showModalContent(`
        <h2>⚖️ 免責事項 / Disclaimer</h2>
        <p>このアプリは公式のIELTSアプリではありません。学習補助ツールとしてご利用ください。</p>
        <p>本アプリの内容の正確性については保証できません。IELTS試験の合格を保証するものではありません。</p>
        <p>ユーザーの自己責任でご利用ください。開発者は本アプリの使用によるいかなる損害も負いません。</p>
        <hr>
        <p><small>This app is not official IELTS material. Use at your own discretion. The developer assumes no responsibility for accuracy or exam results.</small></p>
    `);
}

function showContact() {
    showModalContent(`
        <h2>📧 お問い合わせ</h2>
        <p>フィードバックやご質問はこちらまで:</p>
        <p><a href="mailto:tony.gariano@gmail.com?subject=IELTS%20アプリ%20フィードバック&body=Hello%20Tony%2C%0A%0AI%20have%20the%20following%20feedback%3A">tony.gariano@gmail.com</a></p>
        <textarea id="feedbackText" rows="5" style="width:100%; margin:10px 0; padding:8px;" placeholder="フィードバックを入力してください..."></textarea>
        <button onclick="sendFeedback()">送信 / Send</button>
    `);
}

function sendFeedback() {
    const feedback = document.getElementById('feedbackText').value;
    if (feedback) {
        window.location.href = `mailto:tony.gariano@gmail.com?subject=IELTS%20アプリ%20フィードバック&body=${encodeURIComponent(feedback)}`;
    }
}

// ========== EVENT LISTENERS ==========
function setupEventListeners() {
    darkModeToggle.onclick = toggleDarkMode;
    exportBtn.onclick = exportData;
    importBtn.onclick = importData;
    resetBtn.onclick = resetAllProgress;
    dashboardBtn.onclick = showDashboard;
    wrongBankBtn.onclick = showWrongBank;
	document.getElementById('calendarBtn').onclick = showStreakCalendar;
    
    document.querySelectorAll('.mode-tab').forEach(tab => {
        tab.onclick = () => {
            document.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentMode = tab.dataset.mode;
            renderMode();
        };
    });
    
    document.getElementById('howtoLink').onclick = (e) => { e.preventDefault(); showHowTo(); };
    document.getElementById('userManualLink').onclick = (e) => { e.preventDefault(); showUserManual(); };
    document.getElementById('disclaimerLink').onclick = (e) => { e.preventDefault(); showDisclaimer(); };
    document.getElementById('contactLink').onclick = (e) => { e.preventDefault(); showContact(); };
}

// Start the app
init();