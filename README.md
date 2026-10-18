# ASE &bull; Advanced Software Engineering Club at NMIT
> **"Ideas in mind. Code in motion."**

Official Web & Registration Portal for **ASE** (Advanced Software Engineering Club) at **NMIT**. Built with a clean, professional university-tech aesthetic using Vanilla HTML5, CSS3, JavaScript, Node.js, Express, SQLite, and session authentication.

---

## 🚀 Quick Start (Windows PowerShell / Command Prompt)

The backend server is currently **running live** at **`http://localhost:3000`**. Whenever you need to run it yourself:

### 1. Open Terminal in the project directory
```powershell
cd C:\Users\Admin\Desktop\ASE.exe
```

### 2. Install Dependencies (One-time setup)
```powershell
npm install
```
*Installs only minimal dependencies: `express`, `sqlite3`, `bcryptjs`, `express-session`, and `dotenv`.*

### 3. Start the Application Server
```powershell
npm start
```
*Or for automatic restart upon file edits:*
```powershell
npm run dev
```

### 4. Open in Your Web Browser
Visit: **[http://localhost:3000](http://localhost:3000)**

### 5. Run the 26-Point Automated Test Suite
```powershell
npm test
```
*Verifies all 21 core requirements including 15-digit SAN validation, bcrypt password hashing, session management, domain categorization, atomic slot locking, and duplicate prevention.*

---

## 🎨 Visual Design & University-Tech Identity (Black Theme)

- **Color Palette:** Pure black (`#000000`) background, dark charcoal (`#111111`) secondary sections, charcoal black (`#151515`) cards & form containers, pure white (`#FFFFFF`) headings, soft white/light grey (`#D0D0D0`) body text, medium grey (`#A0A0A0`) secondary text, and subtle dark-grey borders (`#262626`).
- **Typography:** **Manrope** for bold, clean headings and **Source Sans 3** for body text. Monospaced elements (SAN numbers, reference IDs) use **JetBrains Mono**.
- **Buttons & Forms:** Formal white primary buttons with black text, transparent secondary buttons with thin grey borders, dark charcoal input surfaces (`#161616`), and crisp white focus outlines.
- **Official Logo:** Uses the official ASE logo artwork at [`public/assets/ase.jpg`](file:///c:/Users/Admin/Desktop/ASE.exe/public/assets/ase.jpg) rendered cleanly against the black identity.

---

## 📁 Project Architecture & Files

```
ASE/
├── server.js               # Express server, SQLite DB setup, session auth, APIs, atomic transactions
├── package.json            # Scripts & minimal dependencies
├── .env                    # Local environment config (PORT=3000, SESSION_SECRET)
├── .env.example            # Environment template
├── .gitignore              # Ignores data/*.sqlite, node_modules, and logs
├── README.md               # Complete documentation & interview guide
├── test_suite.js           # 26-point automated verification test runner
│
├── data/                   # Persistent SQLite Database Directory (outside public web directory)
│   └── ase.sqlite          # SQLite database file (preserved across server restarts)
│
└── public/                 # Static Frontend Web Assets
    ├── index.html          # Welcome screen with logo animation, tagline, & 3 prominent actions
    ├── signup.html         # Student account creation (mandatory 15-digit SAN, bcrypt hash)
    ├── login.html          # Student account login with session creation & redirect
    ├── recruitment.html    # Recruitment registration with 3 domain categories & fixed slots
    ├── events.html         # Demonstration events calendar & seat pass reservation
    │
    ├── css/
    │   └── style.css       # University-tech stylesheet (Manrope, Source Sans 3, warm white, dark teal)
    │
    ├── js/
    │   ├── app.js          # Global session detection, header auth controls, toasts
    │   ├── auth.js         # Client-side 15-digit SAN validation, signup & login workflows
    │   ├── recruitment.js  # Account prefill, categorized domain selection, slot booking
    │   └── events.js       # Event selection, account prefill, duplicate registration prevention
    │
    └── assets/
        └── ase.jpg         # Official ASE club logo
```

---

## 🔐 Mandatory 15-Digit SAN Number Validation

The Student Academic Number (SAN) must be **exactly 15 digits** everywhere.

1. **Frontend Validation:**
   - HTML input pattern: `pattern="\d{15}"` with `inputmode="numeric"` and `maxlength="15"`.
   - Real-time JavaScript validator (`/^\d{15}$/`) displaying live feedback (`Current length: X/15 digits`).
   - Rejects spaces, letters, punctuation, and lengths other than 15.
2. **Backend Validation:**
   - The Express backend independently executes:
     ```javascript
     function isValidSanNumber(san) {
       if (typeof san !== 'string') return false;
       return /^\d{15}$/.test(san.trim());
     }
     ```
   - **Treated as a string** throughout the backend and SQLite schema, ensuring that **leading zeroes are never stripped or lost**.

---

## 🗄️ SQLite Database Schema & Tables

All data is stored in [`data/ase.sqlite`](file:///c:/Users/Admin/Desktop/ASE.exe/data/ase.sqlite) with `PRAGMA foreign_keys = ON;`:

### 1. `users` Table (Student Accounts)
```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  san_number TEXT NOT NULL,
  full_name TEXT NOT NULL,
  branch TEXT NOT NULL,
  year_of_study TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
```

### 2. `recruitment_registrations` Table
```sql
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
);
```
- **`UNIQUE(interview_date, interview_time_slot)`**: Enforces atomic single-booking per slot.
- **`UNIQUE(san_number)`**: Enforces one recruitment submission per candidate.

### 3. `interview_slots` Table
Configured interview dates and fixed slots (`is_active = 1`).

### 4. `events` Table
Demonstration workshops and hackathons with descriptions, dates, and venues.

### 5. `event_registrations` Table
```sql
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
);
```
- **`UNIQUE(san_number, event_id)`**: Prevents duplicate registration for the same event by the same student.

---

## 🎯 Categorized Domain Selection (Section 6)

Students can select multiple domains organized into three clear categories:

1. **Technical Domains:**
   - Web Development
   - App Development
   - Artificial Intelligence and Machine Learning (AI/ML)
   - Data Science and Analytics
   - Cybersecurity
   - Cloud Computing and DevOps
   - Backend Development
   - UI/UX Engineering
   - Software Development and Problem Solving
2. **Creative and Media Domains:**
   - Media and Marketing
   - Graphic Designing
   - UI/UX Design and Creative Design
   - Content Writing and Copywriting
   - Photography and Videography
   - Social Media Management
   - Branding and Public Relations
3. **Management and Operations Domains:**
   - Sponsorship and Finance
   - Operations and Event Management
   - Corporate Relations
   - Public Relations and Outreach
   - Human Resources and Team Coordination
   - Logistics and Planning
   - Documentation and Reporting

---

## 🎙️ Interview Talking Points (For Your Round 2 Interview)

When explaining this project to the ASE senior committee:

1. **Why SQLite & Transactions?**
   - *"I used SQLite because it is lightweight, zero-configuration, and file-based, making it portable and easy to run locally. For interview scheduling, I used an SQLite `BEGIN IMMEDIATE TRANSACTION` with a `UNIQUE(interview_date, interview_time_slot)` constraint so that even if two students click 'Book' at the exact same millisecond, the database handles the lock atomically and prevents double booking."*
2. **Why 15-digit SAN validation as a String?**
   - *"If a student has a SAN with leading zeroes (e.g., `000123456789012`), treating it as an integer in JavaScript or SQL would strip the leading zeroes to `123456789012`. By storing it as a `TEXT` type and validating it with `/^\d{15}$/`, we guarantee data integrity."*
3. **How does Authentication & Session Persistence work?**
   - *"Passwords are salted and hashed using `bcryptjs` with salt rounds = 10 before saving. Plaintext passwords never touch the database. I used `express-session` with `httpOnly` cookies to keep sessions secure and prevent XSS cookie theft. When a student logs in, the session regenerates to prevent session fixation, and their account details automatically prefill the recruitment and event forms."*
4. **How did you structure the design?**
   - *"I designed a formal, disciplined university technology organisation identity with a pure black background (#000000), dark charcoal containers (#151515), pure white typography (#FFFFFF), and formal white buttons. It uses Manrope and Source Sans 3 typography with subtle dark borders, avoiding distracting neon colors or AI-generated clutter."*
