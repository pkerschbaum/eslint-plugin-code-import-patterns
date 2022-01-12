// based on https://github.com/microsoft/vscode/blob/324764a4dfadb8be90fe9dd06bb3e8d9639b2cf5/build/lib/eslint/code-import-patterns.ts

import type * as eslint from "eslint";
import type { TSESTree } from "@typescript-eslint/experimental-utils";
import path from "path";
import { createImportRuleListener } from "./utils";
import type {
  ImportPatternsConfig,
  ObjectPattern,
  PatternsCollection,
  Zone,
} from "./types";

type MessageId = "noAllowedPatternDidMatch" | "forbiddenPatternWasViolated";
type Messages = {
  [messageId in MessageId]: string;
};
const messages: Messages = {
  noAllowedPatternDidMatch:
    'Imports violates restrictions. None of the allowed patterns did match. allowedPatterns="{{allowedPatterns}}"',
  forbiddenPatternWasViolated: "{{forbiddenPatternsViolationsMessage}}",
};

export class CodeImportPatternsRule implements eslint.Rule.RuleModule {
  readonly meta: eslint.Rule.RuleMetaData = {
    messages,
  };

  create(context: eslint.Rule.RuleContext): eslint.Rule.RuleListener {
    const ruleOption = <ImportPatternsConfig>context.options[0];
    const lintedFilename = ensurePathUsesPosixSeparator(context.getFilename());
    const patterns = collectAllowedAndForbiddenPatterns(
      lintedFilename,
      ruleOption.zones
    );

    if (
      patterns.allowedPatterns.length > 0 ||
      patterns.forbiddenPatterns.length > 0
    ) {
      return createImportRuleListener((node, value) =>
        checkImport(context, patterns, node, value)
      );
    }

    return {};
  }

  checkImport(
    context: eslint.Rule.RuleContext,
    patterns: PatternsCollection,
    node: TSESTree.Node,
    pathOfFile: string
  ) {
    // resolve relative paths
    if (pathOfFile[0] === ".") {
      pathOfFile = path.join(context.getFilename(), pathOfFile);
    }

    let someAllowedPatternDidMatch = false;

    if (patterns.allowedPatterns.length === 0) {
      someAllowedPatternDidMatch = true;
    } else {
      for (const stringOrRegexToTest of patterns.allowedPatterns) {
        if (testPattern(stringOrRegexToTest, pathOfFile)) {
          someAllowedPatternDidMatch = true;
          break;
        }
      }
    }

    let errorMessagesOfViolatedForbiddenPatterns: string[] = [];
    for (const pattern of patterns.forbiddenPatterns) {
      let stringOrRegexToTest: string | RegExp;
      let errorMessage: string | undefined;
      if (typeof pattern === "string") {
        stringOrRegexToTest = pattern;
        errorMessage = `Import pattern "${stringOrRegexToTest}" is not allowed.`;
      } else if (thingIsRegexp(pattern)) {
        stringOrRegexToTest = pattern;
        errorMessage = `Import pattern "${stringOrRegexToTest}" is not allowed.`;
      } else if (thingIsObjectPattern(pattern)) {
        stringOrRegexToTest = pattern.pattern;
        errorMessage = pattern.errorMessage;
      } else {
        assertIsUnreachable(pattern);
      }

      if (testPattern(stringOrRegexToTest, pathOfFile)) {
        errorMessagesOfViolatedForbiddenPatterns.push(errorMessage);
      }
    }

    if (errorMessagesOfViolatedForbiddenPatterns.length > 0) {
      const messageId: MessageId = "forbiddenPatternWasViolated";
      context.report({
        loc: node.loc,
        messageId,
        data: {
          forbiddenPatternsViolationsMessage:
            errorMessagesOfViolatedForbiddenPatterns.join(" "),
        },
      });
    } else if (!someAllowedPatternDidMatch) {
      const messageId: MessageId = "noAllowedPatternDidMatch";
      context.report({
        loc: node.loc,
        messageId,
        data: {
          allowedPatterns: patterns.allowedPatterns.join('" or "'),
        },
      });
    }
  }
}

export const codeImportPatternsRule = new CodeImportPatternsRule();

function checkImport(
  context: eslint.Rule.RuleContext,
  patterns: PatternsCollection,
  node: TSESTree.Node,
  pathOfFile: string
) {
  // resolve relative paths
  if (pathOfFile[0] === ".") {
    pathOfFile = path.join(context.getFilename(), pathOfFile);
  }

  let someAllowedPatternDidMatch = false;

  if (patterns.allowedPatterns.length === 0) {
    someAllowedPatternDidMatch = true;
  } else {
    for (const stringOrRegexToTest of patterns.allowedPatterns) {
      if (testPattern(stringOrRegexToTest, pathOfFile)) {
        someAllowedPatternDidMatch = true;
        break;
      }
    }
  }

  let errorMessagesOfViolatedForbiddenPatterns: string[] = [];
  for (const pattern of patterns.forbiddenPatterns) {
    let stringOrRegexToTest: string | RegExp;
    let errorMessage: string | undefined;
    if (typeof pattern === "string") {
      stringOrRegexToTest = pattern;
      errorMessage = `Import pattern "${stringOrRegexToTest}" is not allowed.`;
    } else if (thingIsRegexp(pattern)) {
      stringOrRegexToTest = pattern;
      errorMessage = `Import pattern "${stringOrRegexToTest}" is not allowed.`;
    } else if (thingIsObjectPattern(pattern)) {
      stringOrRegexToTest = pattern.pattern;
      errorMessage = pattern.errorMessage;
    } else {
      assertIsUnreachable(pattern);
    }

    if (testPattern(stringOrRegexToTest, pathOfFile)) {
      errorMessagesOfViolatedForbiddenPatterns.push(errorMessage);
    }
  }

  if (errorMessagesOfViolatedForbiddenPatterns.length > 0) {
    const messageId: MessageId = "forbiddenPatternWasViolated";
    context.report({
      loc: node.loc,
      messageId,
      data: {
        forbiddenPatternsViolationsMessage:
          errorMessagesOfViolatedForbiddenPatterns.join(" "),
      },
    });
  } else if (!someAllowedPatternDidMatch) {
    const messageId: MessageId = "noAllowedPatternDidMatch";
    context.report({
      loc: node.loc,
      messageId,
      data: {
        allowedPatterns: patterns.allowedPatterns.join('" or "'),
      },
    });
  }
}

function collectAllowedAndForbiddenPatterns(
  lintedFilename: string,
  zones: Zone[]
): PatternsCollection {
  const result: PatternsCollection = {
    allowedPatterns: [],
    forbiddenPatterns: [],
  };

  for (const zone of zones) {
    if (zone.target.test(lintedFilename)) {
      result.allowedPatterns.push(...(zone.allowedPatterns ?? []));
      result.forbiddenPatterns.push(...(zone.forbiddenPatterns ?? []));
    }
  }

  return result;
}

function testPattern(
  stringOrRegexToTest: string | RegExp,
  path: string
): boolean {
  let importIsOK;

  if (typeof stringOrRegexToTest === "string") {
    if (path === stringOrRegexToTest) {
      importIsOK = true;
    } else {
      importIsOK = false;
    }
  } else if (thingIsRegexp(stringOrRegexToTest)) {
    if (stringOrRegexToTest.test(path)) {
      importIsOK = true;
    } else {
      importIsOK = false;
    }
  } else {
    assertIsUnreachable(stringOrRegexToTest);
  }

  return importIsOK;
}

function thingIsRegexp(something: unknown): something is RegExp {
  return (
    typeof something === "object" &&
    typeof (something as any).test === "function"
  );
}

function thingIsObjectPattern(something: unknown): something is ObjectPattern {
  return (
    typeof something === "object" &&
    (typeof (something as any).pattern === "string" ||
      thingIsRegexp((something as any).pattern)) &&
    typeof (something as any).errorMessage === "string"
  );
}

// https://www.typescriptlang.org/docs/handbook/2/narrowing.html#exhaustiveness-checking
function assertIsUnreachable(value: never): never {
  throw new Error(`should be unreachable, but got here. value=${value}`);
}

function ensurePathUsesPosixSeparator(filePath: string): string {
  return filePath.split(path.sep).join(path.posix.sep);
}
