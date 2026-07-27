export class IntelligenceJobStartedEvent {
    constructor(
        public readonly organizationId: string,
        public readonly userId: string,
        public readonly title: string,
        public readonly progressable: boolean,
        public readonly description?: string,
        public readonly message?: string,
    ) {}
}

export class IntelligenceJobSetTitleEvent {
    constructor(
        public readonly jobId: string,
        public readonly title: string,
    ) {}
}

export class IntelligenceJobSetDescriptionEvent {
    constructor(
        public readonly jobId: string,
        public readonly description: string,
    ) {}
}

export class IntelligenceJobSetProgressableEvent {
    constructor(
        public readonly jobId: string,
        public readonly progressable: boolean,
    ) {}
}

export class IntelligenceJobSetProgressEvent {
    constructor(
        public readonly jobId: string,
        public readonly progress: number,
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
