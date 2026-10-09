import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentsService } from './appointments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let prisma: PrismaService;

  beforeEach(async () => {
    // A robust test suite would mock Prisma properly or use a test DB.
    // For this demonstration, we are just instantiating to verify it builds.
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn(),
            $executeRaw: jest.fn(),
            appointment: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              count: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            businessService: {
              findUnique: jest.fn(),
            },
            staffServiceAssignment: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
            },
            staffWorkingHours: {
              findMany: jest.fn(),
            },
            staffTimeOff: {
              findMany: jest.fn(),
            },
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            createNotification: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<AppointmentsService>(AppointmentsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
