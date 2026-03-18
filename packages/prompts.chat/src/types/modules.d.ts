declare module 'clipboardy' {
  const clipboardy: {
    write(text: string): Promise<void>;
  };

  export default clipboardy;
}

declare module 'meow' {
  interface MeowResult {
    input: string[];
  }

  interface MeowOptions {
    importMeta: ImportMeta;
    flags?: Record<string, unknown>;
  }

  function meow(helpText: string, options: MeowOptions): MeowResult;

  export default meow;
}