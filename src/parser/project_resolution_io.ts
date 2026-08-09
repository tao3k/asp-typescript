/** Minimal I/O contract consumed by parser-owned ProjectResolution parsing. */
export type CliStreams = {
  readonly stdin?: string;
  readonly stdout: {
    write(chunk: string): unknown;
  };
};
