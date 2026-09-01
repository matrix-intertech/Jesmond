import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });

const expressApp = app.getHttpAdapter().getInstance();
expressApp.set('trust proxy', 1);

  // 1. Request Logging via Pino
  app.useLogger(app.get(Logger));

  // 2. Request ID Middleware (Basic implementation for scaffolding)
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestId = req.headers['x-request-id'] || crypto.randomUUID();
    req.id = requestId;
    res.setHeader('X-Request-Id', requestId);
    next();
  });

  // 3. Security: Helmet
  app.use(helmet());

  const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
  app.enableCors({
    origin: [corsOrigin, 'http://127.0.0.1:3000', 'http://localhost:3000'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // 5. Security: Rate Limiting
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each client IP to 100 requests per windowMs
      standardHeaders: true,
      legacyHeaders: true,
      message: 'Too many requests, please try again later.',
    }),
  );

  // 6. Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // 7. Global Prefix
  app.setGlobalPrefix('api/v1');

  // 8. Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('Jesmond 2.0 API')
    .setDescription('The Jesmond Student Accommodation Platform API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // 9. Start Server
  const port = process.env.PORT || 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Application is running on: http://localhost:${port}/api/v1`);
  console.log(
    `📚 Swagger documentation available at: http://localhost:${port}/docs`,
  );
}
bootstrap();
