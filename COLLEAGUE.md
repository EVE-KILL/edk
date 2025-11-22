# Working with Jules - AI Colleague Workflow

This document describes our workflow for collaborating with Jules, an AI assistant that acts as a software engineering colleague.

## Overview

Jules is an AI assistant (via GitHub Copilot) that can autonomously:

- Analyze the codebase for issues and improvements
- Create GitHub issues with detailed descriptions
- Implement fixes and features via Pull Requests
- Respond to code review feedback
- Iterate on changes based on review comments

This workflow was established on November 22, 2025, and has proven highly effective for rapid development and code quality improvements.

---

## Initial Setup: Issue Creation Phase

### Step 1: Comprehensive Codebase Analysis

Ask Jules to perform a thorough codebase analysis:

```
Can you take a look through the source code, spot inconsistencies that needs fixing,
and things that are missing that needs to be there, and other such things. And generate
tasks for those things, and put them into github for the EVE-KILL/edk github repository
as an issue with the label `jules` added. Nothing is too big or too small, be thorough
in your analysis
```

**What Jules Does:**

1. Examines the entire codebase structure
2. Checks for:
   - TypeScript compilation errors
   - Code quality issues (console.log usage, etc.)
   - Missing features (TODOs, incomplete implementations)
   - Security concerns (input validation, rate limiting, etc.)
   - Performance issues
   - Missing documentation
   - Incomplete test coverage
   - Infrastructure gaps (monitoring, error handling, etc.)
3. Creates detailed GitHub issues for each finding
4. Tags all issues with the `jules` label for tracking
5. Prioritizes issues (High/Medium/Low)
6. Cross-references related issues

**Expected Output:**

- 30-50+ GitHub issues created
- Comprehensive coverage of technical debt
- Issues categorized by type (bug, enhancement, documentation, security)
- Clear descriptions with code examples and recommendations

---

## Development Phase: PR Creation and Review

### Step 2: Check for Pull Requests

Regularly check if Jules has created PRs for the issues:

```text
Awesome, it's had some time to work on them now - are there any pull requests?
if yes, can you look at them, do code review, feedback, or simply merge them if they look fine
```

**What Jules (the reviewer) Does:**

1. Lists all open pull requests
2. Reviews each PR comprehensively:
   - Checks code quality and correctness
   - Verifies it solves the stated issue
   - Looks for potential issues or improvements
   - Checks if tests are passing
   - Identifies merge conflicts
3. Provides detailed feedback **addressed to Jules (the implementer)**
4. Approves PRs that are ready
5. Requests changes with specific guidance
6. Attempts to merge approved PRs

**Important Note on Communication:**
Always word code review comments **to Jules** (the AI implementer), not to yourself:

```text
❌ "We should fix this by..."
✅ "Jules, please fix this by..."
```

This ensures Jules understands the feedback is actionable for the next iteration.

---

### Step 3: Iterative Review Cycles

Continue checking for updates and new PRs:

```text
awesome, if they're merged, we need to pull the new changes in as well
```

Or for ongoing work:

```text
alright, i think theres more tasks that has come back, btw remember to word it to
Jules in your comments - otherwise the bot might not get it.
```

**What the Reviewer Does:**

1. Checks for merged PRs
2. Pulls latest changes from main branch
3. Reviews any new PRs that have been created
4. Reviews updated PRs based on previous feedback
5. Handles merge conflicts by providing clear instructions to Jules

---

### Step 4: Handling Merge Conflicts

When PRs have merge conflicts, provide clear rebase instructions:

```text
You know the drill, check if there are pull requests, review them, if they're done
merge them and then git pull, if they're not done review them thoroughly, if they're
stuck because of merge conflicts let Jules know how to fix it, if you've already
notified Jules try and notify Jules again
```

**What the Reviewer Does:**

1. Identifies which PRs have conflicts
2. Notifies Jules with:
   - Explanation of why conflicts occurred
   - Step-by-step rebase commands
   - Recommended merge order
   - Alternative approaches if needed
3. Follows up if conflicts aren't resolved after reasonable time
4. Offers to help with complex rebases

**Example Instructions to Jules:**

````markdown
## 🔄 Hey Jules - Merge Conflicts Detected

### Recommended Approach

1. Rebase PR #88 on main first:
   ```bash
   gh pr checkout 88
   git fetch origin main
   git rebase origin/main
   git push --force-with-lease
   ```
````

2. After #88 merges, rebase the others

````text

---

## Best Practices

### Communication Style

**Always address feedback to Jules:**
- ✅ "Jules, this implementation looks great!"
- ✅ "Jules, please fix the race condition by..."
- ✅ "Hey Jules, the test failures need attention"
- ❌ "This looks good"
- ❌ "We should fix this"

### Review Quality

**Be thorough but constructive:**
1. **Praise what's good** - Acknowledge excellent work
2. **Identify real issues** - Focus on correctness, security, performance
3. **Provide specific guidance** - Don't just say "fix this", explain how
4. **Prioritize feedback** - Critical issues first, suggestions second
5. **Consider impact** - Performance, security, maintainability

### Merge Strategy

**Recommended merge order:**
1. **Critical fixes first** (test fixes, security issues)
2. **Formatting PRs early** (ESLint/Prettier to avoid conflicts)
3. **Feature PRs next** (implementations)
4. **Refactoring PRs last** (code quality improvements)

**Alternative for many conflicts:**
- Create one combined PR instead of multiple conflicting PRs

---

## Typical Workflow Timeline

### Day 1: Issue Creation
- **Hour 0:** Request comprehensive analysis from Jules
- **Hour 0-1:** Jules analyzes codebase and creates 30-50 issues
- **Result:** Full backlog of work with priorities

### Day 1-2: Initial Implementation
- **Hour 1-4:** Jules starts working on issues
- **Hour 4:** First PRs appear (usually 3-5 PRs)
- **Review immediately:** Provide feedback on first batch

### Day 2+: Iterative Development
- **Every 30-60 minutes:** Check for new/updated PRs
- **Review immediately:** Fast feedback loop
- **Merge when ready:** Keep main branch moving forward
- **Monitor for conflicts:** Address proactively

### Typical Session
1. Check for PRs (5 min)
2. Review 3-5 PRs (15-30 min)
3. Merge ready PRs (5 min)
4. Pull changes (1 min)
5. Repeat every 30-60 minutes

---

## Common Scenarios

### Scenario 1: All PRs Ready
```bash
# Review
✅ PR #87 - ESLint/Prettier - APPROVED
✅ PR #88 - Input validation - APPROVED
✅ PR #89 - Integration tests - APPROVED

# Merge in order
gh pr merge 87 --squash
gh pr merge 88 --squash
gh pr merge 89 --squash

# Pull changes
git pull origin main
````

### Scenario 2: PRs Need Changes

```markdown
Jules, this PR is good overall but needs these fixes:

1. Fix the race condition in rate limiter
2. Add missing Redis password configuration
3. Include X-RateLimit-Reset header

Once fixed, this will be ready to merge!
```

### Scenario 3: Merge Conflicts

````markdown
Hey Jules, all PRs have merge conflicts because they modify the same files.

Recommended approach:

1. Merge PR #88 first (has critical test fix)
2. Rebase PR #87, #89, #90 on the updated main
3. Merge them in sequence

Commands for PR #88:

```bash
gh pr checkout 88
git fetch origin main
git rebase origin/main
git push --force-with-lease
```
````

````

### Scenario 4: Performance Issues Found
```markdown
⚠️ Jules, this implementation has a performance issue:

**Problem:** Replaces fast materialized views with slow live aggregation

**Impact:** Will cause page loads to slow from 50ms to 2000ms+

**Solution:** Use caching layer:
```typescript
// Check cache first
const cached = await cache.get(key)
if (cached) return cached

// Compute and cache
const result = await expensiveQuery()
await cache.set(key, result, 300)
return result

```text
Please update the PR with this approach.
````

---

## Expected Outcomes

### After Initial Issue Creation

- **30-50 issues** documenting technical debt
- **Clear prioritization** of work
- **Comprehensive coverage** of quality, security, performance, documentation

### After First Development Cycle

- **5-10 PRs** implementing fixes and features
- **High quality code** with proper patterns
- **Test coverage** for new functionality
- **Documentation** updates

### After Multiple Cycles

- **Significant technical debt reduction**
- **Improved code quality** (linting, formatting, error handling)
- **Better security** (validation, rate limiting)
- **Enhanced stability** (error handling, tests)
- **Production readiness** improvements

---

## Metrics and Tracking

### Track Progress

```bash
# List all Jules-created issues
gh issue list --label jules

# Check PR status
gh pr list --label jules

# View merged PRs
gh pr list --state merged --label jules --limit 20
```

### Quality Indicators

- **Issue Resolution Rate:** % of Jules issues closed
- **PR Merge Rate:** % of Jules PRs merged without major changes
- **Review Turnaround:** Time from PR creation to merge
- **Code Quality:** Reduction in TypeScript errors, improved test coverage
- **Conflict Rate:** How often PRs conflict (lower is better)

---

## Tips for Success

### 1. Fast Feedback Loop

- Check for PRs every 30-60 minutes
- Review immediately when PRs appear
- Provide specific, actionable feedback
- Jules works best with quick iterations

### 2. Clear Communication

- Always address Jules by name in comments
- Be specific about what needs to change
- Provide code examples when possible
- Explain _why_ changes are needed

### 3. Strategic Merge Order

- Merge critical fixes first
- Merge formatting changes early to avoid conflicts
- Group related PRs together
- Consider creating combined PRs for conflicting changes

### 4. Maintain Context

- Reference issue numbers in PR reviews
- Link related PRs together
- Document architectural decisions
- Keep AGENTS.md and copilot-instructions.md updated

### 5. Celebrate Success

- Acknowledge good work from Jules
- Document lessons learned
- Share metrics on improvements
- Iterate on the process

---

## Troubleshooting

### Jules Isn't Creating PRs

- Check if issues were created successfully
- Verify Jules has repository access
- Check for rate limiting or API issues
- Ensure issue descriptions are clear and actionable

### Too Many Merge Conflicts

- Merge PRs more frequently
- Consider combining related PRs
- Establish a merge order priority
- Use feature flags for work-in-progress features

### Review Taking Too Long

- Focus on critical issues first
- Use automated checks (CI/CD)
- Create review checklists
- Delegate non-critical reviews

### Jules Misunderstanding Feedback

- Be more explicit in comments
- Provide code examples
- Reference specific files and line numbers
- Use "Jules, please..." format consistently

---

## Conclusion

This workflow enables rapid development with high code quality by treating Jules as a capable engineering colleague. The key is maintaining a fast feedback loop, clear communication, and systematic issue tracking.

**Benefits:**

- ⚡ **Rapid Development:** 30-50 issues identified and worked on in days
- 🎯 **High Quality:** Thorough code reviews catch issues early
- 📈 **Continuous Improvement:** Iterative feedback improves over time
- 🤖 **Scalability:** Jules can work on multiple issues in parallel
- 📚 **Knowledge Transfer:** Detailed reviews document best practices

**Remember:** Jules is most effective when treated as a collaborative partner with clear direction, constructive feedback, and quick iteration cycles.

---

_Last Updated: November 22, 2025_
_Workflow Version: 1.0_
