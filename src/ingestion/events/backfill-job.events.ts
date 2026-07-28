export class BackfillJobStartedEvent {
    constructor(
        public readonly organizationId: string,
        public readonly userId: string,
        public readonly title: string,
        public readonly description: string,
    ) {}
}

export class BackfillJobProgressEvent {
    constructor(
        public readonly jobId: string,
        public readonly progress: number,
        public readonly message: string,
    ) {}
}

export class BackfillJobCompletedEvent {
    constructor(
        public readonly jobId: string,
        public readonly message: string,
    ) {}
}

export class BackfillJobFailedEvent {
    constructor(
        public readonly jobId: string,
        public readonly error: string,
    ) {}
}
