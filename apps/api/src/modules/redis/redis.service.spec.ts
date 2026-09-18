import { Test, TestingModule } from '@nestjs/testing';
import { RedisService } from './redis.service';

describe('RedisService', () => {
  let service: RedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RedisService],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should handle get gracefully when Redis client is disconnected', async () => {
    const val = await service.get('test-key');
    expect(val).toBeNull();
  });

  it('should handle set gracefully when Redis client is disconnected', async () => {
    await expect(service.set('test-key', { a: 1 })).resolves.not.toThrow();
  });

  it('should handle del and delPattern gracefully when Redis client is disconnected', async () => {
    await expect(service.del('test-key')).resolves.not.toThrow();
    await expect(service.delPattern('test-*')).resolves.not.toThrow();
  });
});
