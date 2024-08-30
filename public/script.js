const socket = io({
    auth: {
        token: localStorage.getItem('token')
    }
});

// DOM Elements
const authView = document.getElementById('auth-view');
const valueIdentificationView = document.getElementById('value-identification-view');
const homeView = document.getElementById('home-view');
const chatView = document.getElementById('chat-view');
const topicBubblesContainer = document.getElementById('topic-bubbles');
const findMatchButton = document.getElementById('find-match');
const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendMessageButton = document.getElementById('send-message');
const echoChamberWarning = document.getElementById('echo-chamber-warning');
const abortAgreementButton = document.getElementById('abort-agreement');
const homeLink = document.getElementById('home-link');
const newsFeed = document.getElementById('news-feed');
const reportButton = document.getElementById('report-btn');
const factCheckerButton = document.getElementById('fact-checker-btn');
const openingStatementPopup = document.getElementById('opening-statement-popup');
const openingStatementTextarea = document.getElementById('opening-statement');
const startChatButton = document.getElementById('start-chat');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const logoutButton = document.getElementById('logout-button');
const retakeAssessmentButton = document.getElementById('retake-assessment');

let currentRoom = null;
let currentTopic = null;
let valueIdentificationMessages = [];

const topics = [
    'Donald Trump', 'Democrats', 'Republicans', 'Flat-Earth', 'Abortion', 'Religion',
    'America', 'China', 'Russia', 'Israel/Palestine', 'Covid-19', 'Climate Change',
    'Gun Control', 'Free Speech', 'Immigration', 'Taxes', 'Capitalism vs. Socialism',
    'Death Penalty', 'Same-Sex Marriage', 'Animal Rights', 'Welfare', 'Artificial Intelligence',
    'Big Tech', 'Other'
];

function createTopics() {
    topics.forEach(topic => {
        const bubble = document.createElement('div');
        bubble.className = 'topic-bubble';
        bubble.textContent = topic;
        bubble.addEventListener('click', () => selectTopic(topic, bubble));
        topicBubblesContainer.appendChild(bubble);
    });
}

function selectTopic(topic, bubbleElement) {
    document.querySelectorAll('.topic-bubble').forEach(bubble => {
        bubble.classList.remove('selected');
    });
    bubbleElement.classList.add('selected');
    currentTopic = topic;
    findMatchButton.disabled = false;
}

function startValueIdentification() {
    authView.classList.add('hidden');
    valueIdentificationView.classList.remove('hidden');
    homeView.classList.add('hidden');
    document.getElementById('ai-message').textContent = "Hello! I'm here to help identify your core values. Let's start with a simple question: What's most important to you in life?";
}

document.getElementById('value-identification-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const userMessage = document.getElementById('value-answer').value;
    document.getElementById('value-answer').value = '';
    
    valueIdentificationMessages.push({ role: "user", content: userMessage });
    
    try {
        const response = await fetch('/api/value-identification', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': localStorage.getItem('token')
            },
            body: JSON.stringify({ 
                message: userMessage, 
                isComplete: valueIdentificationMessages.length >= 10 
            })
        });
        const data = await response.json();
        
        if (data.completed) {
            completeValueIdentification(data.values);
        } else {
            document.getElementById('ai-message').textContent = data.message;
            valueIdentificationMessages.push({ role: "assistant", content: data.message });
        }
    } catch (error) {
        console.error('Error in value identification:', error);
        alert('An error occurred. Please try again.');
    }
});

function completeValueIdentification(values) {
    valueIdentificationView.classList.add('hidden');
    homeView.classList.remove('hidden');
    updateDashboard(values);
}

function updateDashboard(values) {
    const activitySummary = document.getElementById('activity-summary');
    activitySummary.innerHTML = `
        <h3>Your Identified Values:</h3>
        <p>${values}</p>
    `;
    retakeAssessmentButton.classList.remove('hidden');
}

function sendMessage() {
    let message = messageInput.value.trim();
    if (message && currentRoom) {
        socket.emit('send message', { room: currentRoom, message: message });
        addChatMessage('you', message);
        messageInput.value = '';
        checkForAgreement(message);
    }
}

sendMessageButton.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

function addChatMessage(sender, message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message');

    const senderElement = document.createElement('span');
    senderElement.classList.add('sender', sender);

    if (sender === 'you') {
        senderElement.textContent = 'You (genius):';
    } else if (sender === 'disagreer') {
        senderElement.textContent = 'Bozo:';
    } else {
        senderElement.textContent = 'System:';
    }

    messageElement.appendChild(senderElement);
    messageElement.appendChild(document.createTextNode(' ' + message));

    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function checkForAgreement(message) {
    if (message.toLowerCase().includes('i agree')) {
        echoChamberWarning.classList.remove('hidden');
    }
}

homeLink.addEventListener('click', () => {
    if (isAuthenticated()) {
        homeView.classList.remove('hidden');
        chatView.classList.add('hidden');
        valueIdentificationView.classList.add('hidden');
    } else {
        authView.classList.remove('hidden');
        homeView.classList.add('hidden');
        chatView.classList.add('hidden');
        valueIdentificationView.classList.add('hidden');
    }
});

findMatchButton.addEventListener('click', () => {
    if (!currentTopic) {
        alert('Please select a topic. How else will you know what to be irrationally angry about?');
        return;
    }
    openingStatementPopup.classList.remove('hidden');
});

startChatButton.addEventListener('click', () => {
    const openingStatement = openingStatementTextarea.value.trim();
    if (openingStatement) {
        socket.emit('find match', currentTopic);
        openingStatementPopup.classList.add('hidden');
        homeView.classList.add('hidden');
        chatView.classList.remove('hidden');
        addChatMessage('system', `Searching for someone who's wrong about ${currentTopic}... This shouldn't take long.`);
    } else {
        alert('Please write an opening statement before starting the chat.');
    }
});

reportButton.addEventListener('click', () => {
    socket.emit('report user', { room: currentRoom });
    alert("The other person has been sent to argue with a wall.");
});

factCheckerButton.addEventListener('click', async () => {
    const selectedMessage = prompt("Please paste the message you want to fact-check:");
    if (selectedMessage) {
        try {
            const response = await fetch('/fact-check', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-auth-token': getToken()
                },
                body: JSON.stringify({ message: selectedMessage }),
            });
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data = await response.json();
            if (data.error) {
                throw new Error(data.details || data.error);
            }
            alert(`Fact Check Result:\n${data.result}`);
        } catch (error) {
            console.error('Error:', error);
            alert(`Error during fact-checking: ${error.message}`);
        }
    }
});

async function fetchNews() {
    try {
        const response = await fetch('/api/news', {
            headers: {
                'x-auth-token': getToken()
            }
        });
        const articles = await response.json();
        displayNews(articles);
    } catch (error) {
        console.error('Error fetching news:', error);
        newsFeed.innerHTML = '<p>Error loading news. Please try again later.</p>';
    }
}

function displayNews(articles) {
    newsFeed.innerHTML = '';
    articles.forEach(article => {
        const articleElement = document.createElement('div');
        articleElement.classList.add('news-card');
        articleElement.innerHTML = `
            <img src="${article.urlToImage || '/placeholder-image.jpg'}" alt="${article.title}">
            <h3>${article.title}</h3>
            <p>${article.description}</p>
        `;
        articleElement.addEventListener('click', () => window.open(article.url, '_blank'));
        newsFeed.appendChild(articleElement);
    });
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginForm.querySelector('input[type="email"]').value;
    const password = loginForm.querySelector('input[type="password"]').value;

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
            throw new Error('Login failed');
        }

        const data = await response.json();

        localStorage.setItem('token', data.token);
        localStorage.setItem('userId', data.userId);
        localStorage.setItem('username', data.username);

        if (data.valueIdentificationCompleted) {
            showHomeView();
        } else {
            startValueIdentification();
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed. Please check your credentials and try again.');
    }
});

signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = signupForm.querySelector('input[name="name"]').value;
    const email = signupForm.querySelector('input[type="email"]').value;
    const password = signupForm.querySelector('input[type="password"]').value;

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, email, password }),
        });

        if (!response.ok) {
            throw new Error('Registration failed');
        }

        const data = await response.json();

        localStorage.setItem('token', data.token);
        localStorage.setItem('userId', data.userId);
        localStorage.setItem('username', data.username);

        startValueIdentification();
    } catch (error) {
        console.error('Signup error:', error);
        alert('Registration failed. Please try again.');
    }
});

function showHomeView() {
    authView.classList.add('hidden');
    valueIdentificationView.classList.add('hidden');
    homeView.classList.remove('hidden');
    fetchUserData();
}

async function fetchUserData() {
    try {
        const response = await fetch('/api/user', {
            headers: {
                'x-auth-token': localStorage.getItem('token')
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch user data');
        }

        const userData = await response.json();
        updateDashboard(userData.identifiedValues);
    } catch (error) {
        console.error('Error fetching user data:', error);
        alert('Failed to load user data. Please try logging in again.');
        logout();
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    authView.classList.remove('hidden');
    homeView.classList.add('hidden');
    chatView.classList.add('hidden');
    valueIdentificationView.classList.add('hidden');
}

logoutButton.addEventListener('click', logout);

function isAuthenticated() {
    return localStorage.getItem('token') !== null;
}

function getToken() {
    return localStorage.getItem('token');
}

// Initialize the application
async function initApp() {
    if (isAuthenticated()) {
        try {
            const response = await fetch('/api/user', {
                headers: {
                    'x-auth-token': localStorage.getItem('token')
                }
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch user data');
            }

            const user = await response.json();
            if (user.valueIdentificationCompleted) {
                showHomeView();
            } else {
                startValueIdentification();
            }
        } catch (error) {
            console.error('Error initializing app:', error);
            logout();
        }
    } else {
        authView.classList.remove('hidden');
    }
    createTopics();
    fetchNews();
}

// Socket event handlers
socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    if (error.message === 'Authentication error') {
        logout();
        alert('Your session has expired. Please log in again.');
    }
});

socket.on('match found', (data) => {
    currentRoom = data.room;
    addChatMessage('system', `Match found! Prepare to enlighten your opponent about ${data.topic}. Remember, the louder you type, the more correct you are!`);

    // Send the opening statement
    const openingStatement = openingStatementTextarea.value.trim();
    if (openingStatement) {
        socket.emit('send message', { room: currentRoom, message: openingStatement });
        addChatMessage('you', openingStatement);
    }
});

socket.on('new message', (message) => {
    addChatMessage('disagreer', message);
});

socket.on('user reported', () => {
    addChatMessage('system', "Your chat partner has been sent to argue with a wall. You win by default!");
    currentRoom = null;
});

// Call initApp when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initApp);