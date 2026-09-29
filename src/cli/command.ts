// The shape of a CLI command: it receives the words after the command name.
type Command = (args: readonly string[]) => void;

// Command name → handler, e.g. { next: …, check: … }.
export type CommandRegistry = Readonly<Record<string, Command>>;
