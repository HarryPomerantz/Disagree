require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const OpenAI = require('openai');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const authMiddleware = require('./middleware/authMiddleware');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(helmet());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use(limiter);

let openai;
try {
    openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });
    console.log('OpenAI client initialized successfully');
} catch (error) {
    console.error('Error initializing OpenAI client:', error);
}

const publicPath = path.join(__dirname, 'public');
app.use(express.static(publicPath));
app.use(express.json());

let waitingUsers = {};

async function connectToDatabase() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        process.exit(1);
    }
}

app.post('/api/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        if (password.length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters long' });
        }

        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ message: 'Username or email already exists' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const user = new User({
            username,
            email,
            password: hashedPassword,
            isNewUser: true
        });

        await user.save();

        res.status(201).json({ message: 'User registered successfully. Please log in to start your value system assessment.' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.json({ 
            token, 
            userId: user._id, 
            username: user.username,
            isNewUser: user.isNewUser
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

app.post('/ai-chat', authMiddleware, async (req, res) => {
    const { message } = req.body;
    try {
        if (!openai) {
            throw new Error('OpenAI client not initialized');
        }
        const userId = req.user;
        const user = await User.findById(userId);
        
        const aiResponse = await generateAIResponse(message, user);
        
        // Update user's chat progress
        user.chatProgress += 1;
        if (user.chatProgress >= 5) {
            user.isNewUser = false;
        }
        await user.save();

        res.json({ 
            response: aiResponse, 
            progress: Math.min(user.chatProgress * 20, 100),
            chatComplete: user.chatProgress >= 5
        });
    } catch (error) {
        console.error("Error in AI chat:", error);
        res.status(500).json({ 
            error: "An error occurred while processing your request.",
            details: error.message
        });
    }
});

async function generateAIResponse(message, user) {
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {"role": "system", "content": "You are an AI designed to assess a user's value system through natural conversation. Ask probing questions about their beliefs and opinions on various topics. Be engaging and avoid repetition. This is message " + (user.chatProgress + 1) + " of the conversation."},
                {"role": "user", "content": message}
            ],
            max_tokens: 150
        });

        return completion.choices[0].message.content;
    } catch (error) {
        console.error("Error generating AI response:", error);
        throw error;
    }
}

app.get('/api/news', authMiddleware, async (req, res) => {
    try {
        const response = await axios.get(`https://newsapi.org/v2/top-headlines?country=us&apiKey=${process.env.NEWS_API_KEY}`);
        res.json(response.data.articles.slice(0, 5));
    } catch (error) {
        console.error('Error fetching news:', error);
        res.status(500).json({ message: 'Error fetching news' });
    }
});

io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Authentication error'));
    }
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return next(new Error('Authentication error'));
        socket.userId = decoded.userId;
        next();
    });
});

io.on('connection', (socket) => {
    console.log('New user connected:', socket.userId);

    socket.on('find match', (topic) => {
        console.log(`User ${socket.userId} looking for match on topic: ${topic}`);
        if (waitingUsers[topic]) {
            const partnerSocket = waitingUsers[topic];
            const room = `room_${Date.now()}`;

            socket.join(room);
            partnerSocket.join(room);

            io.to(room).emit('match found', { room, topic });
            console.log(`Match found for topic: ${topic}`);

            delete waitingUsers[topic];
        } else {
            waitingUsers[topic] = socket;
            console.log(`User ${socket.userId} waiting for match on topic: ${topic}`);
        }
    });

    socket.on('send message', (data) => {
        console.log(`Message sent in room: ${data.room}`);
        socket.to(data.room).emit('new message', data.message);
    });

    socket.on('disconnect', () => {
        for (let topic in waitingUsers) {
            if (waitingUsers[topic] === socket) {
                delete waitingUsers[topic];
                console.log(`Waiting user ${socket.userId} removed from topic: ${topic}`);
                break;
            }
        }
        console.log('User disconnected:', socket.userId);
    });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

async function startServer() {
    await connectToDatabase();

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

startServer();