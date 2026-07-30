export class UserSignedUpEvent {
    constructor(
        public readonly userId: string,
        public readonly firstName: string,
        public readonly lastName: string | null,
        public readonly email: string,
    ) {}
}
