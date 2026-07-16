import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import session from 'express-session';
import { AppModule } from './app.module';

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

    const config = new DocumentBuilder()
        .setTitle('PN Console API')
        .setDescription('Backend API for PN Console')
        .setVersion('0.0.1')
        .addBearerAuth()
        .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
