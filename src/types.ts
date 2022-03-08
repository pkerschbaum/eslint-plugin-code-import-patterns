export type ImportPatternsConfig = {
  zones: Zone[];
  matchAgainstAbsolutePaths?: boolean;
};

export type Zone = {
  target: RegExp;
  allowedPatterns?: SimplePattern[];
  forbiddenPatterns?: Pattern[];
};

export type PatternsCollection = {
  allowedPatterns: SimplePattern[];
  forbiddenPatterns: Pattern[];
};

export type Pattern = SimplePattern | ObjectPattern;
export type SimplePattern = string | RegExp;
export type ObjectPattern = { pattern: SimplePattern; errorMessage: string };
