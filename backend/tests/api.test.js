const test = require('node:test');
const assert = require('node:assert');
const { prisma } = require('../src/config/db');
const { startServer } = require('../src/server');

const PORT = 5001;
const ORIGIN = `http://localhost:${PORT}`;
let serverInstance;

async function cleanTestData() {
  const testEmails = ['test_client@taskforge.com', 'test_freelancer@taskforge.com'];
  const testUsers = await prisma.user.findMany({
    where: { email: { in: testEmails } },
    select: { id: true }
  });
  const testUserIds = testUsers.map(u => u.id);

  if (testUserIds.length > 0) {
    await prisma.review.deleteMany({
      where: {
        OR: [
          { reviewerId: { in: testUserIds } },
          { revieweeId: { in: testUserIds } }
        ]
      }
    });
    await prisma.bid.deleteMany({
      where: { freelancerId: { in: testUserIds } }
    });
    await prisma.bid.deleteMany({
      where: { project: { clientId: { in: testUserIds } } }
    });
    await prisma.project.deleteMany({
      where: { clientId: { in: testUserIds } }
    });
    await prisma.refreshToken.deleteMany({
      where: { userId: { in: testUserIds } }
    });
    await prisma.user.deleteMany({
      where: { id: { in: testUserIds } }
    });
  }

  await prisma.pendingUser.deleteMany({
    where: { email: { in: testEmails } }
  });
}

test.before(async () => {
  await cleanTestData();
  serverInstance = await startServer(PORT);
});

test.after(async () => {
  await cleanTestData();
  if (serverInstance) {
    await new Promise(resolve => serverInstance.close(resolve));
  }
  await prisma.$disconnect();
});

test('TaskForge End-to-End API Flow', async (t) => {
  const appOrigin = ORIGIN;

  let clientToken = '';
  let freelancerToken = '';
  let adminToken = '';
  
  let clientId = '';
  let freelancerId = '';
  
  let projectId = '';
  let bidId = '';

  await t.test('1. Register Client & Freelancer', async () => {
    // Client Registration
    const clientRes = await fetch(`${appOrigin}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test_client@taskforge.com',
        password: 'password123',
        fullName: 'Test Client',
        role: 'client'
      })
    });
    const clientData = await clientRes.json();
    assert.strictEqual(clientRes.status, 201);
    assert.ok(clientData.userId);
    clientId = clientData.userId;

    // Freelancer Registration
    const freeRes = await fetch(`${appOrigin}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test_freelancer@taskforge.com',
        password: 'password123',
        fullName: 'Test Freelancer',
        role: 'freelancer'
      })
    });
    const freeData = await freeRes.json();
    assert.strictEqual(freeRes.status, 201);
    assert.ok(freeData.userId);
    freelancerId = freeData.userId;
  });

  await t.test('2. Email Verification via Database OTP Lookup', async () => {
    // In local testing, we look up the OTP from the PendingUser table
    const clientPending = await prisma.pendingUser.findUnique({ where: { email: 'test_client@taskforge.com' } });
    const freePending = await prisma.pendingUser.findUnique({ where: { email: 'test_freelancer@taskforge.com' } });

    assert.ok(clientPending.otp);
    assert.ok(freePending.otp);

    // Verify Client via OTP
    const verifyClientRes = await fetch(`${appOrigin}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test_client@taskforge.com', otp: clientPending.otp })
    });
    assert.strictEqual(verifyClientRes.status, 200);

    // Verify Freelancer via OTP
    const verifyFreeRes = await fetch(`${appOrigin}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test_freelancer@taskforge.com', otp: freePending.otp })
    });
    assert.strictEqual(verifyFreeRes.status, 200);
  });

  await t.test('3. Authenticate & Retrieve JWT Tokens', async () => {
    // Client Login
    const clientLoginRes = await fetch(`${appOrigin}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test_client@taskforge.com',
        password: 'password123'
      })
    });
    const clientLoginData = await clientLoginRes.json();
    assert.strictEqual(clientLoginRes.status, 200);
    assert.ok(clientLoginData.accessToken);
    clientToken = clientLoginData.accessToken;

    // Freelancer Login
    const freeLoginRes = await fetch(`${appOrigin}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test_freelancer@taskforge.com',
        password: 'password123'
      })
    });
    const freeLoginData = await freeLoginRes.json();
    assert.strictEqual(freeLoginRes.status, 200);
    assert.ok(freeLoginData.accessToken);
    freelancerToken = freeLoginData.accessToken;
  });

  await t.test('4. Create Project (Client Access Only)', async () => {
    // Freelancer tries to post a project (Should fail)
    const failRes = await fetch(`${appOrigin}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${freelancerToken}`
      },
      body: JSON.stringify({
        title: 'Freelancer Project',
        description: 'Should fail',
        budget: 100
      })
    });
    assert.strictEqual(failRes.status, 403); // Forbidden

    // Client posts a project (Should succeed)
    const successRes = await fetch(`${appOrigin}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${clientToken}`
      },
      body: JSON.stringify({
        title: 'E-commerce Redesign API',
        description: 'Build a high-performance REST API with Express and Postgres.',
        budget: 850.00
      })
    });
    const successData = await successRes.json();
    assert.strictEqual(successRes.status, 201);
    assert.ok(successData.project.id);
    projectId = successData.project.id;
  });

  await t.test('5. Submit Bid (Freelancer Access Only)', async () => {
    // Client tries to place bid on own project (Should fail)
    const failRes = await fetch(`${appOrigin}/api/projects/${projectId}/bids`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${clientToken}`
      },
      body: JSON.stringify({
        amount: 800,
        proposal: 'I can do this easily.'
      })
    });
    assert.strictEqual(failRes.status, 403); // Forbidden

    // Freelancer places bid (Should succeed)
    const successRes = await fetch(`${appOrigin}/api/projects/${projectId}/bids`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${freelancerToken}`
      },
      body: JSON.stringify({
        amount: 750.00,
        proposal: 'Expert node engineer. Will complete in 3 days with clean tests.'
      })
    });
    const successData = await successRes.json();
    assert.strictEqual(successRes.status, 201);
    assert.ok(successData.bid.id);
    bidId = successData.bid.id;
  });

  await t.test('6. Accept Bid (Client Owner Only)', async () => {
    // Accept bid
    const acceptRes = await fetch(`${appOrigin}/api/projects/${projectId}/accept-bid`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${clientToken}`
      },
      body: JSON.stringify({ bidId })
    });
    const acceptData = await acceptRes.json();
    assert.strictEqual(acceptRes.status, 200);
    assert.strictEqual(acceptData.project.status, 'ASSIGNED');
    assert.strictEqual(acceptData.project.freelancerId, freelancerId);
  });

  await t.test('7. Deliver Work (Assigned Freelancer Only)', async () => {
    // Deliver work
    const deliverRes = await fetch(`${appOrigin}/api/projects/${projectId}/deliver`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${freelancerToken}`
      }
    });
    const deliverData = await deliverRes.json();
    assert.strictEqual(deliverRes.status, 200);
    assert.strictEqual(deliverData.project.status, 'DELIVERED');
  });

  await t.test('8. Complete Project (Client Owner Only)', async () => {
    // Complete project
    const completeRes = await fetch(`${appOrigin}/api/projects/${projectId}/complete`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${clientToken}`
      }
    });
    const completeData = await completeRes.json();
    assert.strictEqual(completeRes.status, 200);
    assert.strictEqual(completeData.project.status, 'COMPLETED');
  });

  await t.test('9. Review Project Exchange', async () => {
    // Client reviews Freelancer
    const clientReviewRes = await fetch(`${appOrigin}/api/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${clientToken}`
      },
      body: JSON.stringify({
        projectId,
        rating: 5,
        comment: 'Outstanding delivery! Clean architecture and highly professional.'
      })
    });
    assert.strictEqual(clientReviewRes.status, 201);
  });

  await t.test('10. Admin User Moderation Check', async () => {
    // Admin login
    const adminLoginRes = await fetch(`${appOrigin}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@taskforge.com',
        password: 'adminpassword123'
      })
    });
    const adminLoginData = await adminLoginRes.json();
    assert.strictEqual(adminLoginRes.status, 200);
    adminToken = adminLoginData.accessToken;

    // Admin lists users
    const usersRes = await fetch(`${appOrigin}/api/admin/users`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const users = await usersRes.json();
    assert.strictEqual(usersRes.status, 200);
    assert.ok(users.length >= 3); // Admin, Client, Freelancer

    // Ban Freelancer
    const banRes = await fetch(`${appOrigin}/api/admin/users/${freelancerId}/ban`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ isBanned: true })
    });
    assert.strictEqual(banRes.status, 200);

    // Verify Freelancer cannot login anymore
    const loginFailRes = await fetch(`${appOrigin}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test_freelancer@taskforge.com',
        password: 'password123'
      })
    });
    assert.strictEqual(loginFailRes.status, 403); // Forbidden (Banned)
  });
});
