#!/usr/bin/env bun

/**
 * Update Propagation Script
 * 
 * Automatically propagates workflow updates to satellite repositories
 * by creating pull requests with the latest workflow versions.
 */

import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

interface RepositoryConfig {
  owner: string;
  repo: string;
  workflowPath: string;
  configProfile?: string;
  enabled: boolean;
  lastUpdated?: string;
}

interface UpdateConfig {
  repositories: RepositoryConfig[];
  workflowVersion: string;
  updateMessage: string;
  dryRun: boolean;
}

class UpdatePropagator {
  private octokit: Octokit;
  private config: UpdateConfig;
  private centralRepo: { owner: string; repo: string };
  private appId: string;
  private privateKey: string;

  constructor(appId: string, privateKey: string, configPath: string) {
    this.appId = appId;
    this.privateKey = privateKey;
    
    // Initialize with app-level authentication first
    this.octokit = new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: appId,
        privateKey: privateKey,
      },
    });
    
    this.config = this.loadConfig(configPath);
    this.centralRepo = {
      owner: "ethereumfollowprotocol",
      repo: "workflow-automation"
    };
  }

  private loadConfig(configPath: string): UpdateConfig {
    if (!existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}`);
    }
    
    const configContent = readFileSync(configPath, 'utf-8');
    return JSON.parse(configContent);
  }

  /**
   * Get installation-specific Octokit instance for a repository
   */
  private async getInstallationOctokit(owner: string, repo: string): Promise<Octokit> {
    try {
      // Get the installation ID for this repository
      const { data: installation } = await this.octokit.apps.getRepoInstallation({
        owner: owner,
        repo: repo,
      });

      // Create installation-specific Octokit instance
      return new Octokit({
        authStrategy: createAppAuth,
        auth: {
          appId: this.appId,
          privateKey: this.privateKey,
          installationId: installation.id,
        },
      });
    } catch (error: any) {
      if (error.status === 404) {
        throw new Error(`GitHub App not installed on ${owner}/${repo}`);
      }
      throw error;
    }
  }

  /**
   * Generate caller workflow content for a repository
   */
  private generateCallerWorkflow(repo: RepositoryConfig): string {
    const profile = repo.configProfile || 'default';
    
    return `name: AI Code Review
on:
  pull_request:
    types: [opened, synchronize, reopened]

permissions:
  contents: read
  pull-requests: write
  issues: write
  actions: read    

jobs:
  ai-review:
    uses: ethereumfollowprotocol/workflow-automation/.github/workflows/pr-review.yml@v${this.config.workflowVersion}
    with:
      config-profile: "${profile}"
      enable-security-review: true
      enable-quality-review: true
      enable-documentation-review: true
    secrets:
      CLAUDE_CODE_OAUTH_TOKEN: \${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
      APP_ID: \${{ secrets.APP_ID }}
      PRIVATE_KEY: \${{ secrets.PRIVATE_KEY }}
      ALLOWED_USER_LIST: \${{ secrets.ALLOWED_USER_LIST }}`;
  }

  /**
   * Generate on-demand workflow content for a repository
   */
  private generateOnDemandWorkflow(repo: RepositoryConfig): string {
    return `name: AI On-Demand Assistant  
on:
  issue_comment:
    types: [created]
  pull_request_review_comment:
    types: [created]
  pull_request_review:
    types: [submitted]
  issues:
    types: [opened]

permissions:
  contents: read
  issues: write
  pull-requests: write
  actions: read

jobs:
  ai-response:
    uses: ethereumfollowprotocol/workflow-automation/.github/workflows/issue-response.yml@v${this.config.workflowVersion}
    with:
      config-profile: "${repo.configProfile || 'default'}"
      bot-mention: "@efp-dev-ops"
      enable-auto-labeling: true
      enable-escalation: true
    secrets:
      CLAUDE_CODE_OAUTH_TOKEN: \${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
      APP_ID: \${{ secrets.APP_ID }}
      PRIVATE_KEY: \${{ secrets.PRIVATE_KEY }}
      ALLOWED_USER_LIST: \${{ secrets.ALLOWED_USER_LIST }}`;
  }

  /**
   * Check if a repository needs updating
   */
  private async needsUpdate(repo: RepositoryConfig): Promise<boolean> {
    try {
      const installationOctokit = await this.getInstallationOctokit(repo.owner, repo.repo);
      
      const { data: currentFile } = await installationOctokit.repos.getContent({
        owner: repo.owner,
        repo: repo.repo,
        path: repo.workflowPath,
      });

      if ('content' in currentFile) {
        const currentContent = Buffer.from(currentFile.content, 'base64').toString();
        const expectedContent = this.generateCallerWorkflow(repo);
        
        // Check if the workflow references the current version
        return !currentContent.includes(`@v${this.config.workflowVersion}`);
      }
      
      return true; // File doesn't exist, needs update
    } catch (error: any) {
      if (error.status === 404) {
        return true; // File doesn't exist, needs creation
      }
      throw error;
    }
  }

  /**
   * Create or update workflow file in a repository
   */
  private async updateRepository(repo: RepositoryConfig): Promise<void> {
    if (!repo.enabled) {
      console.log(`⏭️ Skipping disabled repository: ${repo.owner}/${repo.repo}`);
      return;
    }

    console.log(`🔍 Checking repository: ${repo.owner}/${repo.repo}`);

    if (!(await this.needsUpdate(repo))) {
      console.log(`✅ Repository ${repo.owner}/${repo.repo} is up to date`);
      return;
    }

    if (this.config.dryRun) {
      console.log(`🧪 [DRY RUN] Would update ${repo.owner}/${repo.repo}`);
      return;
    }

    try {
      // Get installation-specific Octokit instance
      const installationOctokit = await this.getInstallationOctokit(repo.owner, repo.repo);
      
      // Create a new branch for the update
      const branchName = `workflow-automation/update-v${this.config.workflowVersion}`;
      
      // Get the default branch
      const { data: repoData } = await installationOctokit.repos.get({
        owner: repo.owner,
        repo: repo.repo,
      });
      
      const defaultBranch = repoData.default_branch;
      
      // Get the latest commit SHA from default branch
      const { data: defaultBranchData } = await installationOctokit.repos.getBranch({
        owner: repo.owner,
        repo: repo.repo,
        branch: defaultBranch,
      });

      // Try to create the branch (if it doesn't exist)
      try {
        await installationOctokit.git.createRef({
          owner: repo.owner,
          repo: repo.repo,
          ref: `refs/heads/${branchName}`,
          sha: defaultBranchData.commit.sha,
        });
        console.log(`🌿 Created branch: ${branchName}`);
      } catch (error: any) {
        if (error.status === 422) {
          // Branch already exists, update it
          await installationOctokit.git.updateRef({
            owner: repo.owner,
            repo: repo.repo,
            ref: `heads/${branchName}`,
            sha: defaultBranchData.commit.sha,
          });
          console.log(`🔄 Updated existing branch: ${branchName}`);
        } else {
          throw error;
        }
      }

      // Generate the workflow content
      const workflowContent = this.generateCallerWorkflow(repo);
      const onDemandContent = this.generateOnDemandWorkflow(repo);

      // Update the main workflow file
      await this.updateFile(
        installationOctokit,
        repo,
        branchName,
        repo.workflowPath,
        workflowContent,
        `Update AI review workflow to v${this.config.workflowVersion}`
      );

      // Update the on-demand workflow file
      const onDemandPath = repo.workflowPath.replace('ai-review.yml', 'ai-on-demand.yml');
      await this.updateFile(
        installationOctokit,
        repo,
        branchName,
        onDemandPath,
        onDemandContent,
        `Update AI on-demand workflow to v${this.config.workflowVersion}`
      );

      // Create pull request
      await this.createPullRequest(installationOctokit, repo, branchName, defaultBranch);
      
      console.log(`✅ Successfully updated ${repo.owner}/${repo.repo}`);
      
    } catch (error) {
      console.error(`❌ Failed to update ${repo.owner}/${repo.repo}:`, error);
      throw error;
    }
  }

  /**
   * Update a file in the repository
   */
  private async updateFile(
    octokit: Octokit,
    repo: RepositoryConfig,
    branch: string,
    filePath: string,
    content: string,
    commitMessage: string
  ): Promise<void> {
    let sha: string | undefined;

    try {
      // Check if file exists
      const { data: existingFile } = await octokit.repos.getContent({
        owner: repo.owner,
        repo: repo.repo,
        path: filePath,
        ref: branch,
      });

      if ('sha' in existingFile) {
        sha = existingFile.sha;
      }
    } catch (error: any) {
      if (error.status !== 404) {
        throw error;
      }
      // File doesn't exist, will create new
    }

    await octokit.repos.createOrUpdateFileContents({
      owner: repo.owner,
      repo: repo.repo,
      path: filePath,
      message: commitMessage,
      content: Buffer.from(content).toString('base64'),
      branch: branch,
      sha: sha,
    });
  }

  /**
   * Create a pull request for the workflow update
   */
  private async createPullRequest(
    octokit: Octokit,
    repo: RepositoryConfig,
    branchName: string,
    baseBranch: string
  ): Promise<void> {
    const title = `🤖 Update AI Workflow Automation to v${this.config.workflowVersion}`;
    const body = `## 🚀 Workflow Automation Update

This PR updates the AI workflow automation to version **v${this.config.workflowVersion}**.

### Changes
- Updated AI review workflow to use latest central workflow version
- Updated AI on-demand response workflow
- Improved configuration handling and error management
- Enhanced prompt templates and language support

### What This Enables
- Latest AI review capabilities
- Improved prompt templates
- Enhanced security and quality checks
- Better configuration management

### Configuration
- **Profile**: ${repo.configProfile || 'default'}
- **Central Repository**: ethereumfollowprotocol/workflow-automation@v${this.config.workflowVersion}

${this.config.updateMessage}

---
🤖 This PR was automatically created by the [EthereumFollowProtocol Workflow Automation System](https://github.com/ethereumfollowprotocol/workflow-automation)`;

    try {
      const { data: pr } = await octokit.pulls.create({
        owner: repo.owner,
        repo: repo.repo,
        title: title,
        body: body,
        head: branchName,
        base: baseBranch,
      });

      console.log(`📝 Created pull request: ${pr.html_url}`);
      
      // Add labels if possible
      try {
        await octokit.issues.addLabels({
          owner: repo.owner,
          repo: repo.repo,
          issue_number: pr.number,
          labels: ['automation', 'workflow-update', 'ai-review'],
        });
      } catch (labelError) {
        console.log(`⚠️ Could not add labels to PR (this is normal if labels don't exist)`);
      }

    } catch (error: any) {
      if (error.status === 422) {
        console.log(`ℹ️ Pull request already exists for ${branchName}`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Run the update propagation process
   */
  async run(): Promise<void> {
    console.log(`🚀 Starting workflow update propagation`);
    console.log(`📋 Target version: v${this.config.workflowVersion}`);
    console.log(`📊 Repositories to process: ${this.config.repositories.length}`);
    
    if (this.config.dryRun) {
      console.log(`🧪 Running in DRY RUN mode`);
    }

    const results = {
      success: 0,
      skipped: 0,
      failed: 0,
    };

    for (const repo of this.config.repositories) {
      try {
        await this.updateRepository(repo);
        if (repo.enabled && await this.needsUpdate(repo)) {
          results.success++;
        } else {
          results.skipped++;
        }
      } catch (error) {
        console.error(`❌ Failed to process ${repo.owner}/${repo.repo}:`, error);
        results.failed++;
      }
    }

    console.log(`\n📈 Update Summary:`);
    console.log(`  ✅ Successful updates: ${results.success}`);
    console.log(`  ⏭️ Skipped (up-to-date or disabled): ${results.skipped}`);
    console.log(`  ❌ Failed updates: ${results.failed}`);

    if (results.failed > 0) {
      process.exit(1);
    }
  }
}

// CLI usage
async function main() {
  const appId = process.env.APP_ID;
  const privateKey = process.env.PRIVATE_KEY;
  
  if (!appId || !privateKey) {
    console.error("❌ APP_ID and PRIVATE_KEY environment variables are required");
    console.error("ℹ️ Use GitHub App credentials instead of GITHUB_TOKEN");
    process.exit(1);
  }

  const configPath = process.argv[2] || './config/repositories.json';
  
  try {
    const propagator = new UpdatePropagator(appId, privateKey, configPath);
    await propagator.run();
  } catch (error) {
    console.error("❌ Update propagation failed:", error);
    process.exit(1);
  }
}

if (import.meta.main) {
  main().catch(console.error);
}

export { UpdatePropagator };