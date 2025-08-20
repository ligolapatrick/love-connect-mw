const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session');
const fs = require('fs');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
require('dotenv').config();

app.use(express.static(path.join(__dirname, 'public')));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: 'drool594s', // Your Cloudinary name
  api_key: '749679254351494', // Your API key
  api_secret: 'UaNi7GGqMNgTkqc9I3gcy_-_WCk', // Your API secret
});

// Set up Cloudinary storage with multer
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'uploads', // Folder name in Cloudinary
    format: async (req, file) => 'jpg', // File format (optional, defaults to uploaded format)
    public_id: (req, file) => `${Date.now()}-${file.originalname}`, // Public ID for unique filenames
  },
});

const upload = multer({ storage: storage });

passport.use(new GoogleStrategy({
    clientID: '946712963279-sq8vmfogp4j6202j2hppm7nh2smgq4jj.apps.googleusercontent.com', // Replace with your Client ID
    clientSecret: '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', // Replace with your Client Secret
    callbackURL: 'https://loveconnect-mw.onrender.com/auth/google/callback' // Ensure this matches the redirect URI in Google Cloud Console
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user already exists in your database
      const user = await User.findOne({ where: { socialId: profile.id } });

      if (!user) {
        // If user doesn't exist, create a new user
        const newUser = await User.create({
          username: profile.displayName,
          email: profile.emails[0].value, // Ensure the email scope is requested
          socialId: profile.id,
          provider: 'google'
        });

        // Pass the newly created user to the next middleware
        return done(null, newUser);
      }

      // If user exists, pass the user data to the next middleware
      return done(null, user);
    } catch (error) {
      console.error('Error handling Google profile:', error);
      return done(error, null);
    }
  }
));

// Route to start Google OAuth login
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] }) // Request profile and email data
);

// Google OAuth callback route
app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
        // Ensure user is authenticated
        console.log('Authenticated user:', req.user);
        if (req.user) {
            const userId = req.user.id;
            const username = req.user.username;
            res.redirect(`/index.html?userId=${userId}&username=${username}`);
        } else {
            console.error('Authentication failed: req.user is not set');
            res.redirect('/login');
        }
    }
);


const FacebookStrategy = require('passport-facebook').Strategy;

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID || 'default_app_id',
    clientSecret: process.env.FACEBOOK_APP_SECRET || 'default_app_secret',
    callbackURL: 'https://loveconnect.site/auth/facebook/callback',
    profileFields: ['id', 'displayName', 'emails']
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const existingUser = await User.findOne({ where: { socialId: profile.id } });
        if (!existingUser) {
            const newUser = await User.create({
                username: profile.displayName,
                email: profile.emails && profile.emails[0] ? profile.emails[0].value : null,
                socialId: profile.id,
                provider: 'facebook'
            });
            return done(null, newUser);
        }
        return done(null, existingUser);
    } catch (error) {
        console.error('Error handling Facebook login:', error);
        return done(error, null);
    }
}));


app.get('/auth/facebook', passport.authenticate('facebook', { scope: ['email'] }));

app.get('/auth/facebook/callback',
    passport.authenticate('facebook', { failureRedirect: '/login' }),
    (req, res) => {
        // On successful login, ensure userId is passed to the next page
        const userId = req.user.id;
        const username = req.user.username;
        res.redirect(`/profile.html?userId=${userId}&username=${username}`);
    }
);


// Initialize Sequelize with PostgreSQL
const { Sequelize, DataTypes, Op } = require('sequelize');

// Initialize Sequelize with SQLite
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './database.sqlite', // The file where the SQLite database will be stored
    logging: false // Disable SQL query logging
});

// Test the SQLite connection
sequelize.authenticate()
  .then(() => console.log('Connected to SQLite database successfully.'))
  .catch(err => console.error('Failed to connect to the database:', err));


// Create HTTP server and Socket.IO instance
const server = http.createServer(app);
const io = socketIo(server);

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true // Ensures uniqueness at the database level
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  fullPhoneNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true // Ensures that phone numbers are unique
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
    allowNull: true,
    defaultValue: false
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
  type: DataTypes.TEXT, // Store as plain text
  allowNull: true,
  get() {
    return this.getDataValue('interests') ? JSON.parse(this.getDataValue('interests')) : [];
  },
  set(val) {
    this.setDataValue('interests', JSON.stringify(val));
  },
},

  badges: {
    type: DataTypes.JSONB, // Store earned badges as a JSON object or array
    allowNull: true,
    defaultValue: [], // Example: ["FirstMatch", "IcebreakerPro"]
  },
  points: {
    type: DataTypes.INTEGER, // Total points earned
    allowNull: false,
    defaultValue: 0,
  },
  achievementsProgress: {
    type: DataTypes.JSONB, // Tracks progress toward specific badges or goals
    allowNull: true,
    defaultValue: {}, // Example: {"messagesSent": 5, "dailyLogins": 2}
  },
  leaderboardStats: {
    type: DataTypes.JSONB, // Optional, if leaderboards are implemented
    allowNull: true,
    defaultValue: {}, // Example: {"rank": 50, "weeklyPoints": 100}
  },
  instantDate: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
    messagesSent: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0, // Start at 0 for all users
  },
  availableToday: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
    travelMode: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false // Default value for travel mode
    },
    travelLocation: {
        type: DataTypes.STRING,
        allowNull: true // Optional column for temporary location
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
  latitude: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  longitude: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  language: {
    type: DataTypes.STRING,
    defaultValue: 'en'
   },
    otp: {
        type: DataTypes.STRING, // Store the reset code
        allowNull: true
   },
    otpExpiry: {
        type: DataTypes.DATE, // Store the expiration time
        allowNull: true
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
  },
  region: {
  type: DataTypes.STRING,
  allowNull: true
  },
  role: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'user'
  },
  casualDatingMode: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
	    hangoutMode: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false // Default to false
    },
    hookupMode: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false // Default to false
    },
  availableUntil: { // Add this field
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  indexes: [
    { fields: ['username'] }, // Improves queries filtering by username
    { fields: ['fullPhoneNumber'] } // Accelerates lookups for phone numbers
  ]
});

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
    allowNull: false,
    validate: {
      len: [1, 500] // Limit content length to avoid overly long messages
    }
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: Sequelize.NOW
  },
  read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  voiceNote: {
  type: DataTypes.STRING, // Path to uploaded file
  allowNull: true
  },
 
  favorite: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  deletedAt: {
    type: DataTypes.DATE, // Allows soft deletion
    allowNull: true
  }
}, {
  paranoid: true, // Enables Sequelize's soft delete functionality
  indexes: [
    { fields: ['fromUserId'] }, // Speeds up queries involving sender
    { fields: ['toUserId'] }, // Speeds up queries involving receiver
    { fields: ['fromUserId', 'toUserId'] } // Composite index for chat conversations
  ]
});

User.hasMany(Message, { as: 'SentMessages', foreignKey: 'fromUserId' });
User.hasMany(Message, { as: 'ReceivedMessages', foreignKey: 'toUserId' });
Message.belongsTo(User, { as: 'Sender', foreignKey: 'fromUserId' });
Message.belongsTo(User, { as: 'Receiver', foreignKey: 'toUserId' });



// Define the Post model
const Post = sequelize.define('Post', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id'
    },
    allowNull: false
  },
  image1: {
    type: DataTypes.STRING,
    allowNull: true
  },
  image2: {
    type: DataTypes.STRING,
    allowNull: true
  },
  caption: {
    type: DataTypes.TEXT,
    allowNull: true
  }
});

// Define the Comment model
const Comment = sequelize.define('Comment', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  postId: {
    type: DataTypes.INTEGER,
    references: {
      model: Post,
      key: 'id'
    },
    allowNull: false
  },
  userId: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id'
    },
    allowNull: false
  },
  parentCommentId: {
    type: DataTypes.INTEGER,
    allowNull: true // Null for top-level comments
  },
  text: {
    type: DataTypes.TEXT,
    allowNull: false
  }
});


// Define Comment associations
Comment.associate = (models) => {
  Comment.hasMany(models.Comment, {
    as: 'Replies',
    foreignKey: 'parentCommentId',
    onDelete: 'CASCADE'
  });

  Comment.belongsTo(models.Comment, {
    as: 'Parent',
    foreignKey: 'parentCommentId',
    onDelete: 'CASCADE'
  });

  Comment.belongsTo(models.Post, {
    foreignKey: 'postId',
    onDelete: 'CASCADE'
  });

  Comment.belongsTo(models.User, {
    foreignKey: 'userId',
    onDelete: 'CASCADE'
  });
};

module.exports = { Comment };


// Define the PostLike model
const PostLike = sequelize.define('PostLike', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  postId: {
    type: DataTypes.INTEGER,
    references: {
      model: Post,
      key: 'id'
    },
    allowNull: false
  },
  userId: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id'
    },
    allowNull: false
  }
});


// Define the PostDislike model
const PostDislike = sequelize.define('PostDislike', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  postId: {
    type: DataTypes.INTEGER,
    references: {
      model: Post,
      key: 'id'
    },
    allowNull: false
  },
  userId: {
    type: DataTypes.INTEGER,
    references: {
      model: User,
      key: 'id'
    },
    allowNull: false
  }
});

// Define associations between models
User.hasMany(Post, { foreignKey: 'userId', onDelete: 'CASCADE' });
Post.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE' });

Post.hasMany(Comment, { foreignKey: 'postId', onDelete: 'CASCADE' });
Comment.belongsTo(Post, { foreignKey: 'postId', onDelete: 'CASCADE' });

Comment.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE' });

Comment.hasMany(Comment, { as: 'Replies', foreignKey: 'parentCommentId', onDelete: 'CASCADE' });
Comment.belongsTo(Comment, { as: 'Parent', foreignKey: 'parentCommentId', onDelete: 'CASCADE' });

Post.hasMany(PostLike, { foreignKey: 'postId', as: 'PostLikes', onDelete: 'CASCADE' });
PostLike.belongsTo(Post, { foreignKey: 'postId', onDelete: 'CASCADE' });

Post.hasMany(PostDislike, { foreignKey: 'postId', as: 'PostDislikes', onDelete: 'CASCADE' });
PostDislike.belongsTo(Post, { foreignKey: 'postId', onDelete: 'CASCADE' });

PostLike.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE' });
PostDislike.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE' });


// Define the BlockedUser model
const BlockedUser = sequelize.define('BlockedUser', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  blockedUserId: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
});


// Sync the model with the database
BlockedUser.sync();


  // Define the Like model
const Like = sequelize.define('Like', {
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  likedUserId: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
});

const Dislike = sequelize.define('Dislike', {
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  dislikedUserId: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
});


const CallLog = sequelize.define('CallLog', {
  fromUserId: { type: DataTypes.INTEGER, allowNull: false },
  toUserId: { type: DataTypes.INTEGER, allowNull: false },
  type: { type: DataTypes.ENUM('voice', 'video'), allowNull: false },
  status: { type: DataTypes.ENUM('missed', 'received', 'declined', 'cancelled'), allowNull: false },
  startedAt: { type: DataTypes.DATE },
  endedAt: { type: DataTypes.DATE }
});

// Associations
CallLog.belongsTo(User, { as: 'Caller', foreignKey: 'fromUserId' });
CallLog.belongsTo(User, { as: 'Receiver', foreignKey: 'toUserId' });

  
  // Define the Notification model
const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  senderId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  message: {
    type: DataTypes.STRING,
    allowNull: false
  }
});


// User associations
User.hasMany(Notification, { foreignKey: 'userId' });
Notification.belongsTo(User, { foreignKey: 'userId', as: 'receiver' });
User.hasMany(Notification, { foreignKey: 'senderId' });
Notification.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });

User.hasMany(Like, { foreignKey: 'userId' });
User.hasMany(Dislike, { foreignKey: 'userId' });



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

app.use((req, res, next) => {
    console.log(`${req.method} request for ${req.url}`);
    next();
});


// Handle registration form submission
app.post('/register', async (req, res) => {
    const { username, password, countryCode, phone, location } = req.body;
    const fullPhoneNumber = `${countryCode}${phone}`;

    try {
        const existingUser = await User.findOne({ where: { fullPhoneNumber } });
        if (existingUser) {
            return res.status(400).send('Phone number is already used by another user.');
        }

        // Ensure we save location along with country code
        const user = await User.create({ username, password, fullPhoneNumber, countryCode, location });
        req.session.userId = user.id;

        res.redirect(`/profile-edit-step?userId=${user.id}`);
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/check-username', async (req, res) => {
    const { username } = req.body;
    try {
        const existing = await User.findOne({ where: { username } });
        res.json({
            success: !existing,
            message: existing ? 'Username already taken.' : 'Username is available.'
        });
    } catch (error) {
        console.error('Error checking username:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});

app.post('/check-phone', async (req, res) => {
  const { fullPhoneNumber } = req.body;
  try {
    const existingUser = await User.findOne({ where: { fullPhoneNumber } });
    if (existingUser) {
      return res.json({ success: false, message: 'Phone number is already registered.' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error checking phone number:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

const countryCodeMap = {
    "+265": "Malawi",
    "+263": "Zimbabwe",
    "+264": "Namibia",
    "+267": "Botswana",
    "+81": "Japan",
    "+260": "Zambia",
    "+254": "Kenya",
    "+256": "Uganda",
    "+1": "USA",
    "+44": "United Kingdom",
    "+27": "South Africa",
    "+234": "Nigeria",
    "+91": "India",
    "+20": "Egypt",
    "+213": "Algeria",
    "+216": "Tunisia",
    "+218": "Libya",
    "+249": "Sudan",
    "+212": "Morocco",
    "+973": "Bahrain",
    "+966": "Saudi Arabia",
    "+971": "United Arab Emirates",
    "+92": "Pakistan",
};


// ✅ API Route to Fetch Cities by Country
app.get('/get-cities/:countryCode', async (req, res) => {
    const countryCode = req.params.countryCode;
    const countryName = countryCodeMap[countryCode]; // Convert code to country name

    if (!countryName) {
        return res.status(400).json({ success: false, message: "Invalid country code." });
    }

    try {
        const query = `[out:json];area[name="${countryName}"]->.searchArea;(node[place="city"](area.searchArea););out;`;
        const response = await axios.get(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);

        const cities = response.data.elements.map(city => city.tags.name).filter(Boolean);
        res.json({ success: true, cities });
    } catch (error) {
        console.error('Error fetching cities:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch cities' });
    }
});

app.get('/get-regions/:countryCode', async (req, res) => {
    const countryCode = req.params.countryCode;
    const countryName = countryCodeMap[countryCode]; // Convert phone code to country name

    if (!countryName) {
        return res.status(400).json({ success: false, message: "Invalid country code." });
    }

    try {
        const query = `[out:json];area[name="${countryName}"]->.searchArea;
                      (relation[boundary=administrative][admin_level=4](area.searchArea);
                      );out;`;
        const response = await axios.get(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);

        const regions = response.data.elements.map(region => region.tags.name).filter(Boolean); // Extract region names

        res.json({ success: true, regions });
    } catch (error) {
        console.error('Error fetching regions:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch regions' });
    }
});

app.get('/get-user-country/:userId', async (req, res) => {
    const userId = req.params.userId;
    console.log("Fetching country code for user ID:", userId); // Debugging step

    try {
        const user = await User.findOne({ where: { id: userId } });
        console.log("User Data:", user); // Debugging step

        if (!user || !user.countryCode) {
            return res.json({ success: false, message: 'User not found or country code missing' });
        }

        res.json({ success: true, countryCode: user.countryCode });
    } catch (error) {
        console.error('Error fetching user country:', error);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
});


// Handle login form submission
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ where: { username, password } });
    if (user) {
      req.session.userId = user.id; // Save userId in session
      res.json({ success: true, userId: user.id });
    } else {
      res.json({ success: false, message: 'Invalid username or password.' });
    }
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});


// Route to handle password reset requests
app.post('/forgot-password', async (req, res) => {
    const { fullPhoneNumber } = req.body;

    if (!fullPhoneNumber) {
        return res.status(400).json({ success: false, message: 'Phone number is required.' });
    }

    try {
        // Find the user by phone number
        const user = await User.findOne({ where: { fullPhoneNumber } });
        if (!user) {
            return res.status(404).json({ success: false, message: 'Phone number not found.' });
        }

        // Generate a reset code
        const resetCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
        user.otp = resetCode;
        user.otpExpiry = Date.now() + 10 * 60 * 1000; // Code valid for 10 minutes
        await user.save();

        // Respond with the reset code (for now, display it directly)
        res.status(200).json({
            success: true,
            message: `Your reset code is: ${resetCode}. Please use it to reset your password.`
        });
    } catch (error) {
        console.error('Error in /forgot-password:', error);
        res.status(500).json({ success: false, message: 'Failed to process request.' });
    }
});

// Route to reset the password
app.post('/reset-password', async (req, res) => {
    const { resetCode, newPassword, confirmPassword } = req.body;

    if (!resetCode || !newPassword || !confirmPassword) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    if (newPassword !== confirmPassword) {
        return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }

    try {
        // Find user with a valid reset code and expiry time
        const user = await User.findOne({
            where: {
                otp: resetCode,
                otpExpiry: { [Op.gt]: Date.now() } // OTP must not be expired
            }
        });

        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or expired reset code.' });
        }

        // Update the user's password and clear the reset code
        user.password = newPassword; // Ideally, hash passwords for security
        user.otp = null;
        user.otpExpiry = null;
        await user.save();

        res.status(200).json({ success: true, message: 'Password reset successfully.' });
    } catch (error) {
        console.error('Error in /reset-password:', error);
        res.status(500).json({ success: false, message: 'Failed to reset password.' });
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
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});
app.get('/index', requireLogin, (req, res) => {
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

// Route to serve the login.html file
app.get('/login1', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login1.html'));
});

// Route to serve the profile.html file
app.get('/profile', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});
app.get('/profile-edit-step', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'profile-edit-step.html'));
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

// Route to serve the messages.html file
app.get('/notifications', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'notifications.html'));
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
// Route to serve the chat.html file
app.get('/searching-base', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'searching-base.html'));
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

app.get('/likes', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'likes.html'));
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

// Route to serve the location-base-match.html file
app.get('/location-matches', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'location-matches.html'));
});

// Route to serve the potential-matches.html file
app.get('/potential-matches', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'potential-matches.html'));
});

// Route to serve the fitness-buddies.html file
app.get('/fitness-buddies', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'fitness-buddies.html'));
});

// Route to serve the daily-discovery.html file
app.get('/daily-discovery', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'daily-discovery.html'));
});

// Route to serve the relationship-goals.html file
app.get('/chat-zone', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat-zone.html'));
});

app.get('/song', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'song.html'));
});
app.get('/travel', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'travel.html'));
});
app.get('/fire', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'fire.html'));
});
// Route to serve the chat-zone.html file
app.get('/relationship-goals', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'relationship-goals.html'));
});

app.get('/quick-matches', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'quick-matches.html'));
});

app.get('/settings', requireLogin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'settings.html'));
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

app.get('/logout', (req, res) => {
    if (!req.session) {
        console.error('Session not found!');
        return res.redirect('/login'); // Redirect if no session exists
    }
    req.session.destroy((err) => {
        if (err) {
            console.error('Error during session destruction:', err);
            return res.status(500).send('Internal Server Error');
        }
        res.clearCookie('connect.sid', { path: '/' });
        res.redirect('/login');
    });
});


// Handle profile update form submission
app.post('/profile', upload.single('profilePicture'), async (req, res) => {
  const { bio, interests, location, age, gender } = req.body;

  try {
    const user = await User.findByPk(req.session.userId); // Get user by session userId
    if (user) {
      user.bio = bio;
      user.interests = JSON.stringify(interests.split(', ')); // Save interests as JSON
      user.profilePicture = req.file.path; // Save the Cloudinary URL
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

app.get('/api/user/:id', requireLogin, async (req, res) => {
  const userId = req.params.id;
  try {
    const user = await User.findByPk(userId);
    if (user) {
      res.json({
        id: user.id,
        username: user.username,
        age: user.age,
        gender: user.gender,
        location: user.location,
        bio: user.bio,
        interests: JSON.parse(user.interests || "[]"),
        profilePicture: user.profilePicture
      });
    } else {
      res.status(404).send("User not found");
    }
  } catch (err) {
    console.error("Error fetching user profile:", err);
    res.status(500).send("Internal Server Error");
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

const Block = sequelize.define('Block', {
    blockerId: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    blockedUserId: {
        type: DataTypes.INTEGER,
        allowNull: false
    }
}, {
    timestamps: true
});

// Define associations
Block.belongsTo(User, { as: 'BlockedUser', foreignKey: 'blockedUserId' });
Block.belongsTo(User, { as: 'Blocker', foreignKey: 'blockerId' });

module.exports = Block;

// Route to get total unread messages count for the logged-in user
app.get('/api/unread-count', requireLogin, async (req, res) => {
    const userId = req.session.userId;

    try {
        const unreadCount = await Message.count({
            where: {
                toUserId: userId,
                read: false
            }
        });

        res.json({ unreadCount });
    } catch (error) {
        console.error('Error fetching unread count:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// --- Authenticated user endpoint ---
app.get('/api/me', requireLogin, async (req, res) => {
  try {
    const me = await User.findByPk(req.session.userId, {
      attributes: ['id', 'username', 'profilePicture', 'location'] // changed here
    });
    if (!me) return res.status(404).json({ error: 'User not found' });
    res.json(me);
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal server error');
  }
});

// --- Fetch peer info ---
app.get('/api/user/:id', requireLogin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: ['id', 'username', 'profilePicture', 'location'] // changed here
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).send('Internal server error');
  }
});

io.on('connection', (socket) => {
  const userId = socket.handshake.session?.userId;
  if (!userId) return;

  // Mark user online
  User.update({ online: true }, { where: { id: userId } });

  socket.on('disconnect', async () => {
    await User.update(
      { online: false, lastSeen: new Date() },
      { where: { id: userId } }
    );
  });
});
app.get('/api/user/:id/presence', requireLogin, async (req, res) => {
  const u = await User.findByPk(req.params.id, {
    attributes: ['online', 'lastSeen']
  });
  res.json(u);
});


// --- Get messages between me and peer ---
app.get('/api/messages', requireLogin, async (req, res) => {
  const userId = req.session.userId;
  const chatUserId = parseInt(req.query.chatUserId, 10);
  if (!chatUserId) return res.status(400).json({ error: 'chatUserId is required' });

  try {
    // Block check
    const isBlocked = await Block.findOne({
      where: {
        [Op.or]: [
          { blockerId: userId, blockedUserId: chatUserId },
          { blockerId: chatUserId, blockedUserId: userId }
        ]
      }
    });
    if (isBlocked) {
      return res.status(403).json({ error: 'Access denied. One of the users is blocked.' });
    }

    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { fromUserId: userId, toUserId: chatUserId },
          { fromUserId: chatUserId, toUserId: userId }
        ]
      },
      order: [['timestamp', 'ASC']],
      include: [{
        model: User,
        as: 'Sender',
        attributes: ['username', 'profilePicture']
      }]
    });

    const enriched = messages.map(m => ({
      id: m.id,
      fromUserId: m.fromUserId,
      toUserId: m.toUserId,
      content: m.content,
      timestamp: m.timestamp,
      senderName: m.Sender.username,
      senderProfilePicture: m.Sender.profilePicture
    }));

    res.json(enriched);
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).send('Internal server error');
  }
});

// --- Send message ---
app.post('/api/send-message', requireLogin, async (req, res) => {
  const fromUserId = req.session.userId;
  const { toUserId, content } = req.body;
  if (!toUserId || !content) return res.status(400).json({ error: 'Missing required fields' });

  try {
    // Block check
    const isBlocked = await Block.findOne({
      where: {
        [Op.or]: [
          { blockerId: fromUserId, blockedUserId: toUserId },
          { blockerId: toUserId, blockedUserId: fromUserId }
        ]
      }
    });
    if (isBlocked) {
      return res.status(403).json({ error: 'Message not allowed. One of the users is blocked.' });
    }

    const newMsg = await Message.create({
      fromUserId,
      toUserId,
      content,
      timestamp: new Date()
    });

    const sender = await User.findByPk(fromUserId, {
      attributes: ['username', 'profilePicture']
    });

    // Save notification
    await Notification.create({
      userId: toUserId,
      senderId: fromUserId,
      message: `${sender.username} sent you a message.`
    });

    res.status(201).json({
      id: newMsg.id,
      fromUserId,
      toUserId,
      content,
      timestamp: newMsg.timestamp,
      senderName: sender.username,
      senderProfilePicture: sender.profilePicture
    });
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).send('Internal server error');
  }
});

// Ensure multer already configured as `upload` for general file uploads
app.post('/api/send-file', requireLogin, upload.single('file'), async (req, res) => {
  try {
    const fileUrl = `/uploads/${req.file.filename}`;
    const msg = await Message.create({
      fromUserId: req.session.userId,
      toUserId: req.body.toUserId,
      content: '[File]', // placeholder to satisfy NOT NULL
      fileUrl,
      filename: req.file.originalname,
      timestamp: new Date()
    });
    res.json({
      id: msg.id,
      fromUserId: msg.fromUserId,
      toUserId: msg.toUserId,
      fileUrl,
      filename: req.file.originalname,
      timestamp: msg.timestamp
    });
  } catch (err) {
    console.error('Error sending file:', err);
    res.status(500).json({ error: 'Failed to send file' });
  }
});


// --- Voice message upload endpoint ---
app.post('/api/voice-message', requireLogin, upload.single('voiceNote'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No voice note uploaded' });

    const voiceUrl = `/uploads/${req.file.filename}`;
    const msg = await Message.create({
      fromUserId: req.session.userId,
      toUserId: req.body.toUserId,
      content: '[Voice]',
      voiceUrl,
      filename: req.file.originalname,
      timestamp: new Date()
    });

    res.json({
      id: msg.id,
      fromUserId: msg.fromUserId,
      toUserId: msg.toUserId,
      voiceUrl,
      filename: msg.filename,
      timestamp: msg.timestamp
    });
  } catch (err) {
    console.error('Error sending voice note:', err);
    res.status(500).json({ error: 'Failed to send voice note' });
  }
});


// GET /api/calls?withUserId=123
app.get('/api/calls', requireLogin, async (req, res) => {
  const userId = req.session.userId;
  const logs = await CallLog.findAll({
    where: {
      [Op.or]: [
        { fromUserId: userId },
        { toUserId: userId }
      ]
    },
    order: [['startedAt', 'DESC']],
    include: [
      { model: User, as: 'Caller', attributes: ['username'] },
      { model: User, as: 'Receiver', attributes: ['username'] }
    ]
  });

  const enriched = logs.map(log => ({
    ...log.toJSON(),
    fromUsername: log.Caller?.username,
    toUsername: log.Receiver?.username
  }));

  res.json(enriched);
});

io.on('connection', (socket) => {
  const userId = socket.handshake.session?.userId;
  if (!userId) return;

  // Mark user online
  User.update({ online: true }, { where: { id: userId } });

  socket.on('disconnect', async () => {
    await User.update({ online: false, lastSeen: new Date() }, { where: { id: userId } });
  });

  // Call offer


  // Call answer
socket.on('callOffer', async ({ to, offer, type }) => {
  const from = socket.handshake.session.userId;

  const log = await CallLog.create({
    fromUserId: from,
    toUserId: to,
    type,
    status: 'missed'
  });

  socket.callLogId = log.id;

  socket.join(from.toString());

  io.to(to.toString()).emit('callOffer', { from, offer, type });

  await Notification.create({
    userId: to,
    senderId: from,
    message: `Incoming ${type} call`
  });

  io.to(to.toString()).emit('newNotification', {
    senderId: from,
    message: `Incoming ${type} call`,
    type: 'call',
    timestamp: new Date()
  });

  setTimeout(async () => {
    const updated = await CallLog.findByPk(log.id);
    if (updated.status === 'missed') {
      io.to(from.toString()).emit('callMissed', { to });
      io.to(to.toString()).emit('callMissed', { from });
    }
  }, 30000);
});


  // End call
  socket.on('endCall', async ({ to }) => {
    await CallLog.update(
      { endedAt: new Date() },
      { where: { id: socket.callLogId } }
    );
    io.to(to.toString()).emit('endCall');
  });

  // Decline call
  socket.on('declineCall', async ({ to }) => {
    await CallLog.update(
      { status: 'declined' },
      { where: { id: socket.callLogId } }
    );
    io.to(to.toString()).emit('endCall');
  });
});


app.post('/api/send-image', requireLogin, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    const fileUrl = `/uploads/${req.file.filename}`;
    const msg = await Message.create({
      fromUserId: req.session.userId,
      toUserId: req.body.toUserId,
      content: '[Image]',
      fileUrl,
      filename: req.file.originalname,
      timestamp: new Date()
    });

    res.json({
      id: msg.id,
      fromUserId: msg.fromUserId,
      toUserId: msg.toUserId,
      fileUrl,
      filename: msg.filename,
      timestamp: msg.timestamp
    });
  } catch (err) {
    console.error('Error sending image:', err);
    res.status(500).json({ error: 'Failed to send image' });
  }
});

// Fetch the chat list for a user with filters and unread message count
app.get('/api/chat-list', requireLogin, async (req, res) => {
    const userId = req.session.userId;

    try {
        // Fetch blocked user IDs
        const blockedUsers = await Block.findAll({
            where: { blockerId: userId },
            attributes: ['blockedUserId']
        });
        const blockedUserIds = blockedUsers.map(block => block.blockedUserId);

        // Find all chats involving the user
        const messages = await Message.findAll({
            where: {
                [Op.or]: [{ fromUserId: userId }, { toUserId: userId }]
            },
            attributes: ['fromUserId', 'toUserId', 'content', 'createdAt', 'read'],
            order: [['createdAt', 'DESC']]
        });

        const chatUserIds = new Set();
        const unreadCounts = {};
        const lastMessageTimes = {};
        const lastMessages = {};

        messages.forEach(msg => {
            const otherUserId = msg.fromUserId === userId ? msg.toUserId : msg.fromUserId;

            if (blockedUserIds.includes(otherUserId)) return;

            chatUserIds.add(otherUserId);

            if (!msg.read && msg.toUserId === userId) {
                unreadCounts[otherUserId] = (unreadCounts[otherUserId] || 0) + 1;
            }

            lastMessageTimes[otherUserId] = lastMessageTimes[otherUserId]
                ? new Date(Math.max(new Date(lastMessageTimes[otherUserId]), new Date(msg.createdAt)))
                : msg.createdAt;

            lastMessages[otherUserId] = msg.content; // Fix: Ensuring last message is properly assigned
        });

        // Retrieve user details for each chat
        const chatUsers = await User.findAll({
            where: { id: Array.from(chatUserIds) },
            attributes: ['id', 'username', 'profilePicture']
        });

        res.json(chatUsers.map(user => ({
            id: user.id,
            username: user.username,
            profilePicture: user.profilePicture,
            unreadCount: unreadCounts[user.id] || 0,
            lastMessageTime: lastMessageTimes[user.id] ? new Date(lastMessageTimes[user.id]).toISOString() : null,
            lastMessage: lastMessages[user.id] || "" // Fix: Ensure lastMessage always has a value
        })));
    } catch (error) {
        console.error('Error fetching chat list:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.delete('/api/delete-chat', requireLogin, async (req, res) => {
    const userId = req.session.userId;
    const { chatUserId } = req.body;

    if (!chatUserId) {
        return res.status(400).json({ error: 'chatUserId is required' });
    }

    try {
        // Delete all messages between the two users
        await Message.destroy({
            where: {
                [Op.or]: [
                    { fromUserId: userId, toUserId: chatUserId },
                    { fromUserId: chatUserId, toUserId: userId }
                ]
            }
        });

        res.sendStatus(200); // Success
    } catch (error) {
        console.error('Error deleting chat:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/unread-count', requireLogin, async (req, res) => {
    const userId = req.session.userId;

    try {
        const unreadCount = await Message.count({
            where: {
                toUserId: userId,
                read: false
            }
        });

        res.json({ unreadCount });
    } catch (error) {
        console.error('Error fetching unread messages count:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Mark messages as read
app.post('/api/mark-as-read', async (req, res) => {
    const { userId, chatUserId } = req.body;

    try {
        // Update all unread messages for the user in the chat as read
        await Message.update(
            { read: true },
            {
                where: {
                    fromUserId: chatUserId,
                    toUserId: userId,
                    read: false // Only update unread messages
                }
            }
        );

        res.status(200).send({ success: true, message: 'Messages marked as read.' });
    } catch (error) {
        console.error('Error marking messages as read:', error);
        res.status(500).send({ success: false, error: 'Failed to mark messages as read.' });
    }
});


// Toggle favorite status
app.post('/api/toggle-favorite', requireLogin, async (req, res) => {
  const { chatUserId, isFavorite } = req.body;
  const userId = req.session.userId;

  try {
    const messages = await Message.findAll({
      where: {
        [Op.or]: [
          { fromUserId: userId, toUserId: chatUserId },
          { fromUserId: chatUserId, toUserId: userId }
        ]
      }
    });

    for (const message of messages) {
      message.favorite = isFavorite;
      await message.save();
    }

    res.send('Favorite status updated');
  } catch (error) {
    console.error('Error toggling favorite status:', error);
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

app.post('/api/update-hangout-mode', requireLogin, async (req, res) => {
    const userId = req.session.userId; // Assuming session contains the logged-in user ID
    const { hangoutMode } = req.body;

    if (typeof hangoutMode !== 'boolean') {
        return res.status(400).json({ error: 'Invalid parameter' });
    }

    try {
        await User.update({ hangoutMode }, { where: { id: userId } });
        res.status(200).json({ message: `Hangout mode ${hangoutMode ? 'enabled' : 'disabled'}` });
    } catch (error) {
        console.error('Error updating hangout mode:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
app.post('/api/update-hookup-mode', requireLogin, async (req, res) => {
    const userId = req.session.userId;
    const { hookupMode } = req.body;

    if (typeof hookupMode !== 'boolean') {
        return res.status(400).json({ error: 'Invalid parameter' });
    }

    try {
        await User.update({ hookupMode }, { where: { id: userId } });
        res.status(200).json({ message: `Hookup mode ${hookupMode ? 'enabled' : 'disabled'}` });
    } catch (error) {
        console.error('Error updating hookup mode:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/hangout-profiles', requireLogin, async (req, res) => {
    const userId = req.session.userId;

    try {
        const currentUser = await User.findByPk(userId, { attributes: ['gender'] });

        if (!currentUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const hangoutUsers = await User.findAll({
            where: {
                hangoutMode: true,
                gender: { [Op.ne]: currentUser.gender } // Filters by opposite gender
            },
            attributes: ['id', 'username', 'age', 'gender', 'bio', 'interests', 'location', 'profilePicture']
        });

        res.json(hangoutUsers);
    } catch (error) {
        console.error('Error fetching hangout profiles:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
app.get('/api/hookup-profiles', requireLogin, async (req, res) => {
    const userId = req.session.userId;

    try {
        const currentUser = await User.findByPk(userId, { attributes: ['gender'] });

        if (!currentUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const hookupUsers = await User.findAll({
            where: {
                hookupMode: true,
                gender: { [Op.ne]: currentUser.gender } // Filters by opposite gender
            },
            attributes: ['id', 'username', 'age', 'gender', 'bio', 'interests', 'location', 'profilePicture']
        });

        res.json(hookupUsers);
    } catch (error) {
        console.error('Error fetching hookup profiles:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/travel-matches', requireLogin, async (req, res) => {
    const userId = req.session.userId;

    try {
        const currentUser = await User.findByPk(userId, {
            attributes: ['travelMode', 'travelLocation', 'location']
        });

        if (!currentUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const location = currentUser.travelMode ? currentUser.travelLocation : currentUser.location;

        const travelMatches = await User.findAll({
            where: {
                location,
                id: { [Op.ne]: userId }
            },
            attributes: ['id', 'username', 'age', 'bio', 'profilePicture']
        });

        res.json(travelMatches);
    } catch (error) {
        console.error('Error fetching travel matches:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
app.get('/api/blocked-users', async (req, res) => {
    try {
        console.log('User ID:', req.userId); // Debugging log
        if (!req.userId) {
            return res.status(400).json({ error: 'User ID is missing in request' });
        }

        const blockedUsers = await Block.findAll({
            where: { blockerId: req.userId },
            include: {
                model: User,
                as: 'BlockedUser',
                attributes: ['id', 'username', 'profilePicture']
            }
        });

        res.json(blockedUsers.map(block => block.BlockedUser));
    } catch (error) {
        console.error('Error fetching blocked users:', error);
        res.status(500).send({ error: 'Failed to fetch blocked users.' });
    }
});

app.post('/api/unblock-user', async (req, res) => {
    try {
        const { blockedUserId } = req.body;
        await Block.destroy({
            where: { blockerId: req.userId, blockedUserId }
        });

        res.status(200).send({ message: 'User unblocked successfully.' });
    } catch (error) {
        console.error('Error unblocking user:', error);
        res.status(500).send({ error: 'Failed to unblock user.' });
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

app.get('/api/notifications', async (req, res) => {
  const userId = req.session.userId;
  try {
    const notifications = await Notification.findAll({
      where: { userId },
      include: [{ model: User, as: 'sender', attributes: ['username'] }],
      order: [['createdAt', 'DESC']]
    });
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


// Accept Mood Match Request
app.post('/api/accept-mood-match', async (req, res) => {
  const { userId } = req.body;
  const fromUserId = req.session.userId;

  try {
    // Notify the user who sent the request
    const senderUser = await User.findByPk(fromUserId);
    const senderName = senderUser ? senderUser.username : 'Unknown User';
    const message = `${senderName} accepted your request. Tap to start chatting.`;

    await Notification.create({ userId, senderId: fromUserId, message });

    res.status(200).send('Mood match request accepted!');
  } catch (error) {
    console.error('Error accepting mood match request:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Send a mood match request
app.post('/api/send-mood-match-request', async (req, res) => {
  const { userId, mood } = req.body;
  const fromUserId = req.session.userId;

  try {
    // Create mood match request notification
    const senderUser = await User.findByPk(fromUserId);
    const senderName = senderUser ? senderUser.username : 'Unknown User';
    const message = `${senderName} sent a mood match request. Tap to accept the request.`;

    await Notification.create({ userId, senderId: fromUserId, message });

    // Create messages for sender and receiver
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
    // Create a fitness goals match request notification
    const senderUser = await User.findByPk(fromUserId);
    const senderName = senderUser ? senderUser.username : 'Unknown User';
    const message = `${senderName} sent a fitness goals match request. Their fitness goals are: ${fitnessGoals}. Tap to accept the request.`;

    await Notification.create({ userId, senderId: fromUserId, message });

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
    // Create a relationship goals match request notification
    const senderUser = await User.findByPk(fromUserId);
    const senderName = senderUser ? senderUser.username : 'Unknown User';
    const message = `${senderName} sent a relationship goals match request. Tap to accept the request.`;

    await Notification.create({ userId, senderId: fromUserId, message });

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


io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('joinQuickMatch', () => {
        onlineUsers.set(socket.id, { socket: socket });

        if (waitingUsers.length > 0) {
            const partnerSocketId = waitingUsers.shift();
            const partnerSocket = onlineUsers.get(partnerSocketId).socket;

            onlineUsers.get(socket.id).partnerSocketId = partnerSocketId;
            onlineUsers.get(partnerSocketId).partnerSocketId = socket.id;

            socket.emit('paired', { partnerSocketId });
            partnerSocket.emit('paired', { partnerSocketId: socket.id });

            // Start 3-minute timer
            startSpeedDateTimer(socket, partnerSocket);
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
        socket.emit('joinQuickMatch');
    });

    socket.on('initiateCall', ({ userId, calleeId }) => {
        const calleeSocketId = onlineUsers.get(calleeId)?.socket;
        if (calleeSocketId) {
            io.to(calleeSocketId).emit('callOffer', { callerId: userId });
        }
    });

    socket.on('signal', ({ partnerSocketId, candidate }) => {
        io.to(partnerSocketId).emit('signal', { candidate });
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

function startSpeedDateTimer(userSocket, partnerSocket) {
    let timeLeft = 180; // 3 minutes in seconds
    const timer = setInterval(() => {
        if (timeLeft <= 0) {
            clearInterval(timer);
            userSocket.emit('timeUp');
            partnerSocket.emit('timeUp');
        } else {
            userSocket.emit('timer', { timeLeft });
            partnerSocket.emit('timer', { timeLeft });
            timeLeft--;
        }
    }, 1000);
}

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


// In-memory storage for game sessions and responses
let gameSessions = [];
let responses = [];

// Create a new game session
app.post('/api/create-game', (req, res) => {
    const { userId, truths, lie, password } = req.body;
    const sessionId = gameSessions.length + 1;
    const correctAnswer = truths.indexOf(lie);
    gameSessions.push({ sessionId, userId, truths, lie, correctAnswer, password, guesses: [] });
    res.json({ sessionId });
});

// List all game sessions
app.get('/api/list-games', (req, res) => {
    res.json(gameSessions);
});

// Fetch a game session
app.get('/api/game-session/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = gameSessions.find(s => s.sessionId === parseInt(sessionId));
    if (session) {
        res.json(session);
    } else {
        res.status(404).json({ error: 'Game session not found' });
    }
});

// Submit a guess
app.post('/api/submit-guess', (req, res) => {
    const { sessionId, userId, guess } = req.body;
    const session = gameSessions.find(s => s.sessionId === parseInt(sessionId));
    if (session) {
        session.guesses.push({ userId, guess });
        res.json({ success: true });
    } else {
        res.status(404).json({ error: 'Game session not found' });
    }
});

// Fetch guesses for a game session
app.get('/api/game-session/:sessionId/guesses', (req, res) => {
    const { sessionId } = req.params;
    const session = gameSessions.find(s => s.sessionId === parseInt(sessionId));
    if (session) {
        res.json(session.guesses);
    } else {
        res.status(404).json({ error: 'Game session not found' });
    }
});

// Fetch responses (guesses) for a user
app.post('/api/fetch-responses', (req, res) => {
    const { userId } = req.body;
    const userResponses = gameSessions.reduce((acc, session) => {
        const userGuesses = session.guesses.filter(guess => guess.userId === parseInt(userId));
        if (userGuesses.length > 0) {
            userGuesses.forEach(guess => acc.push({
                sessionId: session.sessionId,
                guess: guess.guess
            }));
        }
        return acc;
    }, []);
    if (userResponses.length > 0) {
        res.json({ success: true, responses: userResponses });
    } else {
        res.json({ success: false, message: 'No responses found for this user ID' });
    }
});

// Fetch response messages
app.get('/api/response-messages', (req, res) => {
    const { userId } = req.query;
    const userResponses = responses.filter(response => response.toUserId == userId || response.fromUserId == userId);
    res.json(userResponses);
});

// Add a response
app.post('/api/add-response', (req, res) => {
    const { fromUserId, toUserId, message } = req.body;
    responses.push({ fromUserId, toUserId, message });
    res.json({ success: true });
});

// Example of in-memory storage for users free to hangout
let freeToHangoutUsers = [];

// API endpoint to get users free to hangout based on gender
app.get('/api/freetohangout-users', (req, res) => {
  const { gender } = req.query;
  const filteredUsers = freeToHangoutUsers.filter(user => user.gender.toLowerCase() === gender.toLowerCase());
  res.json(filteredUsers);
});

// Example of endpoint to add a user to free to hangout list
app.post('/api/freetohangout-users', (req, res) => {
  const { userId, username, profilePicture, age, gender, bio, interests } = req.body;
  freeToHangoutUsers.push({ id: userId, username, profilePicture, age, gender, bio, interests });
  res.json({ success: true });
});

// Example of endpoint to get user details
app.get('/api/user/:userId', (req, res) => {
  const { userId } = req.params;
  const user = freeToHangoutUsers.find(user => user.id === parseInt(userId));
  res.json(user);
});

// Route to get posts created by the logged-in user
app.get('/api/get-user-posts', async (req, res) => {
  try {
    const { userId } = req.session; // Ensure the userId is in the session
    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated.' });
    }

  const posts = await Post.findAll({
  where: { userId },
  include: [
    { model: User, attributes: ['username'] },
    { model: Comment, include: [User] },
    { model: PostLike, as: 'PostLikes' }, // Alias matches the association
    { model: PostDislike, as: 'PostDislikes' } // Alias matches the association
  ],
  order: [['createdAt', 'DESC']]
});

    const formattedPosts = posts.map(post => ({
      id: post.id,
      userId: post.userId,
      image1: post.image1,
      image2: post.image2,
      caption: post.caption,
      username: post.User.username,
      likes: post.PostLikes.length,
      dislikes: post.PostDislikes.length,
      comments: post.Comments.map(comment => ({
        id: comment.id,
        text: comment.text,
        username: comment.User.username
      }))
    }));

    res.json(formattedPosts);
  } catch (error) {
    console.error('Error fetching user posts:', error);
    res.status(500).json({ success: false, error: 'Error fetching user posts' });
  }
});


// Route to get all public posts
app.get('/api/get-public-posts', async (req, res) => {
  try {
    const posts = await Post.findAll({
      include: [
        { model: User, attributes: ['username'] },
        { model: Comment, include: [User] },
        { model: PostLike, as: 'PostLikes' }, // Include with alias
        { model: PostDislike, as: 'PostDislikes' } // Include with alias
      ],
      order: [['createdAt', 'DESC']] // Order by newest first
    });

    const formattedPosts = posts.map(post => ({
      id: post.id,
      userId: post.userId,
      image1: post.image1,
      image2: post.image2,
      caption: post.caption,
      username: post.User.username,
      likes: post.PostLikes.length,
      dislikes: post.PostDislikes.length,
      comments: post.Comments.map(comment => ({
        id: comment.id,
        text: comment.text,
        username: comment.User.username
      }))
    }));

    res.json(formattedPosts);
  } catch (error) {
    console.error('Error fetching public posts:', error);
    res.status(500).json({ success: false, error: 'Error fetching public posts' });
  }
});



// Route to like a post
app.post('/api/like-post/:postId', async (req, res) => {
  try {
    const { userId } = req.session; // Logged-in user ID
    const { postId } = req.params;

    const existingLike = await PostLike.findOne({ where: { userId, postId } });
    const existingDislike = await PostDislike.findOne({ where: { userId, postId } });

    if (existingLike) {
      // Remove like if it exists
      await existingLike.destroy();
      return res.json({ message: 'Like removed.' });
    }

    if (existingDislike) {
      // Remove dislike if it exists
      await existingDislike.destroy();
    }

    // Add new like
    await PostLike.create({ userId, postId });
    res.json({ message: 'Post liked.' });
  } catch (error) {
    console.error('Error liking post:', error);
    res.status(500).json({ error: 'Error liking post' });
  }
});

// Route to dislike a post
app.post('/api/dislike-post/:postId', async (req, res) => {
  try {
    const { userId } = req.session; // Logged-in user ID
    const { postId } = req.params;

    const existingDislike = await PostDislike.findOne({ where: { userId, postId } });
    const existingLike = await PostLike.findOne({ where: { userId, postId } });

    if (existingDislike) {
      // Remove dislike if it exists
      await existingDislike.destroy();
      return res.json({ message: 'Dislike removed.' });
    }

    if (existingLike) {
      // Remove like if it exists
      await existingLike.destroy();
    }

    // Add new dislike
    await PostDislike.create({ userId, postId });
    res.json({ message: 'Post disliked.' });
  } catch (error) {
    console.error('Error disliking post:', error);
    res.status(500).json({ error: 'Error disliking post' });
  }
});

// Route to comment on a post
app.post('/api/comment-post/:postId', async (req, res) => {
  try {
    const { userId } = req.session;
    const { postId } = req.params;
    const { comment } = req.body;

    const newComment = await Comment.create({ postId, userId, text: comment });
    res.json({ success: true, comment: newComment });
  } catch (error) {
    console.error('Error posting comment:', error);
    res.status(500).json({ success: false, error: 'Error posting comment' });
  }
});

app.post('/api/reply-comment/:commentId', async (req, res) => {
  try {
    const { userId } = req.session;
    const { commentId } = req.params;
    const { comment } = req.body;

    const parentComment = await Comment.findByPk(commentId);
    if (!parentComment) {
      return res.status(404).json({ success: false, error: 'Parent comment not found' });
    }

    const newReply = await Comment.create({
      postId: parentComment.postId,
      userId,
      parentCommentId: commentId,
      text: comment
    });

    res.json({ success: true, reply: newReply });
  } catch (error) {
    console.error('Error posting reply:', error);
    res.status(500).json({ success: false, error: 'Error posting reply' });
  }
});

// Route to delete a post
app.delete('/api/delete-post/:postId', async (req, res) => {
  try {
    const { userId } = req.session; // Assume userId is stored in session
    const { postId } = req.params;

    const post = await Post.findByPk(postId);
    if (post.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    await post.destroy();
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting post:', error);
    res.status(500).json({ success: false, error: 'Error deleting post' });
  }
});

// Route to create a post
app.post('/api/create-post', upload.fields([{ name: 'image1' }, { name: 'image2' }]), async (req, res) => {
  try {
    const { userId } = req.session; // Ensure the userId is in the session
    const { caption } = req.body;

    // Ensure image paths are stored as relative URLs
    const image1 = req.files['image1'] ? `/uploads/${req.files['image1'][0].filename}` : null;
    const image2 = req.files['image2'] ? `/uploads/${req.files['image2'][0].filename}` : null;

    const newPost = await Post.create({ userId, image1, image2, caption });
    res.json({ success: true, post: newPost });
  } catch (error) {
    console.error('Error creating post:', error);
    res.status(500).json({ success: false, error: 'Error creating post' });
  }
});

app.get('/api/get-comments/:postId', async (req, res) => {
  try {
    const { postId } = req.params;
    const comments = await Comment.findAll({
      where: { postId },
      include: [{ model: User, attributes: ['username'] }],
      order: [['createdAt', 'DESC']]
    });

    const formattedComments = comments.map(comment => ({
      id: comment.id,
      text: comment.text,
      username: comment.User.username,
      createdAt: comment.createdAt
    }));
    res.json(formattedComments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ success: false, error: 'Error fetching comments' });
  }
});
// Recent Posts
app.get('/api/posts/recent', async (req, res) => {
  try {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const posts = await Post.findAll({
      where: { createdAt: { [Op.gte]: twoWeeksAgo } },
      include: [
        { model: User, attributes: ['username'] },
        { model: PostLike },
        { model: PostDislike }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(posts);
  } catch (error) {
    console.error('Error fetching recent posts:', error);
    res.status(500).json({ error: 'Error fetching recent posts' });
  }
});

// Old Posts
app.get('/api/posts/old', async (req, res) => {
  try {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const posts = await Post.findAll({
      where: { createdAt: { [Op.lt]: twoWeeksAgo } },
      include: [
        { model: User, attributes: ['username'] },
        { model: PostLike },
        { model: PostDislike }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json(posts);
  } catch (error) {
    console.error('Error fetching old posts:', error);
    res.status(500).json({ error: 'Error fetching old posts' });
  }
});

// Popular Posts
app.get('/api/posts/popular', async (req, res) => {
  try {
    const posts = await Post.findAll({
      include: [
        { model: User, attributes: ['username'] },
        { model: PostLike }
      ],
      attributes: {
        include: [
          [sequelize.fn('COUNT', sequelize.col('PostLikes.id')), 'likeCount']
        ]
      },
      group: ['Post.id'],
      having: sequelize.where(sequelize.fn('COUNT', sequelize.col('PostLikes.id')), '>', 50),
      order: [[sequelize.literal('likeCount'), 'DESC']]
    });

    res.json(posts);
  } catch (error) {
    console.error('Error fetching popular posts:', error);
    res.status(500).json({ error: 'Error fetching popular posts' });
  }
});

// Define AMA models with associations properly

const AMAProfile = sequelize.define("AMAProfile", {
    userId: { type: DataTypes.INTEGER, allowNull: false },
    visibility: { type: DataTypes.ENUM("public", "matches_only", "private"), defaultValue: "public" }
});

const AMAQuestion = sequelize.define("AMAQuestion", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.INTEGER, references: { model: User, key: 'id' }, allowNull: false },
    question: { type: DataTypes.TEXT, allowNull: false }
});

const AMAAnswer = sequelize.define("AMAAnswer", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    questionId: { type: DataTypes.INTEGER, references: { model: AMAQuestion, key: 'id' }, allowNull: false },
    userId: { type: DataTypes.INTEGER, references: { model: User, key: 'id' }, allowNull: false },
    answer: { type: DataTypes.TEXT, allowNull: false }
});

const AMAReaction = sequelize.define("AMAReaction", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    answerId: { type: DataTypes.INTEGER, references: { model: AMAAnswer, key: 'id' }, allowNull: false },
    userId: { type: DataTypes.INTEGER, references: { model: User, key: 'id' }, allowNull: false },
    reaction: { type: DataTypes.ENUM("like", "love", "funny") }
});

// Define associations similar to post system
User.hasMany(AMAQuestion, { foreignKey: 'userId', onDelete: 'CASCADE' });
AMAQuestion.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE' });

AMAQuestion.hasMany(AMAAnswer, { foreignKey: 'questionId', onDelete: 'CASCADE' });
AMAAnswer.belongsTo(AMAQuestion, { foreignKey: 'questionId', onDelete: 'CASCADE' });

AMAAnswer.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE' });

AMAAnswer.hasMany(AMAReaction, { foreignKey: 'answerId', onDelete: 'CASCADE' });
AMAReaction.belongsTo(AMAAnswer, { foreignKey: 'answerId', onDelete: 'CASCADE' });

AMAReaction.belongsTo(User, { foreignKey: 'userId', onDelete: 'CASCADE' });


// ✅ Route to create AMA question
app.post("/api/ama-question", async (req, res) => {
    const { userId, question } = req.body;

    if (!userId || !question.trim()) {
        return res.status(400).json({ error: "Invalid data received." });
    }

    try {
        const newQuestion = await AMAQuestion.create({ userId, question });
        res.json({ success: true, message: "AMA Question posted!", question: newQuestion });
    } catch (error) {
        console.error("Error posting AMA question:", error);
        res.status(500).json({ error: "Error posting AMA question." });
    }
});

// ✅ Route to fetch AMA questions created by logged-in user
app.get("/api/get-user-ama", async (req, res) => {
    try {
        const { userId } = req.session;

        if (!userId) {
            return res.status(401).json({ success: false, error: "User not authenticated." });
        }

        const questions = await AMAQuestion.findAll({
            where: { userId },
            include: [{ model: User, attributes: ["username"] }],
            order: [["createdAt", "DESC"]]
        });

        res.json(questions);
    } catch (error) {
        console.error("Error fetching user AMA questions:", error);
        res.status(500).json({ success: false, error: "Error fetching user AMA questions." });
    }
});

// ✅ Route to fetch all public AMA questions
app.get("/api/get-public-ama", async (req, res) => {
    try {
        const questions = await AMAQuestion.findAll({
            include: [{ model: User, attributes: ["username"] }],
            order: [["createdAt", "DESC"]]
        });

        res.json(questions);
    } catch (error) {
        console.error("Error fetching public AMA questions:", error);
        res.status(500).json({ success: false, error: "Error fetching public AMA questions." });
    }
});

// ✅ Route to submit AMA answers
app.post("/api/ama-answers", async (req, res) => {
    const { questionId, userId, answer } = req.body;

    try {
        await AMAAnswer.create({ questionId, userId, answer });
        res.json({ success: true, message: "Answer submitted!" });
    } catch (error) {
        console.error("Error submitting AMA answer:", error);
        res.status(500).json({ error: "Error submitting AMA answer." });
    }
});

// ✅ Route to react to AMA answers
app.post("/api/ama-reactions", async (req, res) => {
    const { answerId, userId, reaction } = req.body;

    try {
        await AMAReaction.create({ answerId, userId, reaction });
        res.json({ success: true, message: "Reaction added!" });
    } catch (error) {
        console.error("Error adding AMA reaction:", error);
        res.status(500).json({ error: "Error adding reaction." });
    }
});

// ✅ Route to delete AMA question
app.delete("/api/delete-ama/:questionId", async (req, res) => {
    try {
        const { userId } = req.session;
        const { questionId } = req.params;

        const question = await AMAQuestion.findByPk(questionId);
        if (!question || question.userId !== userId) {
            return res.status(403).json({ success: false, error: "Unauthorized or not found." });
        }

        await question.destroy();
        res.json({ success: true });
    } catch (error) {
        console.error("Error deleting AMA question:", error);
        res.status(500).json({ success: false, error: "Error deleting AMA question." });
    }
});



app.get('/api/nearby-users', async (req, res) => {
  try {
    const users = await User.findAll();
    res.json(users);
  } catch (error) {
    console.error('Error fetching nearby users:', error);
    res.status(500).send('Internal Server Error');
  }
});


// Like a user
app.post('/api/like', requireLogin, async (req, res) => {
  const { userId } = req.body;
  try {
    await Like.create({ userId: req.session.userId, likedUserId: userId });
    const likedUser = await User.findByPk(userId);
    const username = likedUser ? likedUser.username : 'Unknown User';
    const message = `${req.session.username} liked your profile.`;
    await Notification.create({ userId, senderId: req.session.userId, message });
    res.send('Liked');
  } catch (error) {
    console.error('Error liking user:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Dislike a user
app.post('/api/dislike', requireLogin, async (req, res) => {
  const { userId } = req.body;
  try {
    await Dislike.create({ userId: req.session.userId, dislikedUserId: userId });
    const dislikedUser = await User.findByPk(userId);
    const username = dislikedUser ? dislikedUser.username : 'Unknown User';
    const message = `${req.session.username} disliked your profile.`;
    await Notification.create({ userId, senderId: req.session.userId, message });
    res.send('Disliked');
  } catch (error) {
    console.error('Error disliking user:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Fetch likes and dislikes notifications
  app.get('/api/likes-dislikes', requireLogin, async (req, res) => {
    try {
      const totalLikes = await Like.count({ where: { likedUserId: req.session.userId } });
      const totalDislikes = await Dislike.count({ where: { dislikedUserId: req.session.userId } });
      const notifications = await Notification.findAll({ 
        where: { userId: req.session.userId }, 
        include: [{ model: User, as: 'sender', attributes: ['username'] }],
        order: [['createdAt', 'DESC']] 
      });
  
      res.json({
        totalLikes,
        totalDislikes,
        notifications: notifications.map(notification => ({
          message: notification.message,
          senderId: notification.senderId,
          senderUsername: notification.sender.username
        }))
      });
    } catch (error) {
      console.error('Error fetching likes and dislikes:', error);
      res.status(500).send('Internal Server Error');
    }
  });
  
// In-memory data storage for simplicity
let users = [
    { id: 1, username: 'User1', age: 25, gender: 'Male', bio: 'Bio1', interests: 'Music, Sports', location: 'Blantyre', profilePicture: 'path/to/image1.jpg' },
    { id: 2, username: 'User2', age: 30, gender: 'Female', bio: 'Bio2', interests: 'Travel, Reading', location: 'Lilongwe', profilePicture: 'path/to/image2.jpg' },
    // Add more users as needed
];

// Fetch users based on location
app.get('/api/location-matches', (req, res) => {
    const { userId } = req.query;
    const currentUser = users.find(user => user.id === parseInt(userId));

    if (!currentUser) {
        return res.status(404).json({ error: 'User not found' });
    }

    const locationMatches = users.filter(user => user.location === currentUser.location && user.id !== currentUser.id);
    res.json(locationMatches);
});


// Endpoint to send a voice note
app.post('/api/send-voice-note', upload.single('audio'), async (req, res) => {
    const { toUserId } = req.body;
    const fromUserId = req.session.userId; // Assume userId is stored in session
    const filePath = req.file.path;

    try {
        const newMessage = await Message.create({
            fromUserId,
            toUserId,
            content: filePath,
            messageType: 'voice'
        });
        res.status(201).json(newMessage);
    } catch (error) {
        console.error('Error sending voice note:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Fetch user profiles based on different interests and opposite genders
app.get('/api/profiles-users', requireLogin, async (req, res) => {
  const userId = req.session.userId;

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).send('User not found');
    }

    const oppositeGender = user.gender === 'male' ? 'female' : 'male';

    const profiles = await User.findAll({
      attributes: ['id', 'username', 'profilePicture', 'age', 'location', 'interests'],
      where: {
        gender: oppositeGender,
        id: {
          [Op.ne]: userId
        },
        interests: {
          [Op.notIn]: user.interests ? JSON.parse(user.interests) : []
        }
      }
    });

    res.json(profiles);
  } catch (error) {
    console.error('Error fetching user profiles:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Fetch user profiles based on location
app.get('/api/location-matches', requireLogin, async (req, res) => {
  const userId = req.session.userId;

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).send('User not found');
    }

    const matches = await User.findAll({
      attributes: [
        'id', 'username', 'profilePicture', 'age', 'gender', 'location', 'bio', 'interests',
        [sequelize.literal(`(6371 * acos(cos(radians(${user.latitude})) * cos(radians(latitude)) * cos(radians(longitude) - radians(${user.longitude})) + sin(radians(${user.latitude})) * sin(radians(latitude))))`), 'distance']
      ],
      where: {
        gender: user.gender === 'male' ? 'female' : 'male',
        interests: {
          [Op.notIn]: user.interests
        },
        id: {
          [Op.ne]: userId
        }
      },
      order: sequelize.col('distance')
    });

    res.json(matches);
  } catch (error) {
    console.error('Error fetching location matches:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Fetch nearby users
app.get('/api/find-nearby-users', async (req, res) => {
  const userId = req.session.userId;
  const distance = parseFloat(req.query.distance);
  const ageRange = req.query.ageRange.split('-').map(Number);

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).send('User not found');
    }

    const nearbyUsers = await User.findAll({
      attributes: [
        'id', 'username', 'profilePicture', 'age', 'latitude', 'longitude',
        [sequelize.literal(`(6371 * acos(cos(radians(${user.latitude})) * cos(radians(latitude)) * cos(radians(longitude) - radians(${user.longitude})) + sin(radians(${user.latitude})) * sin(radians(latitude))))`), 'distance']
      ],
      where: {
        age: {
          [Op.between]: ageRange
        },
        [Op.and]: [
          sequelize.literal(`(6371 * acos(cos(radians(${user.latitude})) * cos(radians(latitude)) * cos(radians(longitude) - radians(${user.longitude})) + sin(radians(${user.latitude})) * sin(radians(latitude)))) <= ${distance}`)
        ],
        id: {
          [Op.ne]: userId
        }
      },
      order: sequelize.col('distance')
    });

    res.json(nearbyUsers);
  } catch (error) {
    console.error('Error fetching nearby users:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Fetch nearby users of the opposite gender
app.get('/api/nearby-users', requireLogin, async (req, res) => {
  const userId = req.session.userId;
  const { latitude, longitude } = req.query;

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).send('User not found');
    }

    const oppositeGender = user.gender === 'male' ? 'female' : 'male';

    const nearbyUsers = await User.findAll({
      attributes: [
        'id', 'username', 'profilePicture', 'age', 'gender', 'location', 'bio', 'interests',
        [sequelize.literal(`(6371 * acos(cos(radians(${latitude})) * cos(radians(latitude)) * cos(radians(longitude) - radians(${longitude})) + sin(radians(${latitude})) * sin(radians(latitude))))`), 'distance']
      ],
      where: {
        gender: oppositeGender,
        id: {
          [Op.ne]: userId
        },
        [Op.and]: [
          sequelize.literal(`(6371 * acos(cos(radians(${latitude})) * cos(radians(latitude)) * cos(radians(longitude) - radians(${longitude})) + sin(radians(${latitude})) * sin(radians(latitude)))) <= 50`) // Within 50 km radius
        ]
      },
      order: sequelize.col('distance')
    });

    res.json(nearbyUsers);
  } catch (error) {
    console.error('Error fetching nearby users:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Fetch matches
app.get('/api/matches', async (req, res) => {
  const userId = req.session.userId;
  const user = await User.findByPk(userId);
  if (user) {
    const userInterests = JSON.parse(user.interests) || [];
    const interestConditions = userInterests.map(interest => ({
      interests: { [Sequelize.Op.like]: `%${interest}%` }
    }));

    const matches = await User.findAll({
      where: {
        id: { [Sequelize.Op.ne]: userId },
        [Sequelize.Op.or]: interestConditions,
        age: {
          [Sequelize.Op.between]: [user.age - 2, user.age + 2]
        }
      }
    });
    res.json(matches);
  } else {
    res.status(404).send('User not found.');
  }
});

// Route to get random users
app.get('/api/get-random-users', async (req, res) => {
  try {
    const { userId } = req.session;
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const genderPreference = user.gender === 'male' ? 'female' : 'male';
    const randomUsers = await User.findAll({
      where: {
        gender: genderPreference,
        id: { [Sequelize.Op.ne]: userId }
      },
      limit: 20,
      order: Sequelize.literal('random()')
    });

    res.json(randomUsers);
  } catch (error) {
    console.error('Error fetching random users:', error);
    res.status(500).json({ success: false, error: 'Error fetching random users' });
  }
});

// Endpoint for Time-Limited Matches
app.get('/time-limited-matches', async (req, res) => {
  try {
    const { userId } = req.session; // Retrieve logged-in user ID from the session
    const user = await User.findByPk(userId, { attributes: ['id', 'gender'] });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const oppositeGender = user.gender === 'male' ? 'female' : 'male';
    const now = new Date();

    // Find users with opposite gender and availability
    const matches = await User.findAll({
      where: {
        id: { [Op.ne]: userId }, // Exclude the logged-in user
        gender: oppositeGender,
        availableUntil: { [Op.gt]: now } // Only fetch users available in the future
      },
      attributes: ['id', 'username', 'age', 'bio', 'profilePicture', 'availableUntil']
    });

    // Format matches and calculate time remaining for availability
    const formattedMatches = matches.map(match => {
      const timeRemaining = Math.max(0, new Date(match.availableUntil) - now);
      return {
        ...match.toJSON(),
        timeRemaining: Math.floor(timeRemaining / 60000) // Convert milliseconds to minutes
      };
    });

    res.json(formattedMatches); // Send the matches to the frontend
  } catch (error) {
    console.error('Error fetching time-limited matches:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});


// Endpoint to set availability (availableUntil)
app.post('/set-availability', async (req, res) => {
  try {
    const { userId } = req.session; // Retrieve logged-in user's ID from the session
    const { hours } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not logged in' });
    }

    if (!hours || hours <= 0 || hours > 24) {
      return res.status(400).json({ success: false, message: 'Invalid hours provided' });
    }

    // Calculate availability end time
    const availableUntil = new Date(Date.now() + hours * 60 * 60 * 1000); // Current time + specified hours

    // Update the user's availability in the database
    await User.update(
      { availableUntil },
      { where: { id: userId } }
    );

    res.json({ success: true, message: 'Availability set successfully' });
  } catch (error) {
    console.error('Error setting availability:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

app.get('/api/matches-base', async (req, res) => {
  const userId = req.session.userId;

  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).send('User not found');
    }

    const oppositeGender = user.gender === 'male' ? 'female' : 'male'; // Determine opposite gender

    // Fetch users of the opposite gender
    const matches = await User.findAll({
      attributes: [
        'id',
        'username',
        'profilePicture',
        'age',
        'gender',
        'bio',
        'interests'
      ],
      where: {
        id: { [Op.ne]: userId }, // Exclude the current user
        gender: oppositeGender // Match only opposite gender
      },
      order: [['createdAt', 'DESC']] // Sort by newest users first
    });

    // Parse the interests field for each match
    const parsedMatches = matches.map(match => {
      const matchData = match.toJSON();
      matchData.interests = matchData.interests ? JSON.parse(matchData.interests) : [];
      return matchData;
    });

    res.json(parsedMatches);
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).send('Internal Server Error');
  }
});


// Haversine formula function to calculate distance between two geocoordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371; // Radius of the Earth in kilometers

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}

// Route to fetch location-based matches
app.get('/api/location-matches', async (req, res) => {
  try {
    const { userId } = req.session; // Get logged-in user ID from the session
    const user = await User.findByPk(userId);

    if (!user || !user.latitude || !user.longitude) {
      return res.status(404).json({ success: false, message: 'User location not available' });
    }

    const maxDistanceKm = 40; // Define maximum distance in kilometers
    const oppositeGender = user.gender === 'male' ? 'female' : 'male'; // Find users of opposite gender

    // Fetch all users with latitude and longitude who are not the logged-in user and match gender
    const matches = await User.findAll({
      where: {
        id: { [Op.ne]: userId }, // Exclude the logged-in user
        latitude: { [Op.ne]: null },
        longitude: { [Op.ne]: null },
        gender: oppositeGender, // Only fetch users of the opposite gender
      },
      attributes: ['id', 'username', 'age', 'bio', 'profilePicture', 'latitude', 'longitude'], // Include necessary fields
    });

    // Filter users based on distance
    const locationMatches = matches
      .map(match => {
        const distance = calculateDistance(
          user.latitude,
          user.longitude,
          match.latitude,
          match.longitude
        );

        // Check if the distance is valid
        if (distance <= maxDistanceKm) {
          return {
            ...match.toJSON(),
            distance: distance.toFixed(1), // Include distance rounded to one decimal point
          };
        }
        return null;
      })
      .filter(match => match !== null); // Remove users outside the max distance

    res.json(locationMatches); // Send filtered matches as response
  } catch (error) {
    console.error('Error fetching location matches:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});


app.get('/api/search-users', async (req, res) => {
  try {
    const { distance, ageRange, gender } = req.query;

    const [minAge, maxAge] = ageRange.split('-').map(Number); // Parse age range
    const userId = req.session.userId; // Logged-in user's ID
    const user = await User.findByPk(userId);

    if (!user || !user.latitude || !user.longitude) {
      return res.status(400).json({ message: 'Your location is not available.' });
    }

    const maxDistanceKm = parseFloat(distance) || 10; // Fallback to 10km if not provided

    const matches = await User.findAll({
      where: {
        id: { [Op.ne]: userId }, // Exclude logged-in user
        gender: gender || { [Op.ne]: null }, // Match gender if provided
        age: { [Op.between]: [minAge || 18, maxAge || 100] },
        latitude: { [Op.ne]: null },
        longitude: { [Op.ne]: null },
      },
      attributes: ['id', 'username', 'age', 'bio', 'profilePicture', 'latitude', 'longitude'], // Include necessary fields
    });

    const filteredUsers = matches
      .map(match => {
        const distance = calculateDistance(user.latitude, user.longitude, match.latitude, match.longitude);
        if (distance <= maxDistanceKm) {
          return {
            ...match.toJSON(),
            distance: distance.toFixed(1), // Include distance rounded to 1 decimal place
          };
        }
        return null; // Exclude users outside max distance
      })
      .filter(user => user !== null); // Remove users who are null

    res.json(filteredUsers); // Send filtered users to the frontend
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Utility to calculate distance between two geolocations using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

// Route to fetch location-based matches
app.get('/api/location-based-matches', async (req, res) => {
  try {
    const { userId } = req.session; // Logged-in user ID
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Fetch logged-in user
    const loggedInUser = await User.findByPk(userId);
    if (!loggedInUser || !loggedInUser.latitude || !loggedInUser.longitude) {
      return res.status(400).json({ error: 'User location not available' });
    }

    const oppositeGender = loggedInUser.gender === 'male' ? 'female' : 'male';

    // Fetch all users of the opposite gender
    const potentialMatches = await User.findAll({
      where: {
        gender: oppositeGender,
        id: { [Op.ne]: userId }, // Exclude logged-in user
      },
    });

    // Filter by distance (below 40 km)
const matches = potentialMatches
  .map((match) => {
    if (match.latitude && match.longitude) {
      const distance = calculateDistance(
        loggedInUser.latitude,
        loggedInUser.longitude,
        match.latitude,
        match.longitude
      );
      return distance <= 40
        ? {
            id: match.id,
            username: match.username,
            age: match.age,
            bio: match.bio,
            profilePicture: match.profilePicture,
            location: match.location || 'Location not provided', // Use a fallback value
            distance: distance.toFixed(1), // Round to 1 decimal place
          }
        : null;
    }
    return null;
  })
  .filter(Boolean); // Remove null values


    res.json(matches);
  } catch (error) {
    console.error('Error fetching location-based matches:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('Users', 'badges', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: [],
    });
    await queryInterface.addColumn('Users', 'points', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });
    await queryInterface.addColumn('Users', 'achievementsProgress', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: {},
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('Users', 'badges');
    await queryInterface.removeColumn('Users', 'points');
    await queryInterface.removeColumn('Users', 'achievementsProgress');
  },
};

async function awardBadge(userId, badgeName) {
  const user = await User.findByPk(userId);
  if (!user.badges.includes(badgeName)) {
    user.badges.push(badgeName); // Add the badge
    await user.save();
    console.log(`Badge awarded: ${badgeName}`);
  }
}

async function addPoints(userId, points) {
  const user = await User.findByPk(userId);
  user.points += points;
  await user.save();
  console.log(`${points} points added to user ${user.username}`);
}
async function handleFirstMatch(userId) {
  const user = await User.findByPk(userId);
  if (!user.badges.includes("FirstMatch")) {
    await awardBadge(userId, "FirstMatch");
    await addPoints(userId, 10); // Award 10 points for first match
  }
}
app.get('/api/user-stats', async (req, res) => {
  try {
    const user = await User.findByPk(req.session.userId);
    res.json({
      points: user.points,
      badges: user.badges,
      achievementsProgress: user.achievementsProgress,
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    res.status(500).json({ error: 'Failed to fetch user stats' });
  }
});


app.post('/api/update-achievement', async (req, res) => {
  try {
    const { userId, achievement, increment } = req.body;
    const user = await User.findByPk(userId);

    // Increment achievement progress
    user.achievementsProgress[achievement] = 
      (user.achievementsProgress[achievement] || 0) + increment;

    // Example: Unlock a badge when progress reaches 10
    if (achievement === 'messagesSent' && user.achievementsProgress[achievement] >= 10) {
      await awardBadge(userId, "Chat Master");
      await addPoints(userId, 5); // Extra points for unlocking a badge
    }

    await user.save();
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating achievement:', error);
    res.status(500).json({ error: 'Failed to update achievement' });
  }
});

app.get('/api/user-settings', async (req, res) => {
    const user = await User.findByPk(req.session.userId);
    res.json({
        blockedUsers: user.blockedUsers || [],
        messagePermissions: user.messagePermissions || 'everyone',
        showAge: user.showAge !== false, // Default: true
        showLocation: user.showLocation !== false, // Default: true
        notifications: user.notifications || { email: true, sms: true, push: true },
        featureToggles: user.featureToggles || { anonymousChat: true, voiceCall: true, videoCall: true },
    });
});
app.post('/api/update-settings', async (req, res) => {
    const { userId } = req.session;
    const updates = req.body;

    const user = await User.findByPk(userId);
    Object.keys(updates).forEach(key => {
        user[key] = updates[key];
    });
    await user.save();

    res.json({ success: true });
});

app.get('/api/blocked-users', requireLogin, async (req, res) => {
  const { userId } = req.session; // Logged-in user ID
  try {
    const blockedUsers = await BlockedUser.findAll({
      where: { userId }, // Get all entries where the current user is the blocker
      include: [
        {
          model: User,
          as: 'BlockedUserDetails',
          attributes: ['id', 'username', 'fullPhoneNumber', 'profilePicture'],
        },
      ],
    });

    // Map the blocked users for response
    const result = blockedUsers.map(entry => ({
      id: entry.BlockedUserDetails.id,
      username: entry.BlockedUserDetails.username,
      fullPhoneNumber: entry.BlockedUserDetails.fullPhoneNumber,
      profilePicture: entry.BlockedUserDetails.profilePicture,
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching blocked users:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error.' });
  }
});

BlockedUser.belongsTo(User, { as: 'BlockedUserDetails', foreignKey: 'blockedUserId' });
User.hasMany(BlockedUser, { foreignKey: 'userId' });

app.post('/api/unblock-user', async (req, res) => {
  const { userId } = req.session;
  const { blockedUserId } = req.body;
  try {
    const user = await User.findByPk(userId);
    user.blockedUsers = user.blockedUsers.filter(id => id !== blockedUserId);
    await user.save();
    res.json({ success: true, message: 'User unblocked successfully.' });
  } catch (error) {
    console.error('Error unblocking user:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

app.get('/api/get-users', async (req, res) => {
    try {
        const users = await User.findAll({
            where: { casualDatingMode: true },
            attributes: ['id', 'username', 'profilePicture', 'bio']
        });
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.get('/api/casual-dating-profiles', requireLogin, async (req, res) => {
    try {
        const casualDatingUsers = await User.findAll({
            where: { casualDatingMode: true },
            attributes: ['id', 'username', 'bio', 'profilePicture']
        });

        res.json(casualDatingUsers);
    } catch (error) {
        console.error('Error fetching casual dating profiles:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/update-casual-mode', requireLogin, async (req, res) => {
    const userId = req.session.userId;
    const { casualMode } = req.body;

    if (typeof casualMode !== 'boolean') {
        return res.status(400).json({ error: 'Invalid parameter' });
    }

    try {
        await User.update({ casualDatingMode: casualMode }, { where: { id: userId } });
        res.sendStatus(200); // Success
    } catch (error) {
        console.error('Error updating casual mode:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/change-password', requireLogin, async (req, res) => {
  const { userId } = req.session; // Get logged-in user ID from session
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'Invalid input. Password must be at least 6 characters.' });
  }

  try {
    // Fetch the user by ID
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Verify the old password
    if (user.password !== oldPassword) {
      return res.status(403).json({ success: false, message: 'Old password is incorrect.' });
    }

    // Update the user's password
    user.password = newPassword; // Directly store the new password
    await user.save();

    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error.' });
  }
});

// Global variables for pairing and user count.
let waitingPlayer = null;
let sessions = {};


const riddles = [
  { id: 6, riddle: "What has to be broken before you can use it?", answer: "Egg", hint: "It's fragile and edible." },
  { id: 7, riddle: "I’m light as a feather, yet the strongest man can’t hold me for more than 5 minutes. What am I?", answer: "Breath", hint: "It's something you can't live without." },
  { id: 8, riddle: "What has an eye but cannot see?", answer: "Needle", hint: "Think about sewing tools." },
  { id: 9, riddle: "What goes up but never comes down?", answer: "Age", hint: "It's related to time." },
  { id: 10, riddle: "I shave every day, but my beard stays the same. What am I?", answer: "Barber", hint: "A profession related to grooming." },
  { id: 11, riddle: "The more you take away, the bigger I get. What am I?", answer: "Hole", hint: "It's something you dig." },
  { id: 12, riddle: "I’m always in front of you but can’t be seen. What am I?", answer: "Future", hint: "It has not happened yet." },
  { id: 13, riddle: "What has hands but can’t clap?", answer: "Clock", hint: "It keeps track of time." },
  { id: 14, riddle: "What has a head, a tail, is brown, and has no legs?", answer: "Penny", hint: "It's a form of currency." },
  { id: 15, riddle: "What can you catch but not throw?", answer: "Cold", hint: "It's something related to health." },
  { id: 16, riddle: "What begins with T, ends with T, and has T in it?", answer: "Teapot", hint: "It’s used to brew a warm beverage." },
  { id: 17, riddle: "What has a neck but no head?", answer: "Bottle", hint: "Used to hold liquids." },
  { id: 18, riddle: "I speak without a mouth and hear without ears. I have no body, but I come alive with the wind. What am I?", answer: "Echo", hint: "It repeats sounds." },
  { id: 19, riddle: "What building has the most stories?", answer: "Library", hint: "It’s full of books." },
  { id: 20, riddle: "I’m not alive, but I can grow. I don’t have lungs, but I need air. What am I?", answer: "Fire", hint: "It needs fuel to stay alive." },
  { id: 21, riddle: "What gets wetter the more it dries?", answer: "Towel", hint: "You use it after a shower." },
  { id: 22, riddle: "I have keys but no locks. I have space but no room. You can enter but not go outside. What am I?", answer: "Keyboard", hint: "It's found on a computer." },
  { id: 23, riddle: "What has many teeth but cannot bite?", answer: "Comb", hint: "It's used for grooming your hair." },
  { id: 24, riddle: "The more of me you take, the more you leave behind. What am I?", answer: "Footsteps", hint: "It's something you leave on the ground." },
  { id: 25, riddle: "I’m tall when I’m young, and I’m short when I’m old. What am I?", answer: "Candle", hint: "It gives light." },
  { id: 26, riddle: "What has a bottom at the top?", answer: "Legs", hint: "Think of human anatomy." },
  { id: 27, riddle: "What can travel around the world while staying in the same spot?", answer: "Stamp", hint: "It's used on letters." },
  { id: 28, riddle: "What runs but never walks, has a bed but never sleeps?", answer: "River", hint: "It flows continuously." },
  { id: 29, riddle: "What comes once in a minute, twice in a moment, but never in a thousand years?", answer: "The letter M", hint: "It's part of a word." },
  { id: 30, riddle: "What has cities but no houses, forests but no trees, and rivers but no water?", answer: "Map", hint: "Used for navigation." },
  { id: 31, riddle: "What can fill a room but takes up no space?", answer: "Light", hint: "You switch it on." },
  { id: 32, riddle: "The more you have of me, the less you see. What am I?", answer: "Darkness", hint: "It appears when there's no light." },
  { id: 33, riddle: "What has one eye but can’t see?", answer: "Needle", hint: "Used for sewing." },
  { id: 34, riddle: "If two’s company, and three’s a crowd, what are four and five?", answer: "Nine", hint: "It's basic math!" },
  { id: 35, riddle: "I am always hungry, I must always be fed. The finger I touch will soon turn red. What am I?", answer: "Fire", hint: "It consumes everything." },
  { id: 36, riddle: "What is so fragile that saying its name breaks it?", answer: "Silence", hint: "It's the absence of noise." },
  { id: 37, riddle: "I fly without wings. I cry without eyes. Wherever I go, darkness flies. What am I?", answer: "Cloud", hint: "You see it in the sky." },
  { id: 38, riddle: "What can’t be used until it’s broken?", answer: "Egg", hint: "It's something you cook." },
  { id: 39, riddle: "I’m found in socks, scarves, and mittens; and often in the paws of playful kittens. What am I?", answer: "Yarn", hint: "It's used for knitting." },
  { id: 40, riddle: "What begins with an ‘e’ and only contains one letter?", answer: "Envelope", hint: "It's used to send letters." },
  { id: 41, riddle: "What has four wheels and flies?", answer: "Garbage truck", hint: "It's often found in neighborhoods." },
  { id: 42, riddle: "What has no beginning, middle, or end?", answer: "Circle", hint: "It's a shape." },
  { id: 43, riddle: "What comes down but never goes up?", answer: "Rain", hint: "It falls from the sky." },
  { id: 44, riddle: "I am a word, I contain six letters, remove one letter, and twelve remain. What am I?", answer: "Dozens", hint: "Think of groups of twelve." },
  { id: 45, riddle: "What is full of holes but still holds water?", answer: "Sponge", hint: "You use it to clean." },
  { id: 46, riddle: "What has one head, one foot, and four legs?", answer: "Bed", hint: "You sleep on it." },
  { id: 47, riddle: "What kind of coat can only be put on when wet?", answer: "Paint", hint: "Used for walls or art." },
  { id: 48, riddle: "What has roots as nobody sees, is taller than trees, up, up it goes, and yet it never grows?", answer: "Mountain", hint: "You climb it." },
  { id: 49, riddle: "If you drop me, I’m sure to crack, but smile at me, and I’ll smile back. What am I?", answer: "Mirror", hint: "Reflects your image." },
  { id: 50, riddle: "What has a spine but no bones?", answer: "Book", hint: "It's full of stories." },
  { id: 51, riddle: "I have branches, yet I have no leaves, no trunk, and no fruit. What am I?", answer: "Bank", hint: "Think of a financial institution with multiple locations." },
  { id: 52, riddle: "What room do ghosts avoid?", answer: "The living room", hint: "It contrasts with being dead." },
  { id: 53, riddle: "What word becomes shorter when you add two letters to it?", answer: "Short", hint: "The word itself means reduced in length." },
  { id: 54, riddle: "What invention lets you look right through a wall?", answer: "Window", hint: "It's transparent." },
  { id: 55, riddle: "I shrink smaller every time I take a bath. What am I?", answer: "Soap", hint: "It dissolves gradually in water." },
  { id: 57, riddle: "What goes up a chimney down, but can't come down a chimney up?", answer: "Umbrella", hint: "Think about its open and closed states." },
  { id: 58, riddle: "What always ends everything?", answer: "The letter G", hint: "Look at the word 'everything'." },
  { id: 59, riddle: "What runs around the yard but never moves?", answer: "Fence", hint: "It encloses your outdoor space." },
  { id: 60, riddle: "What breaks but never falls, and what falls but never breaks?", answer: "Day breaks and night falls", hint: "A play on words about time." },
  { id: 61, riddle: "I am taken from a mine and shut in a wooden case. What am I?", answer: "Pencil lead", hint: "It's found in every pencil." },
  { id: 62, riddle: "What has ears but cannot hear?", answer: "Corn", hint: "They grow on a cob." },
  { id: 63, riddle: "What letter is in the middle of water?", answer: "T", hint: "Spell out 'water' to find the center." },
  { id: 64, riddle: "What letter appears once in a year, twice in a decade, and never in a month?", answer: "E", hint: "Look closely at the words." },
  { id: 65, riddle: "What can be cracked, made, told, and played?", answer: "A joke", hint: "It’s meant to entertain." },
  { id: 66, riddle: "What is black when you buy it, red when you use it, and gray when you throw it away?", answer: "Charcoal", hint: "It burns and then turns to ash." },
  { id: 67, riddle: "What has a heart that doesn’t beat?", answer: "An artichoke", hint: "Look for the edible 'heart'." },
  { id: 68, riddle: "What flies without wings?", answer: "Time", hint: "It passes quickly without physical form." },
  { id: 69, riddle: "What gets sharper the more you use it?", answer: "Your mind", hint: "Exercise your brain." },
  { id: 70, riddle: "What can you hold without ever touching it?", answer: "A conversation", hint: "It’s intangible." },
  { id: 71, riddle: "What begins with a P, ends with an E, and has thousands of letters?", answer: "Post office", hint: "It handles mail." },
  { id: 72, riddle: "I am heavy forward, but backward I'm not. What am I?", answer: "Ton", hint: "Think about the reversed spelling." },
  { id: 73, riddle: "What has many rings but no fingers?", answer: "Saturn", hint: "It's a planet known for its rings." },
  { id: 74, riddle: "What has many faces but never complains?", answer: "Dice", hint: "Used in numerous games." },
  { id: 75, riddle: "What has a neck but no head, and two arms but no hands?", answer: "A shirt", hint: "It's a piece of clothing." },
  { id: 76, riddle: "What type of room has no doors or windows?", answer: "Mushroom", hint: "A fun play on words." },
  { id: 77, riddle: "What is always coming, but never arrives?", answer: "Tomorrow", hint: "It’s perpetually in the future." },
  { id: 78, riddle: "I am not alive, but I have five fingers. What am I?", answer: "Glove", hint: "You wear it on your hand." },
  { id: 79, riddle: "What do you call a bear with no teeth?", answer: "Gummy bear", hint: "Think of a sweet, chewy treat." },
  { id: 80, riddle: "What never asks a question but gets answered all the time?", answer: "A doorbell", hint: "You ring it, and someone responds." },
  { id: 81, riddle: "How many months have 28 days?", answer: "All of them", hint: "Every month has at least 28 days." },
  { id: 82, riddle: "What is hard to get but easy to lose?", answer: "Your temper", hint: "It can flare up quickly." },
  { id: 83, riddle: "What belongs to you but is used more by others?", answer: "Your name", hint: "Others call you by it." },
  { id: 84, riddle: "If an electric train is moving north at 100mph and a wind is blowing east at 10mph, which way does the smoke blow?", answer: "None", hint: "Electric trains don’t produce smoke." },
  { id: 85, riddle: "What kind of tree can you carry in your hand?", answer: "Palm", hint: "A play on words." },
  { id: 86, riddle: "What word is always spelled incorrectly in every dictionary?", answer: "Incorrectly", hint: "That’s exactly how it’s written." },
  { id: 87, riddle: "What can’t you put in a saucepan?", answer: "Its lid", hint: "Because it's already covering it." },
  { id: 88, riddle: "What is the center of gravity?", answer: "The letter V", hint: "Examine the word closely." },
  { id: 89, riddle: "What has four eyes but cannot see?", answer: "Mississippi", hint: "Count the letter 'i's in it." },
  { id: 90, riddle: "What kind of cup doesn't hold water?", answer: "A cupcake", hint: "It’s a delicious dessert." },
  { id: 91, riddle: "What has bark but no bite?", answer: "A tree", hint: "It covers the trunk and branches." },
  { id: 92, riddle: "What can you break, even if you never pick it up?", answer: "A promise", hint: "It's not a physical object." },
  { id: 93, riddle: "What goes up when the rain comes down?", answer: "An umbrella", hint: "It opens when it rains." },
  { id: 94, riddle: "I am an odd number. Take away one letter and I become even. What number am I?", answer: "Seven", hint: "Remove the 's' to reveal 'even'." },
  { id: 95, riddle: "What goes around in circles but still moves forward?", answer: "A wheel", hint: "It rotates continuously." },
  { id: 96, riddle: "What word is a palindrome?", answer: "Racecar", hint: "It reads the same forwards and backwards." },
  { id: 97, riddle: "What jumps when it walks and sits when it stands?", answer: "Kangaroo", hint: "This marsupial is known for hopping." },
  { id: 98, riddle: "What has feet but can't walk?", answer: "A ruler", hint: "It's used for measuring." },
  { id: 99, riddle: "I build up castles, yet tear down mountains. I make some men blind, yet help others to see. What am I?", answer: "Sand", hint: "Found at the beach or in the desert." },
  { id: 100, riddle: "What can bring back the dead, make you cry, make you laugh, and last a lifetime?", answer: "Memory", hint: "It lives in your mind." }
];

// Track online users count
let onlineUserCount = 0;

// User pairing and session tracking

io.on('connection', (socket) => {
  // Increment online user count and notify all clients
  onlineUserCount++;
  io.emit('updateUserCount', { count: onlineUserCount });
  console.log(`User connected: ${socket.id} | Online users: ${onlineUserCount}`);

  let currentSession = null;

  // Handle game joining
  socket.on('joinRiddleGame', () => {
    if (waitingPlayer) {
      // Pair the players
      const session = {
        player1: waitingPlayer,
        player2: socket.id,
        scores: {},
        activeRiddle: null,
        riddleTimer: null,
        sessionTimer: null,
        riddles: [...riddles]
      };

      // Initialize scores
      session.scores[session.player1] = 0;
      session.scores[session.player2] = 0;

      // Store session
      sessions[socket.id] = session;
      sessions[waitingPlayer] = session;
      currentSession = session;

      // Notify match found
      io.to(session.player1).emit('matchFound', { opponent: session.player2 });
      io.to(session.player2).emit('matchFound', { opponent: session.player1 });
      waitingPlayer = null;

      // Start the session
      startRiddleSession(session);
    } else {
      waitingPlayer = socket.id;
      socket.emit('waiting', { message: "Waiting for an opponent..." });
    }
  });

  // Function to start a riddle session
  const startRiddleSession = (session) => {
    const players = [session.player1, session.player2];
    let sessionTime = 180;

    const sendNextRiddle = () => {
      if (session.riddles.length === 0) {
        io.to(players[0]).emit('sessionEnd', { 
          userScore: session.scores[players[0]], 
          opponentScore: session.scores[players[1]] 
        });
        io.to(players[1]).emit('sessionEnd', { 
          userScore: session.scores[players[1]], 
          opponentScore: session.scores[players[0]] 
        });
        endSession(players);
        return;
      }

      // Select a random riddle
      const randomIndex = Math.floor(Math.random() * session.riddles.length);
      const riddle = session.riddles[randomIndex];
      session.riddles.splice(randomIndex, 1);
      session.activeRiddle = riddle;

      // Send riddle to players
      io.to(players[0]).emit('newRiddle', riddle);
      io.to(players[1]).emit('newRiddle', riddle);

      let timeLeft = 30;
      session.riddleTimer = setInterval(() => {
        if (timeLeft <= 0) {
          clearInterval(session.riddleTimer);
          io.to(players[0]).emit('riddleTimeout', { message: "Time's up! Next riddle." });
          io.to(players[1]).emit('riddleTimeout', { message: "Time's up! Next riddle." });
          sendNextRiddle();
        } else {
          io.to(players[0]).emit('riddleTimerUpdate', { riddleTime: timeLeft });
          io.to(players[1]).emit('riddleTimerUpdate', { riddleTime: timeLeft });
          timeLeft--;
        }
      }, 1000);
    };

    // Start session timer
    session.sessionTimer = setInterval(() => {
      if (sessionTime <= 0) {
        clearInterval(session.sessionTimer);
        clearInterval(session.riddleTimer);
        io.to(players[0]).emit('sessionEnd', { 
          userScore: session.scores[players[0]], 
          opponentScore: session.scores[players[1]] 
        });
        io.to(players[1]).emit('sessionEnd', { 
          userScore: session.scores[players[1]], 
          opponentScore: session.scores[players[0]] 
        });
        endSession(players);
      } else {
        io.to(players[0]).emit('sessionTimerUpdate', { sessionTime });
        io.to(players[1]).emit('sessionTimerUpdate', { sessionTime });
        sessionTime--;
      }
    }, 1000);

    // Send first riddle
    sendNextRiddle();
  };

  // Handle answer submission
  socket.on('submitAnswer', ({ input }) => {
    const session = sessions[socket.id];
    if (!session) return;

    const sanitizedInput = input.trim().toLowerCase();
    const correctAnswer = session.activeRiddle.answer.toLowerCase();

    if (sanitizedInput === correctAnswer) {
      session.scores[socket.id] = (session.scores[socket.id] || 0) + 1;
      io.to(session.player1).emit('correctAnswer', { userId: socket.id });
      io.to(session.player2).emit('correctAnswer', { userId: socket.id });

      clearInterval(session.riddleTimer);
      startRiddleSession(session);
    } else {
      socket.emit('incorrectAnswer', { message: "Wrong answer! Try again." });
    }
  });

  // Handle real-time typing
  socket.on('typing', ({ input }) => {
    const session = sessions[socket.id];
    if (!session) return;
    const opponent = session.player1 === socket.id ? session.player2 : session.player1;
    io.to(opponent).emit('opponentTyping', { input });
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    
    onlineUserCount--;
    io.emit('updateUserCount', { count: onlineUserCount });

    const session = sessions[socket.id];
    if (session) {
      const opponent = session.player1 === socket.id ? session.player2 : session.player1;
      io.to(opponent).emit('endChat', { message: "Your opponent has left the game." });
      endSession([session.player1, session.player2]);
    }

    if (waitingPlayer === socket.id) {
      waitingPlayer = null;
    }
  });

  // Clean up session
  const endSession = (players) => {
    players.forEach(player => {
      delete sessions[player];
    });
  };
});



app.use(bodyParser.urlencoded({ extended: true }));



//for admin login only starting from here 


const ADMIN_EMAIL = "ligolapatrick61@gmail.com";
const ADMIN_PASSWORD = "4123trecks";

// Admin login route
app.post("/admin/login", (req, res) => {
  const { email, password } = req.body;

  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    req.session.adminLoggedIn = true;
    res.redirect("/admin/dashboard");
  } else {
    res.status(401).send("Invalid admin credentials.");
  }
});

// Middleware to protect admin-only routes
const requireAdmin = (req, res, next) => {
  if (req.session.adminLoggedIn) {
    next(); // Proceed to the requested admin route
  } else {
    res.redirect("/admin/login"); // Redirect to login page
  }
};

app.get("/admin/dashboard", requireAdmin, (req, res) => {
  // Send the static HTML file for the admin dashboard
  res.sendFile(path.join(__dirname, 'public', 'dashboardadmin.html'));
});


app.post("/admin/login", (req, res) => {
  const { email, password } = req.body;

  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    req.session.adminLoggedIn = true;
    res.redirect("/admin/dashboard");
  } else {
    res.status(401).send("Invalid email or password.");
  }
});

// Fetch all users for the dashboard
app.get("/admin/api/users", requireAdmin, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ["id", "username", "fullPhoneNumber", "createdAt"],
    });
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// Fetch all posts for the dashboard
app.get("/admin/api/posts", requireAdmin, async (req, res) => {
  try {
    const posts = await Post.findAll({
      include: [{ model: User, attributes: ["username"] }],
      order: [["createdAt", "DESC"]],
    });
    res.json(posts);
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/admin/delete-user/:userId", requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    await User.destroy({ where: { id: userId } });
    res.redirect("/admin/dashboard");
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/admin/delete-post/:postId", requireAdmin, async (req, res) => {
  try {
    const { postId } = req.params;
    await Post.destroy({ where: { id: postId } });
    res.redirect("/admin/dashboard");
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Route to search for a user by phone number
app.get('/admin/search-user', requireAdmin, async (req, res) => {
  const { phoneNumber } = req.query; // Get the query parameter for the phone number

  try {
    // Search for the user using the fullPhoneNumber
    const user = await User.findOne({
      where: { fullPhoneNumber: phoneNumber },
      attributes: ['id', 'username', 'fullPhoneNumber', 'role', 'createdAt', 'online'] // Limit fields
    });

    if (user) {
      res.json({ success: true, user });
    } else {
      res.json({ success: false, message: 'User not found.' });
    }
  } catch (error) {
    console.error('Error searching user:', error);
    res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
});

app.get('/admin/api/active-users', requireAdmin, async (req, res) => {
  try {
    const activeUsers = await User.findAll({
      where: { online: true },
      attributes: ['id', 'username', 'fullPhoneNumber', 'lastSeen', 'age', 'gender'],
    });
    res.json(activeUsers);
  } catch (error) {
    console.error('Error fetching active users:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.get('/admin/api/users-by-gender', requireAdmin, async (req, res) => {
  try {
    const maleUsers = await User.findAll({
      where: { gender: 'male' },
      attributes: ['id', 'username', 'fullPhoneNumber', 'createdAt'],
    });
    const femaleUsers = await User.findAll({
      where: { gender: 'female' },
      attributes: ['id', 'username', 'fullPhoneNumber', 'createdAt'],
    });
    res.json({ maleUsers, femaleUsers });
  } catch (error) {
    console.error('Error fetching users by gender:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});





app.get('/api/find-nearby', async (req, res) => {
    const { latitude, longitude } = req.query;

    try {
        const users = await User.findAll({
            attributes: ['id', 'username', 'profilePicture', 'age', 'gender', 'bio', 'interests', 'latitude', 'longitude'],
            where: {
                latitude: { [Op.ne]: null },
                longitude: { [Op.ne]: null },
                [Op.and]: Sequelize.literal(
                    `(6371 * acos(cos(${latitude} * PI() / 180) * cos(latitude * PI() / 180) * cos((longitude - ${longitude}) * PI() / 180) + sin(${latitude} * PI() / 180) * sin(latitude * PI() / 180))) <= 20`
                )
            },
            order: [['createdAt', 'DESC']]
        });

        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.post('/api/clear-unread', async (req, res) => {
    const { userId } = req.body;

    try {
        await Message.update(
            { unread: false }, // Set unread messages to false
            { where: { senderId: userId, receiverId: req.session.userId, unread: true } }
        );

        res.status(200).send({ success: true });
    } catch (error) {
        console.error("Error clearing unread messages:", error);
        res.status(500).send({ success: false, error: "Internal Server Error" });
    }
});

sequelize.sync({ alter: true }).then(() => {
  console.log('Database & tables updated!');
});

// Start the server
const port = 5000;
server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
