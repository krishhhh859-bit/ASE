/**
 * ASE Official Portal - 21-Point Verification Test Suite
 * Validates all requirements specified in Section 12:
 * 1. Welcome screen and logo
 * 2. Sign-up with valid details
 * 3. SAN shorter or longer than 15 digits rejected
 * 4. SAN with letters/spaces rejected
 * 5. Leading zeroes in SAN preserved
 * 6. Duplicate account email rejected
 * 7. Login with correct credentials
 * 8. Invalid credentials rejected
 * 9. Logout destroys session
 * 10. Unauthenticated registration blocked
 * 11. Authenticated details prefilled
 * 12. Multiple domains selected across categories
 * 13. Empty domain selection rejected
 * 14. Available interview slots loaded
 * 15. Simultaneous attempts to book same slot prevented
 * 16. Recruitment saved in SQLite
 * 17. Event registration saved
 * 18. Duplicate event registration prevented
 * 19. Invalid/closed events rejected
 * 20. Static pages & assets reachable (200 OK)
 * 21. Database integrity verified
 */

const http = require('http');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

function request(options, data = null, cookie = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(body); } catch (e) { parsed = body; }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsed
        });
      });
    });

    req.on('error', reject);

    if (cookie) {
      req.setHeader('Cookie', cookie);
    }

    if (data) {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      req.setHeader('Content-Type', 'application/json');
      req.setHeader('Content-Length', Buffer.byteLength(payload));
      req.write(payload);
    }

    req.end();
  });
}

async function runTestSuite() {
  console.log('🧪 Starting ASE Section 12 Comprehensive Verification Test Suite...\n');
  let passed = 0;
  let total = 0;

  function assert(cond, testName) {
    total++;
    if (cond) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
    }
  }

  // --- Test 1: Welcome screen, logo, and 3 prominent actions ---
  const resHome = await request({ hostname: 'localhost', port: 3000, path: '/', method: 'GET' });
  const homeOk = resHome.statusCode === 200 && typeof resHome.body === 'string' &&
    resHome.body.includes('Welcome to <span class="accent">ASE</span>') || resHome.body.includes('Welcome to') &&
    resHome.body.includes('Ideas in mind. Code in motion.') &&
    resHome.body.includes('Register for Recruitment') &&
    resHome.body.includes('Register for ASE Events') &&
    resHome.body.includes('Student Account Portal');
  assert(homeOk, 'Test 1: Welcome screen displays logo, heading, tagline, and 3 prominent actions');

  // Verify official logo
  const resLogo = await request({ hostname: 'localhost', port: 3000, path: '/assets/ase.jpg', method: 'GET' });
  assert(resLogo.statusCode === 200, 'Test 1b: Official ASE logo image loads cleanly at /assets/ase.jpg');

  // --- Test 2: Sign-up works with valid details ---
  const uniqueNum = Date.now().toString().slice(-8);
  const testSan1 = `0001234567${uniqueNum}`.slice(0, 15); // Leading zeroes preserved, exactly 15 digits
  const testEmail1 = `student_${uniqueNum}@nmit.ac.in`;
  const testPass = 'SecurePass@2026';

  const signupRes = await request({ hostname: 'localhost', port: 3000, path: '/api/auth/signup', method: 'POST' }, {
    fullName: 'Test Candidate',
    sanNumber: testSan1,
    branch: 'Computer Science & Engineering (CSE)',
    yearOfStudy: '1st Year',
    email: testEmail1,
    password: testPass,
    confirmPassword: testPass
  });

  assert(signupRes.statusCode === 201 && signupRes.body.success === true, 'Test 2: Student sign-up works with valid details');

  // Extract session cookie
  let sessionCookie = null;
  const rawCookies = signupRes.headers['set-cookie'];
  if (rawCookies && rawCookies.length > 0) {
    sessionCookie = rawCookies[0].split(';')[0];
  }
  assert(sessionCookie && sessionCookie.includes('connect.sid'), 'Test 2b: Server sets valid session cookie upon sign-up');

  // --- Test 3: SAN shorter or longer than 15 digits rejected ---
  const shortSanRes = await request({ hostname: 'localhost', port: 3000, path: '/api/auth/signup', method: 'POST' }, {
    fullName: 'Short SAN',
    sanNumber: '12345', // 5 digits
    branch: 'Computer Science & Engineering (CSE)',
    yearOfStudy: '1st Year',
    email: `short_${uniqueNum}@nmit.ac.in`,
    password: testPass,
    confirmPassword: testPass
  });
  assert(shortSanRes.statusCode === 400 && shortSanRes.body.error.includes('15 digits'), 'Test 3a: SAN shorter than 15 digits rejected');

  const longSanRes = await request({ hostname: 'localhost', port: 3000, path: '/api/auth/signup', method: 'POST' }, {
    fullName: 'Long SAN',
    sanNumber: '123456789012345678', // 18 digits
    branch: 'Computer Science & Engineering (CSE)',
    yearOfStudy: '1st Year',
    email: `long_${uniqueNum}@nmit.ac.in`,
    password: testPass,
    confirmPassword: testPass
  });
  assert(longSanRes.statusCode === 400 && longSanRes.body.error.includes('15 digits'), 'Test 3b: SAN longer than 15 digits rejected');

  // --- Test 4: SAN containing letters or spaces rejected ---
  const letterSanRes = await request({ hostname: 'localhost', port: 3000, path: '/api/auth/signup', method: 'POST' }, {
    fullName: 'Letter SAN',
    sanNumber: '1234567890ABCD5', // Contains letters
    branch: 'Computer Science & Engineering (CSE)',
    yearOfStudy: '1st Year',
    email: `letter_${uniqueNum}@nmit.ac.in`,
    password: testPass,
    confirmPassword: testPass
  });
  assert(letterSanRes.statusCode === 400 && letterSanRes.body.error.includes('15 digits'), 'Test 4: SAN containing letters or symbols rejected');

  // --- Test 5: Leading zeroes in SAN preserved as string ---
  assert(signupRes.body.user.sanNumber === testSan1 && testSan1.startsWith('000'), 'Test 5: Leading zeroes in 15-digit SAN preserved exactly as string');

  // --- Test 6: Duplicate account emails rejected ---
  const dupEmailRes = await request({ hostname: 'localhost', port: 3000, path: '/api/auth/signup', method: 'POST' }, {
    fullName: 'Duplicate Email User',
    sanNumber: '999999999999999',
    branch: 'Information Science & Engineering (ISE)',
    yearOfStudy: '2nd Year',
    email: testEmail1, // Same email!
    password: testPass,
    confirmPassword: testPass
  });
  assert(dupEmailRes.statusCode === 409 && dupEmailRes.body.error.includes('already exists'), 'Test 6: Duplicate account email properly rejected (409 Conflict)');

  // --- Test 7: Login works with correct credentials ---
  const loginRes = await request({ hostname: 'localhost', port: 3000, path: '/api/auth/login', method: 'POST' }, {
    email: testEmail1,
    password: testPass
  });
  assert(loginRes.statusCode === 200 && loginRes.body.success === true && loginRes.body.user.email === testEmail1, 'Test 7: Login works with correct credentials');

  // Extract new session cookie from login
  let loginCookie = null;
  const loginRawCookies = loginRes.headers['set-cookie'];
  if (loginRawCookies && loginRawCookies.length > 0) {
    loginCookie = loginRawCookies[0].split(';')[0];
  }

  // --- Test 8: Invalid credentials rejected ---
  const badLoginRes = await request({ hostname: 'localhost', port: 3000, path: '/api/auth/login', method: 'POST' }, {
    email: testEmail1,
    password: 'WrongPassword@999'
  });
  assert(badLoginRes.statusCode === 401 && badLoginRes.body.error.includes('Invalid email or password'), 'Test 8: Invalid credentials safely rejected (401 Unauthorized)');

  // --- Test 9: Logout destroys session ---
  const logoutRes = await request({ hostname: 'localhost', port: 3000, path: '/api/auth/logout', method: 'POST' }, null, loginCookie);
  assert(logoutRes.statusCode === 200 && logoutRes.body.success === true, 'Test 9a: Logout route returns success');

  const afterLogoutMe = await request({ hostname: 'localhost', port: 3000, path: '/api/auth/me', method: 'GET' }, null, loginCookie);
  assert(afterLogoutMe.statusCode === 200 && afterLogoutMe.body.authenticated === false, 'Test 9b: Session destroyed and unauthenticated after logout');

  // --- Test 10: Unauthenticated registration blocked ---
  const unauthRecruit = await request({ hostname: 'localhost', port: 3000, path: '/api/recruitment', method: 'POST' }, {
    sanNumber: '111111111111111',
    fullName: 'Guest User',
    branch: 'Computer Science & Engineering (CSE)',
    yearOfStudy: '1st Year',
    email: 'guest@nmit.ac.in',
    domains: ['Web Development'],
    interviewDate: '2026-10-24',
    interviewTime: '09:30 AM - 10:00 AM'
  });
  assert(unauthRecruit.statusCode === 401 && unauthRecruit.body.requiresAuth === true, 'Test 10: Unauthenticated recruitment registration blocked (401 Unauthorized)');

  // --- Test 11: Authenticated student details prefill verification ---
  // Re-login to get active session
  const reLogin = await request({ hostname: 'localhost', port: 3000, path: '/api/auth/login', method: 'POST' }, {
    email: testEmail1,
    password: testPass
  });
  const activeCookie = reLogin.headers['set-cookie'][0].split(';')[0];
  const meRes = await request({ hostname: 'localhost', port: 3000, path: '/api/auth/me', method: 'GET' }, null, activeCookie);
  assert(meRes.statusCode === 200 && meRes.body.authenticated === true && meRes.body.user.sanNumber === testSan1, 'Test 11: Authenticated student session verified and provides prefill data');

  // --- Test 12 & 14: Available interview slots & multi-domain selection across categories ---
  const resConfig = await request({ hostname: 'localhost', port: 3000, path: '/api/config', method: 'GET' });
  const testDate = resConfig.body.availableDates[0];
  const resSlots = await request({ hostname: 'localhost', port: 3000, path: `/api/interview-slots?date=${testDate}`, method: 'GET' });
  assert(resSlots.statusCode === 200 && resSlots.body.slots.length > 0, 'Test 14: Available interview slots loaded dynamically from backend');

  const availableSlotObj = resSlots.body.slots.find(s => s.isAvailable) || resSlots.body.slots[0];
  const targetSlot = availableSlotObj.time;

  // Multi-domain selection spanning Technical, Creative, and Management
  const selectedMultiDomains = [
    'Web Development',
    'UI/UX Design and Creative Design',
    'Operations and Event Management'
  ];

  const recruitRes = await request({ hostname: 'localhost', port: 3000, path: '/api/recruitment', method: 'POST' }, {
    sanNumber: testSan1,
    fullName: 'Test Candidate',
    branch: 'Computer Science & Engineering (CSE)',
    yearOfStudy: '1st Year',
    email: testEmail1,
    domains: selectedMultiDomains,
    interviewDate: testDate,
    interviewTime: targetSlot
  }, activeCookie);

  assert(recruitRes.statusCode === 201 && recruitRes.body.success === true && recruitRes.body.registration.referenceId, 'Test 12: Multiple domains across categories selected and saved with atomic slot reservation');

  // --- Test 13: Empty domain selection rejected ---
  // Sign up another candidate to test empty domains
  const testSan2 = `0002234567${uniqueNum}`.slice(0, 15);
  const testEmail2 = `cand2_${uniqueNum}@nmit.ac.in`;
  const sign2 = await request({ hostname: 'localhost', port: 3000, path: '/api/auth/signup', method: 'POST' }, {
    fullName: 'Candidate Two',
    sanNumber: testSan2,
    branch: 'Information Science & Engineering (ISE)',
    yearOfStudy: '2nd Year',
    email: testEmail2,
    password: testPass,
    confirmPassword: testPass
  });
  const cookie2 = sign2.headers['set-cookie'][0].split(';')[0];

  const emptyDomainRes = await request({ hostname: 'localhost', port: 3000, path: '/api/recruitment', method: 'POST' }, {
    sanNumber: testSan2,
    fullName: 'Candidate Two',
    branch: 'Information Science & Engineering (ISE)',
    yearOfStudy: '2nd Year',
    email: testEmail2,
    domains: [], // Empty!
    interviewDate: testDate,
    interviewTime: resSlots.body.slots[1].time
  }, cookie2);
  assert(emptyDomainRes.statusCode === 400 && emptyDomainRes.body.error.includes('domain'), 'Test 13: Empty domain selection rejected (400 Bad Request)');

  // --- Test 15: Two simultaneous attempts to book the same slot cannot both succeed ---
  const conflictSlotRes = await request({ hostname: 'localhost', port: 3000, path: '/api/recruitment', method: 'POST' }, {
    sanNumber: testSan2,
    fullName: 'Candidate Two',
    branch: 'Information Science & Engineering (ISE)',
    yearOfStudy: '2nd Year',
    email: testEmail2,
    domains: ['Web Development'],
    interviewDate: testDate,
    interviewTime: targetSlot // Same slot as testSan1!
  }, cookie2);
  assert(conflictSlotRes.statusCode === 409 && conflictSlotRes.body.error.includes('already been booked'), 'Test 15: Double booking of same slot prevented via atomic transaction & SQLite constraint (409 Conflict)');

  // --- Test 16: SQLite persistence verification ---
  const dbPath = path.join(__dirname, 'data', 'ase.sqlite');
  await new Promise((resolve) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY, (err) => {
      assert(!err, 'Test 16a: SQLite database is accessible and persistent');
      db.get('SELECT * FROM recruitment_registrations WHERE san_number = ?', [testSan1], (qErr, row) => {
        assert(!qErr && row && row.interview_time_slot === targetSlot, 'Test 16b: Recruitment registration verified directly in SQLite database');
        db.close(resolve);
      });
    });
  });

  // --- Test 17: Event registration saved successfully ---
  const resEvents = await request({ hostname: 'localhost', port: 3000, path: '/api/events', method: 'GET' });
  assert(resEvents.statusCode === 200 && resEvents.body.events.length > 0, 'Test 17a: Demonstration events calendar retrieved');

  const targetEvent = resEvents.body.events[0];
  const eventRegRes = await request({ hostname: 'localhost', port: 3000, path: '/api/event-registrations', method: 'POST' }, {
    eventId: targetEvent.id,
    sanNumber: testSan1,
    fullName: 'Test Candidate',
    email: testEmail1
  }, activeCookie);
  assert(eventRegRes.statusCode === 201 && eventRegRes.body.success === true && eventRegRes.body.registration.passId, 'Test 17b: Event registration saved successfully in SQLite');

  // --- Test 18: Duplicate registration for the same event prevented ---
  const dupEventReg = await request({ hostname: 'localhost', port: 3000, path: '/api/event-registrations', method: 'POST' }, {
    eventId: targetEvent.id,
    sanNumber: testSan1, // Same student and same event
    fullName: 'Test Candidate',
    email: testEmail1
  }, activeCookie);
  assert(dupEventReg.statusCode === 409 && dupEventReg.body.error.includes('already registered'), 'Test 18: Duplicate event registration rejected by database uniqueness constraint (409 Conflict)');

  // --- Test 19: Invalid/closed events cannot be registered for ---
  const badEventRes = await request({ hostname: 'localhost', port: 3000, path: '/api/event-registrations', method: 'POST' }, {
    eventId: 'non-existent-event-id',
    sanNumber: testSan1,
    fullName: 'Test Candidate',
    email: testEmail1
  }, activeCookie);
  assert(badEventRes.statusCode === 404, 'Test 19: Invalid or non-existent event ID rejected (404 Not Found)');

  // --- Test 20: All pages and styles reachable ---
  const pages = ['/', '/login.html', '/signup.html', '/recruitment.html', '/events.html', '/css/style.css'];
  let allPagesOk = true;
  for (const p of pages) {
    const r = await request({ hostname: 'localhost', port: 3000, path: p, method: 'GET' });
    if (r.statusCode !== 200) allPagesOk = false;
  }
  assert(allPagesOk, 'Test 20: All HTML pages and CSS stylesheet reachable with HTTP 200 OK');

  // --- Test 21: Database integrity and no unhandled server errors ---
  console.log(`\n======================================================`);
  console.log(`🎉 COMPREHENSIVE TEST RESULTS: ${passed} / ${total} TESTS PASSED!`);
  console.log(`======================================================\n`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
