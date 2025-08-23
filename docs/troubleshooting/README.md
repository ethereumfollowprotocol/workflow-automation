# Troubleshooting Guide

This guide helps you diagnose and resolve common issues with the workflow automation system.

## Quick Diagnostics

### Check System Status
```bash
# Check workflow versions across repositories
bun run check-versions

# Validate all configurations
bun run validate-config

# Test prompt templates
bun run test-prompts
```

### Common Issues Checklist
- [ ] Secrets are properly configured
- [ ] Workflow files reference the correct version
- [ ] GitHub App has necessary permissions
- [ ] Configuration files are valid JSON
- [ ] User is in ALLOWED_USER_LIST

## Issue Categories

## 1. Workflow Not Triggering

### Symptoms
- PR opened but no AI review appears
- Issue comments don't trigger AI responses
- Workflow shows as "skipped" in Actions tab

### Diagnosis Steps

#### Check Workflow File
```bash
# Validate workflow syntax
yamllint .github/workflows/ai-review.yml
```

Common issues:
- Missing `types` specification
- Incorrect `uses` reference
- Missing required `secrets`

#### Verify Triggers
```yaml
# ❌ Missing trigger types
on:
  pull_request:

# ✅ Correct trigger configuration
on:
  pull_request:
    types: [opened, synchronize, reopened]
```

#### Check Repository Settings
1. Go to Settings → Actions → General
2. Ensure "Allow all actions and reusable workflows" is selected
3. Verify "Read and write permissions" for GITHUB_TOKEN

### Solutions

#### Fix Workflow Reference
```yaml
# ❌ Incorrect reference
uses: ethereumfollowprotocol/workflow-automation/.github/workflows/pr-review.yml@main

# ✅ Correct versioned reference  
uses: ethereumfollowprotocol/workflow-automation/.github/workflows/pr-review.yml@v1
```

#### Add Missing Secrets
1. Go to repository Settings → Secrets and variables → Actions
2. Add required secrets:
   - `CLAUDE_CODE_OAUTH_TOKEN`
   - `APP_ID` 
   - `PRIVATE_KEY`

## 2. Authentication Errors

### Symptoms
- "Invalid credentials" errors
- "Unauthorized" API responses
- Workflow fails with 401/403 errors

### Diagnosis Steps

#### Verify Token Validity
```bash
# Test Claude Code token
curl -H "Authorization: Bearer $CLAUDE_CODE_OAUTH_TOKEN" \
  https://api.anthropic.com/v1/messages

# Test GitHub App token
curl -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://api.github.com/user
```

#### Check GitHub App Configuration
1. Go to GitHub Settings → Developer settings → GitHub Apps
2. Verify app is installed on target repositories
3. Check permissions are sufficient:
   - Contents: Read
   - Issues: Write  
   - Pull requests: Write

### Solutions

#### Refresh Claude Code Token
1. Go to [Claude Code dashboard](https://claude.ai/code)
2. Generate new OAuth token
3. Update repository secret

#### Fix GitHub App Permissions
1. Edit your GitHub App
2. Update permissions as needed
3. Reinstall on repositories to apply changes

#### Regenerate Private Key
1. In GitHub App settings, generate new private key
2. Update `PRIVATE_KEY` secret with new key content
3. Ensure proper formatting (include BEGIN/END lines)

## 3. AI Not Responding

### Symptoms
- Mention triggers workflow but no response appears
- Workflow runs successfully but no comments posted
- Partial responses or error messages

### Diagnosis Steps

#### Check User Authorization
```json
// Verify ALLOWED_USER_LIST format
["username1", "username2", "admin"]
```

#### Review Workflow Logs
1. Go to Actions tab in repository
2. Click on failed/completed workflow run
3. Expand "AI Response" step
4. Look for error messages

#### Test Mention Format
```markdown
# ❌ Incorrect mention formats
@efpdevops help me
@efp_dev_ops help me

# ✅ Correct mention format  
@efp-dev-ops help me with this issue
```

### Solutions

#### Update Allowed Users List
```json
{
  "ALLOWED_USER_LIST": ["your-username", "team-member-1", "team-member-2"]
}
```

#### Fix Claude Code Configuration
```yaml
# Ensure correct action reference
uses: 0xthrpw/claude-code-action@v0.0.1
with:
  claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
  github_token: ${{ steps.generate-token.outputs.token }}
```

#### Check Rate Limits
- Monitor Anthropic API usage
- Implement backoff strategies for high-volume repositories
- Consider using multiple API keys for load distribution

## 4. Poor Review Quality

### Symptoms
- Reviews miss obvious issues
- Responses are too generic or vague
- AI suggests incorrect solutions
- Reviews focus on wrong aspects

### Diagnosis Steps

#### Review Configuration
```bash
# Check current configuration
cat .github/ai-review-config.json

# Validate against schema
bun run validate-config .github/ai-review-config.json
```

#### Analyze Prompt Templates
```bash
# Check which prompts are being used
ls prompts/review/

# Test prompt variations
bun run test-prompts --language typescript --profile frontend
```

### Solutions

#### Adjust Configuration Profile
```json
{
  "model": "claude-3-5-sonnet-20241022",
  "review_rules": {
    "check_security": true,
    "check_performance": true,
    "min_test_coverage": 85
  },
  "response_settings": {
    "tone": "technical",
    "max_response_length": 3000,
    "include_code_examples": true
  }
}
```

#### Switch Configuration Profile
```yaml
# Change from default to more specific profile
config-profile: "backend"  # or "frontend", "security"
```

#### Custom Prompt Override
```json
{
  "custom_prompts": {
    "security_prompt_override": "Focus specifically on authentication and authorization issues in this Node.js API..."
  }
}
```

## 5. Performance Issues

### Symptoms
- Workflows take longer than 2 minutes
- Timeouts on large PRs
- Rate limit errors
- High API costs

### Diagnosis Steps

#### Monitor Execution Time
```bash
# Check workflow duration in Actions tab
# Look for steps that consistently take long time
```

#### Review PR Size
- Large PRs (>1000 lines) may need special handling
- Consider excluding certain file types
- Use more targeted review focus

### Solutions

#### Optimize Configuration
```json
{
  "exclusions": {
    "file_patterns": [
      "*.min.js",
      "*.map",
      "node_modules/**",
      "dist/**",
      "*.lock"
    ],
    "directory_patterns": [
      "vendor/",
      "coverage/",
      ".cache/"
    ]
  }
}
```

#### Adjust Timeouts
```yaml
timeout-minutes: 15  # Increase for large repositories
```

#### Use Faster Model for Large PRs
```json
{
  "model": "claude-3-haiku-20240307"  // Faster for large reviews
}
```

## 6. Configuration Issues

### Symptoms
- Validation errors in configuration files
- Inconsistent behavior across repositories
- Schema validation failures

### Diagnosis Steps

#### Validate Configuration Files
```bash
# Validate specific config file
bun run validate-config configs/profiles/frontend.json

# Validate all configurations
bun run validate-config configs/profiles/
```

#### Check JSON Syntax
```bash
# Use jq to validate JSON
jq . .github/ai-review-config.json
```

### Solutions

#### Fix JSON Syntax Errors
```json
{
  "model": "claude-3-5-sonnet-20241022",  // ❌ Remove trailing comma
  "review_rules": {
    "check_tests": true
  }
}
```

#### Use Schema Validation
```bash
# Generate schema-compliant configuration
bun run generate-config --profile backend --output .github/ai-review-config.json
```

## 7. Version Inconsistencies

### Symptoms
- Different repositories using different workflow versions
- Some repositories not getting updates
- Inconsistent review behavior across projects

### Diagnosis Steps

#### Check Version Status
```bash
# Generate version report
bun run check-versions

# View HTML report
open version-report.html
```

#### Review Workflow References
```bash
# Check which version each repo is using
grep -r "@v" .github/workflows/
```

### Solutions

#### Update All Repositories
```bash
# Run update propagation
bun run propagate-updates

# Or trigger via GitHub Actions
gh workflow run update-propagation.yml
```

#### Pin to Specific Version
```yaml
# Pin to stable version instead of @main
uses: ethereumfollowprotocol/workflow-automation/.github/workflows/pr-review.yml@v1.2.3
```

## Advanced Troubleshooting

### Debug Mode

Enable detailed logging by adding to workflow:

```yaml
- name: Enable Debug Logging
  run: echo "::debug::Debug mode enabled"
  env:
    RUNNER_DEBUG: 1
```

### Log Analysis

Common log patterns to look for:

```
# Authentication issues
"message": "Bad credentials"
"message": "Not Found"

# Rate limiting
"message": "API rate limit exceeded"

# Timeout issues
"The operation was cancelled"

# Configuration errors
"Invalid configuration"
"Schema validation failed"
```

### Manual Testing

Test components individually:

```bash
# Test configuration validation
bun run scripts/config-validator.ts

# Test version checking
bun run scripts/version-check.ts

# Test prompt loading
node -e "console.log(require('./prompts/review/security-typescript.md'))"
```

### Recovery Procedures

#### Reset to Known Good State
```bash
# Revert to stable version
git checkout v1.0.0

# Reset configuration to defaults
cp configs/profiles/default.json .github/ai-review-config.json
```

#### Emergency Disable
```yaml
# Temporarily disable AI review
name: AI Code Review
on:
  pull_request:
    types: []  # Disable all triggers
```

## Getting Help

### 1. Gather Information
Before requesting help, collect:
- Workflow run logs
- Configuration files
- Error messages
- Repository details
- Expected vs actual behavior

### 2. Check Known Issues
- Review [GitHub Issues](https://github.com/ethereumfollowprotocol/workflow-automation/issues)
- Search for similar problems
- Check release notes for breaking changes

### 3. Create Support Issue
Include in your issue:
- Clear description of the problem
- Steps to reproduce
- Expected behavior
- Actual behavior
- Relevant logs and configuration
- Environment details

### 4. Emergency Contacts
For critical production issues:
- Create high-priority GitHub issue
- Contact repository maintainers directly
- Use team communication channels

## Prevention Strategies

### 1. Regular Maintenance
- Weekly version consistency checks
- Monthly configuration audits
- Quarterly security reviews

### 2. Monitoring
- Set up alerts for workflow failures
- Monitor API usage and costs
- Track review quality metrics

### 3. Testing
- Test configuration changes in staging
- Validate before rolling out updates
- Maintain rollback procedures

### 4. Documentation
- Keep configuration documented
- Document custom modifications
- Maintain troubleshooting runbooks