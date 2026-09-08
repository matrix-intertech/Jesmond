import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './app.module';
import { PrismaService } from './modules/prisma/prisma.service';

describe('API Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    prisma = app.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should withdraw app', async () => {
    const user = await prisma.user.findFirst({ where: { email: 'student@jesmond.demo' } });
    if (!user) return console.log('no user');
    const resLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'student@jesmond.demo', password: 'Jesmond@Demo2026!' });
      
    const token = resLogin.body.accessToken || resLogin.body.access_token;
    console.log(resLogin.body);
    expect(token).toBeDefined();

    let appRecord = await prisma.application.findFirst({ where: { studentId: user.id } });
    if (!appRecord) {
      const roomType = await prisma.roomType.findFirst();
      appRecord = await prisma.application.create({
        data: {
          studentId: user.id,
          roomTypeId: roomType!.id,
          status: 'PENDING_REVIEW',
          moveInDate: new Date(),
          durationMonths: 12,
          lockedPrice: 10000,
        }
      });
    }

    console.log('AppRecord:', appRecord);
    const res = await request(app.getHttpServer())
      .post(`/api/v1/applications/${appRecord.id}/withdraw`)
      .set('Authorization', `Bearer ${token}`);
    
    console.log(res.body);
    expect(res.status).toBe(201); // Created or 200 OK
  });
});
