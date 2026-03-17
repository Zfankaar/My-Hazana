// Supabase Configuration
const SUPABASE_URL = 'https://oxcqdrldqjxlgvszqcem.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im94Y3FkcmxkcWp4bGd2c3pxY2VtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2NDE4NDEsImV4cCI6MjA4OTIxNzg0MX0.cVFhCAZek3EQ2hoCznPNVZVza9fWStfPrMXt88vrvx0';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// State
let currentUser = null;
let currentUserData = null;
let activeFilter = 'all';
let activeNotifTab = 'account';
let accountNotifications = [];
let dailyAdsTasks = [];
let isFetchingUser = false;
let authListenerInitialized = false;
let authTimeout = null;
let lastAdsDate = null;

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
// Daily: 20, 0, 50, 70 (high chance)
// Weekly: 2000 (once a week)
// 2 Weeks: 5000 (once every 2 weeks)
const spinRewards = [
    { value: 0, weight: 20 },
    { value: 20, weight: 30 },
    { value: 50, weight: 20 },
    { value: 70, weight: 18 },
    { value: 200, weight: 10 },
    { value: 2000, weight: 1.5 },
    { value: 5000, weight: 0.5 }
];

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
window.setFilter = setFilter;
window.startTask = startTask;
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
window.changeProfilePhoto = changeProfilePhoto;
window.selectPaymentMethod = selectPaymentMethod;
window.selectWithdrawalMethod = selectWithdrawalMethod;
window.fetchLocation = fetchLocation;
window.toggleFaq = toggleFaq;
window.goToInvite = goToInvite;
window.openTasks = openTasks;
window.openAnnouncements = openAnnouncements;
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
    // Rate limiting - ignore events that happen too quickly
    if (now - lastAuthEvent < AUTH_EVENT_COOLDOWN) {
        console.log("Auth event rate limited:", event);
        return;
    }
    lastAuthEvent = now;
    
    console.log("Auth event:", event);

    // Clear existing transition check
    if (authTimeout) clearTimeout(authTimeout);

    if (session) {
        // Debounce to prevent multiple rapid triggers during state sync
        authTimeout = setTimeout(async () => {
            // Prevent multiple simultaneous loads
            if (isFetchingUser) {
                hideLoading();
                return;
            }
            if (currentUser?.id !== session.user.id || !currentUserData) {
                currentUser = session.user;
                await loadUserData();
            } else {
                hideLoading(); // Safety
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
        console.log(`Fetching data for: ${currentUser.id}`);
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('id', currentUser.id)
            .maybeSingle();

        if (error) throw error;

        if (!data) {
            // User record doesn't exist - try to create it
            console.log("User data not found, creating default record...");
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

function showDashboardScreen(screenId) {
    // Prevent screen switch during another transition
    if (isFetchingUser) {
        console.log("Screen switch blocked - loading in progress");
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
        // Only load user data if explicitly switching to home
        if (!currentUserData) loadUserData();
    }
    if (screenId === 'tasks') loadTasks();
    if (screenId === 'invite') loadInviteData();
    if (screenId === 'announcements') {
        activeNotifTab = 'system';
        setTimeout(() => {
            document.querySelectorAll('.notif-tab').forEach(t => t.classList.remove('active'));
            const systemTab = document.querySelector('.notif-tab:nth-child(2)');
            if (systemTab) systemTab.classList.add('active');
        }, 100);
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
    document.getElementById('total-payouts').textContent = '₨ ' + payouts.toLocaleString();
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
        document.getElementById('withdraw-available-hzn').textContent = `${balance} HZN`;
    }

    updateCheckInUI();
    updateSpinUI();
}

// Check-In
function showCheckIn() {
    document.getElementById('checkin-overlay').classList.add('active');
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
        
        await supabaseClient.from('users').update({
            balance: newBalance,
            check_in_day: dayNum,
            last_check_in: new Date().toISOString()
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
        
        saveActivity('Daily Check-In', `You claimed ${reward} HZN for Day ${dayNum}`);
        
        // Update local data instantly
        currentUserData.balance = newBalance;
        currentUserData.check_in_day = dayNum;
        
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
        
        await loadUserData();
        hideLoading();
        showToast(`🎉 Day ${dayNum} Reward: ${reward} HZN claimed!`, 'success');
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
    document.getElementById('checkin-progress-fill').style.width = `${(day / 7) * 100}%`;
    
    // Update button text
    const btn = document.getElementById('checkin-btn');
    if (btn) {
        btn.textContent = checkedInToday ? 'Claimed Today!' : (day >= 7 ? 'Claim Reward' : 'Claim Day ' + (day + 1));
    }
}

// Spin
function showSpinWheel() { document.getElementById('spin-overlay').classList.add('active'); }
function closeSpin() { document.getElementById('spin-overlay').classList.remove('active'); }

async function spinWheel() {
    if (!currentUser || !currentUserData) {
        showToast('Please login first!', 'error');
        return;
    }
    
    const spinsLeft = currentUserData.spins_left !== undefined ? currentUserData.spins_left : 7;
    if (spinsLeft <= 0) {
        showToast('No spins left!', 'error');
        return;
    }
    
    // Disable button while spinning
    const spinBtn = document.getElementById('spin-btn');
    spinBtn.disabled = true;
    spinBtn.style.opacity = '0.6';

    const drawNumber = document.getElementById('draw-number');
    const drawCircle = document.getElementById('draw-circle');
    
    // Get weighted random reward
    const reward = getWeightedReward();
    
    // Start spinning animation
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
            console.log('Processing spin reward:', reward, 'for user:', currentUser.id);
            
            // Get fresh balance from database
            const { data: userData, error: fetchError } = await supabaseClient.from('users').select('balance').eq('id', currentUser.id).single();
            
            if (fetchError) {
                console.error('Error fetching user:', fetchError);
                showToast('Error processing spin', 'error');
                return;
            }
            
            console.log('Current balance:', userData?.balance);
            
            const currentBalance = userData?.balance || 0;
            const newBalance = currentBalance + reward;
            
            console.log('New balance will be:', newBalance);
            
            // Update balance and spins
            const { error: updateError } = await supabaseClient.from('users').update({
                balance: newBalance,
                spins_left: spinsLeft - 1,
                last_spin: new Date().toISOString()
            }).eq('id', currentUser.id);

            if (updateError) {
                console.error('Error updating balance:', updateError);
                showToast('Error saving reward', 'error');
                return;
            }

            console.log('Balance updated successfully!');

            if (reward > 0) {
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
                saveActivity('Spin Win', `You won ${reward} HZN from spin wheel`);
            }

            // Show result in UI
            const resultDiv = document.getElementById('spin-result');
            resultDiv.innerHTML = reward > 0 ? `🎉 You won <strong>${reward} HZN</strong>!` : '😢 Better luck next time!';
            resultDiv.classList.add('show');

            // Update local data
            currentUserData.balance = newBalance;
            currentUserData.spins_left = spinsLeft - 1;
            
            // Update HZN UI
            document.getElementById('spin-count').textContent = spinsLeft - 1;
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
    const spins = currentUserData.spins_left !== undefined ? currentUserData.spins_left : 7;
    const el1 = document.getElementById('spins-left');
    const el2 = document.getElementById('spin-count');
    if (el1) el1.textContent = spins;
    if (el2) el2.textContent = spins;
}

// Tasks
function loadTasks() {
    const list = document.getElementById('tasks-list');
    list.innerHTML = '';
    const tasks = [
        { id: 1, title: 'Watch Ad 1', reward: 50, duration: 15 },
        { id: 2, title: 'Watch Ad 2', reward: 50, duration: 15 },
        { id: 3, title: 'Watch Ad 3', reward: 50, duration: 15 }
    ];

    tasks.forEach(t => {
        const div = document.createElement('div');
        div.className = 'task-card';
        div.innerHTML = `
            <div class="task-header"><span>${t.title}</span> <span>${t.reward} HZN</span></div>
            <button class="task-btn" onclick="startTask(${t.id})">Start</button>
        `;
        list.appendChild(div);
    });
}

let currentAdTask = null;
function startTask(id) {
    currentAdTask = { id, reward: 50, duration: 15 };
    document.getElementById('ad-overlay').classList.add('active');
    let timeLeft = 15;
    const timer = setInterval(() => {
        timeLeft--;
        document.getElementById('timer-text').textContent = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timer);
            completeTask();
        }
    }, 1000);
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
    saveActivity('Task Completed', `You completed a task and earned ${currentAdTask.reward} HZN`);
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
    const message = `🎉 Join Milionar & Earn 4000 HZN! 💰\n\nUse my referral code: ${code}\n\nDownload now and start earning!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`); 
}

function shareOnFacebook() { 
    const code = currentUserData.referral_code || '------';
    const message = `Join Milionar & Earn 4000 HZN! Use code: ${code}`;
    window.open(`https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(message)}`); 
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
        
        return `
        <div class="referral-user-card">
            <div class="referral-user-info">
                <div class="referral-avatar">
                    <span class="avatar-text">${user.username.charAt(0).toUpperCase()}</span>
                </div>
                <div class="referral-details">
                    <span class="referral-name">${user.username}</span>
                    <span class="referral-date">${dateStr}</span>
                </div>
            </div>
            <div class="referral-rewards">
                <div class="reward-row">
                    <span class="reward-label">Bonus</span>
                    <span class="reward-value bonus">+${rewardAmount}</span>
                </div>
                <div class="reward-row">
                    <span class="reward-label">Comm</span>
                    <span class="reward-value commission">+${commissionAmount}</span>
                </div>
            </div>
        </div>
    `})).then(html => html.join(''));
}

// Announcements
async function loadAnnouncements() {
    const list = document.getElementById('announcements-list');
    if (!list) return;
    
    const storageKey = `account_activities_${currentUser?.id}`;
    
    if (activeNotifTab === 'account') {
        const activities = JSON.parse(localStorage.getItem(storageKey) || '[]');
        if (activities.length > 0) {
            list.innerHTML = activities.map(a => `
                <div class="announcement-card ${a.read ? '' : 'unread'}">
                    <h4>${a.title}</h4>
                    <p>${a.message}</p>
                    <small class="activity-time">${a.time}</small>
                </div>
            `).join('');
        } else {
            list.innerHTML = '<p class="empty-state">No account activities yet</p>';
        }
    } else {
        try {
            const { data: news } = await supabaseClient.from('announcements').select('*').order('created_at', { ascending: false });
            if (news && news.length > 0) {
                list.innerHTML = news.map(n => `
                    <div class="announcement-card">
                        <h4>${n.title}</h4>
                        <p>${n.content}</p>
                    </div>
                `).join('');
            } else {
                list.innerHTML = '<p class="empty-state">No news available</p>';
            }
        } catch (e) {
            console.log('Announcements load error:', e.message);
            list.innerHTML = '<p class="empty-state">No news available</p>';
        }
    }
}

// Save activity to localStorage
function saveActivity(title, message) {
    if (!currentUser) return;
    const storageKey = `account_activities_${currentUser.id}`;
    const activities = JSON.parse(localStorage.getItem(storageKey) || '[]');
    activities.unshift({
        title,
        message,
        time: new Date().toLocaleString(),
        read: false
    });
    if (activities.length > 50) activities.splice(50);
    localStorage.setItem(storageKey, JSON.stringify(activities));
}

// Mark all as read
function markAllRead() {
    if (!currentUser) return;
    const storageKey = `account_activities_${currentUser.id}`;
    if (!storageKey) return;
    
    const activities = JSON.parse(localStorage.getItem(storageKey) || '[]');
    activities.forEach(a => a.read = true);
    localStorage.setItem(storageKey, JSON.stringify(activities));
    showToast('All marked as read', 'success');
    closeAnnouncementMenu();
    loadAnnouncements();
}

// Clear all announcements
function clearAllAnnouncements() {
    if (!currentUser) return;
    const storageKey = `account_activities_${currentUser.id}`;
    if (!storageKey) return;
    
    if (activeNotifTab === 'account') {
        localStorage.removeItem(storageKey);
        showToast('All activities cleared', 'success');
    } else {
        showToast('News cannot be cleared from app', 'info');
    }
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
    const localPhoto = localStorage.getItem(`profile_pic_${currentUser.id}`);
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
    const localPayment = localStorage.getItem(`payment_method_${currentUser.id}`);
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
    const day = now.getDay(); // 0 is Sunday
    const isSunday = day === 0;

    const lockedDiv = document.getElementById('withdrawal-locked');
    const activeDiv = document.getElementById('withdrawal-active');

    if (isSunday) {
        if (lockedDiv) lockedDiv.style.display = 'none';
        if (activeDiv) activeDiv.style.display = 'block';

        // Auto-select default payment method from localStorage
        const localPayment = localStorage.getItem(`payment_method_${currentUser.id}`);
        if (localPayment) {
            selectWithdrawalMethod(localPayment);
        }
    } else {
        if (lockedDiv) lockedDiv.style.display = 'block';
        if (activeDiv) activeDiv.style.display = 'none';
        updateWithdrawalCountdown();
        withdrawalTimer = setInterval(updateWithdrawalCountdown, 60000); // Update every minute
    }
}

function updateWithdrawalCountdown() {
    const now = new Date();
    const nextSunday = new Date();
    nextSunday.setDate(now.getDate() + (7 - now.getDay()) % 7);
    if (now.getDay() === 0) nextSunday.setDate(nextSunday.getDate() + 7);
    nextSunday.setHours(0, 0, 0, 0);

    const diff = nextSunday - now;
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
        localStorage.setItem(`profile_pic_${currentUser.id}`, base64);

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
    localStorage.setItem(`payment_method_${currentUser.id}`, m);
    showToast(`${m} selected as default!`, 'success');
}

function selectWithdrawalMethod(m) {
    currentUserData.withdrawal_method = m;
    document.querySelectorAll('.payment-option').forEach(opt => opt.classList.remove('selected'));
    const activeOpt = document.querySelector(`.payment-option[data-method="${m}"]`);
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

    // Fetch min withdrawal from settings
    const { data: settings } = await supabaseClient.from('settings').select('min_withdrawal').eq('id', 'app').single();
    if (settings && amountRs < settings.min_withdrawal) {
        return showToast(`Min withdrawal is Rs ${settings.min_withdrawal}`, 'error');
    }

    showLoading();
    try {
        const withdrawData = {
            user_id: currentUser.id,
            amount_rs: amountRs,
            amount_hzn: amountHZN,
            method: method,
            account_name: document.getElementById('withdraw-account-name').value,
            account_number: document.getElementById('withdraw-account-number').value,
            location: document.getElementById('withdraw-location').value,
            status: 'pending'
        };

        const { error: wError } = await supabaseClient.from('withdrawals').insert([withdrawData]);
        if (wError) throw wError;

        const { error: uError } = await supabaseClient.from('users').update({
            balance: currentUserData.balance - amountHZN
        }).eq('id', currentUser.id);
        if (uError) throw uError;

        await loadUserData();
        showToast('Withdrawal submitted!', 'success');
        saveActivity('Withdrawal Request', `You requested withdrawal of Rs ${amountRs}`);
        showDashboardScreen('home');
    } catch (error) {
        showToast(error.message, 'error');
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
    document.getElementById('transactions-list').innerHTML = txs?.map(t => `
        <div class="transaction-card">
            <span>${t.type}</span> <span>${t.amount} HZN</span>
        </div>
    `).join('') || 'No withdrawal transactions';
}

// Utilities
function showToast(m, type = 'success') {
    const toast = document.getElementById('toast');
    const icons = { success: 'fa-check', error: 'fa-times', info: 'fa-info' };
    toast.className = type;
    toast.querySelector('.toast-icon').innerHTML = `<i class="fas ${icons[type]}"></i>`;
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
function setFilter(f) { activeFilter = f; loadTasks(); }
function toggleAnnouncement(id) { }
function showAnnouncementMenu() { document.getElementById('announcement-menu-overlay')?.classList.add('active'); }
function closeAnnouncementMenu() { document.getElementById('announcement-menu-overlay')?.classList.remove('active'); }
function showReferralGuide() { document.getElementById('referral-guide-overlay')?.classList.add('active'); }
function closeReferralGuide() { document.getElementById('referral-guide-overlay')?.classList.remove('active'); }
function showNotifTab(e, t) { 
    activeNotifTab = t;
    document.querySelectorAll('.notif-tab').forEach(tab => tab.classList.remove('active'));
    e.target.closest('.notif-tab')?.classList.add('active');
    loadAnnouncements(); 
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
function fetchLocation() { showToast('Location fetched!', 'success'); }
function toggleFaq(element) {
    const faqItem = element.closest('.faq-item');
    faqItem.classList.toggle('active');
}
function goToInvite() { showDashboardScreen('invite'); }
function openTasks() { showDashboardScreen('tasks'); }
function openAnnouncements(tab) {
    showDashboardScreen('announcements');
    // Set the tab to system/news by default when opening from nav
    if (tab === 'system' || !tab) {
        activeNotifTab = 'system';
        // Update tab buttons UI
        setTimeout(() => {
            document.querySelectorAll('.notif-tab').forEach(t => t.classList.remove('active'));
            const systemTab = document.querySelector('.notif-tab:nth-child(2)');
            if (systemTab) systemTab.classList.add('active');
        }, 100);
    }
}

// Load landing stats on page load
loadLandingStats();
