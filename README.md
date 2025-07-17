# Workflow Automation

This repository contains GitHub Actions workflows for AI-powered code review and on-demand assistance, primarily using Anthropic's Claude AI models through the `claude-code-action`. It serves as both a testing ground for workflow development and a production environment for AI automation.

## Purpose

- **AI-Powered Code Reviews**: Automated security and quality analysis for pull requests
- **On-Demand AI Assistance**: Interactive AI assistant triggered by mentions in issues and comments
- **Workflow Development**: Testing and validation environment for GitHub Actions automation
- **CI/CD Experimentation**: Exploring advanced automation patterns and integrations

## Active Workflows

These workflows are currently deployed and active in the `.github/workflows/` directory:

### `ai-review.yaml` - Custom AI Code Review
**Trigger**: Automatically runs on pull request events (opened, synchronize, reopened)

**Purpose**: Provides comprehensive automated code review using Claude AI

**Features**:
- 🛡️ **Security Analysis**: Scans for vulnerabilities including SQL injection, XSS, authentication issues, and input validation problems
- 📋 **Code Quality Assessment**: Evaluates maintainability, readability, best practices, and performance considerations  
- 📚 **Documentation Review**: Checks comment quality, function documentation, and README updates
- 📊 **Summary Comments**: Posts structured feedback with actionable recommendations

**Workflow Steps**:
1. Checkout code with full history for better context
2. Generate GitHub App token for authentication
3. Run AI security review with specific security focus
4. Run AI code quality review with comprehensive analysis
5. Post summary comment with review completion status

### `ai-on-demand.yaml` - AI On-Demand Assistant  
**Trigger**: Responds to `@efp-dev-ops` mentions in issue comments, PR review comments, PR reviews, and new issues

**Purpose**: Provides interactive AI assistance on-demand for development team members

**Access Control**: Limited to specific authorized users (`0xthrpw`, `encrypteddegen`, `caveman-eth`, `brantlymillegan`)

**Features**:
- 💬 **Interactive Help**: Responds to specific questions and requests
- 🔍 **Code Analysis**: Provides analysis based on current repository context
- 📝 **Actionable Guidance**: Offers clear, formatted responses for GitHub comments
- 👍 **Reaction Feedback**: Adds thumbs-up reaction to acknowledge mention

**Workflow Steps**:
1. Extract instruction text from the triggering comment
2. Generate GitHub App token for authentication  
3. Process request through Claude AI with extracted instruction
4. React to original comment to confirm processing

## Development/Working Workflows

These workflows are located in the `working/` directory for development and testing:

### `claude.yml` - Claude PR Assistant
**Purpose**: Alternative implementation using `@claude` mentions and `anthropic_api_key` authentication
- Simplified version for testing Claude Code Action beta features
- Uses basic permissions setup (read-only with minimal write access)
- Supports issues, comments, and PR review interactions

### `claude-review.yaml` - Alternative Code Review Implementation
**Purpose**: Development version of the AI code review workflow
- Mirror of `ai-review.yaml` with `anthropic_api_key` instead of OAuth token
- Used for testing changes before deploying to production workflow
- Identical functionality to the active review workflow

### `claude-on-demand.yaml` - Enhanced On-Demand Assistant
**Purpose**: Development version with additional bot prevention logic
- Includes extra filtering to prevent bot-to-bot interactions
- Enhanced error handling and instruction extraction
- Uses `claude-code-action@v1` for testing newer versions

### `ai-on-demand.yaml` - Simplified On-Demand Variant
**Purpose**: Streamlined version of the on-demand assistant
- Reduced event triggers (only issue and PR review comments)
- Simplified conditional logic for easier debugging
- Alternative implementation for A/B testing different approaches

## Configuration Requirements

All workflows require the following repository secrets:

- `APP_ID`: GitHub App ID for authentication
- `PRIVATE_KEY`: GitHub App private key
- `ANTHROPIC_API_KEY`: Anthropic API key for Claude access
- `CLAUDE_CODE_OAUTH_TOKEN`: OAuth token for Claude Code Action

## Usage Instructions

### For Code Reviews
Code reviews run automatically on pull requests. No manual intervention required.

### For On-Demand Assistance  
1. Mention `@efp-dev-ops` in any issue comment, PR comment, or new issue
2. Include your question or request after the mention
3. The AI assistant will respond with helpful analysis or guidance
4. Look for the 👍 reaction to confirm your mention was processed

### Example Usage
```
@efp-dev-ops can you explain what this function does?
@efp-dev-ops help me optimize this code for better performance  
@efp-dev-ops review the security implications of this change
```

## Development Workflow

1. **Development**: Create and test new workflows in the `working/` directory
2. **Validation**: Test functionality with different trigger conditions and inputs
3. **Deployment**: Move stable workflows to `.github/workflows/` for production use
4. **Monitoring**: Review workflow run logs and AI responses for quality assurance

This repository serves as both a testing ground for GitHub Actions innovation and a production environment for AI-powered development assistance.