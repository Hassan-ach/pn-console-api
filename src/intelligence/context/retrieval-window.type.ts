export interface RetrievalWindow {
    /** Inclusive start of the window (start of day UTC). */
    start: Date;
    /** Inclusive end of the window (end of day UTC — 23:59:59). */
    end: Date;
    /** Number of messages in this window. */
    messageCount: number;
}
