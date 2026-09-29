type Command = (args: readonly string[]) => void;

export type CommandRegistry = Readonly<Record<string, Command>>;
