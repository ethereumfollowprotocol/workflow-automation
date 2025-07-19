# Workflow Automation

This repository contains GitHub Actions workflows for AI-powered development assistance and automation. It serves as both a testing environment for workflow development and a collection of production-ready AI integration patterns.

## Repository Structure

### Active Workflows (`.github/workflows/`)

#### `ai-on-demand.yaml`
**AI On-Demand Assistant** - Triggers AI assistance when team members mention `@efp-dev-ops` in issues, PR comments, or reviews.

- **Triggers**: Issue comments, PR review comments, PR reviews, new issues
- **Access Control**: Restricted to specific team members (`0xthrpw`, `encrypteddegen`, `caveman-eth`, `brantlymillegan`)
- **Functionality**: Extracts instructions from mentions and provides AI-powered responses
- **Authentication**: Uses GitHub App with custom token generation
- **AI Provider**: Uses `anthropics/claude-code-action@v0`

#### `ai-review.yaml`
**Custom AI Code Review** - Automated AI-powered code review system for pull requests.

- **Triggers**: PR opened, synchronized, or reopened
- **Features**:
  - Security vulnerability analysis (SQL injection, XSS, auth issues)
  - Code quality assessment with scoring (1-10)
  - Documentation review
  - Compliance checking
- **Output**: Dual AI reviews (security + quality) with summary comment
- **Authentication**: GitHub App with custom token generation

### Draft/Working Workflows (`working/`)

#### `ai-on-demand.yaml`
Early version of the AI on-demand assistant with similar functionality but different implementation details.

#### `claude-on-demand.yaml` 
Claude-specific on-demand assistant triggered by `@efp-dev-ops` mentions.

- **Key Difference**: Includes bot prevention logic (`github.event.comment.user.login != 'efp-dev-ops[bot]'`)
- **Features**: Comment extraction and Claude-powered responses
- **Authentication**: Supports both API key and OAuth token methods

#### `claude-review.yaml`
Multi-step AI code review system with separate security and quality analysis phases.

- **Features**:
  - Dedicated security review step
  - Separate code quality review step  
  - Summary comment with completion status
- **Review Focus**: Security standards, error handling, maintainability, documentation
- **Uses**: `anthropics/claude-code-action@v0`

#### `claude.yml`
Claude PR Assistant triggered by `@claude` mentions.

- **Triggers**: Issue comments, PR comments, new issues, PR reviews
- **Features**: Direct Claude integration with beta action version
- **Configuration**: Supports timeout settings and network restrictions
- **Uses**: `anthropics/claude-code-action@beta`

### Project Files

#### `package.json`
Basic TypeScript/Bun project configuration with minimal dependencies.

#### `index.ts`
Simple "Hello via Bun!" console application for testing the TypeScript setup.

#### `tsconfig.json`
TypeScript compiler configuration for the project.

## AI Integration Patterns

This repository demonstrates several AI integration patterns:

1. **On-Demand AI Assistance**: Trigger AI help through @mentions
2. **Automated Code Reviews**: AI-powered PR analysis and feedback
3. **Multi-Provider Support**: Examples for different AI services
4. **Security-First Reviews**: Dedicated security vulnerability scanning
5. **Team Access Control**: Restricted AI access to authorized team members

## Authentication Methods

The workflows support multiple authentication approaches:

- **GitHub App**: Custom app tokens for enhanced permissions
- **API Keys**: Direct API key authentication for AI services
- **OAuth Tokens**: OAuth-based authentication for Claude Code

## Usage

### For AI Assistance
- Comment `@efp-dev-ops [your request]` on issues or PRs to get AI help
- Comment `@claude [your request]` to trigger the Claude assistant

### For Code Reviews
- Open, update, or reopen pull requests to trigger automated AI reviews
- Reviews cover security, quality, and documentation aspects

## Development

This is a testing environment for:
- GitHub Actions workflow development
- AI integration pattern validation  
- Workflow automation experimentation
- Team collaboration tool testing