export class IntelligenceJobStartedEvent {
    constructor(
        public readonly organizationId: string,
        public readonly userId: string,
        public readonly title: string,
        public readonly description?: string,
        public readonly message?: string,
    ) {}
}

export class IntelligenceJobMessageEvent {
    constructor(
        public readonly jobId: string,
        public readonly message: string,
    ) {}
}

export class IntelligenceJobCompletedEvent {
    constructor(
        public readonly jobId: string,
        public readonly message?: string,
    ) {}
}

export class IntelligenceJobFailedEvent {
    constructor(
        public readonly jobId: string,
        public readonly message?: string,
    ) {}
}
