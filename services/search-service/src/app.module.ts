import { LoggingModule } from './observability/logging.module';
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SearchModule } from './search/search.module';

import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    LoggingModule,
    PrometheusModule.register(),
    SearchModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
