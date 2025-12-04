# Contributing Guide

We welcome contributions to EVE-KILL! This guide outlines the process for contributing to the project.

## Getting Started

Before you begin, please make sure you have followed the **[Development Setup](./docs/development/setup.md)** guide to get your local environment up and running.

## Development Workflow

1.  **Create an Issue:** Before starting work on a new feature or bug fix, please create an issue in the issue tracker to discuss the proposed changes. This helps to ensure that your work is aligned with the project's goals.
2.  **Fork and Branch:** Fork the repository and create a new branch for your changes. Use a descriptive branch name (e.g., `feat/add-new-feature` or `fix/resolve-bug-123`).
3.  **Make Changes:** Make your changes in your forked repository.
4.  **Follow the Code Style:** Ensure that your code adheres to the project's **[Code Style Guide](./docs/development/code-style.md)**.
5.  **Write Tests:** Add tests for any new features or bug fixes. See the **[Testing Guide](./docs/development/testing.md)** for more information.
6.  **Commit Your Changes:** Write clear and concise commit messages.
7.  **Push and Create a Pull Request:** Push your changes to your fork and create a pull request to the `main` branch of the main repository.

## Pull Request Process

1.  **Fill out the Template:** When you create a pull request, please fill out the pull request template with a clear description of the changes you have made.
2.  **Code Review:** Your pull request will be reviewed by one or more maintainers. They may request changes to your code.
3.  **Address Feedback:** Please address any feedback from the code review in a timely manner.
4.  **Merge:** Once your pull request has been approved, it will be merged into the `main` branch.

## Testing Requirements

All contributions should include tests that cover the changes being made.

- **Unit Tests:** For small, isolated pieces of functionality.
- **Integration Tests:** For functionality that involves multiple components of the system.

Before submitting a pull request, please ensure that all tests pass by running:

```bash
bun test
```
