// Supabase Configuration
const SUPABASE_URL = 'https://oxcqdrldqjxlgvszqcem.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94Y3FkcmxkcWp4bGd2c3pxY2VtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NDE4NDEsImV4cCI6MjA4OTIxNzg0MX0.cVFhCAZek3EQ2hoCznPNVZVza9fWStfPrMXt88vrvx0';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// External Link Handler - Opens links in system browser instead of iframe
function openExternalLink(url) {
    // Check if running in iframe
    const isInIframe = window !== window.parent;
    
    if (isInIframe) {
        // Send message to parent (wrapper) to open link
        try {
            window.parent.postMessage({
                type: 'openExternalLink',
                url: url
            }, '*');
        } catch (e) {
            console.log('postMessage error:', e);
            // Fallback - try direct open
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    } else {
        // Not in iframe - open directly
        window.open(url, '_blank', 'noopener,noreferrer');
    }
}

// Listen for messages from iframe (for direct browser usage)
window.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'openExternalLink' && event.data.url) {
        // If this window received a message (shouldn't happen in normal usage)
        console.log('Received link to open:', event.data.url);
    }
});

// State
let currentUser = null;
let currentUserData = null;
let activeFilter = 'all';
let activeNotifTab = 'system';
let accountNotifications = [];
let dailyAdsTasks = [];
let allTasks = [];
let completedTasks = [];
let isFetchingUser = false;
let authListenerInitialized = false;
let authTimeout = null;
let lastAdsDate = null;
let appSettings = {
    min_withdrawal: 100,
    referral_bonus_hzn: 2000,
    referral_commission_percent: 5,
    exchange_rate: 0.01,
    withdrawal_day: 'sunday'
};

// Load app settings
async function loadAppSettings() {
    try {
        const { data } = await supabaseClient.from('settings').select('*').eq('id', 'app').single();
        if (data) {
            appSettings = {
                min_withdrawal: data.min_withdrawal || 100,
                referral_bonus_hzn: data.referral_bonus_hzn || 2000,
                referral_commission_percent: data.referral_commission_percent || 5,
                exchange_rate: data.exchange_rate || 0.01,
                withdrawal_day: data.withdrawal_day || 'sunday'
            };
            localStorage.setItem('appSettings', JSON.stringify(appSettings));
        } else {
            const cached = localStorage.getItem('appSettings');
            if (cached) appSettings = JSON.parse(cached);
        }
    } catch (e) {
        const cached = localStorage.getItem('appSettings');
        if (cached) appSettings = JSON.parse(cached);
    }
    updateUIWithSettings();
}

function updateUIWithSettings() {
    const withdrawMinEl = document.getElementById('withdraw-min-amount');
    if (withdrawMinEl) withdrawMinEl.textContent = appSettings.min_withdrawal;
    
    const commissionEl = document.getElementById('referral-commission-display');
    if (commissionEl) commissionEl.textContent = appSettings.referral_commission_percent;
    
    const withdrawalDayEl = document.getElementById('withdrawal-day-display');
    if (withdrawalDayEl) withdrawalDayEl.textContent = appSettings.withdrawal_day.charAt(0).toUpperCase() + appSettings.withdrawal_day.slice(1);
}

// Global Error Handling to prevent stuck loader
window.addEventListener('unhandledrejection', event => {
    console.error('Unhandled promise rejection:', event.reason);
    if (typeof hideLoading === 'function') hideLoading();
});

window.addEventListener('error', event => {
    console.error('Global error:', event.error);
    if (typeof hideLoading === 'function') hideLoading();
});

// UI State
// Weighted spin rewards based on probability
// Daily: 20 HZN (80%), other moderate rewards (40-50%), 5000 once per month
const MAX_DAILY_SPINS = 5;
const spinRewards = [
    { value: 0, weight: 10 },       // 10% - nothing
    { value: 20, weight: 80 },      // 80% - 20 HZN (most common)
    { value: 40, weight: 25 },      // 25% - 40 HZN
    { value: 60, weight: 15 },      // 15% - 60 HZN
    { value: 100, weight: 8 },      // 8% - 100 HZN
    { value: 200, weight: 4 },      // 4% - 200 HZN
    { value: 500, weight: 1.5 },    // 1.5% - 500 HZN
    { value: 2000, weight: 0.3 },   // 0.3% - 2000 HZN (rare)
    { value: 5000, weight: 0.05 }   // 0.05% - 5000 HZN (once a month - very rare)
];

let monthlyBigWinGiven = false;
let lastMonthlyReset = null;

function checkMonthlyBigWin() {
    const now = new Date();
    const currentMonth = now.getMonth() + '-' + now.getFullYear();
    
    if (lastMonthlyReset !== currentMonth) {
        monthlyBigWinGiven = false;
        lastMonthlyReset = currentMonth;
    }
    return monthlyBigWinGiven;
}

function markMonthlyBigWinGiven() {
    monthlyBigWinGiven = true;
}

// Get weighted random reward
function getWeightedReward() {
    const totalWeight = spinRewards.reduce((sum, r) => sum + r.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const reward of spinRewards) {
        random -= reward.weight;
        if (random <= 0) {
            return reward.value;
        }
    }
    return spinRewards[0].value;
}

// Global functions for HTML handlers
window.showScreen = showScreen;
window.showDashboardScreen = showDashboardScreen;
window.openSignup = openSignup;
window.openLogin = openLogin;
window.goToLanding = goToLanding;
window.logout = logout;
window.togglePassword = togglePassword;
window.showCheckIn = showCheckIn;
window.closeCheckIn = closeCheckIn;
window.claimDay = claimDay;
window.showSpinWheel = showSpinWheel;
window.closeSpin = closeSpin;
window.spinWheel = spinWheel;
window.closeAdEarly = closeAdEarly;
window.showQuiz = showQuiz;
window.closeQuiz = closeQuiz;
window.showVideos = showVideos;
window.closeVideos = closeVideos;
window.startTask = startTask;
window.startAdTask = startAdTask;
window.closeTaskConfirm = closeTaskConfirm;
window.confirmTaskComplete = confirmTaskComplete;
window.startTaskProcess = startTaskProcess;
window.closeTaskWaiting = closeTaskWaiting;
window.copyReferralCode = copyReferralCode;
window.shareOnWhatsApp = shareOnWhatsApp;
window.shareOnFacebook = shareOnFacebook;
window.shareOnInstagram = shareOnInstagram;
window.toggleAnnouncement = toggleAnnouncement;
window.showAnnouncementMenu = showAnnouncementMenu;
window.closeAnnouncementMenu = closeAnnouncementMenu;
window.markAllRead = markAllRead;
window.clearAllAnnouncements = clearAllAnnouncements;
window.showReferralGuide = showReferralGuide;
window.closeReferralGuide = closeReferralGuide;
window.showNotifTab = showNotifTab;
window.switchNotifTab = switchNotifTab;
window.changeProfilePhoto = changeProfilePhoto;
window.selectPaymentMethod = selectPaymentMethod;
window.selectWithdrawalMethod = selectWithdrawalMethod;
window.fetchLocation = fetchLocation;
window.toggleFaq = toggleFaq;
window.goToInvite = goToInvite;
window.openTasks = openTasks;
window.openAnnouncements = openAnnouncements;
window.openAnnouncementsPage = openAnnouncementsPage;
window.setTaskFilter = setTaskFilter;
window.showTerms = showTerms;
window.closeTerms = closeTerms;
window.acceptTerms = acceptTerms;
window.switchTermsTab = switchTermsTab;
window.doCheckIn = doCheckIn;

let lastAuthEvent = 0;
const AUTH_EVENT_COOLDOWN = 3000; // 3 seconds cooldown between auth events
let currentScreen = 'home'; // Track current dashboard screen

// Auth State Listener
supabaseClient.auth.onAuthStateChange(async (event, session) => {
    const now = Date.now();
    if (now - lastAuthEvent < AUTH_EVENT_COOLDOWN) {
        return;
    }
    lastAuthEvent = now;

    if (authTimeout) clearTimeout(authTimeout);

    if (session) {
        authTimeout = setTimeout(async () => {
            if (isFetchingUser) {
                hideLoading();
                return;
            }
            if (currentUser?.id !== session.user.id || !currentUserData) {
                currentUser = session.user;
                await loadUserData();
            } else {
                hideLoading();
            }
        }, 500);
    } else {
        resetAppState();
        if (event === 'SIGNED_OUT') goToLanding();
        hideLoading();
    }
});

async function loadUserData(retries = 2) {
    if (!currentUser || isFetchingUser) return;
    isFetchingUser = true;
    try {
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('id', currentUser.id)
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            const username = 'user_' + currentUser.id.substring(0, 8);
            const userRefCode = 'M' + Math.random().toString(36).substring(2, 8).toUpperCase();
            
            const { error: insertError } = await supabaseClient.from('users').insert([{
                id: currentUser.id,
                username: username,
                email: currentUser.email || 'user@example.com',
                phone: '',
                fullname: username,
                referral_code: userRefCode,
                referred_by: null,
                balance: 0,
                    status: 'active'
            }]);
            
            if (insertError) {
                console.error('Error creating user record:', insertError);
                if (retries > 0) {
                    isFetchingUser = false;
                    setTimeout(() => loadUserData(retries - 1), 1000);
                    return;
                }
                hideLoading();
                showToast('Account setup issue. Please contact support.', 'error');
                return;
            }
            
            // Retry to fetch the newly created user
            const { data: newData } = await supabaseClient
                .from('users')
                .select('*')
                .eq('id', currentUser.id)
                .maybeSingle();
            
            if (newData) {
                currentUserData = newData;
                updateUserUI();
                hideLoading();
                showScreen('home');
                return;
            }
            
            if (retries > 0) {
                isFetchingUser = false;
                setTimeout(() => loadUserData(retries - 1), 1000);
                return;
            }
            
            hideLoading();
            showToast('Account setup issue. Please contact support.', 'error');
            return;
        }

        currentUserData = data;

        // Isolate UI updates so one error doesn't block everything
        try { updateUserUI(); } catch (e) { console.error("UI update error:", e); }
        try { loadTasks(); } catch (e) { console.error("Tasks load error:", e); }
        try { loadInviteData(); } catch (e) { console.error("Invite load error:", e); }
        try { loadAnnouncements(); } catch (error) { console.error("Announcements load error:", error); }
        try { loadAppSettings(); } catch (error) { console.error("Settings load error:", error); }

        showScreen('dashboard');
        // Only switch to home if not already on a dashboard screen
        if (!currentScreen || currentScreen === 'home') {
            showDashboardScreen('home');
        }
        hideLoading();
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Error loading user data:', error);
            showToast('Error loading profile', 'error');
        }
        hideLoading();
    } finally {
        isFetchingUser = false;
    }
}

function resetAppState() {
    currentUser = null;
    currentUserData = null;
    currentScreen = 'home';
    accountNotifications = [];
    dailyAdsTasks = [];
    lastAdsDate = null;
}

// UI Controllers
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');

    if (screenId === 'withdrawal') {
        checkWithdrawalAvailability();
    }
}

async function showDashboardScreen(screenId) {
    if (isFetchingUser) {
        return;
    }
    
    currentScreen = screenId;
    document.querySelectorAll('.dashboard-screen').forEach(s => s.classList.remove('active'));
    const screen = document.getElementById(screenId + '-screen');
    if (!screen) return;
    screen.classList.add('active');

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        const onclick = item.getAttribute('onclick') || '';
        if (onclick.includes(`'${screenId}'`) || onclick.includes(`"${screenId}"`)) {
            item.classList.add('active');
        }
    });

    if (screenId === 'home') {
        if (!currentUserData) loadUserData();
        await checkAndResetSpins();
        updateSpinUI();
    }
    if (screenId === 'tasks') loadTasks();
    if (screenId === 'invite') loadInviteData();
    if (screenId === 'announcements') {
        loadAnnouncements();
    }
    if (screenId === 'profile') loadProfileData();
}

// Signup & Login
async function openSignup() { showScreen('signup'); }
async function openLogin() { showScreen('login'); }
function goToLanding() { 
    loadLandingStats();
    showScreen('landing'); 
}

// Landing Stats - Daily Growth System
function loadLandingStats() {
    const today = new Date().toDateString();
    const storedDate = localStorage.getItem('landingStatsDate');
    const usersKey = 'landing_users';
    const payoutsKey = 'landing_payouts';
    
    let users = parseInt(localStorage.getItem(usersKey)) || 1000;
    let payouts = parseInt(localStorage.getItem(payoutsKey)) || 25000;
    
    if (storedDate !== today) {
        const newUsers = Math.floor(Math.random() * 50) + 20;
        const newPayouts = Math.floor(Math.random() * 5000) + 1000;
        users += newUsers;
        payouts += newPayouts;
        localStorage.setItem(usersKey, users);
        localStorage.setItem(payoutsKey, payouts);
        localStorage.setItem('landingStatsDate', today);
    }
    
    document.getElementById('total-users').textContent = users.toLocaleString();
    document.getElementById('total-payouts').textContent = 'Rs ' + payouts.toLocaleString();
}

document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();
    const username = document.getElementById('signup-username').value.trim().toLowerCase();
    const email = document.getElementById('signup-email').value.trim();
    const phone = document.getElementById('signup-phone').value.trim();
    const password = document.getElementById('signup-password').value;
    const referralCode = document.getElementById('signup-referral').value.trim().toUpperCase();

    try {
        const { data: existingUser } = await supabaseClient.from('users').select('username').eq('username', username).maybeSingle();
        if (existingUser) {
            hideLoading();
            showToast('Username already taken!', 'error');
            return;
        }

        // Check if referral code is valid
        let referrerUser = null;
        if (referralCode) {
            const { data: refUser } = await supabaseClient.from('users').select('*').eq('referral_code', referralCode).maybeSingle();
            referrerUser = refUser;
        }

        const { data: authData, error: authError } = await supabaseClient.auth.signUp({ email, password });
        if (authError) throw authError;
        if (!authData.user) throw new Error('Failed to create user account');

        const userRefCode = 'M' + Math.random().toString(36).substring(2, 8).toUpperCase();
        
        // Give new user 4000 HZN if referral code is valid
        const newUserBalance = referrerUser ? 4000 : 0;
        
        const { error: userInsertError } = await supabaseClient.from('users').insert([{
            id: authData.user.id,
            username,
            email,
            phone,
            fullname: username,
            referral_code: userRefCode,
            referred_by: referralCode || null,
            balance: newUserBalance,
            status: 'active'
        }]);
        
        if (userInsertError) {
            console.error('User insert error:', userInsertError);
            // Try to delete the auth user if insert fails
            await supabaseClient.auth.admin.deleteUser(authData.user.id);
            throw new Error('Failed to create account. Please try again.');
        }

        // Give referrer 2000 HZN reward + check if they have 5 referrals now
        if (referrerUser) {
            // Check total referrals for this referrer
            const { data: allReferrals } = await supabaseClient.from('users')
                .select('id')
                .eq('referred_by', referrerUser.referral_code);
            
            const totalRefs = (allReferrals?.length || 0) + 1; // +1 for current signup
            const rewardAmount = 2000;
            let bonusMultiplier = 1;
            
            // If 5+ referrals, give 2x bonus
            if (totalRefs >= 5) {
                bonusMultiplier = 2;
            }
            
            const totalReward = rewardAmount * bonusMultiplier;
            const newBalance = (referrerUser.balance || 0) + totalReward;
            await supabaseClient.from('users').update({ balance: newBalance }).eq('id', referrerUser.id);
            
            // Add transaction for referrer (wrapped in try-catch)
            try {
                await supabaseClient.from('transactions').insert([{
                    user_id: referrerUser.id,
                    type: 'referral_bonus',
                    amount: totalReward,
                    description: bonusMultiplier > 1 ? 'Referral bonus (5+ referrals - 2x!)' : 'Referral bonus - Friend signed up',
                    status: 'completed'
                }]);
            } catch (e) {
                console.log('Transaction insert error:', e.message);
            }
        }

        // Note: The auth listener will pick this up soon
        // But we add a safety timeout to hide loader if listener doesn't trigger
        setTimeout(hideLoading, 5000);
    } catch (error) {
        hideLoading();
        showToast(error.message, 'error');
    }
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();
    const identifier = document.getElementById('login-identifier').value.trim();
    const password = document.getElementById('login-password').value;

    try {
        let email = identifier;
        if (!identifier.includes('@')) {
            const { data: user } = await supabaseClient.from('users').select('email').or(`username.eq.${identifier},phone.eq.${identifier}`).maybeSingle();
            if (user) email = user.email;
        }

        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // Listener will handle redirection, but we ensure hideLoading
        setTimeout(hideLoading, 5000); // Safety timeout
    } catch (error) {
        hideLoading();
        showToast(error.message, 'error');
    }
});

function updateUserUI() {
    if (!currentUserData) return;
    const balance = currentUserData.balance || 0;

    const elements = {
        'user-name': currentUserData.fullname || 'User',
        'total-balance': balance,
        'my-referral-code': currentUserData.referral_code || '------',
        'profile-name': currentUserData.fullname || 'User',
        'profile-username': '@' + (currentUserData.username || 'user'),
        'profile-balance': balance
    };

    for (const [id, value] of Object.entries(elements)) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    const balanceRs = (balance * 0.01).toFixed(2);
    const rsElements = ['withdraw-available-rs', 'profile-pkr', 'earn-rate'];
    rsElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = balanceRs;
    });

    if (document.getElementById('withdraw-available-hzn')) {
        document.getElementById('withdraw-available-hzn').textContent = balance + ' HZN';
    }

    updateCheckInUI();
    updateSpinUI();
    updateNotificationBadges();
}

// Check-In
function showCheckIn() {
    document.getElementById('checkin-overlay').classList.add('active');
    
    // Calculate correct day based on last check-in date
    if (currentUserData) {
        const lastCheckIn = currentUserData.last_check_in;
        
        if (lastCheckIn) {
            const lastDate = new Date(lastCheckIn.split('T')[0]);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            lastDate.setHours(0, 0, 0, 0);
            const diffTime = today - lastDate;
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
            // If more than 1 day passed (missed a day), reset to day 0
            if (diffDays > 1) {
                currentUserData.check_in_day = 0;
            }
        } else {
            // No previous check-in, start from day 0
            currentUserData.check_in_day = 0;
        }
    }
    
    // Ensure claim-text spans exist in all day-status divs
    document.querySelectorAll('.week-day .day-status').forEach(statusDiv => {
        if (!statusDiv.querySelector('.claim-text')) {
            const claimText = document.createElement('span');
            claimText.className = 'claim-text';
            claimText.textContent = 'Claim';
            statusDiv.appendChild(claimText);
        }
    });
    
    // Update both dashboard UI and overlay UI
    updateCheckInUI();
    updateCheckInOverlay();
}

function closeCheckIn() { document.getElementById('checkin-overlay').classList.remove('active'); }

async function claimDay(dayNum) {
    if (!currentUser || !currentUserData) return;
    showLoading();
    try {
        // Rewards: Day 1: 20, Day 2: 40, Day 3: 80, Day 4: 160, Day 5: 320, Day 6: 640, Day 7: 1280
        const rewards = [20, 40, 80, 160, 320, 640, 1280];
        const reward = rewards[dayNum - 1];
        const newBalance = (currentUserData.balance || 0) + reward;
        const now = new Date().toISOString();
        
        await supabaseClient.from('users').update({
            balance: newBalance,
            check_in_day: dayNum,
            last_check_in: now
        }).eq('id', currentUser.id);

        try {
            await supabaseClient.from('transactions').insert([{
                user_id: currentUser.id,
                type: 'Check-In',
                amount: reward,
                status: 'completed'
            }]);
        } catch (e) {
            console.log('Transaction insert error:', e.message);
        }
        
        saveActivity('Daily Check-In', 'You claimed ' + reward + ' HZN for Day ' + dayNum);
        
        // Update local data instantly
        currentUserData.balance = newBalance;
        currentUserData.check_in_day = dayNum;
        currentUserData.last_check_in = now;
        
        // Update HZN UI instantly
        const totalBalEl = document.getElementById('total-balance');
        const profileBalEl = document.getElementById('profile-balance');
        if (totalBalEl) totalBalEl.textContent = newBalance;
        if (profileBalEl) profileBalEl.textContent = newBalance;
        
        // Update Rs UI instantly
        const newBalanceRs = (newBalance * 0.01).toFixed(2);
        const rsElements = ['withdraw-available-rs', 'profile-pkr', 'earn-rate'];
        rsElements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = newBalanceRs;
        });
        
        // Update check-in UI instantly
        updateCheckInUI();
        updateCheckInOverlay();
        
        // Update dashboard check-in card UI as well
        const day = currentUserData.check_in_day || 0;
        const lastCheckIn = currentUserData.last_check_in;
        const today = new Date().toISOString().split('T')[0];
        const checkedInToday = lastCheckIn && lastCheckIn.split('T')[0] === today;
        
        // Update all week-day elements in overlay
        document.querySelectorAll('#checkin-overlay .week-day').forEach((box, i) => {
            box.classList.remove('completed', 'current', 'claimed');
            const dayNum = i + 1;
            
            if (dayNum <= day) {
                box.classList.add('completed');
                if (checkedInToday && dayNum === day) {
                    box.classList.add('claimed');
                }
            } else if (dayNum === day + 1 && !checkedInToday) {
                box.classList.add('current');
            }
        });
        
        await loadUserData();
        hideLoading();
        showToast('Day ' + dayNum + ' Reward: ' + reward + ' HZN claimed!', 'success');
    } catch (error) {
        hideLoading();
        showToast(error.message, 'error');
    }
}

function doCheckIn() {
    if (!currentUserData) return;
    const lastCheckIn = currentUserData.last_check_in;
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // Get last check-in date
    let lastCheckInDate = null;
    if (lastCheckIn) {
        lastCheckInDate = lastCheckIn.split('T')[0];
    }
    
    // Calculate days since last check-in
    let currentDay = currentUserData.check_in_day || 0;
    
    if (lastCheckInDate) {
        const lastDate = new Date(lastCheckInDate);
        const todayDate = new Date(today);
        const diffTime = todayDate - lastDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        
        // If more than 1 day passed (missed a day), reset to day 1
        if (diffDays > 1) {
            currentDay = 0;
        }
    }
    
    // Check if already checked in today
    if (lastCheckInDate === today) {
        showToast('Already checked in today!', 'info');
        return;
    }
    
    // Next day (if completed day 7, reset to day 1)
    const nextDay = currentDay + 1;
    if (nextDay > 7) {
        nextDay = 1;
    }
    
    claimDay(nextDay);
}

function updateCheckInUI() {
    const day = currentUserData.check_in_day || 0;
    const lastCheckIn = currentUserData.last_check_in;
    const today = new Date().toISOString().split('T')[0];
    const checkedInToday = lastCheckIn && lastCheckIn.split('T')[0] === today;
    
    document.querySelectorAll('.week-day').forEach((box, i) => {
        box.classList.remove('completed', 'current', 'claimed');
        const dayNum = i + 1;
        
        if (dayNum <= day) {
            box.classList.add('completed');
            if (checkedInToday && dayNum === day) {
                box.classList.add('claimed');
            }
        } else if (dayNum === day + 1 && !checkedInToday) {
            box.classList.add('current');
        }
    });
}

function updateCheckInOverlay() {
    const day = currentUserData.check_in_day || 0;
    const lastCheckIn = currentUserData.last_check_in;
    const today = new Date().toISOString().split('T')[0];
    const checkedInToday = lastCheckIn && lastCheckIn.split('T')[0] === today;
    
    document.getElementById('checkin-streak').textContent = checkedInToday ? day : day;
    document.getElementById('checkin-progress-fill').style.width = (day / 7) * 100 + '%';
    
    // Update button text
    const btn = document.getElementById('checkin-btn');
    if (btn) {
        btn.textContent = checkedInToday ? 'Claimed Today!' : (day >= 7 ? 'Claim Reward' : 'Claim Day ' + (day + 1));
    }
}

// Spin
function showSpinWheel() { 
    document.getElementById('spin-overlay').classList.add('active');
    checkAndResetSpins().then(() => {
        updateSpinUI();
    });
}

function checkAndResetSpins() {
    return new Promise(async (resolve) => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toDateString();
        const lastSpin = localStorage.getItem('last_spin');
        
        let shouldReset = false;
        let dbLastSpin = null;
        let dbSpinsLeft = null;
        
        // Get fresh data from database
        if (currentUser && currentUser.id) {
            try {
                const { data } = await supabaseClient.from('users').select('spins_left, last_spin').eq('id', currentUser.id).single();
                if (data) {
                    dbLastSpin = data.last_spin;
                    dbSpinsLeft = data.spins_left;
                }
            } catch (e) {
                console.log('Error fetching spins:', e);
            }
        }
        
        performSpinReset(now, today, lastSpin, dbLastSpin, dbSpinsLeft);
        resolve();
    });
}

function performSpinReset(now, today, lastSpin, dbLastSpin, dbSpinsLeft) {
    let spins = MAX_DAILY_SPINS;
    let shouldReset = false;
    
    // Get start of today for proper comparison
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    // Check localStorage last spin
    if (lastSpin) {
        const lastSpinDate = new Date(lastSpin);
        const lastSpinDay = new Date(lastSpinDate.getFullYear(), lastSpinDate.getMonth(), lastSpinDate.getDate()).getTime();
        if (lastSpinDay < todayStart) {
            shouldReset = true;
        }
    } else {
        shouldReset = true;
    }
    
    // Check database last spin
    if (dbLastSpin) {
        const dbLastSpinDate = new Date(dbLastSpin);
        const dbLastSpinDay = new Date(dbLastSpinDate.getFullYear(), dbLastSpinDate.getMonth(), dbLastSpinDate.getDate()).getTime();
        if (dbLastSpinDay < todayStart) {
            shouldReset = true;
        }
    } else {
        shouldReset = true;
    }
    
    // Don't auto-resurt if spins are 0 (user used all spins today)
    // Only reset if it's a new day or spins are null/undefined
    
    if (shouldReset) {
        spins = MAX_DAILY_SPINS;
        const newTs = now.toISOString();
        
        if (currentUserData) {
            currentUserData.spins_left = MAX_DAILY_SPINS;
            currentUserData.last_spin = newTs;
            supabaseClient.from('users').update({
                spins_left: MAX_DAILY_SPINS,
                last_spin: newTs
            }).eq('id', currentUser.id);
        }
        localStorage.setItem('spins_left', MAX_DAILY_SPINS.toString());
        localStorage.setItem('last_spin', newTs);
    } else {
        // If spins exists in database, use it (including 0)
        if (dbSpinsLeft !== null && dbSpinsLeft !== undefined) {
            spins = dbSpinsLeft;
        } else {
            // Only use localStorage if database has no value
            let lsSpins = parseInt(localStorage.getItem('spins_left'));
            spins = (lsSpins !== null && lsSpins !== undefined) ? lsSpins : MAX_DAILY_SPINS;
        }
    }
    
    const el1 = document.getElementById('spins-left');
    const el2 = document.getElementById('spin-count');
    if (el1) el1.textContent = spins;
    if (el2) el2.textContent = spins;
}
function closeSpin() { document.getElementById('spin-overlay').classList.remove('active'); }

async function spinWheel() {
    if (!currentUser) {
        showToast('Please login first!', 'error');
        return;
    }
    
    await checkAndResetSpins();
    
    // Get spins AFTER reset - check both localStorage and database
    let spinsLeft = MAX_DAILY_SPINS;
    
    // Check database first (most authoritative) - include 0
    if (currentUser && currentUser.id) {
        try {
            const { data } = await supabaseClient.from('users').select('spins_left').eq('id', currentUser.id).single();
            if (data && data.spins_left !== null && data.spins_left !== undefined) {
                spinsLeft = data.spins_left;
            }
        } catch (e) {
            console.log('Error reading spins:', e);
        }
    }
    
    // Then check localStorage as backup - include 0
    let localSpins = parseInt(localStorage.getItem('spins_left'));
    if (localSpins !== null && localSpins !== undefined && localSpins !== NaN) {
        spinsLeft = localSpins;
    }
    
    // Ensure spins don't exceed max
    if (spinsLeft > MAX_DAILY_SPINS) {
        spinsLeft = MAX_DAILY_SPINS;
    }
    
    // Show error if no spins left
    if (spinsLeft <= 0) {
        showToast('No spins left! Come back tomorrow!', 'error');
        return;
    }
    
    const spinBtn = document.getElementById('spin-btn');
    spinBtn.disabled = true;
    spinBtn.style.opacity = '0.6';

    const drawNumber = document.getElementById('draw-number');
    const drawCircle = document.getElementById('draw-circle');
    
    // Check monthly big win eligibility
    checkMonthlyBigWin();
    let reward = getWeightedReward();
    
    // If 5000 reward and already given this month, replace with smaller reward
    if (reward === 5000 && monthlyBigWinGiven) {
        // Replace 5000 with a random smaller reward
        const smallerRewards = [20, 40, 60, 100, 200, 500];
        reward = smallerRewards[Math.floor(Math.random() * smallerRewards.length)];
    }
    
    drawNumber.classList.add('spinning');
    
    // Rapid number change animation
    let spinCount = 0;
    const spinInterval = setInterval(() => {
        const randomVal = getWeightedReward();
        drawNumber.textContent = randomVal;
        drawNumber.style.background = 'linear-gradient(180deg, #fff, #cbd5e1)';
        drawNumber.style.webkitBackgroundClip = 'text';
        drawNumber.style.backgroundClip = 'text';
        spinCount++;
        
        if (spinCount >= 15) {
            clearInterval(spinInterval);
            drawNumber.classList.remove('spinning');
            drawNumber.textContent = reward;
            if (reward >= 2000) {
                drawNumber.style.background = 'linear-gradient(180deg, #f472b6, #db2777)';
            } else if (reward >= 200) {
                drawNumber.style.background = 'linear-gradient(180deg, #34d399, #10b981)';
            } else if (reward > 0) {
                drawNumber.style.background = 'linear-gradient(180deg, #fbbf24, #f59e0b)';
            } else {
                drawNumber.style.background = 'linear-gradient(180deg, #94a3b8, #64748b)';
            }
            drawNumber.style.webkitBackgroundClip = 'text';
            drawNumber.style.backgroundClip = 'text';
        }
    }, 100);

    setTimeout(async () => {
        try {
            const { data: userData, error: fetchError } = await supabaseClient.from('users').select('balance').eq('id', currentUser.id).single();
            
            if (fetchError) {
                console.error('Error fetching user:', fetchError);
                showToast('Error processing spin', 'error');
                return;
            }
            
            const currentBalance = userData?.balance || 0;
            const newBalance = currentBalance + reward;
            
            const newSpinsLeft = spinsLeft - 1;
            const { error: updateError } = await supabaseClient.from('users').update({
                balance: newBalance,
                spins_left: newSpinsLeft,
                last_spin: new Date().toISOString()
            }).eq('id', currentUser.id);

            if (updateError) {
                console.error('Error updating balance:', updateError);
                showToast('Error saving reward', 'error');
                return;
            }

            localStorage.setItem('spins_left', newSpinsLeft.toString());
            localStorage.setItem('last_spin', new Date().toISOString());

            if (reward > 0) {
                // Mark monthly big win as given if 5000 was won
                if (reward === 5000) {
                    markMonthlyBigWinGiven();
                }
                
                try {
                    await supabaseClient.from('transactions').insert([{
                        user_id: currentUser.id,
                        type: 'Spin Win',
                        amount: reward,
                        status: 'completed'
                    }]);
                } catch (e) {
                    console.log('Transaction insert error:', e.message);
                }
                saveActivity('Spin Win', 'You won ' + reward + ' HZN from spin wheel');
            }

            // Show result in UI
            const resultDiv = document.getElementById('spin-result');
            resultDiv.innerHTML = reward > 0 ? 'You won ' + reward + ' HZN!' : 'Better luck next time!';
            resultDiv.classList.add('show');

            // Update local data
            currentUserData.balance = newBalance;
            currentUserData.spins_left = newSpinsLeft;
            
            // Update all spin count displays
            document.getElementById('spin-count').textContent = newSpinsLeft;
            const spinsLeftEl = document.getElementById('spins-left');
            if (spinsLeftEl) spinsLeftEl.textContent = newSpinsLeft;
            
            const totalBalEl = document.getElementById('total-balance');
            const profileBalEl = document.getElementById('profile-balance');
            if (totalBalEl) totalBalEl.textContent = newBalance;
            if (profileBalEl) profileBalEl.textContent = newBalance;
            
            // Update Rs UI instantly
            const newBalanceRs = (newBalance * 0.01).toFixed(2);
            const rsElements = ['withdraw-available-rs', 'profile-pkr', 'earn-rate'];
            rsElements.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = newBalanceRs;
            });
            
            // Hide result after 3 seconds
            setTimeout(() => {
                const resultDiv = document.getElementById('spin-result');
                if (resultDiv) resultDiv.classList.remove('show');
                // Re-enable button
                const spinBtn = document.getElementById('spin-btn');
                if (spinBtn) {
                    spinBtn.disabled = false;
                    spinBtn.style.opacity = '1';
                }
            }, 3000);
            
        } catch (err) {
            console.error('Spin error:', err);
            showToast('Something went wrong!', 'error');
        }
    }, 1600);
}

function updateSpinUI() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const lastSpin = localStorage.getItem('last_spin');
    
    let spins = MAX_DAILY_SPINS;
    
    // Get from database first (most authoritative) - include 0
    if (currentUserData?.spins_left !== undefined && currentUserData?.spins_left !== null) {
        spins = currentUserData.spins_left;
    }
    
    // Then check localStorage as backup - include 0
    let localSpins = parseInt(localStorage.getItem('spins_left'));
    if (localSpins !== null && localSpins !== undefined && localSpins !== NaN) {
        spins = localSpins;
    }
    
    // Cap at max daily spins
    if (spins > MAX_DAILY_SPINS) {
        spins = MAX_DAILY_SPINS;
    }
    
    // Check if reset is needed (only if it's a new day)
    let needsReset = false;
    if (lastSpin) {
        const lastSpinDate = new Date(lastSpin);
        const lastSpinDay = new Date(lastSpinDate.getFullYear(), lastSpinDate.getMonth(), lastSpinDate.getDate()).getTime();
        if (lastSpinDay < todayStart) {
            needsReset = true;
        }
    } else {
        needsReset = true;
    }
    
    if (needsReset) {
        spins = MAX_DAILY_SPINS;
        const newTs = now.toISOString();
        if (currentUserData) {
            currentUserData.spins_left = MAX_DAILY_SPINS;
            currentUserData.last_spin = newTs;
            supabaseClient.from('users').update({
                spins_left: MAX_DAILY_SPINS,
                last_spin: newTs
            }).eq('id', currentUser.id);
        }
        localStorage.setItem('spins_left', MAX_DAILY_SPINS.toString());
        localStorage.setItem('last_spin', newTs);
    }
    
    const el1 = document.getElementById('spins-left');
    const el2 = document.getElementById('spin-count');
    if (el1) el1.textContent = spins;
    if (el2) el2.textContent = spins;
}

// Ad Tasks - Daily 200-300 ads with different durations and rewards
const AD_TASKS = [
    { duration: 5, reward: 10, title: 'Quick Ad' },
    { duration: 10, reward: 20, title: 'Short Ad' },
    { duration: 15, reward: 30, title: 'Standard Ad' },
    { duration: 30, reward: 50, title: 'Long Ad' }
];

let dailyAdStats = {
    adsWatched: 0,
    lastDate: null
};

function loadDailyAdStats() {
    const today = new Date().toDateString();
    const stored = localStorage.getItem('dailyAdStats');
    
    if (stored) {
        const data = JSON.parse(stored);
        if (data.lastDate === today) {
            dailyAdStats = data;
        } else {
            // New day - reset
            dailyAdStats = { adsWatched: 0, lastDate: today };
            localStorage.setItem('dailyAdStats', JSON.stringify(dailyAdStats));
        }
    } else {
        dailyAdStats = { adsWatched: 0, lastDate: today };
        localStorage.setItem('dailyAdStats', JSON.stringify(dailyAdStats));
    }
}

function loadCompletedTasks() {
    const today = new Date().toDateString();
    const stored = localStorage.getItem('completedTasks_' + today);
    completedTasks = stored ? JSON.parse(stored) : [];
}

function markTaskCompleted(taskId) {
    if (!completedTasks.includes(taskId)) {
        completedTasks.push(taskId);
        const today = new Date().toDateString();
        localStorage.setItem('completedTasks_' + today, JSON.stringify(completedTasks));
    }
}

function generateDailyAds() {
    const today = new Date().toDateString();
    const cacheKey = 'dailyAds_' + today;
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
        return JSON.parse(cached);
    }
    
    const totalAds = Math.floor(Math.random() * 51) + 200;
    const ads = [];
    
    for (let i = 0; i < totalAds; i++) {
        const adType = AD_TASKS[Math.floor(Math.random() * AD_TASKS.length)];
        ads.push({
            id: 'ad_' + i + '_' + Date.now(),
            category: 'ad_watch',
            title: adType.title,
            description: 'Watch this ad to earn ' + adType.reward + ' HZN',
            duration: adType.duration,
            reward: adType.reward
        });
    }
    
    localStorage.setItem(cacheKey, JSON.stringify(ads));
    return ads;
}

let watchedAdIds = [];

function loadWatchedAds() {
    const today = new Date().toDateString();
    const stored = localStorage.getItem('watchedAdIds_' + today);
    watchedAdIds = stored ? JSON.parse(stored) : [];
}

function markAdWatched(adId) {
    if (!watchedAdIds.includes(adId)) {
        watchedAdIds.push(adId);
        const today = new Date().toDateString();
        localStorage.setItem('watchedAdIds_' + today, JSON.stringify(watchedAdIds));
        dailyAdStats.adsWatched++;
        localStorage.setItem('dailyAdStats', JSON.stringify(dailyAdStats));
    }
}

let currentTaskFilter = 'all';

function setTaskFilter(filter) {
    currentTaskFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    loadTasks();
}

function loadTasks() {
    loadDailyAdStats();
    loadWatchedAds();
    loadCompletedTasks();
    
    const list = document.getElementById('tasks-list');
    list.innerHTML = '<div class="loading">Loading tasks...</div>';
    
    supabaseClient.from('tasks').select('*').eq('status', 'active').order('id', { ascending: false })
        .then(({ data, error }) => {
            if (error) {
                console.error('Tasks load error:', error);
            }
            
            let tasks = data || [];
            list.innerHTML = '';
            
            if (currentTaskFilter === 'all' || currentTaskFilter === 'ad_watch') {
                const dailyAds = generateDailyAds();
                
                dailyAds.forEach(ad => {
                    const isWatched = watchedAdIds.includes(ad.id);
                    const div = document.createElement('div');
                    div.className = isWatched ? 'task-card ad-card watched' : 'task-card ad-card';
                    div.innerHTML = '<div class="task-header"><span class="task-type">' + (isWatched ? 'Watched' : 'Ad Watch') + '</span><span class="task-reward">' + ad.reward + ' HZN</span></div><div class="task-title">' + ad.title + '</div><div class="task-info"><small>' + ad.duration + 's</small></div><div class="task-btn-container">' + (isWatched ? '<button class="task-btn completed">Completed</button>' : '<button class="task-btn" onclick="startAdTask(\'' + ad.id + '\', ' + ad.duration + ', ' + ad.reward + ')">Watch</button>') + '</div>';
                    list.appendChild(div);
                });
            }
            
            if (currentTaskFilter !== 'ad_watch') {
                const filteredTasks = currentTaskFilter === 'all' ? tasks : tasks.filter(t => t.category === currentTaskFilter);
                
                filteredTasks.forEach(t => {
                    const isCompleted = completedTasks.includes(t.id);
                    const div = document.createElement('div');
                    div.className = isCompleted ? 'task-card watched' : 'task-card';
                    div.innerHTML = '<div class="task-header"><span class="task-type">' + (isCompleted ? 'Completed' : getCategoryIcon(t.category)) + '</span><span class="task-reward">' + t.reward + ' HZN</span></div><div class="task-title">' + t.title + '</div><div class="task-info"><small>' + t.duration + 's</small>' + (t.description ? '<small> | ' + t.description + '</small>' : '') + '</div>' + (!isCompleted && t.link ? '<a href="#" onclick="openExternalLink(\'' + t.link + '\'); return false;" class="task-link">Link</a>' : '') + '<div class="task-btn-container">' + (isCompleted ? '<button class="task-btn completed">Completed</button>' : '<button class="task-btn" onclick="startTask(' + t.id + ')">Start</button>') + '</div>';
                    list.appendChild(div);
                });
            }
            
            if (list.children.length === 0) {
                list.innerHTML = '<div class="empty-state">No tasks available</div>';
            }
        });
}

function getCategoryIcon(category) {
    const icons = { 'ad_watch': 'Ads', 'video_watch': 'Videos', 'social': 'Social', 'signup': 'Signup' };
    return icons[category] || 'Task';
}

async function startTask(taskId) {
    const { data: task } = await supabaseClient.from('tasks').select('*').eq('id', taskId).single();
    if (!task) {
        showToast('Task not found', 'error');
        return;
    }
    
    window.pendingTask = task;
    document.getElementById('task-confirm-title').textContent = task.title;
    document.getElementById('task-confirm-desc').textContent = task.description || 'Complete this task to earn rewards!';
    document.getElementById('task-confirm-duration').textContent = task.duration + ' seconds';
    document.getElementById('task-confirm-reward').textContent = '+' + task.reward + ' HZN';
    
    if (task.link) {
        document.getElementById('task-link-hint').textContent = 'Link: ' + task.link;
        document.getElementById('task-link-hint').style.display = 'block';
    } else {
        document.getElementById('task-link-hint').style.display = 'none';
    }
    
    document.getElementById('task-confirm-overlay').classList.add('active');
}

function startTaskProcess() {
    const task = window.pendingTask;
    if (!task) return;
    
    closeTaskConfirm();
    
    if (task.link) {
        openExternalLink(task.link);
    }
    
    startTaskTimer(task);
}

function startTaskTimer(task) {
    document.getElementById('task-waiting-title').textContent = task.title;
    document.getElementById('task-timer-seconds').textContent = task.duration;
    document.getElementById('task-timer-ring').style.strokeDashoffset = '0';
    document.getElementById('task-waiting-overlay').classList.add('active');
    
    let timeLeft = task.duration;
    const timerEl = document.getElementById('task-timer-seconds');
    const ringEl = document.getElementById('task-timer-ring');
    const circumference = 283;
    
    const timer = setInterval(() => {
        timeLeft--;
        timerEl.textContent = timeLeft;
        const offset = circumference - (timeLeft / task.duration) * circumference;
        ringEl.style.strokeDashoffset = offset;
        
        if (timeLeft <= 0) {
            clearInterval(timer);
            completeTaskAfterTimer(task);
        }
    }, 1000);
    
    window.taskTimer = timer;
    window.currentTask = task;
}

function closeTaskWaiting() {
    document.getElementById('task-waiting-overlay').classList.remove('active');
    if (window.taskTimer) {
        clearInterval(window.taskTimer);
        window.taskTimer = null;
    }
}

async function completeTaskAfterTimer(task) {
    closeTaskWaiting();
    
    if (!currentUser) return;
    
    markTaskCompleted(task.id);
    
    try {
        await supabaseClient.from('transactions').insert([{
            user_id: currentUser.id,
            type: 'task',
            amount: task.reward,
            status: 'completed'
        }]);
        
        const newBalance = (currentUserData.balance || 0) + task.reward;
        currentUserData.balance = newBalance;
        currentUser.balance = newBalance;
        
        const totalBalEl = document.getElementById('total-balance');
        const profileBalEl = document.getElementById('profile-balance');
        if (totalBalEl) totalBalEl.textContent = newBalance;
        if (profileBalEl) profileBalEl.textContent = newBalance;
        
        const newBalanceRs = (newBalance * 0.01).toFixed(2);
        const rsElements = ['withdraw-available-rs', 'profile-pkr', 'earn-rate'];
        rsElements.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = newBalanceRs;
        });
        
        await supabaseClient.from('users').update({ balance: newBalance }).eq('id', currentUser.id);
        showToast('Task Complete! +' + task.reward + ' HZN', 'success');
        loadTasks();
    } catch (err) {
        console.error('Task completion error:', err);
        showToast('Task completed! Reward added.', 'success');
        loadTasks();
    }
}

function closeTaskConfirm() {
    document.getElementById('task-confirm-overlay').classList.remove('active');
    window.pendingTask = null;
}

async function confirmTaskComplete() {
    if (!window.pendingTask || !currentUser) {
        closeTaskConfirm();
        return;
    }
    
    const task = window.pendingTask;
    closeTaskConfirm();
    showLoading();
    
    try {
        const { error } = await supabaseClient.from('transactions').insert([{
            user_id: currentUser.id,
            type: 'task',
            amount: task.reward,
            status: 'completed'
        }]);
        
        if (!error) {
            const newBalance = (currentUserData.balance || 0) + task.reward;
            currentUserData.balance = newBalance;
            currentUser.balance = newBalance;
            
            const totalBalEl = document.getElementById('total-balance');
            const profileBalEl = document.getElementById('profile-balance');
            if (totalBalEl) totalBalEl.textContent = newBalance;
            if (profileBalEl) profileBalEl.textContent = newBalance;
            
            const newBalanceRs = (newBalance * 0.01).toFixed(2);
            const rsElements = ['withdraw-available-rs', 'profile-pkr', 'earn-rate'];
            rsElements.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = newBalanceRs;
            });
            
            await supabaseClient.from('users').update({ balance: newBalance }).eq('id', currentUser.id);
            showToast('Task complete! +' + task.reward + ' HZN', 'success');
            loadTasks();
        } else {
            showToast('Task already completed or error occurred', 'error');
        }
    } catch (err) {
        console.error('Task completion error:', err);
        showToast('Error completing task', 'error');
    }
    
    hideLoading();
}

async function completeBackendTask(task) {
    startTaskTimer(task);
}

function startAdTask(id, duration, reward) {
    if (watchedAdIds.includes(id)) {
        showToast('This ad has already been watched!', 'error');
        return;
    }
    
    document.getElementById('ad-overlay').classList.add('active');
    document.getElementById('ad-reward-preview').textContent = '+' + reward + ' HZN';
    
    let timeLeft = duration;
    const timer = setInterval(() => {
        timeLeft--;
        document.getElementById('timer-text').textContent = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timer);
            completeAdTask(id, reward);
        }
    }, 1000);
}

async function completeAdTask(adId, reward) {
    document.getElementById('ad-overlay').classList.remove('active');
    
    markAdWatched(adId);
    
    const newBalance = (currentUserData.balance || 0) + reward;
    currentUserData.balance = newBalance;
    
    const totalBalEl = document.getElementById('total-balance');
    const profileBalEl = document.getElementById('profile-balance');
    if (totalBalEl) totalBalEl.textContent = newBalance;
    if (profileBalEl) profileBalEl.textContent = newBalance;
    
    const newBalanceRs = (newBalance * 0.01).toFixed(2);
    const rsElements = ['withdraw-available-rs', 'profile-pkr', 'earn-rate'];
    rsElements.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = newBalanceRs;
    });
    
    await supabaseClient.from('users').update({ balance: newBalance }).eq('id', currentUser.id);
    
    try {
        await supabaseClient.from('transactions').insert([{
            user_id: currentUser.id,
            type: 'Ad Watch',
            amount: reward,
            status: 'completed'
        }]);
    } catch (e) {
        console.log('Transaction error:', e);
    }
    
    showToast('Earned ' + reward + ' HZN!', 'success');
    loadTasks();
}

async function completeTask() {
    document.getElementById('ad-overlay').classList.remove('active');
    await supabaseClient.from('users').update({
        balance: (currentUserData.balance || 0) + currentAdTask.reward
    }).eq('id', currentUser.id);

    try {
        await supabaseClient.from('transactions').insert([{
            user_id: currentUser.id,
            type: 'Task Reward',
            amount: currentAdTask.reward,
            status: 'completed'
        }]);
    } catch (e) {
        console.log('Transaction insert error:', e.message);
    }

    await loadUserData();
    showToast('Task completed!', 'success');
    saveActivity('Task Completed', 'You completed a task and earned ' + currentAdTask.reward + ' HZN');
}

function closeAdEarly() { document.getElementById('ad-overlay').classList.remove('active'); }

// Invite
async function loadInviteData() {
    if (!currentUserData?.referral_code) return;
    
    const { data: referrals } = await supabaseClient.from('users').select('id, username, created_at').eq('referred_by', currentUserData.referral_code);
    const referralCount = referrals?.length || 0;
    document.getElementById('total-referrals').textContent = referralCount;
    
    // Calculate pending earnings (2000 HZN per referral + 5% commission from transactions)
    let totalCommission = 0;
    if (referrals && referrals.length > 0) {
        for (const user of referrals) {
            try {
                const { data: transactions } = await supabaseClient.from('transactions')
                    .select('amount')
                    .eq('user_id', user.id)
                    .eq('status', 'completed');
                
                const userEarnings = transactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
                totalCommission += Math.floor(userEarnings * 0.05);
            } catch (e) {
                console.log('Commission query error:', e);
            }
        }
    }
    
    const pendingEarnings = (referralCount * 2000) + totalCommission;
    document.getElementById('referral-earnings').textContent = pendingEarnings;
    
    // Progress bar
    const progressPercent = Math.min((referralCount / 5) * 100, 100);
    document.getElementById('referral-progress-fill').style.width = progressPercent + '%';
    document.getElementById('referral-progress-count').textContent = referralCount;
    
    // Load referred users list with commission
    loadReferredUsers(referrals || []);
}

function copyReferralCode() {
    navigator.clipboard.writeText(currentUserData.referral_code);
    showToast('Code copied!', 'success');
}

function shareOnWhatsApp() { 
    const code = currentUserData.referral_code || '------';
    const message = 'Join Hazana Earning App! Use my referral code: ' + code + ' and get bonus!';
    window.open('https://wa.me/?text=' + encodeURIComponent(message)); 
}

function shareOnFacebook() { 
    const code = currentUserData.referral_code || '------';
    const message = 'Join Hazana Earning App! Use my referral code: ' + code;
    window.open('https://www.facebook.com/sharer/sharer.php?quote=' + encodeURIComponent(message)); 
}

function shareOnInstagram() { showToast('Sharing to Instagram...', 'info'); }

// Referrals Display
async function loadReferredUsers(referrals) {
    const container = document.getElementById('referred-users-list');
    
    if (!referrals || referrals.length === 0) {
        container.innerHTML = '<p class="empty-state">No referrals yet</p>';
        return;
    }
    
    container.innerHTML = await Promise.all(referrals.map(async user => {
        const joinDate = new Date(user.created_at);
        const today = new Date();
        const diffTime = Math.abs(today - joinDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        let dateStr = diffDays === 0 ? 'Today' : diffDays === 1 ? 'Yesterday' : diffDays + 'd ago';
        
        const rewardAmount = 2000;
        
        // Get commission from user's transactions
        let commissionAmount = 0;
        try {
            const { data: transactions } = await supabaseClient.from('transactions')
                .select('amount')
                .eq('user_id', user.id)
                .eq('status', 'completed');
            const userEarnings = transactions?.reduce((sum, t) => sum + (t.amount || 0), 0) || 0;
            commissionAmount = Math.floor(userEarnings * 0.05);
        } catch (e) {
            console.log('Commission query error:', e);
        }
        
        return '<div class="referral-user-card"><div class="referral-user-info"><div class="referral-avatar"><span class="avatar-text">' + user.username.charAt(0).toUpperCase() + '</span></div><div class="referral-details"><span class="referral-name">' + user.username + '</span><span class="referral-date">' + dateStr + '</span></div></div><div class="referral-rewards"><div class="reward-row"><span class="reward-label">Bonus</span><span class="reward-value bonus">+' + rewardAmount + '</span></div><div class="reward-row"><span class="reward-label">Comm</span><span class="reward-value commission">+' + commissionAmount + '</span></div></div></div>';
    })).then(html => html.join(''));
}

// Announcements - Only News/System from backend
async function loadAnnouncements() {
    const list = document.getElementById('announcements-list');
    if (!list) return;
    
    list.innerHTML = '<p class="empty-state">Loading...</p>';
    
    try {
        const { data: news } = await supabaseClient.from('announcements').select('*').order('created_at', { ascending: false });
        if (news && news.length > 0) {
            list.innerHTML = news.map(n => '<div class="announcement-card"><h4>' + n.title + '</h4><p>' + n.content + '</p></div>').join('');
        } else {
            list.innerHTML = '<p class="empty-state">No news available</p>';
        }
    } catch (e) {
        console.log('Announcements load error:', e.message);
        list.innerHTML = '<p class="empty-state">No news available</p>';
    }
}

// Save activity for future use
function saveActivity(title, message) {
    // Can be used for activity feed or analytics later
}

// Mark all as read - not applicable for news
function markAllRead() {
    showToast('News cannot be marked as read', 'info');
    closeAnnouncementMenu();
}

// Clear all announcements - reloads news
function clearAllAnnouncements() {
    showToast('Refreshing news...', 'info');
    closeAnnouncementMenu();
    loadAnnouncements();
}

// Profile & Withdraw
async function loadProfileData() {
    if (!currentUserData) return;
    updateUserUI(); // Basic UI sync

    // Fill Edit Profile Form
    const elements = {
        'edit-fullname': currentUserData.fullname || '',
        'edit-phone': currentUserData.phone || '',
        'edit-username': currentUserData.username || '',
        'edit-email': currentUserData.email || '',
        'edit-joined': new Date(currentUserData.created_at).toLocaleDateString()
    };

    for (const [id, value] of Object.entries(elements)) {
        const el = document.getElementById(id);
        if (el) el.value = value;
    }

    // Load Profile Photo from LocalStorage
    const localPhoto = localStorage.getItem('profile_pic_' + currentUser.id);
    if (localPhoto) {
        const profilePic = document.getElementById('profile-pic');
        const editProfilePic = document.getElementById('edit-profile-pic');
        if (profilePic) profilePic.src = localPhoto;
        if (editProfilePic) editProfilePic.src = localPhoto;
    } else if (currentUserData.photo_url) {
        // Fallback to DB if it exists (for backward compatibility if they did run the command)
        const profilePic = document.getElementById('profile-pic');
        const editProfilePic = document.getElementById('edit-profile-pic');
        if (profilePic) profilePic.src = currentUserData.photo_url;
        if (editProfilePic) editProfilePic.src = currentUserData.photo_url;
    }

    // Highlight selected payment method
    const localPayment = localStorage.getItem('payment_method_' + currentUser.id);
    if (localPayment || currentUserData.payment_method) {
        const method = localPayment || currentUserData.payment_method;
        document.querySelectorAll('#payment-methods .wallet-card').forEach(card => {
            card.classList.toggle('selected', card.dataset.method === method);
        });
    }

    loadTransactionHistory();
}

let withdrawalTimer = null;
function checkWithdrawalAvailability() {
    if (withdrawalTimer) clearInterval(withdrawalTimer);

    const now = new Date();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayName = dayNames[now.getDay()];
    const isWithdrawalDay = todayName === appSettings.withdrawal_day;

    const lockedDiv = document.getElementById('withdrawal-locked');
    const activeDiv = document.getElementById('withdrawal-active');
    const dayTextEl = document.querySelector('.next-withdrawal-card p');

    if (isWithdrawalDay) {
        if (lockedDiv) lockedDiv.style.display = 'none';
        if (activeDiv) activeDiv.style.display = 'block';
        const paymentMethod = localStorage.getItem('payment_method_' + currentUser.id);
        if (paymentMethod) {
            selectWithdrawalMethod(paymentMethod);
        }
    } else {
        if (lockedDiv) lockedDiv.style.display = 'block';
        if (activeDiv) activeDiv.style.display = 'none';
        const dayName = appSettings.withdrawal_day.charAt(0).toUpperCase() + appSettings.withdrawal_day.slice(1);
        const dayTextEl = document.getElementById('next-withdrawal-day');
        if (dayTextEl) dayTextEl.textContent = 'Next: ' + dayName;
        updateWithdrawalCountdown();
        withdrawalTimer = setInterval(updateWithdrawalCountdown, 60000);
    }
}

function updateWithdrawalCountdown() {
    const now = new Date();
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetDayIndex = dayNames.indexOf(appSettings.withdrawal_day);
    
    const nextWithdrawal = new Date();
    const daysUntil = (targetDayIndex - now.getDay() + 7) % 7 || 7;
    nextWithdrawal.setDate(now.getDate() + daysUntil);
    nextWithdrawal.setHours(0, 0, 0, 0);

    const diff = nextWithdrawal - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    const daysEl = document.getElementById('days-left');
    const hoursEl = document.getElementById('hours-left');
    const minutesEl = document.getElementById('minutes-left');

    if (daysEl) daysEl.textContent = days;
    if (hoursEl) hoursEl.textContent = hours;
    if (minutesEl) minutesEl.textContent = minutes;
}

async function changeProfilePhoto() {
    const file = document.getElementById('profile-upload').files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        const base64 = e.target.result;

        // Save to LocalStorage instead of DB
        localStorage.setItem('profile_pic_' + currentUser.id, base64);

        // Update UI immediately
        const profilePic = document.getElementById('profile-pic');
        const editProfilePic = document.getElementById('edit-profile-pic');
        if (profilePic) profilePic.src = base64;
        if (editProfilePic) editProfilePic.src = base64;

        showToast('Photo saved locally!', 'success');
    };
    reader.readAsDataURL(file);
}

document.getElementById('edit-profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();
    const fullname = document.getElementById('edit-fullname').value.trim();
    const phone = document.getElementById('edit-phone').value.trim();

    try {
        const { error } = await supabaseClient.from('users').update({ fullname, phone }).eq('id', currentUser.id);
        if (error) throw error;

        await loadUserData(); // Refresh local state
        showToast('Profile updated!', 'success');
        saveActivity('Profile Updated', 'Your profile information has been updated');
        showDashboardScreen('profile');
    } catch (err) {
        showToast(err.message, 'error');
    }
    hideLoading();
});

async function selectPaymentMethod(m) {
    // UI update
    document.querySelectorAll('#payment-methods .wallet-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.method === m);
    });

    // Save locally
    localStorage.setItem('payment_method_' + currentUser.id, m);
    showToast(m + ' selected as default!', 'success');
}

function selectWithdrawalMethod(m) {
    currentUserData.withdrawal_method = m;
    document.querySelectorAll('.payment-option').forEach(opt => opt.classList.remove('selected'));
    const activeOpt = document.querySelector('.payment-option[data-method="' + m + '"]');
    if (activeOpt) activeOpt.classList.add('selected');

    const withdrawForm = document.getElementById('withdrawal-form');
    if (withdrawForm) withdrawForm.dataset.method = m;
}

document.getElementById('withdrawal-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const amountRs = parseFloat(document.getElementById('withdraw-amount').value);
    const amountHZN = amountRs * 100;
    const method = document.getElementById('withdrawal-form').dataset.method || 'easypaisa';

    if (amountHZN > currentUserData.balance) return showToast('Insufficient balance', 'error');

    if (amountRs < appSettings.min_withdrawal) {
        return showToast('Min withdrawal is Rs ' + appSettings.min_withdrawal, 'error');
    }

    const location = document.getElementById('withdraw-location').value;
    if (!location) {
        return showToast('Please fetch your location first!', 'error');
    }

    showLoading();
    try {
        const withdrawData = {
            user_id: currentUser.id,
            amount: amountHZN,
            method: method,
            account: document.getElementById('withdraw-account-number').value,
            location: location,
            status: 'pending'
        };

        const { error: wError } = await supabaseClient.from('withdrawals').insert([withdrawData]);
        if (wError) throw wError;

        const newBalance = currentUserData.balance - amountHZN;
        const { error: uError } = await supabaseClient.from('users').update({
            balance: newBalance
        }).eq('id', currentUser.id);
        if (uError) throw uError;

        currentUserData.balance = newBalance;
        document.getElementById('total-balance').textContent = newBalance;
        document.getElementById('withdraw-available-hzn').textContent = newBalance + ' HZN';
        document.getElementById('withdraw-available-rs').textContent = (newBalance * 0.01).toFixed(2);

        showToast('Withdrawal submitted!', 'success');
        showDashboardScreen('home');
    } catch (error) {
        console.error('Withdrawal error:', error);
        showToast('Error: ' + (error.message || 'Please try again'), 'error');
    }
    hideLoading();
});

// Real-time HZN calculation for withdrawal
document.getElementById('withdraw-amount')?.addEventListener('input', (e) => {
    const amountRs = parseFloat(e.target.value) || 0;
    const amountHZN = Math.round(amountRs * 100);
    const calcBox = document.getElementById('withdraw-calculation');
    const calcText = document.getElementById('calc-hzn');

    if (amountRs > 0) {
        if (calcBox) calcBox.style.display = 'flex';
        if (calcText) calcText.textContent = amountHZN;
    } else {
        if (calcBox) calcBox.style.display = 'none';
    }
});

async function loadTransactionHistory() {
    const { data: txs } = await supabaseClient.from('transactions').select('*').eq('user_id', currentUser.id).eq('type', 'withdrawal').order('created_at', { ascending: false });
    document.getElementById('transactions-list').innerHTML = txs?.map(t => '<div class="transaction-card"><span>' + t.type + '</span> <span>' + t.amount + ' HZN</span></div>').join('') || 'No withdrawal transactions';
}

// Utilities
function showToast(m, type = 'success') {
    const toast = document.getElementById('toast');
    const icons = { success: 'fa-check', error: 'fa-times', info: 'fa-info' };
    toast.className = type;
    toast.querySelector('.toast-icon').innerHTML = '<i class="fas ' + icons[type] + '"></i>';
    toast.querySelector('.toast-message').textContent = m;
    toast.style.display = 'flex';
    setTimeout(() => { toast.style.display = 'none'; toast.className = ''; }, 3000);
}

function showLoading() { document.getElementById('loading-overlay').classList.add('active'); }
function hideLoading() { document.getElementById('loading-overlay').classList.remove('active'); }
function togglePassword(id) {
    const input = document.getElementById(id);
    input.type = input.type === 'password' ? 'text' : 'password';
}

// Change Password
document.getElementById('change-password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPass = document.getElementById('current-password').value;
    const newPass = document.getElementById('new-password').value;
    const confirmPass = document.getElementById('confirm-new-password').value;

    if (newPass !== confirmPass) {
        showToast('New passwords do not match!', 'error');
        return;
    }

    if (newPass.length < 8) {
        showToast('Password must be at least 8 characters!', 'error');
        return;
    }

    try {
        showLoading();
        const { error } = await supabaseClient.auth.updateUser({ password: newPass });
        if (error) throw error;
        
        showToast('Password changed successfully!', 'success');
        saveActivity('Password Changed', 'Your account password has been updated');
        document.getElementById('change-password-form').reset();
    } catch (err) {
        showToast(err.message || 'Failed to change password', 'error');
    } finally {
        hideLoading();
    }
});

async function logout() { await supabaseClient.auth.signOut(); }

// Terms
function showTerms() { document.getElementById('terms-overlay').classList.add('active'); }
function closeTerms() { document.getElementById('terms-overlay').classList.remove('active'); }
function acceptTerms() { closeTerms(); openSignup(); }
function switchTermsTab(tab) { /* UI logic for tabs */ }

// Extra screens
function showQuiz() { showToast('Coming soon!', 'info'); }
function closeQuiz() { }
function showVideos() { showToast('Coming soon!', 'info'); }
function closeVideos() { }
function toggleAnnouncement(id) { }
function showAnnouncementMenu() { document.getElementById('announcement-menu-overlay')?.classList.add('active'); }
function closeAnnouncementMenu() { document.getElementById('announcement-menu-overlay')?.classList.remove('active'); }
function showReferralGuide() { document.getElementById('referral-guide-overlay')?.classList.add('active'); }
function closeReferralGuide() { document.getElementById('referral-guide-overlay')?.classList.remove('active'); }
function switchNotifTab(tab) {
    // Only system/news tab exists now
    activeNotifTab = 'system';
    loadAnnouncements();
}

function showNotifTab(e, t) { 
    switchNotifTab(t);
}
function changeProfilePhotoHandler() {
    const uploadInput = document.getElementById('profile-upload');
    if (uploadInput) uploadInput.click();
}

// Ensure the listener is only attached once
const profileUploadInput = document.getElementById('profile-upload');
if (profileUploadInput && !profileUploadInput.dataset.listener) {
    profileUploadInput.addEventListener('change', changeProfilePhoto);
    profileUploadInput.dataset.listener = 'true';
}
function fetchLocation() {
    const locationInput = document.getElementById('withdraw-location');
    if (!locationInput) return;
    
    if (!navigator.geolocation) {
        showToast('Geolocation not supported', 'error');
        return;
    }
    
    locationInput.value = 'Fetching location...';
    
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            try {
                const { latitude, longitude } = position.coords;
                const response = await fetch('https://nominatim.openstreetmap.org/reverse?lat=' + latitude + '&lon=' + longitude + '&format=json');
                const data = await response.json();
                
                const city = data.address.city || data.address.town || data.address.village || data.address.district || '';
                const province = data.address.state || '';
                
                locationInput.value = city ? city + ', ' + province : latitude.toFixed(4) + ', ' + longitude.toFixed(4);
                showToast('Location fetched!', 'success');
            } catch (e) {
                locationInput.value = position.coords.latitude.toFixed(4) + ', ' + position.coords.longitude.toFixed(4);
                showToast('Location fetched!', 'success');
            }
        },
        (error) => {
            locationInput.value = '';
            showToast('Could not get location. Please enter manually.', 'error');
        },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}
function toggleFaq(element) {
    const faqItem = element.closest('.faq-item');
    faqItem.classList.toggle('active');
}
function goToInvite() { showDashboardScreen('invite'); }
function openTasks() { showDashboardScreen('tasks'); }
function openAnnouncements(tab) {
    activeNotifTab = 'system';
    showDashboardScreen('announcements');
    loadAnnouncements();
}

function openAnnouncementsPage(tab) {
    activeNotifTab = 'system';
    showScreen('dashboard');
    showDashboardScreen('announcements');
    loadAnnouncements();
}

function setNotifTab(tab) {
    switchNotifTab(tab);
}

// Update notification badges - simplified for news only
function updateNotificationBadges() {
    // For now, hide notification badges since we only have news
    // If you want to show unread news count, you'd need to track it differently
    const badges = ['notif-badge', 'nav-news-badge', 'account-tab-badge', 'system-tab-badge'];
    badges.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
}

// Load landing stats on page load
loadLandingStats();
loadAppSettings();
