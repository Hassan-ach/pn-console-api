import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import session from 'express-session';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    app.enableCors();
    app.use(
        session({
            secret: 'pn-console-dev-session-secret',
            resave: false,
            saveUninitialized: false,
        }),
    );
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
        new ValidationPipe({ transform: true, whitelist: true }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());

    const config = new DocumentBuilder()
        .setTitle('PN Console API')
        .setDescription('Backend API for PN Console')
        .setVersion('0.0.1')
        .addBearerAuth()
        .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    const configService = app.get(ConfigService);
    const port = configService.get<number>('app.port', 3000);
    await app.listen(port);
}
bootstrap();
