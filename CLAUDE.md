# Workflow Automation Central Repository

## Repository Purpose

This repository serves as the **central hub for GitHub workflow automation** across all EthereumFollowProtocol repositories. It implements a centralized workflow management system that eliminates duplicate workflow maintenance while enabling dynamic configuration and prompt management for AI-powered code reviews.

## Problem Solved

Previously, maintaining AI-powered PR review workflows across multiple repositories required updating each workflow file individually when improvements were made. This created:
- **Maintenance overhead**: O(n) complexity for updates across n repositories  
- **Version inconsistency**: Different repos running different versions
- **Configuration drift**: Settings diverging over time
- **Slow iteration**: Updates requiring PRs to every repository

## Architecture Overview

### System Components

```
Central Infrastructure:
├── Shared Workflows Repo (this repo)
├── Prompt Storage Repo  
├── Configuration Store
└── Automation Manager

Project Repositories:
├── Project Repo 1 (minimal caller workflows)
├── Project Repo 2 (minimal caller workflows)
└── Project Repo N (minimal caller workflows)

External Services:
├── GitHub API
├── Anthropic API  
└── Slack/Discord (notifications)
```

### Key Features

- **Reusable Workflows**: Central workflow definitions with parameterization
- **Dynamic Configuration**: Repository-specific settings without code duplication
- **AI Integration**: Anthropic API integration for automated code reviews
- **Prompt Management**: Centralized, templated prompts with immediate updates
- **Version Management**: Semantic versioning with rollback capabilities
- **Automated Updates**: System automatically propagates changes to satellite repos

## Repository Structure

```
workflow-automation/
├── .github/
│   └── workflows/           # Reusable workflow definitions
├── configs/                 # Configuration profiles and schemas
├── prompts/                 # AI prompt templates
├── scripts/                 # Automation and utility scripts
├── docs/                    # Documentation and guides
├── tests/                   # Testing infrastructure
└── CLAUDE.md               # This file
```

## Core Workflows

### 1. PR Review Workflow
- **Purpose**: Automated AI-powered code review on pull requests
- **Triggers**: PR opened, updated, review requested
- **Features**: Code quality analysis, security checks, best practice enforcement
- **Response**: Line-specific comments, overall assessment, actionable feedback

### 2. Issue Response Workflow  
- **Purpose**: AI-powered responses to GitHub issues
- **Triggers**: Issue created, @mention in comments
- **Features**: Context-aware responses, automated labeling, escalation logic

### 3. Update Propagation Workflow
- **Purpose**: Automated distribution of workflow updates to satellite repos
- **Triggers**: Changes to central workflows or configurations
- **Features**: Batched updates, dry-run capability, rollback support

## Configuration Management

### Configuration Profiles
- **default**: Standard configuration for most repositories
- **frontend**: Specialized rules for frontend codebases  
- **backend**: Backend-specific review criteria
- **security**: Enhanced security-focused reviews
- **experimental**: Latest features and experimental prompts

### Configuration Override Hierarchy
1. Repository-specific overrides (highest priority)
2. Profile-based configurations  
3. Default global settings (lowest priority)

## AI Integration

### Supported Models
- **GPT-4**: Primary model for complex analysis
- **GPT-3.5-turbo**: Fallback for rate limiting
- **Future**: Anthropic Claude, Cohere models planned

### Prompt Templates
- Language-specific prompts (JavaScript, TypeScript, Python, Go, Rust)
- Context-aware templates (PR size, change type, file patterns)
- Customizable review criteria per repository

## Development Commands

### Testing
```bash
# Run workflow tests
npm test

# Run configuration validation
npm run validate-config

# Test prompt templates
npm run test-prompts
```

### Linting & Formatting
```bash
# Lint workflow files
npm run lint

# Format configuration files
npm run format

# Validate workflow syntax
npm run validate-workflows
```

### Local Development
```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production  
npm run build
```

## Key Requirements

### Performance
- Workflow execution time: < 2 minutes for standard PRs
- Configuration fetching: < 5 seconds
- Response time for @mentions: < 30 seconds
- Support for 100+ concurrent repositories

### Reliability
- 99.9% system availability target
- Retry logic for transient failures
- Graceful degradation when external services unavailable
- Fallback configurations for critical paths

### Security
- API keys stored as encrypted GitHub Secrets
- Fine-grained access controls
- No sensitive data in logs
- Support for private prompt repositories

## Success Metrics

### Current Targets
- 90% reduction in workflow maintenance overhead
- 95% workflow version consistency across repositories  
- < 1 hour mean time to propagate changes
- < 5 minutes repository onboarding time
- Daily+ prompt update frequency

## Migration Status

### Implementation Phases
1. **Foundation** (Weeks 1-2): Basic reusable workflows
2. **AI Integration** (Weeks 3-4): Anthropic integration and prompts
3. **Configuration** (Weeks 5-6): Profiles and customization
4. **Automation** (Weeks 7-8): Update propagation and monitoring  
5. **Migration** (Weeks 9-10): Full repository rollout

## Usage for Satellite Repositories

Satellite repositories only need a minimal caller workflow (< 20 lines):

```yaml
name: AI Code Review
on: [pull_request]

jobs:
  review:
    uses: ethereumfollowprotocol/workflow-automation/.github/workflows/pr-review.yml@v1
    with:
      config-profile: "frontend"
      repository-config: ".github/ai-review-config.json"
    secrets:
      Anthropic_API_KEY: ${{ secrets.Anthropic_API_KEY }}
```

## Important Files

### Configuration Schema
- `configs/schema.json`: JSON schema for configuration validation
- `configs/profiles/`: Named configuration profiles
- `configs/defaults.json`: Default settings

### Prompt Templates  
- `prompts/review/`: Code review prompt templates
- `prompts/response/`: Issue response templates
- `prompts/shared/`: Common prompt components

### Scripts
- `scripts/update-propagation.js`: Automated update distribution
- `scripts/version-check.js`: Cross-repository version tracking
- `scripts/config-validator.js`: Configuration validation utility

## Monitoring & Alerting

### Key Metrics Tracked
- Workflow execution success rates
- API usage and rate limits  
- Configuration version consistency
- Response times and performance
- Cost tracking (Anthropic API usage)

### Alert Conditions
- Workflow failure rate > 5%
- API rate limit approaching
- Version inconsistency detected
- Performance degradation
- Cost threshold exceeded

## Support

### Documentation
- Setup guides for new repositories
- Configuration reference documentation
- Troubleshooting guides for common issues
- Migration guides from existing workflows

### Maintenance Schedule
- **Daily**: Monitor execution metrics
- **Weekly**: Review and merge prompt updates
- **Monthly**: Performance optimization review
- **Quarterly**: Major version releases
- **Annually**: Architecture review

## Future Enhancements

### Short-term (3-6 months)
- Additional AI provider integrations
- Custom metrics dashboards
- Workflow template marketplace
- IDE plugins for local testing

### Long-term (12+ months)  
- ML-based configuration recommendations
- Predictive maintenance alerts
- Cross-organization workflow sharing
- Complete GitOps implementation

## Cost Structure

### Monthly Operating Costs
- GitHub Actions: $0 (within free tier)
- Anthropic API: ~$500 (estimated 100 reviews/day)
- Monitoring tools: ~$100
- **Total**: ~$600/month

## Dependencies

### External
- GitHub Actions availability and performance
- Anthropic API availability and pricing  
- GitHub API rate limits
- Network connectivity

### Internal
- Developer training and adoption
- Security team approval for API integrations
- Budget approval for operational costs
- Infrastructure team support

---

This repository represents a critical infrastructure component enabling efficient, consistent, and scalable workflow automation across the entire EthereumFollowProtocol ecosystem.