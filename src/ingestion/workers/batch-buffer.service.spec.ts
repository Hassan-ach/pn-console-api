import { BatchBuffer } from './batch-buffer.service';

describe('BatchBuffer', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('flushes when batch size is reached', async () => {
        const flush = jest.fn().mockResolvedValue(undefined);
        const buf = new BatchBuffer<number>(3, 5000, flush);

        buf.add(1);
        buf.add(2);
        expect(flush).not.toHaveBeenCalled();

        buf.add(3);
        expect(flush).toHaveBeenCalledWith([1, 2, 3]);
    });

    it('flushes after maxWindowMs when batch size not reached', () => {
        const flush = jest.fn().mockResolvedValue(undefined);
        const buf = new BatchBuffer<number>(10, 1000, flush);

        buf.add(42);
        expect(flush).not.toHaveBeenCalled();

        jest.advanceTimersByTime(1000);
        expect(flush).toHaveBeenCalledWith([42]);
    });

    it('does nothing on flush when buffer is empty', async () => {
        const flush = jest.fn().mockResolvedValue(undefined);
        const buf = new BatchBuffer<number>(3, 5000, flush);

        await buf.flush();
        expect(flush).not.toHaveBeenCalled();
    });

    it('flush returns all accumulated items and clears buffer', async () => {
        const flush = jest.fn().mockResolvedValue(undefined);
        const buf = new BatchBuffer<number>(5, 5000, flush);

        buf.add(1);
        buf.add(2);
        await buf.flush();
        expect(flush).toHaveBeenCalledWith([1, 2]);
        expect(flush).toHaveBeenCalledTimes(1);
    });
});
