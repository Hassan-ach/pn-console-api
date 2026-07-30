import { Module } from '@nestjs/common';
import { RepositoriesModule } from 'src/repositories/repositories.module';
import { CapabilitiesModule } from '../capabilities/capabilities.module';
import { SuggestionsService } from './suggestions.service';
import { SuggestionsController } from './suggestions.controller';

@Module({
    imports: [RepositoriesModule, CapabilitiesModule],
    controllers: [SuggestionsController],
    providers: [SuggestionsService],
    exports: [SuggestionsService],
})
export class SuggestionsModule {}
