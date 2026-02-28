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

let currentUser = null;
let currentUserData = null;
let totalUsersCount = 0;
let activeFilter = 'all';
let activeNotifTab = 'account';

const rewards = [10, 20, 30, 40, 50, 60, 100];
const spinRewards = [
    { value: 20, weight: 15 },
    { value: 40, weight: 25 },
    { value: 70, weight: 25 },
    { value: 0, weight: 15 },
    { value: 100, weight: 10 },
    { value: 250, weight: 7 },
    { value: 1000, weight: 2 },
    { value: 0, weight: 1 }
];

let dailyAdsTasks = [];
let lastAdsDate = null;

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
    { id: 1, icon: 'fa-gift', title: 'New Bonus Campaign!', content: 'Earn double on all tasks this weekend. Don\'t miss rewards out on this amazing opportunity to boost your earnings!', time: '2 hours ago', unread: true, likes: 5 },
    { id: 2, icon: 'fa-bullhorn', title: 'System Maintenance', content: 'The app will undergo maintenance on Sunday from 2 AM to 4 AM. Services may be temporarily unavailable.', time: '1 day ago', unread: false, likes: 2 },
    { id: 3, icon: 'fa-star', title: 'Top Earners Winner', content: 'Congratulations to our top earners this month! Special prizes await you. Keep earning!', time: '3 days ago', unread: false, likes: 10 },
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

const accountNotifications = [];

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
    const totalUnread = announcements.filter(a => a.unread).length + accountNotifications.filter(n => n.unread).length;
    document.getElementById('notif-badge').textContent = totalUnread;
    
    const notifBadge = document.getElementById('notif-badge');
    if (totalUnread > 0) {
        notifBadge.style.display = 'flex';
    } else {
        notifBadge.style.display = 'none';
    }
    
    const badge = document.getElementById('announcement-badge');
    if (totalUnread > 0) {
        badge.style.display = 'flex';
        badge.textContent = totalUnread > 9 ? '9+' : totalUnread;
    } else {
        badge.style.display = 'none';
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
        }
    });
});

async function updateTotalUsers() {
    try {
        const snapshot = await getDocs(collection(db, 'users'));
        totalUsersCount = snapshot.size;
        document.getElementById('total-users').textContent = totalUsersCount.toLocaleString();
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
    try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        if (userDoc.exists()) {
            currentUser = auth.currentUser;
            currentUserData = { id: uid, ...userDoc.data() };
            showScreen('dashboard');
            updateUserUI();
        }
    } catch (e) {
        console.error('Error loading user:', e);
    }
}

function showScreen(screenId) {
    window.scrollTo(0, 0);
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function showDashboardScreen(screenId) {
    window.scrollTo(0, 0);
    document.querySelectorAll('.dashboard-screen').forEach(s => s.classList.remove('active'));
    document.getElementById(`${screenId}-screen`).classList.add('active');
    
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`.nav-item[data-screen="${screenId}"]`).classList.add('active');

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
    const hour = new Date().getHours();
    let greeting = 'Good Morning';
    if (hour >= 12 && hour < 17) greeting = 'Good Afternoon';
    else if (hour >= 17) greeting = 'Good Evening';
    document.getElementById('greeting-text').textContent = greeting;
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
            spinsLeft: 3,
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
    
    document.getElementById('user-name').textContent = currentUserData.fullname || 'User';
    document.getElementById('profile-name').textContent = currentUserData.fullname || 'User';
    document.getElementById('profile-username').textContent = '@' + (currentUserData.username || 'user');
    document.getElementById('total-balance').textContent = currentUserData.balance || 0;
    document.getElementById('profile-balance').textContent = currentUserData.balance || 0;
    document.getElementById('earn-rate').textContent = ((currentUserData.balance || 0) * 0.01).toFixed(2);
    document.getElementById('profile-pkr').textContent = ((currentUserData.balance || 0) * 0.01).toFixed(2);
    document.getElementById('my-referral-code').textContent = currentUserData.referralCode || '------';
    
    // Update profile pic
    const randomImg = Math.floor(Math.random() * 10) + 1;
    const profilePic = `https://i.pravatar.cc/150?img=${randomImg}`;
    document.getElementById('profile-pic').src = profilePic;
    document.getElementById('edit-profile-pic').src = profilePic;
    
    // Load profile edit data
    document.getElementById('edit-fullname').value = currentUserData.fullname || '';
    document.getElementById('edit-username').value = currentUserData.username || '';
    document.getElementById('edit-phone').value = currentUserData.phone || '';
    document.getElementById('edit-email').value = currentUserData.email || '';
    
    if (currentUserData.createdAt) {
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
    document.getElementById('checkin-day').textContent = day === 0 ? 1 : day;
    
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
        showToast(`Check-in successful! +${reward} Hzn`, 'success');
        addAccountNotification('fa-calendar-check', 'Daily Check-In', `You earned ${reward} Hzn for daily check-in!`);
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
    document.getElementById('spin-overlay').classList.add('active');
    updateSpinUI();
}

function closeSpin() {
    document.getElementById('spin-overlay').classList.remove('active');
}

async function spinWheel() {
    const spinsLeft = currentUserData.spinsLeft !== undefined ? currentUserData.spinsLeft : 3;
    
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
            resultDiv.textContent = `Congratulations! You won ${reward} Hzn!`;
            resultDiv.classList.add('win', 'show');
            
            addAccountNotification('fa-trophy', 'Spin Win!', `Congratulations! You won ${reward} Hzn on the spin wheel!`);
            
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
                
                updateUserUI();
                hideLoading();
            } catch (error) {
                hideLoading();
            }
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
                
                hideLoading();
            } catch (error) {
                hideLoading();
            }
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
                <span class="task-reward">${task.reward} Hzn</span>
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
    document.getElementById('timer-text').textContent = `${task.duration}s`;
    document.getElementById('timer-progress').style.width = '0%';
    document.getElementById('ad-loader-bar').style.width = '0%';
    
    let elapsed = 0;
    const duration = task.duration;
    
    adTimerInterval = setInterval(() => {
        elapsed++;
        const progress = (elapsed / duration) * 100;
        
        document.getElementById('timer-progress').style.width = `${progress}%`;
        document.getElementById('ad-loader-bar').style.width = `${progress}%`;
        document.getElementById('timer-text').textContent = `${duration - elapsed}s`;
        
        if (elapsed >= duration) {
            clearInterval(adTimerInterval);
            adCompleted = true;
            completeTask();
        }
    }, 1000);
}

function closeAdEarly() {
    if (adTimerInterval) {
        clearInterval(adTimerInterval);
        adTimerInterval = null;
    }
    
    document.getElementById('ad-overlay').classList.remove('active');
    
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
        showToast(`Great! You earned ${currentAdTask.reward} Hzn!`, 'success');
        addAccountNotification('fa-ad', 'Task Completed', `You earned ${currentAdTask.reward} Hzn from watching ad!`);
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
    const text = `Join Yv Earn and earn rewards! Use my referral code: ${code}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

function shareOnFacebook() {
    const code = document.getElementById('my-referral-code').textContent;
    const text = `Join Yv Earn and earn rewards! Use my referral code: ${code}`;
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
    const systemAnns = announcements.map(a => ({...a, type: 'system'}));
    
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
            <div class="announcement-actions">
                <button class="like-btn ${hasLiked ? 'liked' : ''}" onclick="likeAnnouncement(${ann.id})">
                    <i class="fas fa-heart"></i>
                    <span class="like-count">${ann.likes || 0}</span>
                </button>
            </div>
            <p class="announcement-content ${needsSeeMore ? 'truncated' : ''}" id="content-${ann.id}">${ann.content}</p>
            ${needsSeeMore ? `<span class="see-more" onclick="toggleAnnouncement(${ann.id})">See more</span>` : ''}
        `;
        list.appendChild(card);
    });
    
    if (systemAnns.length === 0) {
        list.innerHTML = '<p style="text-align: center; color: var(--gray); padding: 20px;">No announcements yet</p>';
    }
    
    updateAllNotifications();
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

function showNotifTab(tab) {
    activeNotifTab = tab;
    document.querySelectorAll('.notif-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    
    if (tab === 'account') {
        loadAccountNotifications();
    } else {
        loadAnnouncements();
    }
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
    showToast('All announcements marked as read', 'success');
    closeAnnouncementMenu();
    loadAnnouncements();
}

function clearAllAnnouncements() {
    showToast('All announcements cleared', 'success');
    closeAnnouncementMenu();
    document.getElementById('announcements-list').innerHTML = '';
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

function changeProfilePhoto() {
    const randomImg = Math.floor(Math.random() * 10) + 1;
    const profilePic = `https://i.pravatar.cc/150?img=${randomImg}`;
    document.getElementById('edit-profile-pic').src = profilePic;
    document.getElementById('profile-pic').src = profilePic;
    showToast('Profile photo updated!', 'success');
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
    showLoading();
    try {
        await updateDoc(doc(db, 'users', currentUser.uid), {
            paymentMethod: method
        });
        
        currentUserData.paymentMethod = method;
        
        hideLoading();
        showToast(`${method.charAt(0).toUpperCase() + method.slice(1)} set as default!`, 'success');
        
    } catch (error) {
        hideLoading();
        showToast('Error saving payment method', 'error');
    }
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
    const amount = parseInt(document.getElementById('withdraw-amount').value);
    
    if (!currentUserData.paymentMethod) {
        hideLoading();
        showToast('Please select a payment method first', 'error');
        return;
    }
    
    if (amount < 100) {
        hideLoading();
        showToast('Minimum withdrawal is 100 Hzn', 'error');
        return;
    }
    
    if (amount > currentUserData.balance) {
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
            amount,
            paymentMethod: currentUserData.paymentMethod,
            status: 'pending',
            createdAt: serverTimestamp()
        };
        
        await setDoc(doc(collection(db, 'withdrawals')), withdrawalData);
        
        // Deduct balance
        await updateDoc(doc(db, 'users', currentUser.uid), {
            balance: currentUserData.balance - amount
        });
        
        currentUserData.balance -= amount;
        
        updateUserUI();
        hideLoading();
        showToast('Withdrawal request submitted!', 'success');
        addAccountNotification('fa-wallet', 'Withdrawal Request', `Your withdrawal request of ${amount} Hzn has been submitted!`);
        
        // Reset form
        document.getElementById('withdrawal-form').reset();
        
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
        const q = query(withdrawalsRef, where('userId', '==', currentUser.uid), orderBy('createdAt', 'desc'), limit(20));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            list.innerHTML = '<p style="text-align: center; color: var(--gray); padding: 20px;">No transactions yet</p>';
            return;
        }
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const date = data.createdAt ? data.createdAt.toDate().toLocaleDateString() : 'N/A';
            
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
                    <span class="amount">-${data.amount} Hzn</span>
                    <br>
                    <span class="status ${data.status}">${data.status}</span>
                </div>
            `;
            list.appendChild(card);
        });
        
    } catch (error) {
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
        currentUser = null;
        currentUserData = null;
        
        hideLoading();
        showToast('Logged out successfully!', 'success');
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

// Make functions available globally
window.showScreen = showScreen;
window.showDashboardScreen = showDashboardScreen;
window.togglePassword = togglePassword;
window.logout = logout;
window.showCheckIn = showCheckIn;
window.closeCheckIn = closeCheckIn;
window.doCheckIn = doCheckIn;
window.showSpinWheel = showSpinWheel;
window.closeSpin = closeSpin;
window.closeAdEarly = closeAdEarly;
window.spinWheel = spinWheel;
window.showQuiz = showQuiz;
window.closeQuiz = closeQuiz;
window.showVideos = showVideos;
window.closeVideos = closeVideos;
window.setFilter = setFilter;
window.filterTasks = filterTasks;
window.startTask = startTask;
window.copyReferralCode = copyReferralCode;
window.shareOnWhatsApp = shareOnWhatsApp;
window.shareOnFacebook = shareOnFacebook;
window.shareOnTikTok = shareOnTikTok;
window.toggleAnnouncement = toggleAnnouncement;
window.showAnnouncementMenu = showAnnouncementMenu;
window.closeAnnouncementMenu = closeAnnouncementMenu;
window.markAllRead = markAllRead;
window.clearAllAnnouncements = clearAllAnnouncements;
window.showReferralGuide = showReferralGuide;
window.closeReferralGuide = closeReferralGuide;
window.showNotifTab = showNotifTab;
window.likeAnnouncement = likeAnnouncement;
window.toggleAnnouncement = toggleAnnouncement;
window.toggleAccountContent = toggleAccountContent;
window.changeProfilePhoto = changeProfilePhoto;
window.selectPaymentMethod = selectPaymentMethod;
window.selectWithdrawalMethod = selectWithdrawalMethod;
window.fetchLocation = fetchLocation;
window.toggleFaq = toggleFaq;
window.goToInvite = goToInvite;
window.openSignup = openSignup;
window.openLogin = openLogin;
window.goToLanding = goToLanding;
window.openTasks = openTasks;
window.openAnnouncements = openAnnouncements;
window.openInvite = openInvite;

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

// Open Announcements without login
function openAnnouncements() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('dashboard').classList.add('active');
    showDashboardScreen('announcements');
}

// Open Invite without login
function openInvite() {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('dashboard').classList.add('active');
    showDashboardScreen('invite');
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
