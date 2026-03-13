import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-analytics.js";
import {
    getFirestore,
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    updatePassword,
    reauthenticateWithCredential,
    EmailAuthProvider,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyAMxDoAOoTDqsJd8rMbPtvKtwVgZ-B1Qt8",
    authDomain: "adopayi-fcf75.firebaseapp.com",
    projectId: "adopayi-fcf75",
    storageBucket: "adopayi-fcf75.firebasestorage.app",
    messagingSenderId: "478505020096",
    appId: "1:478505020096:web:08dcfff7af28a535d01b25",
    measurementId: "G-MZDQRK4LKT"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

// Make functions available globally at the EARLIEST moment
window.showScreen = (id) => showScreen(id);
window.showDashboardScreen = (id) => showDashboardScreen(id);
window.openSignup = () => openSignup();
window.openLogin = () => openLogin();
window.goToLanding = () => goToLanding();
window.logout = () => logout();
window.togglePassword = (id) => togglePassword(id);
window.showCheckIn = () => showCheckIn();
window.closeCheckIn = () => closeCheckIn();
window.doCheckIn = () => doCheckIn();
window.showSpinWheel = () => showSpinWheel();
window.closeSpin = () => closeSpin();
window.spinWheel = () => spinWheel();
window.closeAdEarly = () => closeAdEarly();
window.showQuiz = () => showQuiz();
window.closeQuiz = () => closeQuiz();
window.showVideos = () => showVideos();
window.closeVideos = () => closeVideos();
window.setFilter = (f) => setFilter(f);
window.filterTasks = () => filterTasks();
window.startTask = (id) => startTask(id);
window.copyReferralCode = () => copyReferralCode();
window.shareOnWhatsApp = () => shareOnWhatsApp();
window.shareOnFacebook = () => shareOnFacebook();
window.shareOnTikTok = () => shareOnTikTok();
window.toggleAnnouncement = (id) => toggleAnnouncement(id);
window.showAnnouncementMenu = () => showAnnouncementMenu();
window.closeAnnouncementMenu = () => closeAnnouncementMenu();
window.markAllRead = () => markAllRead();
window.clearAllAnnouncements = () => clearAllAnnouncements();
window.showReferralGuide = () => showReferralGuide();
window.closeReferralGuide = () => closeReferralGuide();
window.showNotifTab = (e, t) => showNotifTab(e, t);
window.likeAnnouncement = (id) => likeAnnouncement(id);
window.toggleAccountContent = (i) => toggleAccountContent(i);
window.changeProfilePhoto = () => changeProfilePhoto();
window.selectPaymentMethod = (m) => selectPaymentMethod(m);
window.selectWithdrawalMethod = (m) => selectWithdrawalMethod(m);
window.fetchLocation = () => fetchLocation();
window.toggleFaq = (e) => toggleFaq(e);
window.goToInvite = () => goToInvite();
window.openTasks = () => openTasks();
window.openAnnouncements = (tab) => openAnnouncements(tab);
window.openInvite = () => openInvite();
window.showTerms = () => showTerms();
window.closeTerms = () => closeTerms();
window.acceptTerms = () => acceptTerms();
window.switchTermsTab = (tab) => switchTermsTab(tab);

// Live Withdrawal Calculation
document.addEventListener('DOMContentLoaded', () => {
    const withdrawInput = document.getElementById('withdraw-amount');
    const calcBox = document.getElementById('withdraw-calculation');
    const calcHzn = document.getElementById('calc-hzn');

    if (withdrawInput) {
        withdrawInput.addEventListener('input', (e) => {
            const rs = parseFloat(e.target.value);
            if (!isNaN(rs) && rs > 0) {
                const hzn = Math.round(rs * 100);
                calcHzn.textContent = hzn;
                calcBox.style.display = 'flex';
            } else {
                calcBox.style.display = 'none';
            }
        });
    }
});

function closeAllOverlays() {
    document.querySelectorAll('.overlay').forEach(overlay => {
        overlay.classList.remove('active');
    });
}

function showTerms() {
    console.log('showTerms called');
    const overlay = document.getElementById('terms-overlay');
    if (overlay) {
        overlay.classList.add('active');
        console.log('Overlay activated');
    } else {
        console.log('Overlay not found');
    }
}

function closeTerms() {
    document.getElementById('terms-overlay').classList.remove('active');
}

function switchTermsTab(tab) {
    const termsTab = document.querySelectorAll('.terms-tab');
    const panels = document.querySelectorAll('.terms-panel');
    
    termsTab.forEach(t => t.classList.remove('active'));
    panels.forEach(p => p.classList.remove('active'));
    
    if (tab === 'terms') {
        document.querySelector('.terms-tab:first-child').classList.add('active');
        document.getElementById('terms-content').classList.add('active');
    } else {
        document.querySelector('.terms-tab:last-child').classList.add('active');
        document.getElementById('privacy-content').classList.add('active');
    }
}

function acceptTerms() {
    closeTerms();
    setTimeout(() => {
        openSignup();
    }, 300);
}

let currentUser = null;
let currentUserData = null;
let totalUsersCount = 0;
let activeFilter = 'all';
let activeNotifTab = 'account';

// Global shared states that MUST be reset on logout
let accountNotifications = [];
let dailyAdsTasks = [];
let lastAdsDate = null;

function resetAppState() {
    currentUser = null;
    currentUserData = null;
    accountNotifications = [];
    dailyAdsTasks = [];
    lastAdsDate = null;

    // Clear UI lists
    const taskList = document.getElementById('tasks-list');
    if (taskList) taskList.innerHTML = '';

    const notifList = document.getElementById('announcements-list');
    if (notifList) notifList.innerHTML = '';

    const referralList = document.getElementById('referred-users');
    if (referralList) referralList.innerHTML = '';

    const transactionList = document.getElementById('transactions-list');
    if (transactionList) transactionList.innerHTML = '';

    // Hide badges
    const notifBadge = document.getElementById('notif-badge');
    if (notifBadge) notifBadge.style.display = 'none';

    const annBadge = document.getElementById('announcement-badge');
    if (annBadge) annBadge.style.display = 'none';
}

const rewards = [10, 20, 30, 40, 50, 60, 100];
const spinRewards = [
    { value: 0, color: 'var(--gray-dark)', weight: 10 },    // Try Again
    { value: 20, color: 'var(--primary)', weight: 40 },     // High chance
    { value: 50, color: 'var(--secondary)', weight: 15 },   // Normal chance
    { value: 70, color: 'var(--info)', weight: 10 },        // Normal chance
    { value: 200, color: 'var(--success)', weight: 30 },    // High chance
    { value: 2000, color: 'var(--warning)', weight: 2 },    // Rare
    { value: 5000, color: 'var(--danger)', weight: 0.5 },   // Extremely Rare
    { value: 20, color: 'var(--primary)', weight: 35 }      // Duplicate 20 for even wheel slicing

];

// dailyAdsTasks and lastAdsDate are now handled in resetAppState()

function generateDailyAds() {
    const today = new Date().toDateString();

    if (lastAdsDate !== today) {
        lastAdsDate = today;

        const totalTarget = Math.floor(Math.random() * (10000 - 7000 + 1)) + 7000;
        const tasksCount = Math.floor(totalTarget / 30);

        dailyAdsTasks = [];

        for (let i = 1; i <= tasksCount; i++) {
            const adDuration = 15 + Math.floor(Math.random() * 15);
            const reward = 30 + Math.floor(Math.random() * 10);

            dailyAdsTasks.push({
                id: i,
                title: `Watch Ad ${i}`,
                description: `Watch ${adDuration} second advertisement`,
                reward: reward,
                duration: adDuration,
                category: 'ads',
                completed: false
            });
        }
    }

    return dailyAdsTasks;
}

const defaultAnnouncements = [
    { id: 1, icon: 'fa-gift', title: 'New Bonus Campaign!', content: 'Earn double on all tasks this weekend. Don\'t miss rewards out on this amazing opportunity to boost your earnings!', time: '2 hours ago', unread: true, likes: 5, views: Math.floor(Math.random() * 500) + 100 },
    { id: 2, icon: 'fa-bullhorn', title: 'System Maintenance', content: 'The app will undergo maintenance on Sunday from 2 AM to 4 AM. Services may be temporarily unavailable.', time: '1 day ago', unread: false, likes: 2, views: Math.floor(Math.random() * 500) + 100 },
    { id: 3, icon: 'fa-star', title: 'Top Earners Winner', content: 'Congratulations to our top earners this month! Special prizes await you. Keep earning!', time: '3 days ago', unread: false, likes: 10, views: Math.floor(Math.random() * 500) + 100 },
];

function loadAnnouncementsFromStorage() {
    const stored = localStorage.getItem('announcementsLikes');
    if (stored) {
        const storedLikes = JSON.parse(stored);
        defaultAnnouncements.forEach(ann => {
            if (storedLikes[ann.id]) {
                ann.likes = storedLikes[ann.id];
            }
        });
    }
    return defaultAnnouncements;
}

function saveAnnouncementsToStorage() {
    const likes = {};
    defaultAnnouncements.forEach(ann => {
        likes[ann.id] = ann.likes;
    });
    localStorage.setItem('announcementsLikes', JSON.stringify(likes));
}

let announcements = loadAnnouncementsFromStorage();

// accountNotifications is now handled in resetAppState()

function addAccountNotification(icon, title, content) {
    const notification = {
        id: Date.now(),
        icon: icon,
        title: title,
        content: content,
        time: 'Just now',
        unread: true
    };
    accountNotifications.unshift(notification);
    updateAllNotifications();
}

function updateAllNotifications() {
    const accountUnread = accountNotifications.filter(n => n.unread).length;
    const systemUnread = announcements.filter(a => a.unread).length;

    // Home Bell Badge (Account Only)
    const notifBadge = document.getElementById('notif-badge');
    if (notifBadge) {
        if (accountUnread > 0) {
            notifBadge.style.display = 'flex';
            notifBadge.textContent = accountUnread > 9 ? '9+' : accountUnread;
        } else {
            notifBadge.style.display = 'none';
        }
    }

    // Nav System Badge (System Only)
    const navSystemBadge = document.getElementById('nav-system-badge');
    if (navSystemBadge) {
        if (systemUnread > 0) {
            navSystemBadge.style.display = 'flex';
            navSystemBadge.textContent = systemUnread > 9 ? '9+' : systemUnread;
        } else {
            navSystemBadge.style.display = 'none';
        }
    }

    // Tab Badges
    const accountTabBadge = document.getElementById('account-tab-badge');
    if (accountTabBadge) {
        if (accountUnread > 0) {
            accountTabBadge.style.display = 'inline-flex';
            accountTabBadge.textContent = accountUnread > 9 ? '9+' : accountUnread;
        } else {
            accountTabBadge.style.display = 'none';
        }
    }

    const systemTabBadge = document.getElementById('system-tab-badge');
    if (systemTabBadge) {
        if (systemUnread > 0) {
            systemTabBadge.style.display = 'inline-flex';
            systemTabBadge.textContent = systemUnread > 9 ? '9+' : systemUnread;
        } else {
            systemTabBadge.style.display = 'none';
        }
    }
}

// Ensure active tab clears unread if needed
function markTabAsRead(tab) {
    let changed = false;
    if (tab === 'account') {
        accountNotifications.forEach(n => {
            if (n.unread) {
                n.unread = false;
                changed = true;
            }
        });
    } else {
        announcements.forEach(a => {
            if (a.unread) {
                a.unread = false;
                changed = true;
            }
        });
    }

    if (changed) {
        updateAllNotifications();
        if (tab === 'system') {
            saveAnnouncementsToStorage();
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    await updateTotalUsers();
    setGreeting();
    updateCountdown();
    setInterval(updateCountdown, 60000);
    loadTasks();
    loadAccountNotifications();
    updateAllNotifications();
    checkReferralRequired();

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            await loadUserData(user.uid);
        } else {
            // If user is logged out, ensure we are on landing
            resetAppState();
            showScreen('landing');
        }
    });
});

async function updateTotalUsers() {
    try {
        const snapshot = await getDocs(collection(db, 'users'));
        totalUsersCount = snapshot.size;
        document.getElementById('total-users').textContent = totalUsersCount.toLocaleString();
        
        // Calculate total payouts from approved withdrawals
        try {
            const withdrawalsSnapshot = await getDocs(query(collection(db, 'withdrawals'), where('status', '==', 'approved')));
            let totalPayouts = 0;
            withdrawalsSnapshot.forEach(doc => {
                const data = doc.data();
                totalPayouts += parseInt(data.amount) || 0;
            });
            
            // Format the payout amount
            let payoutDisplay = '₨ 0';
            if (totalPayouts >= 10000000) {
                payoutDisplay = '₨ ' + (totalPayouts / 10000000).toFixed(1) + 'M+';
            } else if (totalPayouts >= 1000000) {
                payoutDisplay = '₨ ' + (totalPayouts / 1000000).toFixed(1) + 'M+';
            } else if (totalPayouts >= 100000) {
                payoutDisplay = '₨ ' + (totalPayouts / 1000).toFixed(0) + 'K+';
            } else {
                payoutDisplay = '₨ ' + totalPayouts.toLocaleString();
            }
            
            const payoutsEl = document.getElementById('total-payouts');
            if (payoutsEl) {
                payoutsEl.textContent = payoutDisplay;
                payoutsEl.classList.add('count-up');
            }
        } catch (wError) {
            console.log('Could not load payouts:', wError);
        }
        
        checkReferralRequired();
    } catch (e) {
        document.getElementById('total-users').textContent = '0';
    }
}

function checkReferralRequired() {
    const refLabel = document.getElementById('ref-required-msg');
    const refInput = document.getElementById('signup-referral');
    if (totalUsersCount < 2) {
        refLabel.textContent = '(Optional - first 2 users free)';
        refInput.required = false;
    } else {
        refLabel.textContent = '(Required)';
        refInput.required = true;
    }
}

async function loadUserData(uid) {
    showLoading();
    try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
            currentUser = auth.currentUser;
            currentUserData = { id: uid, ...userDoc.data() };

            // Ensure tasks are freshly generated for this user session
            loadTasks();

            showScreen('dashboard');
            updateUserUI();
        }
    } catch (e) {
        console.error('Error loading user:', e);
    } finally {
        hideLoading();
    }
}

function showScreen(screenId) {
    const screen = document.getElementById(screenId);
    if (!screen) {
        console.error(`Screen not found: ${screenId}`);
        return;
    }
    closeAllOverlays();
    window.scrollTo(0, 0);
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    screen.classList.add('active');

    // Refresh data for specific screens
    if (screenId === 'dashboard') {
        showDashboardScreen('home');
    }
    if (screenId === 'withdrawal') {
        updateUserUI(); // Ensure balance is fresh
    }
    if (screenId === 'transaction-history') {
        loadTransactionHistory(); // Refresh history
    }
}

function showDashboardScreen(screenId) {
    const targetScreen = document.getElementById(`${screenId}-screen`);
    const navItem = document.querySelector(`.nav-item[data-screen="${screenId}"]`);

    if (!targetScreen) {
        console.error(`Dashboard screen not found: ${screenId}-screen`);
        return;
    }

    // Crucial: Close any open overlays when switching tabs via bottom nav
    closeAllOverlays();

    window.scrollTo(0, 0);
    document.querySelectorAll('.dashboard-screen').forEach(s => s.classList.remove('active'));
    targetScreen.classList.add('active');

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (navItem) {
        navItem.classList.add('active');
    }

    if (screenId === 'profile') {
        loadProfileData();
    } else if (screenId === 'invite') {
        loadInviteData();
    } else if (screenId === 'tasks') {
        filterTasks();
    } else if (screenId === 'announcements') {
        if (activeNotifTab === 'account') {
            markAllAccountNotificationsRead();
        } else {
            markAnnouncementsAsRead();
        }
    }
}

function setGreeting() {
    document.getElementById('greeting-text').textContent = 'Hello';
}

function updateCountdown() {
    const now = new Date();
    const daysUntilSunday = (7 - now.getDay()) % 7;
    const isSunday = now.getDay() === 0;

    let nextSunday = new Date(now);
    if (!isSunday) {
        nextSunday.setDate(now.getDate() + daysUntilSunday);
    }
    nextSunday.setHours(0, 0, 0, 0);

    const diff = nextSunday - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    document.getElementById('days-left').textContent = isSunday ? 0 : days;
    document.getElementById('hours-left').textContent = isSunday ? 0 : hours;
    document.getElementById('minutes-left').textContent = isSunday ? 0 : minutes;

    if (isSunday) {
        document.getElementById('withdrawal-locked').style.display = 'none';
        document.getElementById('withdrawal-active').style.display = 'block';
    } else {
        document.getElementById('withdrawal-locked').style.display = 'block';
        document.getElementById('withdrawal-active').style.display = 'none';
    }
}

// Signup Form
document.getElementById('signup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();

    const fullname = document.getElementById('signup-fullname').value;
    const username = document.getElementById('signup-username').value.toLowerCase();
    const email = document.getElementById('signup-email').value;
    const phone = document.getElementById('signup-phone').value;
    const password = document.getElementById('signup-password').value;
    const confirmPassword = document.getElementById('signup-confirm-password').value;
    const referralCode = document.getElementById('signup-referral').value.trim();
    const saveAccount = document.getElementById('save-account').checked;

    if (password !== confirmPassword) {
        hideLoading();
        showToast('Passwords do not match', 'error');
        return;
    }

    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
        hideLoading();
        showToast('Password must be at least 8 chars with 1 uppercase and 1 number', 'error');
        return;
    }

    if (totalUsersCount >= 2 && !referralCode) {
        hideLoading();
        showToast('Referral code required', 'error');
        return;
    }

    try {
        // Check if username/email/phone exists
        const usersRef = collection(db, 'users');
        const usernameQuery = await getDocs(query(usersRef, where('username', '==', username)));
        if (!usernameQuery.empty) {
            hideLoading();
            showToast('Username already taken', 'error');
            return;
        }

        const emailQuery = await getDocs(query(usersRef, where('email', '==', email)));
        if (!emailQuery.empty) {
            hideLoading();
            showToast('Email already registered', 'error');
            return;
        }

        const phoneQuery = await getDocs(query(usersRef, where('phone', '==', phone)));
        if (!phoneQuery.empty) {
            hideLoading();
            showToast('Phone number already registered', 'error');
            return;
        }

        // Create user with email/password
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        const myReferralCode = username;
        let referredBy = null;

        // Check referral code
        if (referralCode) {
            const referrerQuery = await getDocs(query(usersRef, where('username', '==', referralCode.toLowerCase())));
            if (!referrerQuery.empty) {
                referredBy = referrerQuery.docs[0].id;

                // Give signup bonus to referrer (400 HZN) and new user (800 HZN)
                const referrerData = referrerQuery.docs[0].data();
                await updateDoc(doc(db, 'users', referredBy), {
                    balance: (referrerData.balance || 0) + 2000,
                    totalEarnings: (referrerData.totalEarnings || 0) + 2000,
                    referralEarnings: (referrerData.referralEarnings || 0) + 2000
                });
            }
        }

        // Create user document
        const userData = {
            uid: user.uid,
            fullname,
            username,
            email,
            phone,
            referralCode: myReferralCode,
            referredBy,
            balance: 4000,
            totalEarnings: 4000,
            checkInDay: 0,
            lastCheckIn: null,
            spinsLeft: 7,
            lastSpin: null,
            paymentMethod: null,
            createdAt: serverTimestamp(),
            isVerified: false
        };

        await setDoc(doc(db, 'users', user.uid), userData);

        await updateTotalUsers();

        // Set current user data for new signup
        currentUser = auth.currentUser;
        currentUserData = { id: user.uid, ...userData };

        hideLoading();
        showToast('Account created successfully!', 'success');
        showScreen('dashboard');
        updateUserUI();

    } catch (error) {
        hideLoading();
        console.error('Signup error:', error);
        showToast(getErrorMessage(error.code), 'error');
    }
});

// Login Form
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();

    const identifier = document.getElementById('login-identifier').value;
    const password = document.getElementById('login-password').value;

    try {
        let email = identifier;

        // Check if identifier is username or phone
        if (!identifier.includes('@')) {
            const usersRef = collection(db, 'users');
            let userQuery = await getDocs(query(usersRef, where('username', '==', identifier.toLowerCase())));

            if (userQuery.empty) {
                userQuery = await getDocs(query(usersRef, where('phone', '==', identifier)));
            }

            if (userQuery.empty) {
                hideLoading();
                showToast('User not found', 'error');
                return;
            }

            email = userQuery.docs[0].data().email;
        }

        await signInWithEmailAndPassword(auth, email, password);

        hideLoading();
        showToast('Login successful!', 'success');
        showScreen('dashboard');

    } catch (error) {
        hideLoading();
        console.error('Login error:', error);
        showToast(getErrorMessage(error.code), 'error');
    }
});

function updateUserUI() {
    if (!currentUserData) return;

    const fullname = currentUserData.fullname || 'User';
    const username = currentUserData.username || 'user';
    const balance = currentUserData.balance || 0;
    const referralCode = currentUserData.referralCode || '------';

    if (document.getElementById('user-name')) document.getElementById('user-name').textContent = fullname;
    if (document.getElementById('profile-name')) document.getElementById('profile-name').textContent = fullname;
    if (document.getElementById('profile-username')) document.getElementById('profile-username').textContent = '@' + username;
    if (document.getElementById('total-balance')) document.getElementById('total-balance').textContent = balance;
    if (document.getElementById('profile-balance')) document.getElementById('profile-balance').textContent = balance;
    if (document.getElementById('earn-rate')) document.getElementById('earn-rate').textContent = (balance * 0.01).toFixed(2);
    if (document.getElementById('profile-pkr')) document.getElementById('profile-pkr').textContent = (balance * 0.01).toFixed(2);
    if (document.getElementById('my-referral-code')) document.getElementById('my-referral-code').textContent = referralCode;

    // Update profile pic (check local storage first)
    let profilePic = localStorage.getItem('profilePic_' + currentUserData.id);
    if (!profilePic) {
        const randomImg = Math.floor(Math.random() * 10) + 1;
        profilePic = `https://i.pravatar.cc/150?img=${randomImg}`;
    }
    if (document.getElementById('profile-pic')) document.getElementById('profile-pic').src = profilePic;
    if (document.getElementById('edit-profile-pic')) document.getElementById('edit-profile-pic').src = profilePic;

    // Load saved payment method
    const savedMethod = localStorage.getItem('paymentMethod_' + currentUserData.id);
    if (savedMethod) {
        currentUserData.paymentMethod = savedMethod;
        // Optionally update UI selection silently
        document.querySelectorAll('.payment-option').forEach(btn => {
            btn.classList.remove('selected');
            if (btn.dataset.method === savedMethod) {
                btn.classList.add('selected');
            }
        });
    }

    // Update Withdrawal section balance
    const balanceRs = (balance * 0.01).toFixed(2);
    if (document.getElementById('withdraw-available-rs')) document.getElementById('withdraw-available-rs').textContent = `Rs ${balanceRs}`;
    if (document.getElementById('withdraw-available-hzn')) document.getElementById('withdraw-available-hzn').textContent = `${balance} HZN`;

    // Load profile edit data
    if (document.getElementById('edit-fullname')) document.getElementById('edit-fullname').value = fullname;
    if (document.getElementById('edit-username')) document.getElementById('edit-username').value = username;
    if (document.getElementById('edit-phone')) document.getElementById('edit-phone').value = currentUserData.phone || '';
    if (document.getElementById('edit-email')) document.getElementById('edit-email').value = currentUserData.email || '';

    if (currentUserData.createdAt && document.getElementById('edit-joined')) {
        const date = currentUserData.createdAt.toDate ? currentUserData.createdAt.toDate() : new Date(currentUserData.createdAt);
        document.getElementById('edit-joined').value = date.toLocaleDateString();
    }

    // Update payment method selection
    if (currentUserData.paymentMethod) {
        document.querySelectorAll('.wallet-card').forEach(card => {
            card.classList.toggle('selected', card.dataset.method === currentUserData.paymentMethod);
        });
    }

    updateCheckInUI();
    updateSpinUI();
}

function updateCheckInUI() {
    if (!currentUserData) return;

    const day = currentUserData.checkInDay || 0;
    const checkinDayEl = document.getElementById('checkin-day');
    if (checkinDayEl) {
        checkinDayEl.textContent = day === 0 ? 1 : day;
    }

    const dayBoxes = document.querySelectorAll('.day-box');
    dayBoxes.forEach((box, index) => {
        box.classList.remove('completed', 'current');
        if (index < day) {
            box.classList.add('completed');
        } else if (index === day) {
            box.classList.add('current');
        }
    });

    const lastCheckIn = currentUserData.lastCheckIn;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (lastCheckIn) {
        const lastDate = new Date(lastCheckIn.toDate ? lastCheckIn.toDate() : lastCheckIn);
        const lastCheckInDate = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());

        if (lastCheckInDate.getTime() === today.getTime()) {
            const checkInBtn = document.querySelector('.action-buttons-row .action-btn:first-child span');
            if (checkInBtn) {
                checkInBtn.textContent = 'Checked';
            }
        }
    }
}

function updateSpinUI() {
    const spinsLeft = currentUserData.spinsLeft !== undefined ? currentUserData.spinsLeft : 3;
    document.getElementById('spins-left').textContent = spinsLeft;
    document.getElementById('spin-count').textContent = spinsLeft;

    const spinBtn = document.getElementById('spin-btn');
    if (spinsLeft <= 0) {
        spinBtn.disabled = true;
        spinBtn.textContent = 'No Spins Left';
    } else {
        spinBtn.disabled = false;
        spinBtn.textContent = 'Spin Now';
    }
}

// Check-In Functions
function showCheckIn() {
    if (!currentUser || !currentUserData) {
        showToast('Please login first!', 'error');
        return;
    }

    const lastCheckIn = currentUserData.lastCheckIn;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (lastCheckIn) {
        const lastDate = new Date(lastCheckIn.toDate ? lastCheckIn.toDate() : lastCheckIn);
        const lastCheckInDate = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());

        if (lastCheckInDate.getTime() === today.getTime()) {
            showToast('Already checked in today! Come back tomorrow.', 'error');
            return;
        }
    }

    document.getElementById('checkin-overlay').classList.add('active');
    updateCheckInOverlay();
}

function closeCheckIn() {
    document.getElementById('checkin-overlay').classList.remove('active');
}

function updateCheckInOverlay() {
    const day = currentUserData.checkInDay || 0;
    const days = document.querySelectorAll('.checkin-day');
    days.forEach((d, index) => {
        d.classList.remove('completed', 'current');
        if (index < day) {
            d.classList.add('completed');
        } else if (index === day) {
            d.classList.add('current');
        }
    });

    const checkInBtn = document.getElementById('checkin-btn');
    const lastCheckIn = currentUserData.lastCheckIn;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (lastCheckIn) {
        const lastDate = new Date(lastCheckIn.toDate ? lastCheckIn.toDate() : lastCheckIn);
        const lastCheckInDate = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());

        if (lastCheckInDate.getTime() === today.getTime()) {
            checkInBtn.disabled = true;
            checkInBtn.textContent = 'Checked In Today';
            return;
        }
    }
    checkInBtn.disabled = false;
    checkInBtn.textContent = 'Check In Now';
}

async function doCheckIn() {
    if (!currentUser || !currentUserData) {
        showToast('Please login first!', 'error');
        return;
    }

    const lastCheckIn = currentUserData.lastCheckIn;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (lastCheckIn) {
        const lastDate = new Date(lastCheckIn.toDate ? lastCheckIn.toDate() : lastCheckIn);
        const lastCheckInDate = new Date(lastDate.getFullYear(), lastDate.getMonth(), lastDate.getDate());

        if (lastCheckInDate.getTime() === today.getTime()) {
            showToast('Already checked in today! Check again tomorrow.', 'error');
            return;
        }
    }

    showLoading();

    let newDay = (currentUserData.checkInDay || 0) + 1;
    if (newDay > 7) newDay = 1;

    const reward = rewards[newDay - 1];

    try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
            checkInDay: newDay,
            lastCheckIn: serverTimestamp(),
            balance: (currentUserData.balance || 0) + reward,
            totalEarnings: (currentUserData.totalEarnings || 0) + reward
        });

        currentUserData.checkInDay = newDay;
        currentUserData.lastCheckIn = new Date();
        currentUserData.balance = (currentUserData.balance || 0) + reward;
        currentUserData.totalEarnings = (currentUserData.totalEarnings || 0) + reward;

        updateUserUI();
        hideLoading();
        showToast(`Check-in successful! +${reward} HZN`, 'success');
        addAccountNotification('fa-calendar-check', 'Daily Check-In', `You earned ${reward} HZN for daily check-in!`);
        closeCheckIn();

    } catch (error) {
        hideLoading();
        showToast('Error during check-in', 'error');
    }
}

// Spin Wheel Functions
function showSpinWheel() {
    if (!currentUser || !currentUserData) {
        showToast('Please login first!', 'error');
        return;
    }

    // Reset spins if it's a new day
    if (currentUserData.lastSpin) {
        const now = new Date();
        const lastSpinTime = new Date(currentUserData.lastSpin.toDate ? currentUserData.lastSpin.toDate() : currentUserData.lastSpin);
        const lastSpinDate = new Date(lastSpinTime.getFullYear(), lastSpinTime.getMonth(), lastSpinTime.getDate());
        const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (todayDate.getTime() > lastSpinDate.getTime()) {
            currentUserData.spinsLeft = 7;
            // Optimistically update DB in background
            updateDoc(doc(db, 'users', currentUser.uid), { spinsLeft: 7 }).catch(console.error);
        }
    } else if (currentUserData.spinsLeft === undefined || currentUserData.spinsLeft === 3) {
        // Fallback for old entries without lastSpin tracking
        currentUserData.spinsLeft = 7;
        updateDoc(doc(db, 'users', currentUser.uid), { spinsLeft: 7 }).catch(console.error);
    }

    document.getElementById('spin-overlay').classList.add('active');
    updateSpinUI();
}

function closeSpin() {
    document.getElementById('spin-overlay').classList.remove('active');
}

async function spinWheel() {
    const spinsLeft = currentUserData.spinsLeft !== undefined ? currentUserData.spinsLeft : 7;

    if (spinsLeft <= 0) {
        showToast('No spins left for today!', 'error');
        return;
    }

    const wheel = document.getElementById('spin-wheel');
    const spinBtn = document.getElementById('spin-btn');
    const resultDiv = document.getElementById('spin-result');

    spinBtn.disabled = true;
    resultDiv.classList.remove('show', 'win', 'lose');

    // Probability distribution
    const totalWeight = spinRewards.reduce((sum, r) => sum + r.weight, 0);
    let random = Math.random() * totalWeight;
    let selectedReward = spinRewards[0];

    for (const reward of spinRewards) {
        random -= reward.weight;
        if (random <= 0) {
            selectedReward = reward;
            break;
        }
    }

    // Calculate rotation
    const segmentAngle = 360 / 8;
    const baseRotation = 360 * 5;
    const rewardIndex = spinRewards.indexOf(selectedReward);
    const targetAngle = baseRotation + (rewardIndex * segmentAngle) + (segmentAngle / 2);

    wheel.style.transform = `rotate(${targetAngle}deg)`;

    setTimeout(async () => {
        const reward = selectedReward.value;

        if (reward > 0) {
            resultDiv.textContent = `Congratulations! You won ${reward} HZN!`;
            resultDiv.classList.add('win', 'show');

            addAccountNotification('fa-trophy', 'Spin Win!', `Congratulations! You won ${reward} HZN on the spin wheel!`);

            showLoading();
            try {
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    spinsLeft: spinsLeft - 1,
                    lastSpin: serverTimestamp(),
                    balance: (currentUserData.balance || 0) + reward,
                    totalEarnings: (currentUserData.totalEarnings || 0) + reward
                });

                currentUserData.spinsLeft = spinsLeft - 1;
                currentUserData.balance = (currentUserData.balance || 0) + reward;
                currentUserData.totalEarnings = (currentUserData.totalEarnings || 0) + reward;
                currentUserData.lastSpin = new Date();

                updateUserUI();
                hideLoading();
            } catch (error) {
                hideLoading();
            }

            // Hide result after 1 second
            setTimeout(() => {
                resultDiv.classList.remove('show');
            }, 1000);

        } else {
            resultDiv.textContent = 'Better luck next time!';
            resultDiv.classList.add('lose', 'show');

            showLoading();
            try {
                await updateDoc(doc(db, 'users', currentUser.uid), {
                    spinsLeft: spinsLeft - 1,
                    lastSpin: serverTimestamp()
                });

                currentUserData.spinsLeft = spinsLeft - 1;
                currentUserData.lastSpin = new Date();

                hideLoading();
            } catch (error) {
                hideLoading();
            }

            // Hide result after 1 second
            setTimeout(() => {
                resultDiv.classList.remove('show');
            }, 1000);
        }

        // Reset wheel after delay
        setTimeout(() => {
            wheel.style.transition = 'none';
            wheel.style.transform = 'rotate(0deg)';
            setTimeout(() => {
                wheel.style.transition = 'transform 4s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
            }, 50);
            updateSpinUI();
            spinBtn.disabled = false;
        }, 3000);

    }, 4000);
}

// Quiz & Videos (Coming Soon)
function showQuiz() {
    if (!currentUser || !currentUserData) {
        showToast('Please login first!', 'error');
        return;
    }
    document.getElementById('quiz-overlay').classList.add('active');
}

function closeQuiz() {
    document.getElementById('quiz-overlay').classList.remove('active');
}

function showVideos() {
    if (!currentUser || !currentUserData) {
        showToast('Please login first!', 'error');
        return;
    }
    document.getElementById('videos-overlay').classList.add('active');
}

function closeVideos() {
    document.getElementById('videos-overlay').classList.remove('active');
}

// Tasks
function loadTasks() {
    const tasksList = document.getElementById('tasks-list');
    tasksList.innerHTML = '';

    const tasks = generateDailyAds();

    tasks.forEach(task => {
        const card = document.createElement('div');
        card.className = 'task-card';
        card.dataset.category = task.category.toLowerCase().replace(' ', '-');

        const btnText = task.completed ? 'Done' : 'Start';
        const btnClass = task.completed ? 'task-btn done' : 'task-btn';

        card.innerHTML = `
            <div class="task-header">
                <span class="task-title">${task.title}</span>
                <span class="task-reward">${task.reward} HZN</span>
            </div>
            <p class="task-desc">${task.description} <span class="task-duration">(${task.duration}s)</span></p>
            <div class="task-footer">
                <span class="task-category">${task.category}</span>
                <button class="${btnClass}" onclick="startTask(${task.id})">${btnText}</button>
            </div>
        `;
        tasksList.appendChild(card);
    });
}

function setFilter(filter) {
    activeFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.filter === filter) {
            btn.classList.add('active');
        }
    });
    filterTasks();
}

function filterTasks() {
    const searchTerm = document.getElementById('task-search').value.toLowerCase();

    document.querySelectorAll('.task-card').forEach(card => {
        const title = card.querySelector('.task-title').textContent.toLowerCase();
        const category = card.dataset.category;

        const matchesSearch = title.includes(searchTerm);
        const matchesFilter = activeFilter === 'all' || category === activeFilter;

        if (matchesSearch && matchesFilter) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

let currentAdTask = null;
let adTimerInterval = null;
let adCompleted = false;

function startTask(taskId) {
    if (!currentUser || !currentUserData) {
        showToast('Please login first!', 'error');
        return;
    }

    const task = dailyAdsTasks.find(t => t.id === taskId);
    if (!task || task.completed) {
        showToast('Task already completed!', 'error');
        return;
    }

    currentAdTask = task;
    adCompleted = false;

    document.getElementById('ad-overlay').classList.add('active');
    document.getElementById('timer-text').textContent = task.duration;
    
    const progressCircle = document.getElementById('timer-progress');
    progressCircle.style.strokeDashoffset = 283;
    
    document.querySelector('.ad-circle').style.display = 'block';
    document.querySelector('.ad-icon').style.display = 'flex';
    document.querySelector('.ad-content h2').style.display = 'block';
    document.querySelector('.ad-content p').style.display = 'block';
    document.querySelector('.ad-dots').style.display = 'flex';
    document.getElementById('ad-complete').style.display = 'none';

    let elapsed = 0;
    const duration = task.duration;
    const circumference = 283;

    adTimerInterval = setInterval(() => {
        elapsed++;
        const progress = elapsed / duration;
        const offset = circumference - (progress * circumference);

        progressCircle.style.strokeDashoffset = offset;
        document.getElementById('timer-text').textContent = duration - elapsed;

        if (elapsed >= duration) {
            clearInterval(adTimerInterval);
            adCompleted = true;
            
            document.querySelector('.ad-circle').style.display = 'none';
            document.querySelector('.ad-icon').style.display = 'none';
            document.querySelector('.ad-content h2').style.display = 'none';
            document.querySelector('.ad-content p').style.display = 'none';
            document.querySelector('.ad-dots').style.display = 'none';
            document.getElementById('ad-complete').style.display = 'flex';
            
            setTimeout(() => {
                completeTask();
            }, 1500);
        }
    }, 1000);
}

function closeAdEarly() {
    if (adTimerInterval) {
        clearInterval(adTimerInterval);
        adTimerInterval = null;
    }

    document.getElementById('ad-overlay').classList.remove('active');
    
    document.querySelector('.ad-circle').style.display = 'block';
    document.querySelector('.ad-icon').style.display = 'flex';
    document.querySelector('.ad-content h2').style.display = 'block';
    document.querySelector('.ad-content p').style.display = 'block';
    document.querySelector('.ad-dots').style.display = 'flex';
    document.getElementById('ad-complete').style.display = 'none';

    if (!adCompleted && currentAdTask) {
        showToast('Ad not completed! No reward earned.', 'error');
    }

    currentAdTask = null;
}

async function completeTask() {
    if (!currentAdTask || !adCompleted) return;

    document.getElementById('ad-overlay').classList.remove('active');

    currentAdTask.completed = true;

    try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
            balance: (currentUserData.balance || 0) + currentAdTask.reward,
            totalEarnings: (currentUserData.totalEarnings || 0) + currentAdTask.reward
        });

        currentUserData.balance = (currentUserData.balance || 0) + currentAdTask.reward;
        currentUserData.totalEarnings = (currentUserData.totalEarnings || 0) + currentAdTask.reward;

        // Give 5% commission to referrer in Rs
        if (currentUserData.referredBy) {
            const referrerSnap = await getDoc(doc(db, 'users', currentUserData.referredBy));
            if (referrerSnap.exists()) {
                const referrerData = referrerSnap.data();
                const commission = Math.floor(currentAdTask.reward * 0.05);

                await updateDoc(doc(db, 'users', currentUserData.referredBy), {
                    balance: (referrerData.balance || 0) + commission,
                    totalEarnings: (referrerData.totalEarnings || 0) + commission,
                    referralEarnings: (referrerData.referralEarnings || 0) + commission
                });

                if (commission > 0) {
                    addAccountNotification('fa-percentage', 'Referral Commission', `You earned ${commission} HZN from your referral's task!`);
                }
            }
        }

        updateUserUI();
        loadTasks();
        showToast(`Great! You earned ${currentAdTask.reward} HZN!`, 'success');
        addAccountNotification('fa-ad', 'Task Completed', `You earned ${currentAdTask.reward} HZN from watching ad!`);
    } catch (error) {
        showToast('Error saving reward', 'error');
    }

    currentAdTask = null;
    adCompleted = false;
}

// Invite Functions
async function loadInviteData() {
    if (!currentUserData) return;

    document.getElementById('my-referral-code').textContent = currentUserData.referralCode || '------';

    try {
        const referralsRef = collection(db, 'users');
        const referralsQuery = query(referralsRef, where('referredBy', '==', currentUser.uid));
        const referralsSnap = await getDocs(referralsQuery);

        let totalReferrals = 0;
        let signupBonus = 0;
        let commission = 0;

        const referredUsersDiv = document.getElementById('referred-users');
        referredUsersDiv.innerHTML = '';

        referralsSnap.forEach(doc => {
            const data = doc.data();
            totalReferrals++;

            const referralBonus = 2000;
            signupBonus += referralBonus;

            const referralEarnings = data.totalEarnings || 0;
            const referralCommission = Math.floor(referralEarnings * 0.05);
            commission += referralCommission;

            const userDiv = document.createElement('div');
            userDiv.className = 'referred-user';
            userDiv.innerHTML = `
                <div class="referred-user-info">
                    <div class="referred-user-avatar">${data.username ? data.username[0].toUpperCase() : 'U'}</div>
                    <div>
                        <strong>${data.username || 'User'}</strong>
                        <p style="font-size: 0.75rem; color: var(--gray);">${data.createdAt ? new Date(data.createdAt.toDate ? data.createdAt.toDate() : data.createdAt).toLocaleDateString() : 'Recently'}</p>
                    </div>
                </div>
                <div class="referred-user-earnings">
                    <span class="amount" style="font-size: 0.8rem;">+${referralBonus} HZN bonus</span>
                    ${referralCommission > 0 ? `<span class="amount" style="font-size: 0.75rem; color: var(--success);">+${referralCommission} HZN commission</span>` : ''}
                </div>
            `;
            referredUsersDiv.appendChild(userDiv);
        });

        if (totalReferrals === 0) {
            referredUsersDiv.innerHTML = '<p style="text-align: center; color: var(--gray); padding: 20px;">No referrals yet. Share your code!</p>';
        }

        document.getElementById('total-referrals').textContent = totalReferrals;
        document.getElementById('signup-bonus-earnings').textContent = currentUserData.referralEarnings || 0;

    } catch (error) {
        console.error('Error loading invite data:', error);
    }
}

function copyReferralCode() {
    const code = document.getElementById('my-referral-code').textContent;
    navigator.clipboard.writeText(code);
    showToast('Referral code copied!', 'success');
}

function shareOnWhatsApp() {
    const code = document.getElementById('my-referral-code').textContent;
    const text = `Join Hazana and earn rewards! Use my referral code: ${code}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

function shareOnFacebook() {
    const code = document.getElementById('my-referral-code').textContent;
    const text = `Join Hazana and earn rewards! Use my referral code: ${code}`;
    window.open(`https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(text)}`, '_blank');
}

function shareOnTikTok() {
    showToast('Open TikTok to share your referral code', 'success');
}

// Announcements
function loadAnnouncements() {
    const list = document.getElementById('announcements-list');
    list.innerHTML = '';

    const userLikes = JSON.parse(localStorage.getItem('userLikes') || '{}');
    const systemAnns = announcements.map(a => ({ ...a, type: 'system' }));

    let unreadCount = 0;

    systemAnns.forEach(ann => {
        if (ann.unread) unreadCount++;

        const card = document.createElement('div');
        card.className = `announcement-card ${ann.unread ? 'unread' : ''}`;
        card.id = `announcement-${ann.id}`;

        const contentLength = ann.content.length;
        const needsSeeMore = contentLength > 80;
        const hasLiked = userLikes[ann.id] ? true : false;

        card.innerHTML = `
            <div class="announcement-icon">
                <i class="fas ${ann.icon}"></i>
            </div>
            <div class="announcement-title">
                <h4>${ann.title}</h4>
                <span class="time">${ann.time}</span>
            </div>
            <p class="announcement-content ${needsSeeMore ? 'truncated' : ''}" id="content-${ann.id}">${ann.content}</p>
            ${needsSeeMore ? `<span class="see-more" onclick="toggleAnnouncement(${ann.id})">See more</span>` : ''}
            <div class="announcement-actions">
                <div class="view-count">
                    <i class="fas fa-eye"></i>
                    <span id="view-count-${ann.id}">${ann.views || 0}</span>
                </div>
                <button class="like-btn ${hasLiked ? 'liked' : ''}" onclick="likeAnnouncement(${ann.id})">
                    <i class="fas fa-heart"></i>
                    <span class="like-count">${ann.likes || 0}</span>
                </button>
            </div>
        `;
        list.appendChild(card);
    });

    if (systemAnns.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: var(--gray); padding: 20px;">No announcements yet</p>';
    }

    updateAllNotifications();

    // Setup live view updater if not already running
    if (!window.viewUpdaterInterval) {
        window.viewUpdaterInterval = setInterval(() => {
            announcements.forEach(ann => {
                if (Math.random() > 0.5) { // Random chance to increase views
                    ann.views = (ann.views || 0) + Math.floor(Math.random() * 3) + 1;
                    const viewEl = document.getElementById(`view-count-${ann.id}`);
                    if (viewEl) {
                        viewEl.textContent = ann.views;
                        // Add a subtle flash effect
                        viewEl.style.color = 'var(--primary)';
                        setTimeout(() => viewEl.style.color = '', 500);
                    }
                }
            });
        }, 5000); // Check every 5 seconds
    }
}

function toggleAnnouncement(id) {
    const content = document.getElementById(`content-${id}`);
    const card = content.closest('.announcement-card');
    const seeMoreBtn = card.querySelector('.see-more');

    if (content.classList.contains('truncated')) {
        content.classList.remove('truncated');
        if (seeMoreBtn) seeMoreBtn.textContent = 'See less';
    } else {
        content.classList.add('truncated');
        if (seeMoreBtn) seeMoreBtn.textContent = 'See more';
    }
}

function likeAnnouncement(id) {
    const ann = announcements.find(a => a.id === id);
    if (ann) {
        const userLikes = JSON.parse(localStorage.getItem('userLikes') || '{}');

        if (userLikes[id]) {
            ann.likes = Math.max(0, (ann.likes || 1) - 1);
            delete userLikes[id];
            showToast('Like removed', 'info');
        } else {
            ann.likes = (ann.likes || 0) + 1;
            userLikes[id] = true;
            showToast('Liked!', 'success');
        }

        localStorage.setItem('userLikes', JSON.stringify(userLikes));
        saveAnnouncementsToStorage();
        loadAnnouncements();
    }
}

function loadAccountNotifications() {
    const list = document.getElementById('announcements-list');
    list.innerHTML = '';

    let unreadCount = 0;

    accountNotifications.forEach((ann, index) => {
        if (ann.unread) unreadCount++;

        const card = document.createElement('div');
        card.className = `announcement-card ${ann.unread ? 'unread' : ''}`;

        const contentLength = ann.content.length;
        const needsSeeMore = contentLength > 80;

        card.innerHTML = `
            <div class="announcement-icon account">
                <i class="fas ${ann.icon}"></i>
            </div>
            <div class="announcement-title">
                <h4>${ann.title}</h4>
                <span class="time">${ann.time}</span>
            </div>
            <p class="announcement-content ${needsSeeMore ? 'truncated' : ''}" id="account-content-${index}">${ann.content}</p>
            ${needsSeeMore ? `<span class="see-more" onclick="toggleAccountContent(${index})">See more</span>` : ''}
        `;
        list.appendChild(card);
    });

    if (accountNotifications.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: var(--gray); padding: 20px;">No account notifications</p>';
    }

    updateAllNotifications();
}

function toggleAccountContent(index) {
    const content = document.getElementById(`account-content-${index}`);
    const card = content.closest('.announcement-card');
    const seeMoreBtn = card.querySelector('.see-more');

    if (content.classList.contains('truncated')) {
        content.classList.remove('truncated');
        if (seeMoreBtn) seeMoreBtn.textContent = 'See less';
    } else {
        content.classList.add('truncated');
        if (seeMoreBtn) seeMoreBtn.textContent = 'See more';
    }
}

function markAnnouncementsAsRead() {
    announcements.forEach(ann => {
        ann.unread = false;
    });
    loadAnnouncements();
    updateAllNotifications();
}

function markAllAccountNotificationsRead() {
    accountNotifications.forEach(notif => {
        notif.unread = false;
    });
    loadAccountNotifications();
    updateAllNotifications();
}

function showNotifTab(e, tab) {
    activeNotifTab = tab;
    document.querySelectorAll('.notif-tab').forEach(t => t.classList.remove('active'));

    if (e && e.target) {
        e.target.classList.add('active');
    } else {
        // Find by attribute/text if no event
        document.querySelectorAll('.notif-tab').forEach(t => {
            if (t.innerText.toLowerCase().includes(tab === 'account' ? 'account' : 'news')) {
                t.classList.add('active');
            }
        });
    }

    // Mark items as read when viewing tab
    markTabAsRead(tab);

    if (tab === 'account') {
        loadAccountNotifications();
    } else {
        loadAnnouncements();
    }
}

function openAnnouncements(tab = 'account') {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('dashboard').classList.add('active');
    showDashboardScreen('announcements');
    showNotifTab(null, tab);
}

function showAnnouncementMenu() {
    document.getElementById('announcement-menu-overlay').classList.add('active');
}

function closeAnnouncementMenu() {
    document.getElementById('announcement-menu-overlay').classList.remove('active');
}

function showReferralGuide() {
    document.getElementById('referral-guide-overlay').classList.add('active');
}

function closeReferralGuide() {
    document.getElementById('referral-guide-overlay').classList.remove('active');
}

function markAllRead() {
    closeAnnouncementMenu();
    if (activeNotifTab === 'account') {
        accountNotifications.forEach(n => n.unread = false);
        showToast('Account notifications marked as read', 'success');
        loadAccountNotifications();
    } else {
        announcements.forEach(a => a.unread = false);
        saveAnnouncementsToStorage();
        showToast('News marked as read', 'success');
        loadAnnouncements();
    }
    updateAllNotifications();
}

function clearAllAnnouncements() {
    closeAnnouncementMenu();
    if (activeNotifTab === 'account') {
        accountNotifications = [];
        showToast('Account notifications cleared', 'success');
        loadAccountNotifications();
    } else {
        // You cannot clear system announcements, they are from the server
        showToast('System news cannot be cleared', 'info');
    }
    updateAllNotifications();
}

// Profile Functions
async function loadProfileData() {
    if (!currentUserData) return;

    document.getElementById('profile-name').textContent = currentUserData.fullname || 'User';
    document.getElementById('profile-username').textContent = '@' + (currentUserData.username || 'user');
    document.getElementById('profile-balance').textContent = currentUserData.balance || 0;
    document.getElementById('profile-pkr').textContent = ((currentUserData.balance || 0) * 0.01).toFixed(2);

    loadTransactionHistory();
}

// Edit Profile
document.getElementById('edit-profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();

    const fullname = document.getElementById('edit-fullname').value;
    const phone = document.getElementById('edit-phone').value;

    try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
            fullname,
            phone
        });

        currentUserData.fullname = fullname;
        currentUserData.phone = phone;

        updateUserUI();
        hideLoading();
        showToast('Profile updated successfully!', 'success');
        showScreen('dashboard');
        showDashboardScreen('profile');

    } catch (error) {
        hideLoading();
        showToast('Error updating profile', 'error');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const profileUpload = document.getElementById('profile-upload');
    if (profileUpload) {
        profileUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function (event) {
                const img = new Image();
                img.onload = function () {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');

                    const MAX_WIDTH = 200;
                    const MAX_HEIGHT = 200;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);

                    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

                    if (currentUserData && currentUserData.id) {
                        localStorage.setItem('profilePic_' + currentUserData.id, dataUrl);
                        document.getElementById('edit-profile-pic').src = dataUrl;
                        document.getElementById('profile-pic').src = dataUrl;
                        showToast('Profile photo updated from gallery!', 'success');
                    }
                }
                img.src = event.target.result;
            }
            reader.readAsDataURL(file);
        });
    }
});

function changeProfilePhoto() {
    // Deprecated. Triggered via HTML click event.
}

// Payment Methods
function selectPaymentMethod(method) {
    document.querySelectorAll('.wallet-card').forEach(card => {
        card.classList.remove('selected');
        if (card.dataset.method === method) {
            card.classList.add('selected');
        }
    });

    savePaymentMethod(method);
}

async function savePaymentMethod(method) {
    if (!currentUser || !currentUser.uid) return;

    // Save to localStorage instead of Firestore
    localStorage.setItem('paymentMethod_' + currentUser.uid, method);
    currentUserData.paymentMethod = method;

    showToast(`${method.charAt(0).toUpperCase() + method.slice(1)} set as default!`, 'success');
}

// Withdrawal
function selectWithdrawalMethod(method) {
    document.querySelectorAll('.payment-option').forEach(btn => {
        btn.classList.remove('selected');
        if (btn.dataset.method === method) {
            btn.classList.add('selected');
        }
    });
}

document.getElementById('withdrawal-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();

    const accountName = document.getElementById('withdraw-account-name').value;
    const accountNumber = document.getElementById('withdraw-account-number').value;
    const location = document.getElementById('withdraw-location').value;
    const amountRs = parseFloat(document.getElementById('withdraw-amount').value);
    const amountHZN = Math.round(amountRs * 100);

    if (!currentUserData.paymentMethod) {
        hideLoading();
        showToast('Please select a payment method first', 'error');
        return;
    }

    if (amountRs < 1) {
        hideLoading();
        showToast('Minimum withdrawal is Rs 1', 'error');
        return;
    }

    if (amountHZN > currentUserData.balance) {
        hideLoading();
        showToast('Insufficient balance', 'error');
        return;
    }

    try {
        // Create withdrawal request
        const withdrawalData = {
            userId: currentUser.uid,
            accountName,
            accountNumber,
            location,
            amount: amountHZN,
            amountRs: amountRs,
            paymentMethod: currentUserData.paymentMethod,
            status: 'pending',
            createdAt: serverTimestamp()
        };

        await setDoc(doc(collection(db, 'withdrawals')), withdrawalData);

        // Deduct balance
        await updateDoc(doc(db, 'users', currentUser.uid), {
            balance: currentUserData.balance - amountHZN
        });

        currentUserData.balance -= amountHZN;

        updateUserUI();
        loadTransactionHistory(); // Refresh history immediately
        hideLoading();
        showToast('Withdrawal request submitted!', 'success');
        addAccountNotification('fa-wallet', 'Withdrawal Request', `Your withdrawal request of Rs ${amountRs} (${amountHZN} HZN) has been submitted!`);

        // Reset form
        document.getElementById('withdrawal-form').reset();
        document.getElementById('withdraw-calculation').style.display = 'none';

    } catch (error) {
        hideLoading();
        showToast('Error submitting withdrawal', 'error');
    }
});

function fetchLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            document.getElementById('withdraw-location').value = 'Pakistan';
            showToast('Location fetched!', 'success');
        }, () => {
            showToast('Could not fetch location', 'error');
        });
    } else {
        showToast('Geolocation not supported', 'error');
    }
}

// Transaction History
async function loadTransactionHistory() {
    const list = document.getElementById('transactions-list');
    list.innerHTML = '';

    try {
        const withdrawalsRef = collection(db, 'withdrawals');
        // Removing orderby to avoid composite index requirement, sorting in JS instead
        const q = query(withdrawalsRef, where('userId', '==', currentUser.uid), limit(50));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            list.innerHTML = '<p style="text-align: center; color: var(--gray); padding: 20px;">No transactions yet</p>';
            return;
        }

        const txs = [];
        snapshot.forEach(doc => {
            txs.push({ id: doc.id, ...doc.data() });
        });

        // Sort in JS instead of Firebase to avoid index errors
        txs.sort((a, b) => {
            const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : (a.createdAt || 0);
            const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : (b.createdAt || 0);
            return dateB - dateA;
        });

        txs.forEach(data => {
            const date = data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toLocaleDateString() : new Date(data.createdAt).toLocaleDateString()) : 'Pending...';
            const displayAmount = data.amountRs ? `Rs ${data.amountRs}` : `${data.amount} HZN`;

            const card = document.createElement('div');
            card.className = 'transaction-card';
            card.innerHTML = `
                <div class="transaction-icon withdraw">
                    <i class="fas fa-arrow-up"></i>
                </div>
                <div class="transaction-details">
                    <h4>Withdrawal (${data.paymentMethod})</h4>
                    <span class="date">${date}</span>
                </div>
                <div class="transaction-amount">
                    <span class="amount">-${displayAmount}</span>
                    <br>
                    <span class="status ${data.status}">${data.status}</span>
                </div>
            `;
            list.appendChild(card);
        });

    } catch (error) {
        console.error("History error:", error);
        list.innerHTML = '<p style="text-align: center; color: var(--gray); padding: 20px;">No transactions yet</p>';
    }
}

// Security
document.getElementById('change-password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoading();

    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-new-password').value;

    if (!currentPassword) {
        hideLoading();
        showToast('Please enter current password', 'error');
        return;
    }

    if (newPassword !== confirmPassword) {
        hideLoading();
        showToast('Passwords do not match', 'error');
        return;
    }

    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
        hideLoading();
        showToast('Password must be at least 8 chars with 1 uppercase and 1 number', 'error');
        return;
    }

    try {
        const user = auth.currentUser;
        if (user && currentUserData) {
            try {
                const credential = EmailAuthProvider.credential(currentUserData.email, currentPassword);
                await reauthenticateWithCredential(user, credential);
                await updatePassword(user, newPassword);

                hideLoading();
                showToast('Password changed successfully!', 'success');
                document.getElementById('change-password-form').reset();
                showScreen('dashboard');
                showDashboardScreen('profile');
            } catch (authError) {
                hideLoading();
                console.error('Auth error:', authError);
                if (authError.code === 'auth/wrong-password') {
                    showToast('Current password is incorrect', 'error');
                } else if (authError.code === 'auth/requires-recent-login') {
                    showToast('Session expired. Please logout and login again to change password.', 'error');
                } else {
                    showToast('Error: ' + authError.message, 'error');
                }
                return;
            }
        }

    } catch (error) {
        hideLoading();
        console.error('Password change error:', error);
        showToast('Error changing password. Please try again.', 'error');
    }
});

// Help & Support
function toggleFaq(element) {
    const faqItem = element.parentElement;
    faqItem.classList.toggle('active');
}

// Logout
async function logout() {
    showLoading();
    try {
        await signOut(auth);

        // Reset ALL application state
        resetAppState();

        hideLoading();
        showToast('Logged out successfully!', 'success');

        // Reset navigation state
        showDashboardScreen('home');
        showScreen('landing');

    } catch (error) {
        hideLoading();
        showToast('Error logging out', 'error');
    }
}

// Utility Functions
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const icon = input.nextElementSibling.querySelector('i');

    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function showLoading() {
    document.getElementById('loading-overlay').classList.add('active');
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.remove('active');
}

function getErrorMessage(code) {
    const messages = {
        'auth/email-already-in-use': 'Email already registered',
        'auth/invalid-email': 'Invalid email address',
        'auth/weak-password': 'Password is too weak',
        'auth/user-disabled': 'User account has been disabled',
        'auth/user-not-found': 'User not found',
        'auth/wrong-password': 'Incorrect password',
        'auth/invalid-credential': 'Invalid credentials'
    };
    return messages[code] || 'An error occurred';
}

// End of global assignments

// Open Signup from Landing
function openSignup() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('landing').classList.remove('active');
    document.getElementById('signup').classList.add('active');
}

// Open Login from Landing
function openLogin() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('landing').classList.remove('active');
    document.getElementById('login').classList.add('active');
}

// Open Tasks without login
function openTasks() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('dashboard').classList.add('active');
    showDashboardScreen('tasks');
}




// Go back to Landing (only on logout)
function goToLanding() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('landing').classList.add('active');
}

// Go to Invite section from Profile
function goToInvite() {
    document.getElementById('landing').classList.remove('active');
    document.getElementById('signup').classList.remove('active');
    document.getElementById('login').classList.remove('active');
    document.getElementById('dashboard').classList.add('active');
    showDashboardScreen('invite');
}

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registered:', registration.scope);
            })
            .catch(error => {
                console.log('ServiceWorker registration failed:', error);
            });
    });
}
