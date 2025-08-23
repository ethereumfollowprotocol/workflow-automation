# Setup Guide

This guide will help you set up and configure the centralized workflow automation system for your repositories.

## Quick Start

### 1. Repository Setup

For new satellite repositories that want to use the centralized AI review system:

1. Create the workflow directory:
   ```bash
   mkdir -p .github/workflows
   ```

2. Add the AI review workflow (`.github/workflows/ai-review.yml`):
   ```yaml
   name: AI Code Review
   on:
     pull_request:
       types: [opened, synchronize, reopened]

   jobs:
     ai-review:
       uses: ethereumfollowprotocol/workflow-automation/.github/workflows/pr-review.yml@v1
       with:
         config-profile: "default"  # Change to: frontend, backend, security, experimental
         repository-config: ".github/ai-review-config.json"
         enable-security-review: true
         enable-quality-review: true
         enable-documentation-review: true
       secrets:
         CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
         APP_ID: ${{ secrets.APP_ID }}
         PRIVATE_KEY: ${{ secrets.PRIVATE_KEY }}
         ALLOWED_USER_LIST: ${{ secrets.ALLOWED_USER_LIST }}
   ```

3. Add the AI on-demand workflow (`.github/workflows/ai-on-demand.yml`):
   ```yaml
   name: AI On-Demand Assistant  
   on:
     issue_comment:
       types: [created]
     pull_request_review_comment:
       types: [created]
     pull_request_review:
       types: [submitted]
     issues:
       types: [opened]

   jobs:
     ai-response:
       uses: ethereumfollowprotocol/workflow-automation/.github/workflows/issue-response.yml@v1
       with:
         config-profile: "default"
         bot-mention: "@efp-dev-ops"
         enable-auto-labeling: true
         enable-escalation: true
       secrets:
         CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
         APP_ID: ${{ secrets.APP_ID }}
         PRIVATE_KEY: ${{ secrets.PRIVATE_KEY }}
         ALLOWED_USER_LIST: ${{ secrets.ALLOWED_USER_LIST }}
   ```

### 2. Configuration Profiles

Choose the appropriate configuration profile for your repository:

- **`default`**: Standard configuration for most repositories
- **`frontend`**: Optimized for frontend codebases (React, TypeScript, etc.)
- **`backend`**: Focused on backend services (APIs, databases, etc.)
- **`security`**: Enhanced security-focused reviews
- **`experimental`**: Latest features and experimental prompts

### 3. Required Secrets

Add these secrets to your repository settings:

#### Essential Secrets
- **`CLAUDE_CODE_OAUTH_TOKEN`**: Your Claude Code OAuth token
- **`APP_ID`**: GitHub App ID for authentication
- **`PRIVATE_KEY`**: GitHub App private key

#### Optional Secrets
- **`ALLOWED_USER_LIST`**: JSON array of users who can trigger AI responses
  ```json
  ["username1", "username2", "admin"]
  ```

### 4. Custom Configuration (Optional)

Create `.github/ai-review-config.json` to override default settings:

```json
{
  "model": "claude-3-5-sonnet-20241022",
  "review_rules": {
    "min_test_coverage": 85,
    "max_complexity": 8,
    "max_function_length": 30
  },
  "security_rules": {
    "check_sql_injection": true,
    "check_xss": true,
    "check_auth": true
  },
  "response_settings": {
    "tone": "friendly",
    "include_code_examples": true
  }
}
```

## Advanced Setup

### GitHub App Configuration

If you need to create a new GitHub App for authentication:

1. Go to GitHub Settings → Developer settings → GitHub Apps
2. Click "New GitHub App"
3. Configure the app with these permissions:
   - **Repository permissions:**
     - Contents: Read
     - Issues: Write
     - Pull requests: Write
     - Metadata: Read
   - **Organization permissions:** None
   - **Account permissions:** None

4. Generate a private key and store it securely
5. Install the app on your repositories

### Webhook Configuration

For immediate response to events, configure webhooks:

1. In your GitHub App settings, set the webhook URL
2. Select these events:
   - Pull requests
   - Pull request reviews
   - Pull request review comments
   - Issues
   - Issue comments

### Environment Variables

For local development or self-hosted runners:

```bash
export GITHUB_TOKEN="your-github-token"
export CLAUDE_CODE_OAUTH_TOKEN="your-claude-code-token"
export APP_ID="your-app-id"
export PRIVATE_KEY="your-private-key"
```

## Configuration Profiles Explained

### Default Profile
```json
{
  "model": "claude-3-5-sonnet-20241022",
  "review_rules": {
    "check_tests": true,
    "check_documentation": true,
    "check_security": true,
    "min_test_coverage": 80
  }
}
```

### Frontend Profile
- Optimized for React, TypeScript, JavaScript
- Enhanced XSS and client-side security checks
- Focus on component architecture and user experience
- Stricter documentation requirements for public APIs

### Backend Profile  
- Optimized for APIs, databases, server-side logic
- Enhanced SQL injection and authentication checks
- Focus on data validation and error handling
- Higher test coverage requirements (85%)

### Security Profile
- Maximum security scrutiny
- All security checks enabled
- Stricter complexity and function length limits
- Enhanced documentation requirements
- Immediate notifications for critical issues

### Experimental Profile
- Latest AI models and features
- Relaxed constraints for prototype development
- Casual tone for rapid iteration
- Flexible documentation requirements

## Testing Your Setup

### 1. Validate Configuration
```bash
# In the workflow-automation repository
bun run validate-config
```

### 2. Test PR Review
1. Create a test pull request in your repository
2. The AI review should automatically trigger
3. Check for review comments and summary

### 3. Test On-Demand Response
1. Create an issue or comment with `@efp-dev-ops help me with...`
2. The AI should respond within 30 seconds
3. Verify the response quality and relevance

## Troubleshooting

### Common Issues

#### 1. Workflow Not Triggering
- Check that secrets are properly configured
- Verify the workflow file syntax
- Ensure the central repository reference is correct (`@v1` or specific version)

#### 2. Authentication Errors  
- Verify `CLAUDE_CODE_OAUTH_TOKEN` is valid and not expired
- Check GitHub App permissions and installation
- Ensure `APP_ID` and `PRIVATE_KEY` match your GitHub App

#### 3. AI Not Responding
- Check the `ALLOWED_USER_LIST` secret includes your username
- Verify you're using the correct mention format (`@efp-dev-ops`)
- Check workflow run logs for error messages

#### 4. Poor Review Quality
- Try a different configuration profile
- Customize the configuration file for your project needs
- Check if you're using the latest workflow version

### Getting Help

1. **Check the logs**: Review GitHub Actions logs for detailed error messages
2. **Validate configuration**: Run the config validator script
3. **Review documentation**: Check the troubleshooting guide
4. **Create an issue**: Report problems in the workflow-automation repository

## Migration from Existing Workflows

If you already have AI review workflows:

### 1. Backup Current Workflows
```bash
cp -r .github/workflows .github/workflows.backup
```

### 2. Update Workflow Files
Replace your existing workflow content with the templates above

### 3. Migrate Configuration
Convert your existing configuration to the new format:

```bash
# Old format (direct in workflow)
anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}

# New format (centralized)
claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
config-profile: "frontend"
```

### 4. Test Migration
1. Create a test PR to verify the new workflow works
2. Compare review quality with previous system
3. Adjust configuration as needed

### 5. Clean Up
Remove old workflow files and unused secrets:
```bash
rm .github/workflows/old-ai-review.yml
# Remove unused repository secrets via GitHub UI
```

## Best Practices

### 1. Configuration Management
- Start with a standard profile and customize gradually
- Document any custom configurations in your repository
- Regularly review and update configurations

### 2. Security
- Use the minimum required permissions for GitHub Apps
- Regularly rotate authentication tokens
- Monitor workflow logs for suspicious activity

### 3. Performance
- Choose appropriate models for your needs (Sonnet vs Haiku)
- Configure reasonable timeouts and limits
- Monitor API usage and costs

### 4. Team Adoption
- Educate team members on using AI assistance
- Establish guidelines for AI review feedback
- Regular feedback collection and workflow improvements

## Next Steps

1. **Monitor Usage**: Set up monitoring dashboards
2. **Collect Feedback**: Gather team feedback on review quality
3. **Iterate**: Continuously improve configurations and prompts
4. **Scale**: Roll out to additional repositories

For more detailed information, see:
- [Configuration Reference](../configuration.md)
- [Troubleshooting Guide](../troubleshooting/)
- [API Reference](../api.md)