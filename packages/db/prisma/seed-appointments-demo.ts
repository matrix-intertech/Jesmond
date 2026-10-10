import {
  PrismaClient,
  OrgType,
  OrgStatus,
  BusinessCategory,
  UserRole,
  AccountStatus,
} from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

interface DemoServiceDef {
  name: string;
  description: string;
  durationMins: number;
  price: number; // in cents AUD
  currency: string;
}

interface DemoWorkingHourDef {
  dayOfWeek: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  startTime: string;
  endTime: string;
}

interface DemoAccountConfig {
  email: string;
  passwordPlain: string;
  firstName: string;
  lastName: string;
  orgName: string;
  businessCategory: BusinessCategory;
  branchName: string;
  branchAddress: string;
  services: DemoServiceDef[];
  workingHours: DemoWorkingHourDef[];
}

// Standard weekly working hours:
// Monday to Friday: 09:00 - 17:00
// Saturday: 09:00 - 13:00
// Sunday: no entry
const STANDARD_WORKING_HOURS: DemoWorkingHourDef[] = [
  { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }, // Monday
  { dayOfWeek: 2, startTime: "09:00", endTime: "17:00" }, // Tuesday
  { dayOfWeek: 3, startTime: "09:00", endTime: "17:00" }, // Wednesday
  { dayOfWeek: 4, startTime: "09:00", endTime: "17:00" }, // Thursday
  { dayOfWeek: 5, startTime: "09:00", endTime: "17:00" }, // Friday
  { dayOfWeek: 6, startTime: "09:00", endTime: "13:00" }, // Saturday
];

const DEMO_CONFIGS: DemoAccountConfig[] = [
  {
    email: "demo.services@jesmond.com.au",
    passwordPlain: "12345678",
    firstName: "Demo",
    lastName: "Services",
    orgName: "Jesmond Demo Services",
    businessCategory: BusinessCategory.SERVICES,
    branchName: "Jesmond Demo Services - Main Branch",
    branchAddress: "100 Business Way, Jesmond NSW 2299",
    services: [
      {
        name: "General Consultation",
        description: "Standard consultation session",
        durationMins: 30,
        price: 6000, // AUD 60 in cents
        currency: "AUD",
      },
      {
        name: "Extended Consultation",
        description: "Comprehensive consultation session",
        durationMins: 60,
        price: 9000, // AUD 90 in cents
        currency: "AUD",
      },
    ],
    workingHours: STANDARD_WORKING_HOURS,
  },
  {
    email: "demo.mechanics@jesmond.com.au",
    passwordPlain: "12345678",
    firstName: "Demo",
    lastName: "Mechanics",
    orgName: "Jesmond Demo Mechanics",
    businessCategory: BusinessCategory.MECHANICS,
    branchName: "Jesmond Demo Mechanics - Workshop",
    branchAddress: "200 Auto Park, Jesmond NSW 2299",
    services: [
      {
        name: "Vehicle Inspection",
        description: "Complete multi-point vehicle safety inspection",
        durationMins: 60,
        price: 12000, // AUD 120 in cents
        currency: "AUD",
      },
      {
        name: "Logbook Service",
        description: "Scheduled manufacturer logbook maintenance service",
        durationMins: 90,
        price: 18000, // AUD 180 in cents
        currency: "AUD",
      },
    ],
    workingHours: STANDARD_WORKING_HOURS,
  },
];

interface ExecutionPlan {
  config: DemoAccountConfig;
  user: {
    status: "EXISTS_REUSE" | "CREATE";
    id?: string;
  };
  organization: {
    status: "EXISTS_REUSE" | "CREATE";
    id?: string;
  };
  branch: {
    status: "EXISTS_REUSE" | "CREATE";
    id?: string;
  };
  staff: {
    status: "EXISTS_REUSE" | "CREATE";
    id?: string;
  };
  staffBranch: {
    status: "EXISTS_REUSE" | "CREATE";
  };
  services: {
    name: string;
    status: "EXISTS_REUSE" | "CREATE";
    id?: string;
    price: number;
    durationMins: number;
    currency: string;
  }[];
  assignments: {
    serviceName: string;
    status: "EXISTS_REUSE" | "CREATE";
  }[];
  workingHours: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    status: "EXISTS_REUSE" | "CREATE";
  }[];
}

async function validateAndPlan(
  config: DemoAccountConfig,
): Promise<ExecutionPlan> {
  // 1. Safety validation on User
  const existingUser = await prisma.user.findUnique({
    where: { email: config.email },
  });

  if (existingUser) {
    if (existingUser.role !== UserRole.ORG_STAFF) {
      throw new Error(
        `Safety Check Failed: Existing user '${config.email}' has unexpected role '${existingUser.role}'. Expected '${UserRole.ORG_STAFF}'. Aborting to prevent modifying unrelated accounts.`,
      );
    }
    if (existingUser.accountStatus !== AccountStatus.ACTIVE) {
      throw new Error(
        `Safety Check Failed: Existing user '${config.email}' has accountStatus '${existingUser.accountStatus}'. Expected '${AccountStatus.ACTIVE}'. Aborting.`,
      );
    }
  }

  // 2. Safety validation on Organization
  const existingOrg = await prisma.organization.findFirst({
    where: { name: config.orgName },
  });

  if (existingOrg) {
    if (existingOrg.type !== OrgType.RETAIL) {
      throw new Error(
        `Safety Check Failed: Existing organization '${config.orgName}' has unexpected type '${existingOrg.type}'. Expected '${OrgType.RETAIL}'. Aborting.`,
      );
    }
    if (existingOrg.status !== OrgStatus.VERIFIED) {
      throw new Error(
        `Safety Check Failed: Existing organization '${config.orgName}' has unexpected status '${existingOrg.status}'. Expected '${OrgStatus.VERIFIED}'. Aborting.`,
      );
    }
    if (existingOrg.businessCategory !== config.businessCategory) {
      throw new Error(
        `Safety Check Failed: Existing organization '${config.orgName}' has businessCategory '${existingOrg.businessCategory}'. Expected '${config.businessCategory}'. Aborting.`,
      );
    }
  }

  // 3. Retail Branch
  let existingBranch = null;
  if (existingOrg) {
    existingBranch = await prisma.retailBranch.findFirst({
      where: {
        organizationId: existingOrg.id,
        name: config.branchName,
      },
    });
  }

  // 4. OrgStaff
  let existingStaff = null;
  if (existingUser && existingOrg) {
    existingStaff = await prisma.orgStaff.findUnique({
      where: {
        userId_organizationId: {
          userId: existingUser.id,
          organizationId: existingOrg.id,
        },
      },
    });
  }

  // 5. OrgStaffBranch
  let existingStaffBranch = null;
  if (existingStaff && existingBranch) {
    existingStaffBranch = await prisma.orgStaffBranch.findUnique({
      where: {
        staffId_branchId: {
          staffId: existingStaff.id,
          branchId: existingBranch.id,
        },
      },
    });
  }

  // 6. Services & Safety Check
  const servicePlans: ExecutionPlan["services"] = [];
  const assignmentPlans: ExecutionPlan["assignments"] = [];

  for (const s of config.services) {
    let matchedService = null;
    if (existingOrg) {
      matchedService = await prisma.businessService.findFirst({
        where: {
          organizationId: existingOrg.id,
          name: s.name,
          ...(existingBranch ? { branchId: existingBranch.id } : {}),
        },
      });

      if (matchedService) {
        if (
          matchedService.durationMins !== s.durationMins ||
          matchedService.price !== s.price ||
          matchedService.currency !== s.currency
        ) {
          throw new Error(
            `Safety Check Failed: Service '${s.name}' for organization '${config.orgName}' already exists with conflicting configuration (duration: ${matchedService.durationMins}m vs ${s.durationMins}m, price: ${matchedService.price} vs ${s.price}, currency: ${matchedService.currency} vs ${s.currency}). Aborting.`,
          );
        }
      }
    }

    servicePlans.push({
      name: s.name,
      status: matchedService ? "EXISTS_REUSE" : "CREATE",
      id: matchedService?.id,
      price: s.price,
      durationMins: s.durationMins,
      currency: s.currency,
    });

    let matchedAssignment = null;
    if (existingStaff && matchedService) {
      matchedAssignment = await prisma.staffServiceAssignment.findUnique({
        where: {
          staffId_serviceId: {
            staffId: existingStaff.id,
            serviceId: matchedService.id,
          },
        },
      });
    }

    assignmentPlans.push({
      serviceName: s.name,
      status: matchedAssignment ? "EXISTS_REUSE" : "CREATE",
    });
  }

  // 7. Working Hours
  const workingHoursPlans: ExecutionPlan["workingHours"] = [];
  if (existingStaff) {
    const existingHours = await prisma.staffWorkingHours.findMany({
      where: { staffId: existingStaff.id },
    });

    for (const wh of config.workingHours) {
      const match = existingHours.find(
        (h) =>
          h.dayOfWeek === wh.dayOfWeek &&
          h.startTime === wh.startTime &&
          h.endTime === wh.endTime,
      );
      workingHoursPlans.push({
        dayOfWeek: wh.dayOfWeek,
        startTime: wh.startTime,
        endTime: wh.endTime,
        status: match ? "EXISTS_REUSE" : "CREATE",
      });
    }
  } else {
    for (const wh of config.workingHours) {
      workingHoursPlans.push({
        dayOfWeek: wh.dayOfWeek,
        startTime: wh.startTime,
        endTime: wh.endTime,
        status: "CREATE",
      });
    }
  }

  return {
    config,
    user: {
      status: existingUser ? "EXISTS_REUSE" : "CREATE",
      id: existingUser?.id,
    },
    organization: {
      status: existingOrg ? "EXISTS_REUSE" : "CREATE",
      id: existingOrg?.id,
    },
    branch: {
      status: existingBranch ? "EXISTS_REUSE" : "CREATE",
      id: existingBranch?.id,
    },
    staff: {
      status: existingStaff ? "EXISTS_REUSE" : "CREATE",
      id: existingStaff?.id,
    },
    staffBranch: {
      status: existingStaffBranch ? "EXISTS_REUSE" : "CREATE",
    },
    services: servicePlans,
    assignments: assignmentPlans,
    workingHours: workingHoursPlans,
  };
}

async function applyPlan(plan: ExecutionPlan) {
  const { config } = plan;

  return await prisma.$transaction(async (tx) => {
    // 1. User
    let userId = plan.user.id;
    if (!userId) {
      const passwordHash = await bcrypt.hash(config.passwordPlain, 10);
      const newUser = await tx.user.create({
        data: {
          email: config.email,
          password: passwordHash,
          firstName: config.firstName,
          lastName: config.lastName,
          role: UserRole.ORG_STAFF,
          accountStatus: AccountStatus.ACTIVE,
          emailVerified: true,
        },
      });
      userId = newUser.id;
      console.log(`  [+] Created User: ${config.email} (${userId})`);
    } else {
      console.log(`  [=] Reused User: ${config.email} (${userId})`);
    }

    // 2. Organization
    let orgId = plan.organization.id;
    if (!orgId) {
      const newOrg = await tx.organization.create({
        data: {
          name: config.orgName,
          type: OrgType.RETAIL,
          status: OrgStatus.VERIFIED,
          businessCategory: config.businessCategory,
          timezone: "Australia/Sydney",
        },
      });
      orgId = newOrg.id;
      console.log(`  [+] Created Organization: ${config.orgName} (${orgId})`);
    } else {
      console.log(`  [=] Reused Organization: ${config.orgName} (${orgId})`);
    }

    // 3. RetailBranch
    let branchId = plan.branch.id;
    if (!branchId) {
      const newBranch = await tx.retailBranch.create({
        data: {
          organizationId: orgId,
          name: config.branchName,
          address: config.branchAddress,
          isActive: true,
        },
      });
      branchId = newBranch.id;
      console.log(
        `  [+] Created RetailBranch: ${config.branchName} (${branchId})`,
      );
    } else {
      console.log(
        `  [=] Reused RetailBranch: ${config.branchName} (${branchId})`,
      );
    }

    // 4. OrgStaff
    let staffId = plan.staff.id;
    if (!staffId) {
      const newStaff = await tx.orgStaff.create({
        data: {
          userId,
          organizationId: orgId,
          role: UserRole.ORG_STAFF,
          retailBranchId: branchId,
          permissions: ["*"],
        },
      });
      staffId = newStaff.id;
      console.log(`  [+] Created OrgStaff: (${staffId})`);
    } else {
      if (!plan.staff.id) {
        // Just in case, update retailBranchId if missing
        await tx.orgStaff.update({
          where: { id: staffId },
          data: { retailBranchId: branchId },
        });
      }
      console.log(`  [=] Reused OrgStaff: (${staffId})`);
    }

    // 5. OrgStaffBranch
    if (plan.staffBranch.status === "CREATE") {
      await tx.orgStaffBranch.upsert({
        where: {
          staffId_branchId: {
            staffId,
            branchId,
          },
        },
        update: {},
        create: {
          staffId,
          branchId,
        },
      });
      console.log(
        `  [+] Created OrgStaffBranch: staff=${staffId}, branch=${branchId}`,
      );
    } else {
      console.log(
        `  [=] Reused OrgStaffBranch: staff=${staffId}, branch=${branchId}`,
      );
    }

    // 6. BusinessServices & Assignments
    const serviceMap = new Map<string, string>();
    for (let i = 0; i < config.services.length; i++) {
      const s = config.services[i];
      const sPlan = plan.services[i];

      let serviceId = sPlan.id;
      if (!serviceId) {
        const newService = await tx.businessService.create({
          data: {
            organizationId: orgId,
            branchId,
            name: s.name,
            description: s.description,
            durationMins: s.durationMins,
            price: s.price,
            currency: s.currency,
            isActive: true,
          },
        });
        serviceId = newService.id;
        console.log(`  [+] Created BusinessService: ${s.name} (${serviceId})`);
      } else {
        console.log(`  [=] Reused BusinessService: ${s.name} (${serviceId})`);
      }
      serviceMap.set(s.name, serviceId);

      // StaffServiceAssignment
      const aPlan = plan.assignments[i];
      if (aPlan.status === "CREATE") {
        await tx.staffServiceAssignment.upsert({
          where: {
            staffId_serviceId: {
              staffId,
              serviceId,
            },
          },
          update: {},
          create: {
            staffId,
            serviceId,
          },
        });
        console.log(`  [+] Assigned staff to service: ${s.name}`);
      } else {
        console.log(`  [=] Reused staff assignment to service: ${s.name}`);
      }
    }

    // 7. StaffWorkingHours
    for (const whPlan of plan.workingHours) {
      if (whPlan.status === "CREATE") {
        const existing = await tx.staffWorkingHours.findFirst({
          where: {
            staffId,
            dayOfWeek: whPlan.dayOfWeek,
            startTime: whPlan.startTime,
            endTime: whPlan.endTime,
          },
        });
        if (!existing) {
          await tx.staffWorkingHours.create({
            data: {
              staffId,
              dayOfWeek: whPlan.dayOfWeek,
              startTime: whPlan.startTime,
              endTime: whPlan.endTime,
            },
          });
          console.log(
            `  [+] Created WorkingHours: Day ${whPlan.dayOfWeek} ${whPlan.startTime}-${whPlan.endTime}`,
          );
        } else {
          console.log(
            `  [=] Reused WorkingHours: Day ${whPlan.dayOfWeek} ${whPlan.startTime}-${whPlan.endTime}`,
          );
        }
      } else {
        console.log(
          `  [=] Reused WorkingHours: Day ${whPlan.dayOfWeek} ${whPlan.startTime}-${whPlan.endTime}`,
        );
      }
    }
  });
}

function printPlan(plan: ExecutionPlan) {
  const { config } = plan;
  console.log(`\n======================================================`);
  console.log(`Account: ${config.email}`);
  console.log(`Organization: ${config.orgName} [${config.businessCategory}]`);
  console.log(`Branch: ${config.branchName}`);
  console.log(`------------------------------------------------------`);
  console.log(
    `  User:            [${plan.user.status}] ${plan.user.id || "(will create)"}`,
  );
  console.log(
    `  Organization:    [${plan.organization.status}] ${plan.organization.id || "(will create)"}`,
  );
  console.log(
    `  RetailBranch:    [${plan.branch.status}] ${plan.branch.id || "(will create)"}`,
  );
  console.log(
    `  OrgStaff:        [${plan.staff.status}] ${plan.staff.id || "(will create)"}`,
  );
  console.log(`  OrgStaffBranch:  [${plan.staffBranch.status}]`);

  console.log(`  Services:`);
  for (const s of plan.services) {
    console.log(
      `    - ${s.name} (${s.durationMins}m, ${s.currency} ${s.price / 100}): [${s.status}] ${s.id || "(will create)"}`,
    );
  }

  console.log(`  Assignments:`);
  for (const a of plan.assignments) {
    console.log(`    - Service '${a.serviceName}': [${a.status}]`);
  }

  console.log(`  Working Hours:`);
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  for (const wh of plan.workingHours) {
    console.log(
      `    - ${dayNames[wh.dayOfWeek]}: ${wh.startTime} - ${wh.endTime} [${wh.status}]`,
    );
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes("--apply");

  console.log("------------------------------------------------------");
  console.log("Jesmond — Appointment Demo Accounts Seed Script");
  console.log(
    `Mode: ${isApply ? "APPLY (Database Writes Enabled)" : "DRY-RUN (Read-Only Preview)"}`,
  );
  console.log("------------------------------------------------------");

  if (!isApply) {
    console.log("NOTE: Running in default read-only dry-run mode.");
    console.log("Pass the --apply flag to execute database changes.\n");
  }

  const plans: ExecutionPlan[] = [];

  // Step 1: Pre-flight safety checks and plan generation
  for (const config of DEMO_CONFIGS) {
    console.log(`Checking safety constraints for ${config.email}...`);
    const plan = await validateAndPlan(config);
    plans.push(plan);
  }

  console.log("\n================ Execution Plan ================");
  for (const plan of plans) {
    printPlan(plan);
  }
  console.log("================================================\n");

  if (!isApply) {
    console.log("Dry-run completed successfully.");
    console.log("No database records were created or modified.");
    console.log("To apply these changes, run with: --apply");
    return;
  }

  // Step 2: Apply changes inside transaction
  console.log("Applying changes...");
  for (const plan of plans) {
    console.log(`\nApplying configuration for ${plan.config.email}...`);
    await applyPlan(plan);
  }

  console.log("\nAll demo appointment accounts have been successfully seeded!");
}

main()
  .catch((err) => {
    console.error("\n[ERROR] Execution aborted:");
    console.error(err.message || err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
