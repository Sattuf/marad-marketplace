import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { DocsController } from './docs.controller';

/** Only loaded outside production (see app.module.ts). */
@Module({ imports: [HttpModule], controllers: [DocsController] })
export class DocsModule {}
