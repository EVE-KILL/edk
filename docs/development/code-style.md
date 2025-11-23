# Code Style Guide

This project uses a combination of Prettier for code formatting and ESLint for code quality and consistency.

## Code Formatting (Prettier)

All code is automatically formatted by [Prettier](https://prettier.io/). This ensures a consistent style across the entire codebase without manual effort. The configuration is defined in `.prettierrc`.

### Key Formatting Rules:

- **Semicolons:** Semicolons are required at the end of statements (`"semi": true`).
- **Quotes:** Single quotes are used for strings (`"singleQuote": true`).
- **Trailing Commas:** Trailing commas are used where valid in ES5 (objects, arrays, etc.) (`"trailingComma": "es5"`).

You can format the code manually by running:

```bash
bun run format
```

It is recommended to set up your editor to format on save.

## Code Quality (ESLint)

ESLint is used to enforce code quality rules and catch potential bugs. The configuration is defined in `eslint.config.js`.

### Key Linting Rules:

- **No Console Logs:** The use of `console.log()` is disallowed to encourage the use of the structured logger. Use the logger available in the application context instead. (`'no-console': 'error'`)
- **No Debugger:** The `debugger` statement is not allowed in committed code. (`'no-debugger': 'error'`)
- **Prefer `const`:** Variables that are not reassigned should be declared with `const`. (`'prefer-const': 'warn'`)
- **No `var`:** The use of `var` is disallowed; use `let` or `const` instead. (`'no-var': 'error'`)
- **Unused Variables:** Unused variables will trigger a warning. If a variable is intentionally unused, prefix it with an underscore (`_`) to suppress the warning. (`'@typescript-eslint/no-unused-vars'`)

You can check for linting errors by running:

```bash
bun run lint
```

## Naming Conventions

- **Files:** Use kebab-case for filenames (e.g., `my-file.ts`).
- **Variables:** Use camelCase for variables and function names (e.g., `myVariable`).
- **Classes:** Use PascalCase for classes (e.g., `MyClass`).
- **Interfaces:** Use PascalCase for interfaces (e.g., `MyInterface`).

## General Principles

- **Clarity and Readability:** Write code that is easy to understand and maintain.
- **DRY (Don't Repeat Yourself):** Avoid duplicating code by creating reusable functions and modules.
- **Modularity:** Keep files focused on a single responsibility.
