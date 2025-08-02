const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const moment = require('moment-timezone');
const { DateTime } = require('luxon');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Security middleware after static files
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      upgradeInsecureRequests: []
    }
  }
}));

// Database initialization
const db = new sqlite3.Database('./timezone.db');

// Initialize database tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    preferences TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Saved configurations table
  db.run(`CREATE TABLE IF NOT EXISTS saved_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT NOT NULL,
    timezones TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Events table
  db.run(`CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT,
    timezones TEXT NOT NULL,
    share_token TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Cities and timezones table
  db.run(`CREATE TABLE IF NOT EXISTS cities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    timezone TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    population INTEGER
  )`);
});

// Timezone data - Major cities with their timezones
const timezoneData = [
  { name: 'New York', country: 'USA', timezone: 'America/New_York', lat: 40.7128, lng: -74.0060, population: 8336817 },
  { name: 'Los Angeles', country: 'USA', timezone: 'America/Los_Angeles', lat: 34.0522, lng: -118.2437, population: 3979576 },
  { name: 'Chicago', country: 'USA', timezone: 'America/Chicago', lat: 41.8781, lng: -87.6298, population: 2693976 },
  { name: 'London', country: 'UK', timezone: 'Europe/London', lat: 51.5074, lng: -0.1278, population: 8982000 },
  { name: 'Paris', country: 'France', timezone: 'Europe/Paris', lat: 48.8566, lng: 2.3522, population: 2161000 },
  { name: 'Berlin', country: 'Germany', timezone: 'Europe/Berlin', lat: 52.5200, lng: 13.4050, population: 3669491 },
  { name: 'Tokyo', country: 'Japan', timezone: 'Asia/Tokyo', lat: 35.6762, lng: 139.6503, population: 13929286 },
  { name: 'Sydney', country: 'Australia', timezone: 'Australia/Sydney', lat: -33.8688, lng: 151.2093, population: 5312163 },
  { name: 'Mumbai', country: 'India', timezone: 'Asia/Kolkata', lat: 19.0760, lng: 72.8777, population: 20411274 },
  { name: 'Beijing', country: 'China', timezone: 'Asia/Shanghai', lat: 39.9042, lng: 116.4074, population: 21540000 },
  { name: 'Toronto', country: 'Canada', timezone: 'America/Toronto', lat: 43.6532, lng: -79.3832, population: 2930000 },
  { name: 'Vancouver', country: 'Canada', timezone: 'America/Vancouver', lat: 49.2827, lng: -123.1207, population: 675218 },
  { name: 'Dubai', country: 'UAE', timezone: 'Asia/Dubai', lat: 25.2048, lng: 55.2708, population: 3331420 },
  { name: 'Singapore', country: 'Singapore', timezone: 'Asia/Singapore', lat: 1.3521, lng: 103.8198, population: 5850342 },
  { name: 'São Paulo', country: 'Brazil', timezone: 'America/Sao_Paulo', lat: -23.5505, lng: -46.6333, population: 12325232 },
  { name: 'Mexico City', country: 'Mexico', timezone: 'America/Mexico_City', lat: 19.4326, lng: -99.1332, population: 9209944 },
  { name: 'Cairo', country: 'Egypt', timezone: 'Africa/Cairo', lat: 30.0444, lng: 31.2357, population: 9539000 },
  { name: 'Johannesburg', country: 'South Africa', timezone: 'Africa/Johannesburg', lat: -26.2041, lng: 28.0473, population: 5634800 },
  { name: 'Moscow', country: 'Russia', timezone: 'Europe/Moscow', lat: 55.7558, lng: 37.6176, population: 12506468 },
  { name: 'Istanbul', country: 'Turkey', timezone: 'Europe/Istanbul', lat: 41.0082, lng: 28.9784, population: 15520000 }
];

// Populate cities table if empty
db.get("SELECT COUNT(*) as count FROM cities", (err, row) => {
  if (err) {
    console.error('Error checking cities table:', err);
    return;
  }
  
  if (row.count === 0) {
    const stmt = db.prepare("INSERT INTO cities (name, country, timezone, latitude, longitude, population) VALUES (?, ?, ?, ?, ?, ?)");
    timezoneData.forEach(city => {
      stmt.run(city.name, city.country, city.timezone, city.lat, city.lng, city.population);
    });
    stmt.finalize();
    console.log('Cities table populated');
  }
});

// Routes

// Main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Routes

// Get current time for a timezone
app.get('/api/time/:timezone', (req, res) => {
  const { timezone } = req.params;
  try {
    const now = moment().tz(timezone);
    res.json({
      timezone,
      currentTime: now.format('HH:mm:ss'),
      currentDate: now.format('YYYY-MM-DD'),
      dayOfWeek: now.format('dddd'),
      offset: now.format('Z'),
      isDST: now.isDST()
    });
  } catch (error) {
    res.status(400).json({ error: 'Invalid timezone' });
  }
});

// Search cities
app.get('/api/search', (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) {
    return res.json([]);
  }

  const query = `
    SELECT name, country, timezone, latitude, longitude 
    FROM cities 
    WHERE name LIKE ? OR country LIKE ? 
    ORDER BY population DESC 
    LIMIT 10
  `;
  
  db.all(query, [`%${q}%`, `%${q}%`], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// Get all cities
app.get('/api/cities', (req, res) => {
  db.all("SELECT name, country, timezone, latitude, longitude FROM cities ORDER BY population DESC", (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// Convert time between timezones
app.get('/api/convert', (req, res) => {
  const { time, fromTz, toTz, date } = req.query;
  
  try {
    const baseDate = date || moment().format('YYYY-MM-DD');
    const inputTime = moment.tz(`${baseDate} ${time}`, fromTz);
    const convertedTime = inputTime.clone().tz(toTz);
    
    res.json({
      original: {
        time,
        timezone: fromTz,
        date: baseDate
      },
      converted: {
        time: convertedTime.format('HH:mm:ss'),
        timezone: toTz,
        date: convertedTime.format('YYYY-MM-DD'),
        dayOfWeek: convertedTime.format('dddd')
      }
    });
  } catch (error) {
    res.status(400).json({ error: 'Invalid time or timezone' });
  }
});

// Get timezone information
app.get('/api/timezone/:timezone', (req, res) => {
  const { timezone } = req.params;
  
  try {
    const now = moment().tz(timezone);
    const cities = timezoneData.filter(city => city.timezone === timezone);
    
    res.json({
      timezone,
      currentOffset: now.format('Z'),
      isDST: now.isDST(),
      cities: cities.map(city => ({
        name: city.name,
        country: city.country
      })),
      nextDSTChange: getNextDSTChange(timezone)
    });
  } catch (error) {
    res.status(400).json({ error: 'Invalid timezone' });
  }
});

// Create shareable event
app.post('/api/events', (req, res) => {
  const { title, startTime, endTime, timezones } = req.body;
  const shareToken = Math.random().toString(36).substring(2, 15);
  
  const stmt = db.prepare(`
    INSERT INTO events (title, start_time, end_time, timezones, share_token) 
    VALUES (?, ?, ?, ?, ?)
  `);
  
  stmt.run(title, startTime, endTime, JSON.stringify(timezones), shareToken, function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to create event' });
    }
    
    res.json({
      id: this.lastID,
      shareToken,
      shareUrl: `/event/${shareToken}`
    });
  });
  
  stmt.finalize();
});

// Get shared event
app.get('/api/events/:token', (req, res) => {
  const { token } = req.params;
  
  db.get("SELECT * FROM events WHERE share_token = ?", [token], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!row) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json({
      ...row,
      timezones: JSON.parse(row.timezones)
    });
  });
});

// User registration
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run("INSERT INTO users (email, password) VALUES (?, ?)", [email, hashedPassword], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Email already exists' });
        }
        return res.status(500).json({ error: 'Registration failed' });
      }
      
      const token = jwt.sign({ userId: this.lastID }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ token, userId: this.lastID });
    });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// User login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  
  db.get("SELECT * FROM users WHERE email = ?", [email], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Login failed' });
    }
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    try {
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ token, userId: user.id });
    } catch (error) {
      res.status(500).json({ error: 'Login failed' });
    }
  });
});

// Save user configuration
app.post('/api/configs', authenticateToken, (req, res) => {
  const { name, timezones } = req.body;
  const userId = req.user.userId;
  
  db.run("INSERT INTO saved_configs (user_id, name, timezones) VALUES (?, ?, ?)", 
    [userId, name, JSON.stringify(timezones)], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to save configuration' });
    }
    res.json({ id: this.lastID });
  });
});

// Get user configurations
app.get('/api/configs', authenticateToken, (req, res) => {
  const userId = req.user.userId;
  
  db.all("SELECT * FROM saved_configs WHERE user_id = ? ORDER BY created_at DESC", [userId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to get configurations' });
    }
    res.json(rows.map(row => ({
      ...row,
      timezones: JSON.parse(row.timezones)
    })));
  });
});

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
}

// Helper function to get next DST change
function getNextDSTChange(timezone) {
  try {
    const now = moment().tz(timezone);
    const year = now.year();
    const nextYear = year + 1;
    
    // Check for DST changes in current and next year
    const transitions = [];
    
    for (let y = year; y <= nextYear; y++) {
      const jan1 = moment.tz(`${y}-01-01`, timezone);
      const dec31 = moment.tz(`${y}-12-31`, timezone);
      
      let current = jan1.clone();
      while (current.isBefore(dec31)) {
        const next = current.clone().add(1, 'day');
        if (current.isDST() !== next.isDST()) {
          transitions.push({
            date: next.format('YYYY-MM-DD'),
            type: next.isDST() ? 'start' : 'end'
          });
        }
        current = next;
      }
    }
    
    // Find the next transition
    const nextTransition = transitions.find(t => 
      moment(t.date).isAfter(moment())
    );
    
    return nextTransition;
  } catch (error) {
    return null;
  }
}

// Serve static files
app.use(express.static('public'));

// Catch-all route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to access the application`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});