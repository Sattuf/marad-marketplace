import { LoggingModule } from './observability/logging.module';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { postgresConnectionOptions } from './common/database';
import { MessagingModule } from './messaging/messaging.module';

@Module({
  imports: [
    LoggingModule,
    PrometheusModule.register(),
    TypeOrmModule.forRoot({
      ...postgresConnectionOptions(),
      autoLoadEntities: true,
    }),
    MessagingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
