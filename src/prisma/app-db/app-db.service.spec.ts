import { Test, TestingModule } from '@nestjs/testing';
import { AppDbService } from './app-db.service';

describe('AppDbService', () => {
  let service: AppDbService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppDbService],
    }).compile();

    service = module.get<AppDbService>(AppDbService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
