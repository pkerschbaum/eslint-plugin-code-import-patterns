# `eslint-plugin-code-import-patterns`

This plugin can be used to allow/forbid specific `import` statements in certain areas ("zones") of the codebase.

It is inspired by the `code-import-patterns` rule used at [microsoft/vscode](https://github.com/microsoft/vscode) (see [microsoft/vscode/.eslintrc.json#L93](https://github.com/microsoft/vscode/blob/31dfab2f7c5f72b163cf2c012d15bbea5550779a/.eslintrc.json#L93)). Actually, this plugin is based on [their custom implemented rule](https://github.com/microsoft/vscode/blob/d7f4200ec34f2aaa779113e408a63d5553727af7/build/lib/eslint/code-import-patterns.ts), but was extended to allow custom error message and regexes.

It can be used to:

- enforce code layering in the codebase
- allow the usage of NodeJS modules only in certain code areas
- ...

## Configuration

Since the rule uses JavaScript regexes for the zones `target` parameters, the rule can currently only be used in ESLint JavaScript configurations (`.eslintrc.js`).

> If you need support for JSON/YAML configurations, feel free to reach out by [creating an issue](https://github.com/pkerschbaum/eslint-plugin-code-import-patterns/issues)!

```javascript
module.exports = {
  // ... eslint configuration
  plugins: ["@pkerschbaum/code-import-patterns"],
  rules: {
    "@pkerschbaum/code-import-patterns/patterns": [
      "error",
      {
        zones: [
          {
            target: /\/src\/ui\/.+/,
            allowedPatterns: ["react", "react-dom"],
          },
        ],
      },
    ],
};
```

See the examples below and [`./src/types.ts`](./src/types.ts) for how to configure the `patterns` rule.

## Examples

Allow `dayjs` to be imported in the entire codebase:

```javascript
{
  zones: [
    {
      target: /.+/,
      allowedPatterns: ["dayjs"],
    },
  ],
}
```

Allow `react` and `react-dom` to be imported in `src/ui`:

```javascript
{
  zones: [
    {
      target: /\/src\/ui\/.+/,
      allowedPatterns: ["react", "react-dom"],
    },
  ],
}
```

Given a directory `components-library` which has its components exposed via a `index.js` (or `index.ts`) file, forbid code in `src/ui` to reach into the internals of `components-library`:

```javascript
{
  zones: [
    {
      target: /\/src\/ui\/.+/,
      forbiddenPatterns: [
        {
          pattern: /\/components-library\/[A-Z].+/,
          errorMessage:
            'Prefer to just import from "components-library" instead of reaching for the component files.',
        },
      ],
    },
  ],
}
```

Enforce the entire codebase to import icons from `components-library/icons.tsx` instead of importing them directly from a JS package:

```javascript
{
  zones: [
    {
      target: /\/src\/ui\/components-library\/icons\.tsx$/,
      allowedPatterns: [/^@mui\/icons-material/],
    },
    {
      // use a negative lookahead to exclude components-library/icons.tsx from this zone
      target: /\/src\/ui\/(?!components-library\/icons\.tsx)/,
      forbiddenPatterns: [
        {
          /**
           * A RegExp can be used to match the import pattern.
           * This is especially helpful when dealing with packages which have a slash in their package name (scoped packages).
           */
          pattern: /^@mui\/icons-material/,
          errorMessage:
            "Don't import from @mui/icons-material directly. Import the icon from component-library/icons.tsx instead. If the icon in question is not present in icons.tsx yet, add the icon there. (putting all icons in icons.tsx makes it easier to modify them in the future)",
        },
      ],
    },
  ],
}
```
