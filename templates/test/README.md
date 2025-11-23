# Test Template Fixtures

This directory contains minimal Handlebars template fixtures used exclusively for testing the template rendering system.

## Purpose

These templates provide a reliable, deterministic environment for testing template rendering without depending on production templates that may change or not be available in all test environments.

## Structure

- `pages/test-page.hbs` - A simple page template with conditional rendering
- `layouts/test-layout.hbs` - A minimal layout template for full page rendering tests
- `partials/test-partial.hbs` - A basic partial template (currently unused in tests)

## Usage

Tests use these fixtures by setting `process.env.THEME = 'test'` and calling `refreshEnv()` before rendering. This ensures tests:

1. Are isolated from production template changes
2. Don't fail due to missing production templates
3. Can verify specific rendering features with known inputs and outputs
4. Remain deterministic and reliable

## Do Not Use in Production

These templates are for testing only and should never be used in production code.
