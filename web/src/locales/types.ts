/** Turns one English engine/API message into this language. */
export type MessageRule = [RegExp, (m: RegExpExecArray) => string];
