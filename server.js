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

// Apply Helmet middleware for security headers
app.use(helmet());

// Rate limiting
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

// User registration
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
            valueIdentificationCompleted: false
        });

        await user.save();
console.log ("User Saved ", user)

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(201).json({ 
            token, 
            userId: user._id, 
            username: user.username, 
            valueIdentificationCompleted: false,
            message: 'User registered successfully. Please complete the value identification process.' 
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Server error during registration' });
    }
});

// User login
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;

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
            valueIdentificationCompleted: user.valueIdentificationCompleted
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Server error during login' });
    }
});

// Protected route to get user data
app.get('/api/user', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ message: 'Server error while fetching user data' });
    }
});

// Value Identification
app.post('/api/value-identification', authMiddleware, async (req, res) => {
    try {
        const { userId } = req;
        const { message, isComplete } = req.body;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { 
                    role: "system", 
                    content: "You are an AI designed to help identify a person's core values through conversation. Ask thought-provoking questions and provide insightful follow-ups. After about 5-7 exchanges, summarize the person's core values."
                },
                { role: "user", content: message }
            ]
        });

        const aiResponse = completion.choices[0].message.content;

        if (isComplete) {
            user.identifiedValues = aiResponse;
            user.valueIdentificationCompleted = true;
            await user.save();
            res.json({ message: 'Value identification completed', values: aiResponse, completed: true });
        } else {
            res.json({ message: aiResponse, completed: false });
        }
    } catch (error) {
        console.error('Error in value identification:', error);
        res.status(500).json({ message: 'Error during value identification process' });
    }
});

// Fetch News Articles
app.get('/api/news', authMiddleware, async (req, res) => {
    try {
        const response = await axios.get(`https://newsapi.org/v2/top-headlines?country=us&apiKey=${process.env.NEWS_API_KEY}`);
        const articles = response.data.articles;
        res.json(articles);
    } catch (error) {
        console.error('Error fetching news:', error);
        res.status(500).json({ message: 'Error fetching news articles' });
    }
});

// Socket.io setup
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
        // Implement match-making logic here
    });

    socket.on('send message', (data) => {
        socket.to(data.room).emit('new message', data.message);
    });

    socket.on('report user', (data) => {
        socket.to(data.room).emit('user reported');
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.userId);
    });
});

async function startServer() {
    await connectToDatabase();

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

startServer();

