/**
 * =============================================================================
 * ASE Official Portal Server
 * Advanced Software Engineering Club at NMIT
 * 
 * Tech Stack: Node.js, Express, express-session, bcryptjs, SQLite (sqlite3)
 * Website Name: ASE
 * Tagline: "Ideas in mind. Code in motion."
 * =============================================================================
 */

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'ase_nmit_club_secret_session_key_2026';

// -----------------------------------------------------------------------------
// Database Setup & Migration (SQLite in data/ase.sqlite)
// -----------------------------------------------------------------------------
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'ase.sqlite');
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to open SQLite database:', err.message);
  } else {
    console.log(`Connected to SQLite database at: ${DB_PATH}`);
  }
});

// Enable SQLite foreign key enforcement
db.run('PRAGMA foreign_keys = ON;');

// Initialize Tables and safe additive migrations
db.serialize(() => {
  // 1. Users table (Student accounts)
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      san_number TEXT NOT NULL,
      full_name TEXT NOT NULL,
      branch TEXT NOT NULL,
      year_of_study TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, (err) => {
    if (err) console.error('Error creating users table:', err.message);
    else console.log('Table "users" ready.');
  });

  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_users_san ON users(san_number);`);

  // 2. Recruitment registrations table
  db.run(`
    CREATE TABLE IF NOT EXISTS recruitment_registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      san_number TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      branch TEXT NOT NULL,
      year_of_study TEXT NOT NULL,
      email TEXT NOT NULL,
      domains TEXT NOT NULL,
      interview_date TEXT NOT NULL,
      interview_time_slot TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(interview_date, interview_time_slot)
    )
  `, (err) => {
    if (err) console.error('Error creating recruitment table:', err.message);
    else {
      console.log('Table "recruitment_registrations" ready.');
      // Safe migration: Add user_id column if it was created before user accounts existed
      db.all(`PRAGMA table_info(recruitment_registrations)`, (infoErr, columns) => {
        if (!infoErr && columns) {
          const hasUserId = columns.some(c => c.name === 'user_id');
          if (!hasUserId) {
            db.run(`ALTER TABLE recruitment_registrations ADD COLUMN user_id INTEGER REFERENCES users(id);`, (altErr) => {
              if (!altErr) console.log('Added user_id column to recruitment_registrations.');
            });
          }
        }
      });
    }
  });

  // 3. Interview Slots table (Configured schedule)
  db.run(`
    CREATE TABLE IF NOT EXISTS interview_slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      interview_date TEXT NOT NULL,
      interview_time_slot TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      UNIQUE(interview_date, interview_time_slot)
    )
  `, (err) => {
    if (err) console.error('Error creating interview_slots table:', err.message);
    else {
      console.log('Table "interview_slots" ready.');
      seedInterviewSlots();
    }
  });

  // 4. Events table
  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      event_date TEXT NOT NULL,
      venue TEXT NOT NULL,
      category TEXT NOT NULL,
      is_open INTEGER DEFAULT 1
    )
  `, (err) => {
    if (err) console.error('Error creating events table:', err.message);
    else {
      console.log('Table "events" ready.');
      seedEvents();
    }
  });

  // 5. Event registrations table
  db.run(`
    CREATE TABLE IF NOT EXISTS event_registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      event_id TEXT NOT NULL,
      event_title TEXT NOT NULL,
      san_number TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(san_number, event_id)
    )
  `, (err) => {
    if (err) console.error('Error creating event_registrations table:', err.message);
    else {
      console.log('Table "event_registrations" ready.');
      // Safe migration: Add user_id column if it doesn't exist
      db.all(`PRAGMA table_info(event_registrations)`, (infoErr, columns) => {
        if (!infoErr && columns) {
          const hasUserId = columns.some(c => c.name === 'user_id');
          if (!hasUserId) {
            db.run(`ALTER TABLE event_registrations ADD COLUMN user_id INTEGER REFERENCES users(id);`, (altErr) => {
              if (!altErr) console.log('Added user_id column to event_registrations.');
            });
          }
        }
      });
    }
  });
});

// -----------------------------------------------------------------------------
// Configurable Lists & Schedule
// -----------------------------------------------------------------------------
const CONFIG = {
  branches: [
    'Computer Science & Engineering (CSE)',
    'Information Science & Engineering (ISE)',
    'Artificial Intelligence & Machine Learning (AIML)',
    'Computer Science & Design (CSD)',
    'Electronics & Communication Engineering (ECE)',
    'Electrical & Electronics Engineering (EEE)',
    'Mechanical Engineering (ME)',
    'Civil Engineering (CE)'
  ],
  years: [
    '1st Year',
    '2nd Year',
    '3rd Year',
    '4th Year'
  ],
  // Categorized domains as required by Section 6
  domainCategories: {
    technical: [
      'Web Development',
      'App Development',
      'Artificial Intelligence and Machine Learning (AI/ML)',
      'Data Science and Analytics',
      'Cybersecurity',
      'Cloud Computing and DevOps',
      'Backend Development',
      'UI/UX Engineering',
      'Software Development and Problem Solving'
    ],
    creative: [
      'Media and Marketing',
      'Graphic Designing',
      'UI/UX Design and Creative Design',
      'Content Writing and Copywriting',
      'Photography and Videography',
      'Social Media Management',
      'Branding and Public Relations'
    ],
    management: [
      'Sponsorship and Finance',
      'Operations and Event Management',
      'Corporate Relations',
      'Public Relations and Outreach',
      'Human Resources and Team Coordination',
      'Logistics and Planning',
      'Documentation and Reporting'
    ]
  },
  // Configured demonstration interview schedule
  initialInterviewSchedule: {
    '2026-10-24': [
      '09:30 AM - 10:00 AM',
      '10:00 AM - 10:30 AM',
      '10:30 AM - 11:00 AM',
      '11:30 AM - 12:00 PM',
      '02:00 PM - 02:30 PM',
      '02:30 PM - 03:00 PM',
      '03:30 PM - 04:00 PM'
    ],
    '2026-10-25': [
      '09:30 AM - 10:00 AM',
      '10:00 AM - 10:30 AM',
      '10:30 AM - 11:00 AM',
      '11:30 AM - 12:00 PM',
      '02:00 PM - 02:30 PM',
      '02:30 PM - 03:00 PM',
      '03:30 PM - 04:00 PM'
    ],
    '2026-10-26': [
      '10:00 AM - 10:30 AM',
      '10:30 AM - 11:00 AM',
      '11:30 AM - 12:00 PM',
      '02:00 PM - 02:30 PM',
      '02:30 PM - 03:00 PM',
      '03:30 PM - 04:00 PM'
    ]
  },
  initialEvents: [
    {
      id: 'evt-git-jumpstart',
      title: 'Git & Open-Source Jumpstart',
      description: 'Hands-on branching strategies, pull request workflows, interactive rebasing, and preparing your first open-source contribution under mentor guidance.',
      date: 'Saturday, Nov 7, 2026 &bull; 10:00 AM - 1:00 PM',
      venue: 'CSE Computing Lab 3, NMIT',
      category: 'Demonstration Workshop'
    },
    {
      id: 'evt-hackase-2026',
      title: 'HackASE 2026: 24-Hour Code Sprint',
      description: 'Collaborate in teams of up to 4 to conceptualize, prototype, and ship real-world developer tools and campus utilities. Midnight pizza and prizes included.',
      date: 'Nov 28 - 29, 2026 &bull; Starts 9:00 AM',
      venue: 'NMIT Main Auditorium & Discord',
      category: 'Demonstration Hackathon'
    },
    {
      id: 'evt-systems-bootcamp',
      title: 'Systems & Backend Architecture Masterclass',
      description: 'Demystifying concurrency, database transactions, indexing strategies, memory leaks, and resilient REST API engineering with live benchmarks.',
      date: 'Saturday, Dec 12, 2026 &bull; 2:00 PM - 5:30 PM',
      venue: 'Seminar Hall 2, NMIT',
      category: 'Demonstration Masterclass'
    }
  ]
};

// Flatten allowed domains for server validation
const ALL_ALLOWED_DOMAINS = [
  ...CONFIG.domainCategories.technical,
  ...CONFIG.domainCategories.creative,
  ...CONFIG.domainCategories.management
];

/**
 * Seed initial interview slots in SQLite if table is empty
 */
function seedInterviewSlots() {
  db.get('SELECT COUNT(*) as count FROM interview_slots', (err, row) => {
    if (!err && row && row.count === 0) {
      const stmt = db.prepare('INSERT OR IGNORE INTO interview_slots (interview_date, interview_time_slot) VALUES (?, ?)');
      for (const [date, slots] of Object.entries(CONFIG.initialInterviewSchedule)) {
        for (const slot of slots) {
          stmt.run([date, slot]);
        }
      }
      stmt.finalize(() => {
        console.log('Seeded initial interview slots into SQLite.');
      });
    }
  });
}

/**
 * Seed demonstration events in SQLite if table is empty
 */
function seedEvents() {
  db.get('SELECT COUNT(*) as count FROM events', (err, row) => {
    if (!err && row && row.count === 0) {
      const stmt = db.prepare('INSERT OR IGNORE INTO events (id, title, description, event_date, venue, category) VALUES (?, ?, ?, ?, ?, ?)');
      for (const evt of CONFIG.initialEvents) {
        stmt.run([evt.id, evt.title, evt.description, evt.date, evt.venue, evt.category]);
      }
      stmt.finalize(() => {
        console.log('Seeded demonstration events into SQLite.');
      });
    }
  });
}

// -----------------------------------------------------------------------------
// Middleware Configuration
// -----------------------------------------------------------------------------
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session setup
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // Set to true if deploying over HTTPS
      maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
  })
);

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// -----------------------------------------------------------------------------
// Validation Helpers
// -----------------------------------------------------------------------------

/**
 * Mandatory SAN Number Validation:
 * Must be EXACTLY 15 digits (digits only, preserved as string).
 */
function isValidSanNumber(san) {
  if (typeof san !== 'string') return false;
  const trimmed = san.trim();
  return /^\d{15}$/.test(trimmed);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({
    success: false,
    error: 'Authentication required. Please log in or create an account to proceed.',
    requiresAuth: true
  });
}

// -----------------------------------------------------------------------------
// API Routes: Authentication
// -----------------------------------------------------------------------------

/**
 * GET /api/auth/me
 * Returns current authenticated user state
 */
app.get('/api/auth/me', (req, res) => {
  if (req.session && req.session.user) {
    return res.json({
      authenticated: true,
      user: req.session.user
    });
  }
  return res.json({
    authenticated: false,
    user: null
  });
});

/**
 * POST /api/auth/signup
 * Creates a student account with 15-digit SAN number & bcrypt password hash
 */
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { fullName, sanNumber, branch, yearOfStudy, email, password, confirmPassword } = req.body;

    const cleanName = fullName ? String(fullName).trim() : '';
    const cleanSan = sanNumber ? String(sanNumber).trim() : '';
    const cleanEmail = email ? String(email).trim().toLowerCase() : '';

    // Field Validations
    if (!cleanName) {
      return res.status(400).json({ success: false, error: 'Full name is required.' });
    }

    // SAN Number: Exactly 15 digits
    if (!isValidSanNumber(cleanSan)) {
      return res.status(400).json({
        success: false,
        error: 'SAN number must contain exactly 15 digits (numbers only, leading zeroes preserved).'
      });
    }

    if (!branch || !CONFIG.branches.includes(branch)) {
      return res.status(400).json({ success: false, error: 'Please select a valid branch of study.' });
    }

    if (!yearOfStudy || !CONFIG.years.includes(yearOfStudy)) {
      return res.status(400).json({ success: false, error: 'Please select a valid year of study.' });
    }

    if (!cleanEmail || !isValidEmail(cleanEmail)) {
      return res.status(400).json({ success: false, error: 'A valid email address is required.' });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, error: 'Password and Confirm Password do not match.' });
    }

    // Check duplicate email
    db.get('SELECT id FROM users WHERE email = ?', [cleanEmail], async (err, existingUser) => {
      if (err) {
        console.error('Database query error on signup:', err.message);
        return res.status(500).json({ success: false, error: 'Database error checking account availability.' });
      }

      if (existingUser) {
        return res.status(409).json({
          success: false,
          error: 'An account with this email address already exists. Please log in instead.'
        });
      }

      // Hash password using bcryptjs
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const insertSql = `
        INSERT INTO users (san_number, full_name, branch, year_of_study, email, password_hash)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      db.run(insertSql, [cleanSan, cleanName, branch, yearOfStudy, cleanEmail, passwordHash], function (insertErr) {
        if (insertErr) {
          console.error('Signup insert error:', insertErr.message);
          return res.status(500).json({ success: false, error: 'Failed to create student account.' });
        }

        const newUserId = this.lastID;

        // Establish session
        req.session.regenerate((regenErr) => {
          if (regenErr) {
            console.error('Session regenerate error:', regenErr.message);
          }
          req.session.user = {
            id: newUserId,
            fullName: cleanName,
            sanNumber: cleanSan,
            branch: branch,
            yearOfStudy: yearOfStudy,
            email: cleanEmail
          };

          return res.status(201).json({
            success: true,
            message: 'Account created successfully! Welcome to ASE.',
            user: req.session.user
          });
        });
      });
    });
  } catch (err) {
    console.error('Unhandled signup error:', err);
    return res.status(500).json({ success: false, error: 'Server error processing account creation.' });
  }
});

/**
 * POST /api/auth/login
 * Authenticates user credentials and establishes server session
 */
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  const cleanEmail = email ? String(email).trim().toLowerCase() : '';
  if (!cleanEmail || !password) {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }

  db.get('SELECT * FROM users WHERE email = ?', [cleanEmail], async (err, user) => {
    if (err) {
      console.error('Database query error on login:', err.message);
      return res.status(500).json({ success: false, error: 'Database error during authentication.' });
    }

    if (!user) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: 'Invalid email or password.' });
    }

    // Regenerate session to protect against session fixation attacks
    req.session.regenerate((regenErr) => {
      if (regenErr) {
        console.error('Session regenerate error:', regenErr.message);
      }

      req.session.user = {
        id: user.id,
        fullName: user.full_name,
        sanNumber: user.san_number,
        branch: user.branch,
        yearOfStudy: user.year_of_study,
        email: user.email
      };

      return res.json({
        success: true,
        message: `Welcome back, ${user.full_name}!`,
        user: req.session.user
      });
    });
  });
});

/**
 * POST /api/auth/logout
 * Destroys current session and clears cookie
 */
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false, error: 'Could not log out at this moment.' });
    }
    res.clearCookie('connect.sid');
    return res.json({ success: true, message: 'Logged out successfully.' });
  });
});

// -----------------------------------------------------------------------------
// API Routes: Configuration & Options
// -----------------------------------------------------------------------------

/**
 * GET /api/config
 * Returns configurable options (branches, years, domain categories, dates)
 */
app.get('/api/config', (req, res) => {
  db.all('SELECT DISTINCT interview_date FROM interview_slots WHERE is_active = 1 ORDER BY interview_date ASC', (err, rows) => {
    const dates = (!err && rows && rows.length > 0) 
      ? rows.map(r => r.interview_date) 
      : Object.keys(CONFIG.initialInterviewSchedule);

    res.json({
      success: true,
      branches: CONFIG.branches,
      years: CONFIG.years,
      domainCategories: CONFIG.domainCategories,
      availableDates: dates
    });
  });
});

/**
 * GET /api/interview-slots?date=YYYY-MM-DD
 * Returns all configured interview slots for the date and real-time availability
 */
app.get('/api/interview-slots', (req, res) => {
  const selectedDate = req.query.date;

  if (!selectedDate) {
    return res.status(400).json({
      success: false,
      error: 'Please specify an interview date (YYYY-MM-DD).'
    });
  }

  // Fetch slots from interview_slots table
  db.all('SELECT interview_time_slot FROM interview_slots WHERE interview_date = ? AND is_active = 1', [selectedDate], (slotErr, slotRows) => {
    let configuredSlots = [];

    if (!slotErr && slotRows && slotRows.length > 0) {
      configuredSlots = slotRows.map(r => r.interview_time_slot);
    } else if (CONFIG.initialInterviewSchedule[selectedDate]) {
      configuredSlots = CONFIG.initialInterviewSchedule[selectedDate];
    } else {
      return res.status(400).json({
        success: false,
        error: `Date "${selectedDate}" has no configured interview slots.`
      });
    }

    // Query booked slots from recruitment_registrations
    db.all('SELECT interview_time_slot FROM recruitment_registrations WHERE interview_date = ?', [selectedDate], (bookedErr, bookedRows) => {
      if (bookedErr) {
        console.error('Error fetching booked slots:', bookedErr.message);
        return res.status(500).json({ success: false, error: 'Database error fetching slot availability.' });
      }

      const bookedSet = new Set((bookedRows || []).map(r => r.interview_time_slot));

      const slotDetails = configuredSlots.map(time => ({
        time: time,
        isAvailable: !bookedSet.has(time)
      }));

      return res.json({
        success: true,
        date: selectedDate,
        slots: slotDetails
      });
    });
  });
});

// -----------------------------------------------------------------------------
// API Routes: Recruitment Registration
// -----------------------------------------------------------------------------

/**
 * POST /api/recruitment
 * Atomically validates and books recruitment registration & interview slot
 */
app.post('/api/recruitment', requireAuth, (req, res) => {
  const {
    sanNumber,
    fullName,
    branch,
    yearOfStudy,
    email,
    domains,
    interviewDate,
    interviewTime
  } = req.body;

  const currentUserId = req.session.user.id;
  const cleanSan = sanNumber ? String(sanNumber).trim() : '';
  const cleanName = fullName ? String(fullName).trim() : '';
  const cleanEmail = email ? String(email).trim().toLowerCase() : '';

  // Mandatory SAN validation: Exactly 15 digits
  if (!isValidSanNumber(cleanSan)) {
    return res.status(400).json({
      success: false,
      error: 'SAN number must contain exactly 15 digits (numbers only, leading zeroes preserved).'
    });
  }

  if (!cleanName) {
    return res.status(400).json({ success: false, error: 'Full name is required.' });
  }

  if (!branch || !CONFIG.branches.includes(branch)) {
    return res.status(400).json({ success: false, error: 'Please select a valid branch of study.' });
  }

  if (!yearOfStudy || !CONFIG.years.includes(yearOfStudy)) {
    return res.status(400).json({ success: false, error: 'Please select a valid year of study.' });
  }

  if (!cleanEmail || !isValidEmail(cleanEmail)) {
    return res.status(400).json({ success: false, error: 'A valid email address is required.' });
  }

  // Domains validation
  const domainsList = Array.isArray(domains) ? domains : (domains ? [domains] : []);
  if (domainsList.length === 0) {
    return res.status(400).json({ success: false, error: 'Please select at least one domain of preference.' });
  }

  const invalidDomain = domainsList.find(d => !ALL_ALLOWED_DOMAINS.includes(d));
  if (invalidDomain) {
    return res.status(400).json({ success: false, error: `Invalid domain selected: ${invalidDomain}` });
  }

  if (!interviewDate) {
    return res.status(400).json({ success: false, error: 'Please select an interview date.' });
  }

  if (!interviewTime) {
    return res.status(400).json({ success: false, error: 'Please select an interview time slot.' });
  }

  const domainsSerialized = JSON.stringify(domainsList);

  // Atomic SQLite Transaction
  db.serialize(() => {
    db.run('BEGIN IMMEDIATE TRANSACTION', (beginErr) => {
      if (beginErr) {
        console.error('Transaction begin error:', beginErr.message);
        return res.status(500).json({ success: false, error: 'Could not acquire database lock. Please try again.' });
      }

      // Check duplicate candidate registration by SAN number
      db.get('SELECT id FROM recruitment_registrations WHERE san_number = ?', [cleanSan], (sanErr, sanRow) => {
        if (sanErr) {
          db.run('ROLLBACK');
          return res.status(500).json({ success: false, error: 'Database verification error.' });
        }

        if (sanRow) {
          db.run('ROLLBACK');
          return res.status(409).json({
            success: false,
            error: `A recruitment registration with SAN number "${cleanSan}" has already been submitted.`
          });
        }

        // Recheck interview slot availability at submission time
        db.get(
          'SELECT id FROM recruitment_registrations WHERE interview_date = ? AND interview_time_slot = ?',
          [interviewDate, interviewTime],
          (slotErr, slotRow) => {
            if (slotErr) {
              db.run('ROLLBACK');
              return res.status(500).json({ success: false, error: 'Database verification error.' });
            }

            if (slotRow) {
              db.run('ROLLBACK');
              return res.status(409).json({
                success: false,
                error: `The interview slot on ${interviewDate} at "${interviewTime}" has already been booked. Please select another available time slot.`
              });
            }

            // Insert recruitment registration
            const insertSql = `
              INSERT INTO recruitment_registrations (
                user_id, san_number, full_name, branch, year_of_study, email, domains, interview_date, interview_time_slot
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            db.run(insertSql, [
              currentUserId,
              cleanSan,
              cleanName,
              branch,
              yearOfStudy,
              cleanEmail,
              domainsSerialized,
              interviewDate,
              interviewTime
            ], function (insertErr) {
              if (insertErr) {
                db.run('ROLLBACK');
                if (insertErr.message.includes('UNIQUE constraint failed')) {
                  return res.status(409).json({
                    success: false,
                    error: 'Slot or SAN number already booked. Please choose another available slot.'
                  });
                }
                return res.status(500).json({ success: false, error: 'Database write error. Please try again.' });
              }

              const newId = this.lastID;

              db.run('COMMIT', (commitErr) => {
                if (commitErr) {
                  db.run('ROLLBACK');
                  return res.status(500).json({ success: false, error: 'Transaction commit failed.' });
                }

                return res.status(201).json({
                  success: true,
                  message: 'Recruitment registration confirmed! Your interview slot is reserved.',
                  registration: {
                    referenceId: `ASE-REC-${newId}`,
                    sanNumber: cleanSan,
                    fullName: cleanName,
                    branch: branch,
                    yearOfStudy: yearOfStudy,
                    email: cleanEmail,
                    domains: domainsList,
                    interviewDate: interviewDate,
                    interviewTime: interviewTime
                  }
                });
              });
            });
          }
        );
      });
    });
  });
});

// -----------------------------------------------------------------------------
// API Routes: Events & Event Registrations
// -----------------------------------------------------------------------------

/**
 * GET /api/events
 * Returns demonstration events with attendee counts
 */
app.get('/api/events', (req, res) => {
  const query = `
    SELECT e.*, 
      (SELECT COUNT(*) FROM event_registrations er WHERE er.event_id = e.id) as attendeeCount
    FROM events e
    WHERE e.is_open = 1
  `;

  db.all(query, (err, rows) => {
    if (err) {
      console.error('Error fetching events:', err.message);
      return res.status(500).json({ success: false, error: 'Database error fetching events calendar.' });
    }

    res.json({
      success: true,
      isDemo: true,
      notice: 'Demonstration events for ASE @ NMIT. Clearly labeled for demonstration.',
      events: rows || []
    });
  });
});

/**
 * POST /api/event-registrations
 * Registers a student for an ASE event, preventing duplicate registrations
 */
app.post('/api/event-registrations', requireAuth, (req, res) => {
  const { eventId, sanNumber, fullName, email } = req.body;
  const currentUserId = req.session.user.id;

  const cleanSan = sanNumber ? String(sanNumber).trim() : '';
  const cleanName = fullName ? String(fullName).trim() : '';
  const cleanEmail = email ? String(email).trim().toLowerCase() : '';

  if (!eventId) {
    return res.status(400).json({ success: false, error: 'Target event must be selected.' });
  }

  // Mandatory SAN validation: Exactly 15 digits
  if (!isValidSanNumber(cleanSan)) {
    return res.status(400).json({
      success: false,
      error: 'SAN number must contain exactly 15 digits (numbers only, leading zeroes preserved).'
    });
  }

  if (!cleanName) {
    return res.status(400).json({ success: false, error: 'Full name is required.' });
  }

  if (!cleanEmail || !isValidEmail(cleanEmail)) {
    return res.status(400).json({ success: false, error: 'A valid email address is required.' });
  }

  // Verify event exists and is open
  db.get('SELECT * FROM events WHERE id = ? AND is_open = 1', [eventId], (evtErr, targetEvent) => {
    if (evtErr || !targetEvent) {
      return res.status(404).json({ success: false, error: 'Selected event not found or is closed for registration.' });
    }

    const insertSql = `
      INSERT INTO event_registrations (user_id, event_id, event_title, san_number, full_name, email)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    db.run(insertSql, [currentUserId, targetEvent.id, targetEvent.title, cleanSan, cleanName, cleanEmail], function (err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({
            success: false,
            error: `You have already registered for "${targetEvent.title}" with SAN number "${cleanSan}".`
          });
        }
        console.error('Event registration error:', err.message);
        return res.status(500).json({ success: false, error: 'Database error saving event registration.' });
      }

      const regId = this.lastID;

      return res.status(201).json({
        success: true,
        message: `Seat confirmed! You have successfully registered for ${targetEvent.title}.`,
        registration: {
          passId: `ASE-EVT-${regId}`,
          eventId: targetEvent.id,
          eventTitle: targetEvent.title,
          sanNumber: cleanSan,
          fullName: cleanName,
          email: cleanEmail
        }
      });
    });
  });
});

// -----------------------------------------------------------------------------
// Fallback & 404 Route Handling
// -----------------------------------------------------------------------------
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, error: 'API endpoint not found' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// -----------------------------------------------------------------------------
// Server Start
// -----------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 ASE Portal running at http://localhost:${PORT}`);
  console.log(`⚡ Tagline: Ideas in mind. Code in motion.`);
  console.log(`📁 Database: SQLite (${DB_PATH})`);
  console.log(`======================================================\n`);
});
