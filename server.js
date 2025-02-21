const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session');
const { Sequelize, DataTypes, Op } = require('sequelize');
const router = express.Router();
const fs = require('fs');

// Create HTTP server and Socket.IO instance
const server = http.createServer(app);
const io = socketIo(server);

// Initialize Sequelize with SQLite
const sequelize = new Sequelize(process.env.DATABASE_URL || {
  dialect: 'sqlite',
  storage: path.join(__dirname, 'database.sqlite')
});

// Define the User model
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  fullPhoneNumber: {
    type: DataTypes.STRING,
    allowNull: false
  },
  profilePicture: {
    type: DataTypes.STRING,
    allowNull: true
  },
  age: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  gender: {
    type: DataTypes.STRING,
    allowNull: true
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true
  },
  online: {
    type: DataTypes.BOOLEAN,
    allowNull: true
  },
  bio: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  mood: {
    type: DataTypes.STRING,
    allowNull: true
  },
  interests: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  instantDate: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  availableToday: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  searchingForRelationship: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  relationshipGoals: {
    type: DataTypes.STRING,
    allowNull: true
  },
  fitnessGoals: {
    type: DataTypes.STRING,
    allowNull: true
  },
  notifications: {
    type: DataTypes.STRING,
    defaultValue: 'all'
  },
  privacy: {
    type: DataTypes.STRING,
    defaultValue: 'public'
  },
  theme: {
    type: DataTypes.STRING,
    defaultValue: 'light'
  },
  language: {
    type: DataTypes.STRING,
    defaultValue: 'en'
  },
  subscription: {
    type: DataTypes.STRING,
    defaultValue: 'monthly'
  },
  fontSize: {
    type: DataTypes.STRING,
    defaultValue: 'medium'
  },
  twoFactorAuth: {
    type: DataTypes.STRING,
    defaultValue: 'disabled'
  },
  onlineStatus: {
    type: DataTypes.STRING,
    defaultValue: 'enabled'
  },
  lastSeen: {
    type: DataTypes.STRING,
    defaultValue: 'everyone'
  },
  readReceipts: {
    type: DataTypes.STRING,
    defaultValue: 'enabled'
  },
  autoDownload: {
    type: DataTypes.STRING,
    defaultValue: 'wifi'
  }
});

// Define the Message model
const Message = sequelize.define('Message', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  fromUserId: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id'
    },
    allowNull: false
  },
  toUserId: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id'
    },
    allowNull: false
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: Sequelize.NOW
  },
  messageType: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: 'text' // Default messageType is 'text'
  }
});

// Define associations
User.hasMany(Message, { as: 'SentMessages', foreignKey: 'fromUserId' });
User.hasMany(Message, { as: 'ReceivedMessages', foreignKey: 'toUserId' });
Message.belongsTo(User, { as: 'Sender', foreignKey: 'fromUserId' });
Message.belongsTo(User, { as: 'Receiver', foreignKey: 'toUserId' });

sequelize.sync({ force: false }).then(() => {
  console.log('Database & tables created!');
});

// Serve static files from the 'public' directory
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));

// Configure session middleware
app.use(session({
  secret: '4123',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Use secure: true in production with HTTPS
}));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage: storage });

// Handle registration form submission
app.post('/register', async (req, res) => {
  const { username, password, countryCode, phone } = req.body;
  if (password.length < 6) {
    return res.status(400).send('Password must be at least 6 characters long.');
  }
  const fullPhoneNumber = `${countryCode}${phone}`;
  try {
    console.log('Checking existing user...');
    const existingUser = await User.findOne({ where: { fullPhoneNumber } });
    if (existingUser) {
      return res.status(400).send('Phone number is already used by another user.');
    }
    console.log('Creating new user...');
    const user = await User.create({ username, password, fullPhoneNumber });
    req.session.userId = user.id; // Save userId in session
    res.redirect(`/profile?userId=${user.id}`);
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Handle login form submission
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ where: { username, password } });
    if (user) {
      req.session.userId = user.id; // Save userId in session
      res.redirect(`/profile?userId=${user.id}`);
    } else {
      res.send('Invalid username or password.');
    }
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Middleware to check if the user is logged in
const requireLogin = (req, res, next) => {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/login');
  }
};

// Route to serve the index.html file
app.get('/', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route to serve the registration.html file
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'registration.html'));
});

// Route to serve the login.html file
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Route to serve the profile.html file
app.get('/profile', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

// Route to serve the matches.html file
app.get('/matches', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'matches.html'));
});

// Route to serve the nearby.html file
app.get('/nearby', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'nearby.html'));
});

// Route to serve the messages.html file
app.get('/messages', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'messages.html'));
});

// Route to serve the secretcrush.html file
app.get('/secretcrush', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'secretcrush.html'));
});

// Route to serve the coffee-room.html file
app.get('/coffee-room', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'coffee-room.html'));
});

// Route to serve the free-today.html file
app.get('/free-today', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'free-today.html'));
});

// Route to serve the speed-dating.html file
app.get('/speed-dating', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'speed-dating.html'));
});

// Route to serve the chatlist.html file
app.get('/chatlist', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chatlist.html'));
});

// Route to serve the about-app.html file
app.get('/about-app', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'about-app.html'));
});

// Route to serve the speed.html file
app.get('/chat', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// Route to serve the chat.html file
app.get('/speed', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'speed.html'));
});

// Route to serve the voice-chat-room.html file
app.get('/voice-chat-room', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'voice-chat-room.html'));
});

// Route to serve the freetohangout.html file
app.get('/freetohangout', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'freetohangout.html'));
});

// Route to serve the searching.html file
app.get('/searching', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'searching.html'));
});

// Route to serve the moodmatcher.html file
app.get('/moodmatcher', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'moodmatcher.html'));
});

// Add routes to serve voice and video call HTML files
app.get('/voiceCall.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'voiceCall.html'));
});

app.get('/videoCall.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'videoCall.html'));
});

// Route to serve the instantdate.html file
app.get('/instantdate', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'instantdate.html'));
});

// Route to serve the nearby-users.html file
app.get('/nearby-users', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'nearby-users.html'));
});

// Route to serve the virtualmeetup.html file
app.get('/virtualmeetup', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'virtualmeetup.html'));
});

// Route to serve the anonymous-chat-room.html file
app.get('/anonymous-chat-room', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'anonymous-chat-room.html'));
});

// Route to serve the chat-zone.html file
app.get('/chat-zone', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat-zone.html'));
});

// Route to get all users
app.get('/api/all-users', async (req, res) => {
  const users = await User.findAll();
  res.json(users);
});

// Route to get online users
app.get('/api/online-users', async (req, res) => {
  const onlineUsers = await User.findAll({
    where: {
      online: true // Assuming you have a field to track online status
    }
  });
  res.json(onlineUsers);
});

app.get('/profile', async (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login.html');
  }
  const user = await User.findByPk(req.session.userId);
  if (user) {
    res.render('profile', { user });
  } else {
    res.redirect('/login.html');
  }
});

// Route to get a user's profile
app.get('/api/profile', requireLogin, async (req, res) => {
  const userId = req.session.userId;
  const user = await User.findByPk(userId);
  if (user) {
    res.json(user);
  } else {
    res.send('User not found.');
  }
});

// Ensure the uploads directory exists
const uploadsDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Handle profile update form submission
app.post('/profile', upload.single('profilePicture'), async (req, res) => {
  const { bio, interests, location, age, gender } = req.body;
  let profilePicture = '';

  if (req.file) {
    profilePicture = `/uploads/${req.file.filename}`;
  }

  try {
    const user = await User.findByPk(req.session.userId);
    if (user) {
      user.bio = bio;
      user.interests = JSON.stringify(interests.split(', '));
      user.profilePicture = profilePicture || user.profilePicture;
      user.location = location;
      user.age = age;
      user.gender = gender;
      await user.save();
      res.redirect(`/profile?userId=${user.id}`);
    } else {
      res.status(404).send('User not found.');
    }
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Route to get matches for a user
app.get('/api/matches', requireLogin, async (req, res) => {
  const userId = req.session.userId;
  const user = await User.findByPk(userId);
  if (user) {
    const matches = await User.findAll({
      where: {
        id: { [Sequelize.Op.ne]: userId },
        interests: { [Sequelize.Op.like]: `%${user.interests}%` },
        age: {
          [Sequelize.Op.between]: [user.age - 2, user.age + 2]
        }
      }
    });
    res.json(matches);
  } else {
    res.send('User not found.');
  }
});

app.get('/api/currently-online-users', async (req, res) => {
  try {
    const users = await User.findAll({
      where: {
        // Replace 'instantDate' with the correct column name if it's different
        instantdate: true, // Users who are in the Instant Date feature
        online: true // Users who are currently online
      },
      attributes: ['id', 'username', 'profilePicture', 'age', 'location', 'interests']
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching currently online users:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Route to search users based on criteria
app.get('/api/search-users', async (req, res) => {
  const { minAge, maxAge, gender, interests, location } = req.query;
  const interestsArray = interests && interests !== 'any' ? interests.split(',').map(interest => interest.trim()) : [];
  
  try {
    const searchCriteria = {};

    if (minAge && maxAge) {
      searchCriteria.age = { [Op.between]: [minAge, maxAge] };
    } else if (minAge) {
      searchCriteria.age = { [Op.gte]: minAge };
    } else if (maxAge) {
      searchCriteria.age = { [Op.lte]: maxAge };
    }

    if (gender) {
      searchCriteria.gender = gender;
    }

    if (location) {
      searchCriteria.location = location;
    }

    if (interestsArray.length > 0) {
      searchCriteria.interests = {
        [Op.or]: interestsArray.map(interest => ({
          [Op.like]: `%${interest}%`
        }))
      };
    }

    const users = await User.findAll({
      where: searchCriteria
    });
    
    res.json(users);
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Route to get nearby users
app.get('/api/nearby', async (req, res) => {
  const userId = req.session.userId;
  const user = await User.findByPk(userId);
  if (user) {
    const nearbyUsers = await User.findAll({
      where: {
        userId: { [Sequelize.Op.ne]: userId },
        location: user.location
      }
    });
    res.json(nearbyUsers);
  } else {
    res.send('User not found.');
  }
});

// Route to get online users
app.get('/api/online-users', async (req, res) => {
  const onlineUsers = await User.findAll({
    where: {
      online: true
    }
  });
  res.json(onlineUsers);
});

// Fetch messages for a chat
app.get('/api/messages', requireLogin, async (req, res) => {
    const userId = req.session.userId;
    const chatUserId = req.query.chatUserId;

    try {
        const messages = await Message.findAll({
            where: {
                [Op.or]: [
                    { fromUserId: userId, toUserId: chatUserId },
                    { fromUserId: chatUserId, toUserId: userId }
                ]
            },
            order: [['timestamp', 'ASC']]
        });
        res.json(messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).send('Internal Server Error');
    }
});


// Send a message
app.post('/api/send-message', requireLogin, async (req, res) => {
    const { toUserId, content } = req.body;
    const fromUserId = req.session.userId; // Ensure this is the dynamic userId

    if (!toUserId || !content) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
        const newMessage = await Message.create({
            fromUserId,
            toUserId,
            content,
            timestamp: new Date(),
            messageType: 'text' // Ensure this is set if it's not in the request body
        });
        console.log('Message created:', newMessage);
        res.status(201).json(newMessage);
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Fetch the chat list for a user
app.get('/api/chat-list', requireLogin, async (req, res) => {
  const userId = req.session.userId;

  try {
    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { fromUserId: userId },
          { toUserId: userId }
        ]
      },
      attributes: ['fromUserId', 'toUserId']
    });

    const chatUserIds = new Set();
    messages.forEach(msg => {
      if (msg.fromUserId != userId) chatUserIds.add(msg.fromUserId);
      if (msg.toUserId != userId) chatUserIds.add(msg.toUserId);
    });

    const chatUsers = await User.findAll({
      where: { id: Array.from(chatUserIds) },
      attributes: ['id', 'username']
    });

    res.json(chatUsers);
  } catch (error) {
    console.error('Error fetching chat list:', error);
    res.status(500).send('Internal Server Error');
  }
});

// API to get mood matches
app.get('/api/match-mood', async (req, res) => {
  const userId = req.session.userId;
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).send('User not found');
    }

    const oppositeGender = user.gender === 'male' ? 'female' : 'male';
    const matches = await User.findAll({
      attributes: ['id', 'username', 'mood', 'profilePicture', 'gender'],
      where: {
        mood: user.mood,
        gender: oppositeGender
      }
    });
    res.json(matches);
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).send('Internal Server Error');
  }
});

// API to update mood
app.post('/api/update-mood', async (req, res) => {
  const { mood } = req.body;
  const userId = req.session.userId; // Assuming userId is stored in the session
  try {
    const user = await User.findByPk(userId);
    if (user) {
      user.mood = mood;
      await user.save();
      res.sendStatus(200);
    } else {
      res.status(404).send('User not found');
    }
  } catch (error) {
    console.error('Error updating mood:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Send a mood match request
app.post('/api/send-mood-match-request', async (req, res) => {
  const { userId, mood } = req.body;
  const fromUserId = req.session.userId; // Assuming userId is stored in the session

  try {
    // Create a mood match request message for both sender and receiver
    await Message.create({
      fromUserId,
      toUserId: userId,
      content: 'You have sent a mood match request.',
      messageType: 'moodMatch'
    });

    await Message.create({
      fromUserId: userId,
      toUserId: fromUserId,
      content: 'You have received a mood match request.',
      messageType: 'moodMatch'
    });

    console.log(`Mood match request sent from user ${fromUserId} to user ${userId}`);
    res.status(200).send('Mood match request sent!');
  } catch (error) {
    console.error('Error sending mood match request:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// Routes
app.get('/api/nearby-users', async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'username', 'profilePicture', 'age', 'interests', 'online']
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching nearby users:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/api/nearby-users', (req, res) => {
    // Mock data for nearby users
    const nearbyUsers = Object.values(users).map(user => ({
        userId: user.userId,
        username: user.username,
        profilePicture: user.profile_picture || 'default-profile.png'
    }));
    res.send(nearbyUsers);
});
app.get('/api/matches', async (req, res) => {
  const { mood } = req.query;
  try {
    if (!mood) {
      return res.status(400).send('Mood parameter is required.');
    }
    const matches = await User.findAll({
      where: {
        mood
      }
    });
    res.json(matches);
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/api/online-users', async (req, res) => {
  try {
    const onlineUsers = await User.findAll({
      where: {
        online: true
      },
      attributes: ['id', 'username', 'profilePicture']
    });
    res.json(onlineUsers);
  } catch (error) {
    console.error('Error fetching users by status:', error);
    res.status(500).send('Internal Server Error');
  }
});


let waitingUsers = [];
let chatPairs = {};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('joinCoffeeRoom', () => {
    if (waitingUsers.length > 0) {
      const partnerSocketId = waitingUsers.pop();
      chatPairs[socket.id] = partnerSocketId;
      chatPairs[partnerSocketId] = socket.id;

      socket.emit('strangerMessage', 'You are now chatting with a stranger.');
      io.to(partnerSocketId).emit('strangerMessage', 'You are now chatting with a stranger.');

      setTimeout(() => {
        endChat(socket.id);
        endChat(partnerSocketId);
      }, 180000); // 3 minutes in milliseconds
    } else {
      waitingUsers.push(socket.id);
    }
  });

  socket.on('userMessage', (message) => {
    const partnerSocketId = chatPairs[socket.id];
    if (partnerSocketId) {
      io.to(partnerSocketId).emit('strangerMessage', message);
    }
  });

  socket.on('endChat', () => {
    endChat(socket.id);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    endChat(socket.id);
  });

  function endChat(socketId) {
    const partnerSocketId = chatPairs[socketId];
    if (partnerSocketId) {
      io.to(partnerSocketId).emit('endChat');
      delete chatPairs[partnerSocketId];
      delete chatPairs[socketId];
    } else {
      const index = waitingUsers.indexOf(socketId);
      if (index !== -1) {
        waitingUsers.splice(index, 1);
      }
    }
  }
});


app.get('/api/matches', async (req, res) => {
  const { userId } = req.query;
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).send('User not found');
    }

    const ageRangeMin = user.age - 2;
    const ageRangeMax = user.age + 2;
    const interestArray = JSON.parse(user.interests || '[]');

    const matches = await User.findAll({
      where: {
        userId: { [Sequelize.Op.ne]: userId },
        age: { [Sequelize.Op.between]: [ageRangeMin, ageRangeMax] },
        interests: { [Sequelize.Op.like]: `%${interestArray}%` }
      },
      attributes: ['userId', 'username', 'age', 'interests', 'profilePicture', 'online']
    });

    res.json(matches);
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).send('Internal Server Error');
  }
});
// Define new route to fetch users based on online/offline status
app.get('/api/users-status', async (req, res) => {
  const { status } = req.query; // Accepts 'online' or 'offline'
  try {
    const users = await User.findAll({
      where: {
        online: status === 'online' ? true : false
      },
      attributes: ['id', 'username', 'profilePicture', 'online']
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users by status:', error);
    res.status(500).send('Internal Server Error');
  }
});

let ongoingVoiceChats = [];

// Routes

// Updated endpoint to fetch users based on online/offline status
app.get('/api/users-status', async (req, res) => {
  const { status } = req.query; // Accepts 'online' or 'offline'
  try {
    const users = await User.findAll({
      where: {
        online: status === 'online' ? true : false
      },
      attributes: ['userId', 'username', 'profilePicture', 'age', 'interests', 'online']
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users by status:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/api/nearby-users', async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['userId', 'username', 'profilePicture', 'online']
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching nearby users:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/api/matches', async (req, res) => {
  const { userId } = req.session;
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).send('User not found');
    }

    const matches = await User.findAll({
      attributes: ['userId', 'username', 'profilePicture'],
      where: {
        mood: user.mood
      }
    });
    res.json(matches);
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Route to send a message
app.post('/api/send-message', requireLogin, async (req, res) => {
  const { toUserId, content } = req.body;
  const fromUserId = req.session.userId;

  if (!toUserId || !content) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    const newMessage = await Message.create({
      fromUserId,
      toUserId,
      content,
      timestamp: new Date()
    });
    console.log('Message created:', newMessage);
    res.status(201).json(newMessage);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Add route to fetch chat list
app.get('/api/chat-list', async (req, res) => {
  const { userId } = req.query;
  try {
    const chats = await Message.findAll({
      where: {
        [Sequelize.Op.or]: [
          { fromUserId: userId },
          { toUserId: userId }
        ]
      },
      include: [
        { model: User, as: 'Sender', attributes: ['username'] },
        { model: User, as: 'Receiver', attributes: ['username'] }
      ]
    });

    const uniqueUsers = [...new Set(chats.map(msg => 
      msg.fromUserId === parseInt(userId) ? msg.Receiver : msg.Sender))];
    res.json(uniqueUsers);
  } catch (error) {
    console.error('Error fetching chat list:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Fetch users who are currently in the SecretCrush feature
app.get('/api/secretcrush-users', async (req, res) => {
  try {
    const users = await User.findAll({
      where: {
        // You can add any additional criteria here if needed
      },
      attributes: ['id', 'username', 'profilePicture', 'age', 'gender', 'interests']
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching secretcrush users:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Fetch users for SecretCrush
app.get('/api/secretcrush-users', requireLogin, async (req, res) => {
  try {
    const users = await User.findAll();
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Send a message
app.post('/api/send-message', requireLogin, async (req, res) => {
  const { toUserId, content } = req.body;
  try {
    const message = await Message.create({
      fromUserId: req.session.userId,
      toUserId,
      content,
      timestamp: new Date()
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Send a secret admirer message
app.post('/api/send-admirer-message', requireLogin, async (req, res) => {
  const { toUserId, content } = req.body;
  try {
    const message = await Message.create({
      fromUserId: req.session.userId,
      toUserId,
      content,
      timestamp: new Date(),
      messageType: 'secretCrush'
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error sending secret admirer message:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Fetch received messages
// Fetch all messages between two users
app.get('/api/messages', requireLogin, async (req, res) => {
  const { userId, chatUserId } = req.query;

  try {
    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { fromUserId: userId, toUserId: chatUserId },
          { fromUserId: chatUserId, toUserId: userId }
        ]
      },
      include: [
        { model: User, as: 'Sender', attributes: ['username'] },
        { model: User, as: 'Receiver', attributes: ['username'] }
      ],
      order: [['timestamp', 'ASC']]
    });

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/send-notification', async (req, res) => {
  const { message } = req.body;
  // Implement logic to send notification
  res.json({ message: 'Notification sent!' });
});

// Socket.IO event handling
io.on('connection', (socket) => {
  console.log('A user connected');
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// Route to fetch currently online users in the Instant Date feature
app.get('/api/currently-online-users', async (req, res) => {
  try {
    const users = await User.findAll({
      where: {
        instantDate: true,
        online: true
      },
      attributes: ['id', 'username', 'profilePicture', 'age', 'location', 'interests']
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching currently online users:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Route to handle user joining the Instant Date feature
app.post('/api/join-instant-date', async (req, res) => {
  const userId = req.session.userId;
  try {
    const user = await User.findByPk(userId);
    if (user) {
      user.instantDate = true;
      await user.save();
      res.sendStatus(200);
    } else {
      res.status(404).send('User not found');
    }
  } catch (error) {
    console.error('Error joining Instant Date:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Route to handle user leaving the Instant Date feature
app.post('/api/leave-instant-date', async (req, res) => {
  const userId = req.session.userId;
  try {
    const user = await User.findByPk(userId);
    if (user) {
      user.instantDate = false;
      await user.save();
      res.sendStatus(200);
    } else {
      res.status(404).send('User not found');
    }
  } catch (error) {
    console.error('Error leaving Instant Date:', error);
    res.status(500).send('Internal Server Error');
  }
});

let speedDatingSessions = [];

app.post('/api/create-speed-dating', requireLogin, (req, res) => {
  const userId = req.session.userId;
  const { sessionName } = req.body;
  const session = {
    sessionName,
    creatorId: userId,
    participants: [userId],
    isActive: false
  };
  speedDatingSessions.push(session);
  res.status(200).json(session);
});

app.post('/api/join-speed-dating', requireLogin, (req, res) => {
  const userId = req.session.userId;
  const { sessionName } = req.body;
  const session = speedDatingSessions.find(s => s.sessionName === sessionName);

  if (session && !session.isActive) {
    if (!session.participants.includes(userId)) {
      session.participants.push(userId);
    }
    if (session.participants.length >= 10) {
      session.isActive = true;
    }
    res.status(200).json(session);
  } else {
    res.status(404).send('Session not found or already active');
  }
});

app.get('/api/available-speed-dating', (req, res) => {
  const availableSessions = speedDatingSessions.filter(s => !s.isActive);
  res.status(200).json(availableSessions);
});

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('joinSpeedDatingSession', (roomName) => {
    socket.join(roomName);
    const session = speedDatingSessions.find(s => `speedDating-${s.sessionName}` === roomName);
    if (session) {
      const participants = session.participants.map(id => ({ id, username: getUsernameById(id) }));
      io.to(roomName).emit('updateParticipants', { participants });
    }
  });

  socket.on('sendMessage', ({ roomName, message }) => {
    io.to(roomName).emit('receiveMessage', { message, senderId: socket.id });
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

function getUsernameById(userId) {
  // Implement logic to get username by userId from the User model
  const user = User.findByPk(userId);
  return user ? user.username : 'Unknown';
}

// Fetch available voice chats
app.get('/api/voice-chats', async (req, res) => {
  try {
    // Implement logic to fetch available voice chats
    res.json([]); // Placeholder for available voice chats
  } catch (error) {
    console.error('Error fetching voice chats:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Fetch available voice chats
app.get('/api/voice-chats', async (req, res) => {
  try {
    res.json(Object.keys(voiceChatRooms));
  } catch (error) {
    console.error('Error fetching voice chats:', error);
    res.status(500).send('Internal Server Error');
  }
});

let voiceChatRooms = {};
let coffeeRoomUsers = [];

// Socket.IO handling
io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('createVoiceChat', (sessionName) => {
    voiceChatRooms[sessionName] = { host: socket.id, participants: [socket.id], listeners: [] };
    socket.join(sessionName);
    socket.emit('voiceChatCreated', sessionName);
    updateVoiceChatList();
  });

  socket.on('joinVoiceChat', (sessionName) => {
    if (voiceChatRooms[sessionName]) {
      if (voiceChatRooms[sessionName].participants.length < 6) {
        voiceChatRooms[sessionName].participants.push(socket.id);
        socket.join(sessionName);
        socket.emit('voiceChatJoined', sessionName);
        io.to(sessionName).emit('newParticipant', socket.id);
      } else {
        voiceChatRooms[sessionName].listeners.push(socket.id);
        socket.emit('voiceChatJoined', sessionName);
      }
    }
  });

  socket.on('leaveVoiceChat', (sessionName) => {
    if (voiceChatRooms[sessionName]) {
      if (voiceChatRooms[sessionName].host === socket.id) {
        // End session if the host leaves
        delete voiceChatRooms[sessionName];
        io.to(sessionName).emit('sessionEnded');
      } else {
        voiceChatRooms[sessionName].participants = voiceChatRooms[sessionName].participants.filter(id => id !== socket.id);
        if (voiceChatRooms[sessionName].listeners.length > 0) {
          const newParticipant = voiceChatRooms[sessionName].listeners.shift();
          voiceChatRooms[sessionName].participants.push(newParticipant);
          io.to(sessionName).emit('newParticipant', newParticipant);
        }
      }
      socket.leave(sessionName);
      updateVoiceChatList();
    }
  });

  socket.on('offer', async ({ to, offer }) => {
    io.to(to).emit('offer', { from: socket.id, offer });
  });

  socket.on('answer', ({ to, answer }) => {
    io.to(to).emit('answer', { from: socket.id, answer });
  });

  socket.on('iceCandidate', ({ to, candidate }) => {
    io.to(to).emit('iceCandidate', { from: socket.id, candidate });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
    for (const sessionName in voiceChatRooms) {
      const room = voiceChatRooms[sessionName];
      if (room.host === socket.id) {
        // End session if the host disconnects
        delete voiceChatRooms[sessionName];
        io.to(sessionName).emit('sessionEnded');
      } else {
        room.participants = room.participants.filter(id => id !== socket.id);
        if (room.listeners.length > 0) {
          const newParticipant = room.listeners.shift();
          room.participants.push(newParticipant);
          io.to(sessionName).emit('newParticipant', newParticipant);
        }
      }
    }
    updateVoiceChatList();
    
    // Handle user disconnection from coffee room
    const index = coffeeRoomUsers.indexOf(socket);
    if (index !== -1) {
      coffeeRoomUsers.splice(index, 1);
    }
  });
});

function updateVoiceChatList() {
  const sessions = Object.keys(voiceChatRooms);
  io.emit('updateVoiceChatList', sessions);
}

// Fetch available users
app.get('/api/free-to-hangout', async (req, res) => {
  try {
    const users = await User.findAll({
      where: { availableToday: true },
      attributes: ['id', 'username', 'profilePicture', 'location']
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Send hangout request
app.post('/api/send-hangout-request', async (req, res) => {
  const { userId } = req.body;
  const fromUserId = req.session.userId; // Assuming userId is stored in the session

  try {
    // Create a hangout request message for both sender and receiver
    await Message.create({
      fromUserId,
      toUserId: userId,
      content: 'You have sent a hangout request.',
      messageType: 'hangout'
    });

    await Message.create({
      fromUserId: userId,
      toUserId: fromUserId,
      content: 'You have received a hangout request.',
      messageType: 'hangout'
    });

    console.log(`Hangout request sent from user ${fromUserId} to user ${userId}`);
    res.status(200).send('Hangout request sent!');
  } catch (error) {
    console.error('Error sending hangout request:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Send message
app.post('/api/send-message', requireLogin, async (req, res) => {
    const { toUserId, content } = req.body;
    const fromUserId = req.session.userId; // Ensure this is the dynamic userId

    if (!toUserId || !content) {
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    try {
        const newMessage = await Message.create({
            fromUserId,
            toUserId,
            content,
            timestamp: new Date(),
            messageType: 'text' // Ensure this is set if it's not in the request body
        });
        console.log('Message created:', newMessage);
        res.status(201).json(newMessage);
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Fetch messages
app.get('/api/messages', requireLogin, async (req, res) => {
    const userId = req.session.userId;
    const chatUserId = req.query.chatUserId;

    try {
        const messages = await Message.findAll({
            where: {
                [Op.or]: [
                    { fromUserId: userId, toUserId: chatUserId },
                    { fromUserId: chatUserId, toUserId: userId }
                ]
            },
            order: [['timestamp', 'ASC']]
        });
        res.json(messages);
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Create a virtual event
app.post('/api/create-virtual-event', async (req, res) => {
  const { title, date, description } = req.body;
  try {
    const event = await Event.create({ title, date, description });
    res.status(201).json(event);
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Fetch virtual events
app.get('/api/virtual-events', async (req, res) => {
  try {
    const events = await Event.findAll();
    res.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Fetch live streams
app.get('/api/live-streams', async (req, res) => {
  try {
    const streams = await LiveStream.findAll();
    res.json(streams);
  } catch (error) {
    console.error('Error fetching live streams:', error);
    res.status(500).send('Internal Server Error');
  }
});


// Fetch users who are searching for a relationship
app.get('/api/searching-for-relationship', async (req, res) => {
  try {
    const users = await User.findAll({
      where: { searchingForRelationship: true },
      attributes: ['id', 'username', 'profilePicture', 'location', 'age', 'interests']
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Fetch the chat list for a user
app.get('/api/chat-list', requireLogin, async (req, res) => {
  const userId = req.session.userId;

  try {
    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { fromUserId: userId },
          { toUserId: userId }
        ]
      },
      attributes: [
        [sequelize.literal('DISTINCT `fromUserId`'), 'fromUserId'],
        [sequelize.literal('DISTINCT `toUserId`'), 'toUserId']
      ]
    });

    const chatUserIds = new Set();
    messages.forEach(msg => {
      if (msg.fromUserId != userId) chatUserIds.add(msg.fromUserId);
      if (msg.toUserId != userId) chatUserIds.add(msg.toUserId);
    });

    const chatUsers = await User.findAll({
      where: { id: Array.from(chatUserIds) },
      attributes: ['id', 'username']
    });

    res.json(chatUsers);
  } catch (error) {
    console.error('Error fetching chat list:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to fetch potential matches based on gender
app.get('/api/location-matches', requireLogin, async (req, res) => {
  const userId = req.session.userId;
  const user = await User.findByPk(userId);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const oppositeGender = user.gender === 'male' ? 'female' : 'male';

  try {
    const matches = await User.findAll({
      where: {
        id: { [Op.ne]: userId },
        gender: oppositeGender,
        location: user.location // Matching by location
      }
    });
    res.json(matches);
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/location-based-search', requireLogin, async (req, res) => {
  const userId = req.session.userId;
  const user = await User.findByPk(userId);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  try {
    const matches = await User.findAll({
      where: {
        id: { [Op.ne]: userId },
        location: user.location // Assuming matching by location
      }
    });
    res.json(matches);
  } catch (error) {
    console.error('Error fetching location-based matches:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

let anonymousChatRooms = {};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // User creates a new chat room
  socket.on('createAnonymousChatRoom', (roomName) => {
    if (!anonymousChatRooms[roomName]) {
      anonymousChatRooms[roomName] = { creator: socket.id, participants: [], messageCount: 0 };
      socket.join(roomName);
      anonymousChatRooms[roomName].participants.push(socket.id);
      socket.emit('chatRoomCreated', roomName);
      console.log(`Chat room ${roomName} created by ${socket.id}`);
    } else {
      socket.emit('chatRoomExists', roomName);
    }
  });

  // User joins an existing chat room
  socket.on('joinAnonymousChatRoom', (roomName) => {
    if (!anonymousChatRooms[roomName]) {
      // Create the room if it doesn't exist
      anonymousChatRooms[roomName] = { creator: null, participants: [], messageCount: 0 };
    }
    socket.join(roomName);
    anonymousChatRooms[roomName].participants.push(socket.id);
    socket.emit('joinedAnonymousChatRoom', roomName);
    io.to(roomName).emit('userJoined', { roomId: roomName, userId: socket.id });

    const creatorId = anonymousChatRooms[roomName].creator;
    if (creatorId) {
      io.to(creatorId).emit('notification', `User ${socket.id} has joined your chat room ${roomName}.`);
    }
    console.log(`${socket.id} joined chat room ${roomName}`);
  });

  // User sends a message in the chat room
  socket.on('anonymousMessage', ({ roomName, message }) => {
    if (anonymousChatRooms[roomName]) {
      anonymousChatRooms[roomName].messageCount++;
      io.to(roomName).emit('receiveAnonymousMessage', { message, senderId: socket.id });
    } else {
      console.error(`Room ${roomName} does not exist.`);
    }
  });

  // Room creator kicks a user
  socket.on('kickUser', ({ roomName, userId }) => {
    if (anonymousChatRooms[roomName] && anonymousChatRooms[roomName].creator === socket.id) {
      io.to(userId).emit('kickedFromRoom', roomName);
      socket.to(userId).disconnect(true);
      anonymousChatRooms[roomName].participants = anonymousChatRooms[roomName].participants.filter(id => id !== userId);
      console.log(`${userId} was kicked from room ${roomName} by ${socket.id}`);
    }
  });

  // User disconnects
  socket.on('disconnect', () => {
    console.log('A user disconnected:', socket.id);
    for (const roomName in anonymousChatRooms) {
      anonymousChatRooms[roomName].participants = anonymousChatRooms[roomName].participants.filter(id => id !== socket.id);
      if (anonymousChatRooms[roomName].participants.length === 0) {
        delete anonymousChatRooms[roomName];
      }
    }
  });
});

// Endpoint to get all chat rooms with their participant count and message count
app.get('/api/chatrooms', (req, res) => {
  const rooms = Object.keys(anonymousChatRooms).map(roomName => ({
    roomName,
    participants: anonymousChatRooms[roomName].participants.length,
    messageCount: anonymousChatRooms[roomName].messageCount,
  }));

  const popularRooms = rooms.sort((a, b) => b.participants - a.participants || b.messageCount - a.messageCount).slice(0, 5);
  res.json({ rooms, popularRooms });
});

app.get('/api/daily-discovery', requireLogin, async (req, res) => {
  const userId = req.session.userId;

  try {
    const totalUsers = await User.count({
      where: { id: { [Op.ne]: userId } }
    });

    const randomOffset = Math.floor(Math.random() * totalUsers);

    const [randomUser] = await User.findAll({
      where: { id: { [Op.ne]: userId } },
      offset: randomOffset,
      limit: 1
    });

    res.json(randomUser);
  } catch (error) {
    console.error('Error fetching daily discovery user:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/api/match-fitness', requireLogin, async (req, res) => {
  const userId = req.session.userId;
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).send('User not found');
    }

    const oppositeGender = user.gender === 'male' ? 'female' : 'male';
    const matches = await User.findAll({
      attributes: ['id', 'username', 'fitnessGoals', 'profilePicture', 'gender'],
      where: {
        fitnessGoals: user.fitnessGoals,
        gender: oppositeGender
      }
    });
    res.json(matches);
  } catch (error) {
    console.error('Error fetching fitness goal matches:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/update-fitness-goals', requireLogin, async (req, res) => {
  const { fitnessGoals } = req.body;
  const userId = req.session.userId;

  try {
    const user = await User.findByPk(userId);
    if (user) {
      user.fitnessGoals = fitnessGoals;
      await user.save();
      res.sendStatus(200);
    } else {
      res.status(404).send('User not found');
    }
  } catch (error) {
    console.error('Error updating fitness goals:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/send-fitness-match-request', requireLogin, async (req, res) => {
  const { userId, fitnessGoals } = req.body;
  const fromUserId = req.session.userId;

  try {
    // Create a fitness goals match request message for both sender and receiver
    await Message.create({
      fromUserId,
      toUserId: userId,
      content: 'You have sent a fitness goals match request.',
      messageType: 'fitnessMatch'
    });

    await Message.create({
      fromUserId: userId,
      toUserId: fromUserId,
      content: 'You have received a fitness goals match request.',
      messageType: 'fitnessMatch'
    });

    console.log(`Fitness match request sent from user ${fromUserId} to user ${userId}`);
    res.status(200).send('Fitness match request sent!');
  } catch (error) {
    console.error('Error sending fitness match request:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/match-goals', requireLogin, async (req, res) => {
  const userId = req.session.userId;
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).send('User not found');
    }

    const oppositeGender = user.gender === 'male' ? 'female' : 'male';
    const matches = await User.findAll({
      attributes: ['id', 'username', 'relationshipGoals', 'profilePicture', 'gender'],
      where: {
        relationshipGoals: user.relationshipGoals,
        gender: oppositeGender
      }
    });
    res.json(matches);
  } catch (error) {
    console.error('Error fetching relationship goal matches:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/api/update-goals', requireLogin, async (req, res) => {
  const { goals } = req.body;
  const userId = req.session.userId;

  try {
    const user = await User.findByPk(userId);
    if (user) {
      user.relationshipGoals = goals;
      await user.save();
      res.sendStatus(200);
    } else {
      res.status(404).send('User not found');
    }
  } catch (error) {
    console.error('Error updating relationship goals:', error);
    res.status(500).send('Internal Server Error');
  }
});
app.post('/api/send-goals-match-request', requireLogin, async (req, res) => {
  const { userId, goals } = req.body;
  const fromUserId = req.session.userId;

  try {
    // Create a relationship goals match request message for both sender and receiver
    await Message.create({
      fromUserId,
      toUserId: userId,
      content: 'You have sent a relationship goals match request.',
      messageType: 'goalsMatch'
    });

    await Message.create({
      fromUserId: userId,
      toUserId: fromUserId,
      content: 'You have received a relationship goals match request.',
      messageType: 'goalsMatch'
    });

    console.log(`Goals match request sent from user ${fromUserId} to user ${userId}`);
    res.status(200).send('Goals match request sent!');
  } catch (error) {
    console.error('Error sending goals match request:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/search-users', requireLogin, async (req, res) => {
  const { minAge, maxAge, interests, location } = req.body;

  try {
    const users = await User.findAll({
      where: {
        age: { [Op.between]: [minAge, maxAge] },
        interests: { [Op.like]: `%${interests}%` },
        location: { [Op.like]: `%${location}%` }
      }
    });

    res.json(users);
  } catch (error) {
    console.error('Error fetching users based on search criteria:', error);
    res.status(500).send('Internal Server Error');
  }
});

//paymentMethod
const Subscription = sequelize.define('Subscription', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
});

module.exports = { Subscription };


router.post('/api/pay', requireLogin, async (req, res) => {
  const { duration, paymentMethod } = req.body;
  const userId = req.session.userId;
  let expiresAt;

  switch (duration) {
    case 'daily':
      expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours from now
      break;
    case 'weekly':
      expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
      break;
    case 'monthly':
      expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
      break;
    default:
      return res.status(400).send('Invalid duration');
  }

  // Integrate with TNM or Airtel payment API here
  // Example: await tnmAirtelPay(userId, paymentMethod);

  // On successful payment
  await Subscription.create({ userId, expiresAt });

  res.status(200).send('Payment successful');
});

router.get('/api/check-subscription', requireLogin, async (req, res) => {
  const userId = req.session.userId;
  const subscription = await Subscription.findOne({ where: { userId, expiresAt: { [Sequelize.Op.gt]: new Date() } } });

  if (subscription) {
    res.json({ hasAccess: true });
  } else {
    res.json({ hasAccess: false });
  }
});

module.exports = router;
// Endpoint to get user settings
app.get('/api/settings', async (req, res) => {
  const userId = req.session.userId; // Ensure userId is available in session
  try {
    const user = await User.findByPk(userId);
    if (user) {
      res.json(user);
    } else {
      res.status(404).send('User not found');
    }
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Endpoint to update user settings
app.post('/api/settings', async (req, res) => {
  const userId = req.session.userId; // Ensure userId is available in session
  const settings = req.body;

  try {
    const user = await User.findByPk(userId);
    if (user) {
      for (const key in settings) {
        if (settings.hasOwnProperty(key)) {
          user[key] = settings[key];
        }
      }
      await user.save();
      res.status(200).send('Settings updated successfully');
    } else {
      res.status(404).send('User not found');
    }
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Route to get a user's profile
app.get('/api/profile', requireLogin, async (req, res) => {
  const userId = req.query.userId || req.session.userId;
  const user = await User.findByPk(userId);
  if (user) {
    res.json(user);
  } else {
    res.status(404).send('User not found.');
  }
});

const Sentiment = require('sentiment');
// Configure Sentiment Analysis
const sentiment = new Sentiment();

const axios = require('axios');

// Sample knowledge base about the app
const knowledgeBase = {
  "What is LoveConnect?": "LoveConnect is a dating and social networking app designed to help you find meaningful connections.",
  "How do I create an account?": "To create an account, click on the 'Register' button on the homepage and fill out the registration form.",
  "How do I reset my password?": "If you forgot your password, click on the 'Forgot Password' link on the login page and follow the instructions.",
  "How can I find nearby users?": "You can find nearby users by clicking on the 'Nearby Users' section in the app.",
  "How do I send a message?": "To send a message, go to the chat interface, type your message, and click the 'Send' button.",
  "What is LoveConnect": "LoveConnect is a dating and social networking app designed to help you find meaningful connections.",
  "How do I create an account": "To create an account, click on the 'Register' button on the homepage and fill out the registration form.",
  "How do I reset my password": "If you forgot your password, click on the 'Forgot Password' link on the login page and follow the instructions.",
  "How can I find nearby users": "You can find nearby users by clicking on the 'Nearby Users' section in the app.",
  "How do I send a message": "To send a message, go to the chat interface, type your message, and click the 'Send' button.",
   "Hello": "Hi, how can i help you!.",
   "hi": "Hi, how can i heip you!.",
   "hello": "Hi, how can i help you!.",
   "what's your name ": "am LoveConnect Ai Assistant!.",
   "what is your name ": "am LoveConnect Ai Assistant!.",
   "what is your name?": "am LoveConnect Ai Assistant!.",
  // Add more FAQs as needed
};

// Friendly and conversational responses
const casualReplies = [
  "Interesting! Tell me more about that.",
  "I love hearing about that.",
  "That's a great topic! What's your take on it?",
  "Oh, that's cool. Got any more details?",
  "Nice! What else can we chat about?",
  "Let's dive deeper into that. What do you think?",
  "Sounds fun! Any other thoughts?"
];

// Function to get AI response
async function getAIResponse(message, conversationContext) {
  // Check if the user message matches any question in the knowledge base
  if (knowledgeBase[message]) {
    return knowledgeBase[message];
  }


  // Perform a web search if necessary
  const webSearchResponse = await performWebSearch(message);
  if (webSearchResponse) {
    return webSearchResponse;
  }

  // Analyze the user's sentiment using Sentiment package
  const sentimentResponse = analyzeSentiment(message);

  // Generate a friendly and empathetic response based on the detected sentiment
  return generateSentimentResponse(sentimentResponse, message);
}

// Function to perform web search using Google Custom Search API
async function performWebSearch(query) {
  const apiKey = 'AIzaSyDTC62xiWs7OPtHRRRiJ35p-oh5-xE66zs'; // Your Google Search API key
  const cx = 'c49ea14e5ae2846e2'; // Your Google Search Engine ID
  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}`;

  try {
    const response = await axios.get(url);
    console.log('Google Search API Response:', response.data); // Log the full API response for debugging

    if (response.data.items && response.data.items.length > 0) {
      // Filter results to prioritize more conversational content
      const filteredResults = response.data.items.filter(item => !item.title.toLowerCase().includes('youtube') && !item.title.toLowerCase().includes('product') && !item.title.toLowerCase().includes('meal'));

      if (filteredResults.length > 0) {
        const searchResult = filteredResults[0];
        return `Here's what I found: ${searchResult.title} - ${searchResult.snippet}. For more details, visit: ${searchResult.link}`;
      } else {
        return "I'm sorry, I couldn't find any conversational information on that. Can I help you with something else?";
      }
    } else {
      console.warn('No search results found for query:', query);
      return "I'm sorry, I couldn't find any information on that. Can I help you with something else?";
    }
  } catch (error) {
    console.error('Error performing web search:', error);
    return "I'm sorry, I couldn't find any information on that. Can I help you with something else?";
  }
}

// Function to analyze sentiment using Sentiment package
function analyzeSentiment(text) {
  const result = sentiment.analyze(text);
  return result;
}

// Function to generate friendly and empathetic responses based on sentiment
function generateSentimentResponse(sentiment, message) {
  let response = "I see. ";

  if (sentiment.score > 2) {
    response += "That sounds wonderful! Tell me more about it.";
  } else if (sentiment.score < -2) {
    response += "I'm sorry to hear that. I'm here if you want to talk.";
  } else {
    response += "I understand. How can I help you with that?";
  }

  return response;
}

// Function to generate friendly responses
function generateFriendlyResponse(message, conversationContext) {
  const response = casualReplies[Math.floor(Math.random() * casualReplies.length)];
  return `${response} ${conversationContext}`;
}

app.post('/api/ai-response', async (req, res) => {
  const userMessage = req.body.message;
  const conversationContext = req.body.context; // Keeping track of conversation context
  const aiResponse = await getAIResponse(userMessage, conversationContext);
  res.json({ response: aiResponse });
});

// Route to get online users
app.get('/api/online-users', async (req, res) => {
  const onlineUsers = await User.findAll({
    where: {
      online: true // Assuming you have a field to track online status
    }
  });
  res.json(onlineUsers);
});

const onlineUsers = new Map();

// User connection and pairing for speed dating
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('joinSpeedDating', () => {
        onlineUsers.set(socket.id, { socket: socket });

        if (waitingUsers.length > 0) {
            const partnerSocketId = waitingUsers.shift();
            const partnerSocket = onlineUsers.get(partnerSocketId).socket;

            onlineUsers.get(socket.id).partnerSocketId = partnerSocketId;
            onlineUsers.get(partnerSocketId).partnerSocketId = socket.id;

            socket.emit('paired', { partnerSocketId });
            partnerSocket.emit('paired', { partnerSocketId: socket.id });
        } else {
            waitingUsers.push(socket.id);
            socket.emit('waitingList');
        }
    });

    socket.on('nextUser', () => {
        const partnerSocketId = onlineUsers.get(socket.id).partnerSocketId;
        if (partnerSocketId) {
            const partnerSocket = onlineUsers.get(partnerSocketId).socket;
            partnerSocket.emit('partnerDisconnected');
            onlineUsers.delete(partnerSocketId);
        }
        onlineUsers.delete(socket.id);
        socket.emit('joinSpeedDating');
    });

    socket.on('sendMessage', (message) => {
        const user = onlineUsers.get(socket.id);
        if (user && user.partnerSocketId) {
            const partnerSocketId = user.partnerSocketId;
            const partnerSocket = onlineUsers.get(partnerSocketId).socket;
            if (partnerSocket) {
                partnerSocket.emit('message', message);
            }
        }
    });

    socket.on('initiateCall', ({ userId, calleeId, callType }) => {
        const calleeSocketId = onlineUsers.get(calleeId)?.socket;
        if (calleeSocketId) {
            io.to(calleeSocketId).emit('callOffer', { callerId: userId, callType });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        const user = onlineUsers.get(socket.id);
        if (user && user.partnerSocketId) {
            const partnerSocketId = user.partnerSocketId;
            const partnerSocket = onlineUsers.get(partnerSocketId).socket;
            if (partnerSocket) {
                partnerSocket.emit('partnerDisconnected');
            }
            onlineUsers.delete(partnerSocketId);
        }
        onlineUsers.delete(socket.id);
    });
});


// Handle user connection and pairing for quick matches
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('joinQuickMatches', () => {
        onlineUsers.set(socket.id, { socket: socket });

        if (waitingUsers.length > 0) {
            const partnerSocketId = waitingUsers.shift();
            const partnerSocket = onlineUsers.get(partnerSocketId).socket;

            onlineUsers.get(socket.id).partnerSocketId = partnerSocketId;
            onlineUsers.get(partnerSocketId).partnerSocketId = socket.id;

            socket.emit('paired', { partnerSocketId });
            partnerSocket.emit('paired', { partnerSocketId: socket.id });
        } else {
            waitingUsers.push(socket.id);
            socket.emit('waitingList');
        }
    });

   socket.on('nextUser', () => {
    const user = onlineUsers.get(socket.id);
    if (user && user.partnerSocketId) {
        const partnerSocketId = user.partnerSocketId;
        if (onlineUsers.has(partnerSocketId)) {
            const partnerSocket = onlineUsers.get(partnerSocketId).socket;
            partnerSocket.emit('partnerDisconnected');
            onlineUsers.delete(partnerSocketId);
        }
    }
    onlineUsers.delete(socket.id);
    socket.emit('joinQuickMatches');
})

    socket.on('sendMessage', (message) => {
        const user = onlineUsers.get(socket.id);
        if (user && user.partnerSocketId) {
            const partnerSocketId = user.partnerSocketId;
            const partnerSocket = onlineUsers.get(partnerSocketId).socket;
            if (partnerSocket) {
                partnerSocket.emit('message', message);
            }
        }
    });

    socket.on('startVideoCall', (stream) => {
        const user = onlineUsers.get(socket.id);
        if (user && user.partnerSocketId) {
            const partnerSocketId = user.partnerSocketId;
            const partnerSocket = onlineUsers.get(partnerSocketId).socket;
            if (partnerSocket) {
                partnerSocket.emit('partnerVideoStream', stream);
            }
        }
    });

    socket.on('initiateCall', ({ userId, calleeId, callType }) => {
        const calleeSocketId = onlineUsers.get(calleeId)?.socket;
        if (calleeSocketId) {
            io.to(calleeSocketId).emit('callOffer', { callerId: userId, callType });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        const user = onlineUsers.get(socket.id);
        if (user && user.partnerSocketId) {
            const partnerSocketId = user.partnerSocketId;
            if (onlineUsers.has(partnerSocketId)) {
                const partnerSocket = onlineUsers.get(partnerSocketId).socket;
                partnerSocket.emit('partnerDisconnected');
                onlineUsers.delete(partnerSocketId);
            }
        }
        onlineUsers.delete(socket.id);
    });
});

// Endpoint to handle voice note uploads
app.post('/api/send-voice-note', upload.single('voiceNote'), (req, res) => {
    const { toUserId } = req.body;
    const voiceNoteUrl = `/voice_notes/${req.file.filename}`;
    const voiceNoteMessage = {
        fromUserId: 'yourUserId', // Replace with the dynamic user ID of the sender
        toUserId: Number(toUserId),
        voiceNoteUrl,
        timestamp: new Date()
    };
    
    // Send the voice note to the recipient
    io.to(onlineUsers.get(toUserId).socket.id).emit('newVoiceNote', voiceNoteMessage);
    res.status(200).json(voiceNoteMessage);
});

const activeCalls = new Set();

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('registerUser', ({ userId }) => {
        onlineUsers.set(userId, { socket: socket.id });
    });

    socket.on('sendMessage', (message) => {
        const user = onlineUsers.get(message.fromUserId);
        const recipientSocketId = onlineUsers.get(message.toUserId)?.socket;

        if (user && recipientSocketId) {
            io.to(recipientSocketId).emit('message', message);
            socket.emit('message', message); // Also emit the message back to the sender
        }
    });

    socket.on('callOffer', ({ offer, toUserId }) => {
        const recipientSocketId = onlineUsers.get(toUserId)?.socket;

        if (recipientSocketId) {
            io.to(recipientSocketId).emit('callOffer', { offer });
        }
    });

    socket.on('callAnswer', ({ answer, toUserId }) => {
        const recipientSocketId = onlineUsers.get(toUserId)?.socket;

        if (recipientSocketId) {
            io.to(recipientSocketId).emit('callAnswer', answer);
        }
    });

    socket.on('iceCandidate', ({ candidate, toUserId }) => {
        const recipientSocketId = onlineUsers.get(toUserId)?.socket;

        if (recipientSocketId) {
            io.to(recipientSocketId).emit('iceCandidate', candidate);
        }
    });

    socket.on('endCall', ({ toUserId }) => {
        const recipientSocketId = onlineUsers.get(toUserId)?.socket;

        if (recipientSocketId) {
            io.to(recipientSocketId).emit('callEnded');
        }
    });

    socket.on('missedCall', ({ fromUserId, toUserId }) => {
        const recipientSocketId = onlineUsers.get(toUserId)?.socket;

        if (recipientSocketId) {
            io.to(recipientSocketId).emit('missedCallNotification', { fromUserId, timestamp: Date.now() });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Remove user from onlineUsers map
        for (const [userId, user] of onlineUsers.entries()) {
            if (user.socket === socket.id) {
                onlineUsers.delete(userId);
                break;
            }
        }
    });

    // Receive voice notes via Socket.io
    socket.on('voiceNote', (voiceNote) => {
        const recipientSocketId = onlineUsers.get(voiceNote.toUserId)?.socket;

        if (recipientSocketId) {
            io.to(recipientSocketId).emit('newVoiceNote', voiceNote);
        }
    });
});

// Endpoint to handle voice note uploads
app.post('/api/send-voice-note', upload.single('voiceNote'), (req, res) => {
    const { toUserId } = req.body;
    const voiceNoteUrl = `/uploads/${req.file.filename}`;
    const voiceNoteMessage = {
        fromUserId: 'yourUserId', // Replace with the dynamic user ID of the sender
        toUserId: Number(toUserId),
        voiceNoteUrl,
        timestamp: new Date()
    };
 // Save voice note to a file or database for persistence
    // This example assumes voice notes are stored in a JSON file
    const voiceNotesFilePath = 'voice_notes.json';
    let voiceNotes = [];
    if (fs.existsSync(voiceNotesFilePath)) {
        voiceNotes = JSON.parse(fs.readFileSync(voiceNotesFilePath, 'utf8'));
    }
    voiceNotes.push(voiceNoteMessage);
    fs.writeFileSync(voiceNotesFilePath, JSON.stringify(voiceNotes, null, 2), 'utf8');

    // Send the voice note to the recipient
    const recipient = onlineUsers.get(toUserId);
    if (recipient && recipient.socket) {
        recipient.socket.emit('newVoiceNote', voiceNoteMessage);
    }
    res.status(200).json(voiceNoteMessage);
});

// Endpoint to fetch voice notes
app.get('/api/voice-notes', (req, res) => {
    const { chatUserId, userId } = req.query;
    const voiceNotesFilePath = 'voice_notes.json';
    let voiceNotes = [];
    if (fs.existsSync(voiceNotesFilePath)) {
        voiceNotes = JSON.parse(fs.readFileSync(voiceNotesFilePath, 'utf8'));
    }
    const relevantVoiceNotes = voiceNotes.filter(note =>
        (note.fromUserId == userId && note.toUserId == chatUserId) ||
        (note.fromUserId == chatUserId && note.toUserId == userId)
    );
    res.json(relevantVoiceNotes);
});

const rooms = new Map();

// Handle user connection and room management
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('createRoom', ({ roomName }) => {
        if (!rooms.has(roomName)) {
            rooms.set(roomName, { host: socket.id, participants: [] });
            socket.join(roomName);
            io.emit('roomCreated', { name: roomName });
        }
    });

    socket.on('getAvailableRooms', () => {
        const availableRooms = Array.from(rooms.keys()).map(roomName => ({ name: roomName }));
        socket.emit('availableRooms', availableRooms);
    });

    socket.on('joinRoomAsHost', ({ roomName }) => {
        if (rooms.has(roomName)) {
            rooms.get(roomName).host = socket.id;
            socket.join(roomName);
        }
    });

    socket.on('joinRoom', ({ roomName, nickname }) => {
        if (rooms.has(roomName)) {
            const room = rooms.get(roomName);
            room.participants.push({ id: socket.id, nickname: nickname || `User ${socket.id}` });
            socket.join(roomName);
            io.to(roomName).emit('participantJoined', { id: socket.id, nickname: nickname || `User ${socket.id}` });
        }
    });

    socket.on('muteAllParticipants', ({ roomName }) => {
        if (rooms.has(roomName)) {
            const room = rooms.get(roomName);
            room.participants.forEach(participant => {
                io.to(participant.id).emit('muted');
            });
        }
    });

    socket.on('muteParticipant', ({ roomName, participantId }) => {
        if (rooms.has(roomName)) {
            io.to(participantId).emit('muted');
        }
    });

    socket.on('unmuteParticipant', ({ roomName, participantId }) => {
        if (rooms.has(roomName)) {
            io.to(participantId).emit('unmuted');
        }
    });

    socket.on('leaveRoomAsHost', ({ roomName }) => {
        if (rooms.has(roomName)) {
            rooms.delete(roomName);
            io.to(roomName).emit('roomClosed');
            socket.leave(roomName);
        }
    });

    socket.on('leaveRoom', ({ roomName }) => {
        socket.leave(roomName);
        rooms.forEach((room, name) => {
            if (name === roomName) {
                room.participants = room.participants.filter(participant => participant.id !== socket.id);
                io.to(roomName).emit('participantLeft', { id: socket.id });
            }
        });
    });

    socket.on('raiseHand', ({ roomName }) => {
        io.to(roomName).emit('raisedHand', { id: socket.id });
    });

    socket.on('muteSelf', ({ roomName }) => {
        socket.emit('muted');
    });

    socket.on('speaking', ({ roomName, participantId }) => {
        if (rooms.has(roomName)) {
            io.to(roomName).emit('speaking', { id: participantId });
        }
    });

        socket.on('stoppedSpeaking', ({ roomName, participantId }) => {
        if (rooms.has(roomName)) {
            io.to(roomName).emit('stoppedSpeaking', { id: participantId });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        rooms.forEach((room, roomName) => {
            if (room.host === socket.id) {
                rooms.delete(roomName);
                io.to(roomName).emit('roomClosed');
            } else {
                room.participants = room.participants.filter(participant => participant.id !== socket.id);
                io.to(roomName).emit('participantLeft', { id: socket.id });
            }
        });
    });
});


// Start the server
const port = 3000;
server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
