const socket = io({
    auth: {
        token: localStorage.getItem('token')
    }
});

const authView = document.getElementById('auth-view');
const homeView = document.getElementById('home-view');
const chatView = document.getElementById('chat-view');
const aiChatView = document.getElementById('ai-chat-view');
const topicBubblesContainer = document.getElementById('topic-bubbles');
const findMatchButton = document.getElementById('find-match');
const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendMessageButton = document.getElementById('send-message');
const homeLink = document.getElementById('home-link');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const logoutButton = document.getElementById('logout-button');
const aiMessageInput = document.getElementById('ai-message-input');
const aiSendMessageButton = document.getElementById('ai-send-message');
const progressBar = document.getElementById('progress-bar');

let currentRoom = null;
let currentTopic = null;

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

findMatchButton.addEventListener('click', () => {
    if (!currentTopic) {
        alert('Please select a topic. How else will you know what to be irrationally angry about?');
        return;
    }
    socket.emit('find match', currentTopic);
    homeView.classList.add('hidden');
    chatView.classList.remove('hidden');
    addChatMessage('system', `Searching for someone who's wrong about ${currentTopic}... This shouldn't take long.`);
});

function sendMessage() {
    let message = messageInput.value.trim();
    if (message && currentRoom) {
        socket.emit('send message', { room: currentRoom, message: message });
        addChatMessage('you', message);
        messageInput.value = '';
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

homeLink.addEventListener('click', () => {
    if (isAuthenticated()) {
        homeView.classList.remove('hidden');
        chatView.classList.add('hidden');
        aiChatView.classList.add('hidden');
    } else {
        authView.classList.remove('hidden');
        homeView.classList.add('hidden');
        chatView.classList.add('hidden');
        aiChatView.classList.add('hidden');
    }
});

async function sendAiMessage() {
    const message = aiMessageInput.value.trim();
    if (message) {
        addAiChatMessage('you', message);
        aiMessageInput.value = '';

        try {
            const response = await fetchWithAuth('/ai-chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message }),
            });
            const data = await response.json();
            if (data.error) {
                throw new Error(data.details || data.error);
            }
            if (data.response) {
                addAiChatMessage('ai', data.response);
                updateProgressBar(data.progress);
                if (data.chatComplete) {
                    setTimeout(() => {
                        aiChatView.classList.add('hidden');
                        homeView.classList.remove('hidden');
                        alert('Value system assessment complete. Welcome to DisagreeWithMe!');
                    }, 2000);
                }
            } else {
                throw new Error('Received empty response from server');
            }
        } catch (error) {
            handleError(error, 'AI chat');
        }
    }
}

function addAiChatMessage(sender, message) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', sender);

    const senderElement = document.createElement('span');
    senderElement.classList.add('sender', sender);

    if (sender === 'you') {
        senderElement.textContent = 'You:';
    } else if (sender === 'ai') {
        senderElement.textContent = 'AI:';
    } else {
        senderElement.textContent = 'System:';
    }

    messageElement.appendChild(senderElement);
    messageElement.appendChild(document.createTextNode(' ' + message));

    const aiChatMessages = document.getElementById('ai-chat-messages');
    aiChatMessages.appendChild(messageElement);
    aiChatMessages.scrollTop = aiChatMessages.scrollHeight;
}

aiSendMessageButton.addEventListener('click', sendAiMessage);
aiMessageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendAiMessage();
    }
});

function updateProgressBar(progress) {
    progressBar.style.width = `${progress}%`;
    progressBar.textContent = `${progress}%`;
}

async function signup(username, email, password) {
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, email, password }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Registration failed');
        }

        const data = await response.json();
        alert(data.message || 'Registration successful. Starting value system assessment...');
        
        // Automatically log in the user after successful registration
        await login(email, password);
    } catch (error) {
        handleError(error, 'signup');
    }
}

async function login(email, password) {
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Login failed');
        }

        const data = await response.json();

        localStorage.setItem('token', data.token);
        localStorage.setItem('userId', data.userId);
        localStorage.setItem('username', data.username);
        
        if (data.isNewUser) {
            startValueSystemAssessment();
        } else {
            updateUIAuthentication();
        }
    } catch (error) {
        handleError(error, 'login');
    }
}

function startValueSystemAssessment() {
    authView.classList.add('hidden');
    aiChatView.classList.remove('hidden');
    addAiChatMessage('ai', "Welcome! I'm here to understand your value system. Let's start with a simple question: What's the most important issue facing the world today?");
}

function updateUIAuthentication() {
    if (isAuthenticated()) {
        authView.classList.add('hidden');
        homeView.classList.remove('hidden');
        chatView.classList.add('hidden');
        aiChatView.classList.add('hidden');
        logoutButton.classList.remove('hidden');
        fetchLatestNews();
    } else {
        authView.classList.remove('hidden');
        homeView.classList.add('hidden');
        chatView.classList.add('hidden');
        aiChatView.classList.add('hidden');
        logoutButton.classList.add('hidden');
    }
}

async function fetchLatestNews() {
    try {
        const response = await fetchWithAuth('/api/news');
        const news = await response.json();
        displayNews(news);
    } catch (error) {
        console.error('Error fetching news:', error);
    }
}

function displayNews(news) {
    const newsContainer = document.getElementById('news-container');
    newsContainer.innerHTML = '';
    news.forEach(article => {
        const articleElement = document.createElement('div');
        articleElement.classList.add('news-article');
        articleElement.innerHTML = `
            <h3>${article.title}</h3>
            <p>${article.description}</p>
            <a href="${article.url}" target="_blank">Read more</a>
        `;
        newsContainer.appendChild(articleElement);
    });
}

signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = signupForm.querySelector('input[type="text"]').value;
    const email = signupForm.querySelector('input[type="email"]').value;
    const password = signupForm.querySelector('input[type="password"]').value;
    await signup(username, email, password);
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = loginForm.querySelector('input[type="email"]').value;
    const password = loginForm.querySelector('input[type="password"]').value;
    await login(email, password);
});

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    updateUIAuthentication();
    socket.disconnect();
}

logoutButton.addEventListener('click', logout);

function isAuthenticated() {
    return localStorage.getItem('token') !== null;
}

function getToken() {
    return localStorage.getItem('token');
}

async function fetchWithAuth(url, options = {}) {
    const token = getToken();
    if (token) {
        options.headers = {
            ...options.headers,
            'x-auth-token': token
        };
    }

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            if (response.status === 401) {
                // Token might be expired, try to refresh
                await refreshToken();
                // Retry the request with the new token
                return fetchWithAuth(url, options);
            }
            throw new Error('Network response was not ok');
        }
        return response;
    } catch (error) {
        handleError(error, 'server communication');
        throw error;
    }
}

function handleError(error, context) {
    console.error(`Error in ${context}:`, error);
    alert(`An error occurred during ${context}: ${error.message}`);
}

async function refreshToken() {
    try {
        const response = await fetch('/api/refresh-token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-auth-token': getToken()
            }
        });

        if (!response.ok) {
            throw new Error('Failed to refresh token');
        }

        const data = await response.json();
        localStorage.setItem('token', data.token);
    } catch (error) {
        console.error('Error refreshing token:', error);
        logout();
    }
}

setInterval(refreshToken, 50 * 60 * 1000);

document.addEventListener('DOMContentLoaded', () => {
    updateUIAuthentication();
    createTopics();
    if (isAuthenticated()) {
        fetchLatestNews();
    }
});

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
});

socket.on('new message', (message) => {
    addChatMessage('disagreer', message);
});

socket.on('user reported', () => {
    addChatMessage('system', "Your chat partner has been sent to argue with a wall. You win by default!");
    currentRoom = null;
});