const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const confirmProd = process.env.CONFIRM_PRODUCTION === 'true';

async function ensureUser(email, requiredRole) {
  let user = await prisma.user.findUnique({ where: { email }, include: { orgStaffRoles: { include: { organization: true } } } });
  
  if (!user) {
    console.error(`Required user ${email} does not exist. Create this account through the normal signup flow.`);
    process.exit(1);
  }

  if (user.role !== requiredRole) {
    user = await prisma.user.update({
      where: { email },
      data: { role: requiredRole },
      include: { orgStaffRoles: { include: { organization: true } } }
    });
    console.log(`Updated user ${email} to role ${requiredRole}`);
  } else {
    console.log(`User ${email} already has role ${requiredRole}`);
  }
  return user;
}

async function ensureOrg(user, type, expectedName) {
  const existingOrgs = user.orgStaffRoles.filter(r => r.organization.type === type);
  
  if (existingOrgs.length > 1) {
    console.error(`ABORT: User ${user.email} belongs to multiple ${type} organizations. Cannot proceed safely.`);
    console.error(existingOrgs.map(o => o.organization.name).join(', '));
    process.exit(1);
  }

  if (existingOrgs.length === 1) {
    console.log(`Reusing existing organization: ${existingOrgs[0].organization.name}`);
    return existingOrgs[0].organization;
  }

  const org = await prisma.organization.create({
    data: { name: expectedName, type, status: 'VERIFIED' }
  });
  await prisma.orgStaff.create({
    data: { userId: user.id, organizationId: org.id, role: 'ADMIN' }
  });
  console.log(`Created new organization: ${expectedName} and assigned user.`);
  return org;
}

async function setupUsers() {
  console.log("=== PRODUCTION USER SETUP ===");
  if (!confirmProd) {
    console.error("ABORT: CONFIRM_PRODUCTION=true is required.");
    process.exit(1);
  }
  console.log("DATABASE HOST: " + (process.env.DATABASE_URL?.split('@')[1]?.split('/')[0] || "Unknown"));
  console.log("DATABASE NAME: " + (process.env.DATABASE_URL?.split('/').pop()?.split('?')[0] || "Unknown"));
  console.log("DATABASE USER: " + (process.env.DATABASE_URL?.split('://')[1]?.split(':')[0] || "Unknown"));

  try {
    const shikhar = await ensureUser('shikharshaurya.01@gmail.com', 'ORG_STAFF');
    await ensureOrg(shikhar, 'RETAIL', 'Jesmond Demo Retail');

    const allien = await ensureUser('allienshaurya@gmail.com', 'ORG_STAFF');
    await ensureOrg(allien, 'PROVIDER', 'Jesmond Demo Host');

    await ensureUser('ssmnvi012@gmail.com', 'STUDENT');

    console.log("User setup complete.");
  } catch (err) {
    console.error("Setup error:", err);
  } finally {
    await prisma.$disconnect();
  }
}
setupUsers();
