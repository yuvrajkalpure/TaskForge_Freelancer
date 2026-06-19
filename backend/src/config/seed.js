const bcrypt = require('bcryptjs');
const { prisma } = require('./db');

async function seedAdmin() {
  try {
    const adminEmail = 'admin@taskforge.com';
    const adminPassword = 'adminpassword123';

    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (!existingAdmin) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      const admin = await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash,
          role: 'admin',
          fullName: 'System Administrator',
          isVerified: true,
          isBanned: false,
        },
      });
      console.log(`[Seed] Admin user successfully seeded: ${admin.email}`);
    } else {
      console.log(`[Seed] Admin user already exists (${adminEmail}).`);
    }
  } catch (error) {
    console.error('[Seed] Failed to seed database:', error);
  }
}

module.exports = { seedAdmin };
