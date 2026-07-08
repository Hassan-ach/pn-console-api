import { Test, TestingModule } from '@nestjs/testing';
import { RawDbService } from './raw-db.service';

describe('RawDbService', () => {
    let service: RawDbService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [RawDbService],
        }).compile();

        service = module.get<RawDbService>(RawDbService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });
});
