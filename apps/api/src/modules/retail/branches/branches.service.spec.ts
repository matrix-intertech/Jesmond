import { Test, TestingModule } from '@nestjs/testing';
import { BranchesService } from './branches.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

describe('BranchesService', () => {
  let service: BranchesService;
  let redisService: RedisService;

  const mockPrisma = {
    retailBranch: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockRedis = {
    del: jest.fn().mockResolvedValue(1),
    delByPattern: jest.fn().mockResolvedValue(1),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BranchesService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: RedisService, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<BranchesService>(BranchesService);
    redisService = module.get<RedisService>(RedisService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should invalidate marketplace store cache on branch mutation', async () => {
    mockPrisma.retailBranch.create.mockResolvedValue({ id: 'b1', organizationId: 'org1' });
    await service.createBranch('org1', { name: 'New Branch' } as any);
    expect(mockRedis.delByPattern).toHaveBeenCalledWith('retail:marketplace:stores:*');
  });
});
