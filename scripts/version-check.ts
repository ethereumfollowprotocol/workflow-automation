#!/usr/bin/env bun

/**
 * Version Check Script
 * 
 * Scans all satellite repositories to check workflow versions and
 * generate a comprehensive version consistency report.
 */

import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import { readFileSync, writeFileSync, existsSync } from "fs";

interface RepositoryInfo {
  owner: string;
  repo: string;
  workflowPath: string;
  currentVersion: string | null;
  lastChecked: Date;
  status: 'up-to-date' | 'outdated' | 'missing' | 'error';
  errorMessage?: string;
  pullRequestUrl?: string;
  configProfile?: string;
}

interface VersionReport {
  centralVersion: string;
  reportDate: Date;
  totalRepositories: number;
  upToDate: number;
  outdated: number;
  missing: number;
  errors: number;
  repositories: RepositoryInfo[];
  summary: {
    versionDistribution: Record<string, number>;
    oldestVersion: string | null;
    newestVersion: string | null;
  };
}

class VersionChecker {
  private octokit: Octokit;
  private centralRepo: { owner: string; repo: string };
  private repositories: { owner: string; repo: string; workflowPath: string; configProfile?: string }[];
  private appId: string;
  private privateKey: string;

  constructor(appId: string, privateKey: string, repositoriesConfig: string) {
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
    
    this.centralRepo = {
      owner: "ethereumfollowprotocol",
      repo: "workflow-automation"
    };
    this.loadRepositories(repositoriesConfig);
  }

  private loadRepositories(configPath: string): void {
    if (!existsSync(configPath)) {
      throw new Error(`Repositories configuration file not found: ${configPath}`);
    }
    
    const configContent = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    
    if (config.repositories && Array.isArray(config.repositories)) {
      this.repositories = config.repositories.filter((repo: any) => repo.enabled !== false);
    } else {
      throw new Error("Invalid repositories configuration format");
    }
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
   * Get the current version from the central repository
   */
  private async getCentralVersion(): Promise<string> {
    try {
      // Get latest release
      const { data: latestRelease } = await this.octokit.repos.getLatestRelease({
        owner: this.centralRepo.owner,
        repo: this.centralRepo.repo,
      });
      
      return latestRelease.tag_name.replace(/^v/, '');
    } catch (error: any) {
      if (error.status === 404) {
        // No releases yet, use latest commit
        const { data: commits } = await this.octokit.repos.listCommits({
          owner: this.centralRepo.owner,
          repo: this.centralRepo.repo,
          per_page: 1,
        });
        
        return commits[0]?.sha.substring(0, 7) || 'unknown';
      }
      throw error;
    }
  }

  /**
   * Extract version from workflow file content
   */
  private extractVersionFromWorkflow(content: string): string | null {
    // Look for version pattern: @v1.2.3 or @main or @commit-sha
    const versionMatch = content.match(/ethereumfollowprotocol\/workflow-automation[^@]*@([^\s\n]+)/);
    
    if (versionMatch) {
      let version = versionMatch[1];
      // Clean up the version string
      if (version.startsWith('v')) {
        version = version.substring(1);
      }
      return version;
    }
    
    return null;
  }

  /**
   * Check the workflow version in a specific repository
   */
  private async checkRepositoryVersion(repo: { owner: string; repo: string; workflowPath: string; configProfile?: string }): Promise<RepositoryInfo> {
    const repoInfo: RepositoryInfo = {
      owner: repo.owner,
      repo: repo.repo,
      workflowPath: repo.workflowPath,
      configProfile: repo.configProfile,
      currentVersion: null,
      lastChecked: new Date(),
      status: 'error',
    };

    try {
      console.log(`🔍 Checking ${repo.owner}/${repo.repo}...`);

      // Get installation-specific Octokit instance
      const installationOctokit = await this.getInstallationOctokit(repo.owner, repo.repo);

      // Try to get the workflow file
      const { data: fileData } = await installationOctokit.repos.getContent({
        owner: repo.owner,
        repo: repo.repo,
        path: repo.workflowPath,
      });

      if ('content' in fileData) {
        const content = Buffer.from(fileData.content, 'base64').toString();
        repoInfo.currentVersion = this.extractVersionFromWorkflow(content);
        
        if (repoInfo.currentVersion) {
          repoInfo.status = 'up-to-date'; // Will be updated in comparison phase
        } else {
          repoInfo.status = 'error';
          repoInfo.errorMessage = 'Could not extract version from workflow file';
        }
      } else {
        repoInfo.status = 'error';
        repoInfo.errorMessage = 'Workflow file is not a regular file';
      }

      // Check for existing update pull requests
      const { data: pulls } = await installationOctokit.pulls.list({
        owner: repo.owner,
        repo: repo.repo,
        state: 'open',
        head: `${repo.owner}:workflow-automation/update-`,
      });

      if (pulls.length > 0) {
        repoInfo.pullRequestUrl = pulls[0].html_url;
      }

    } catch (error: any) {
      if (error.message.includes('not installed')) {
        repoInfo.status = 'error';
        repoInfo.errorMessage = 'GitHub App not installed on repository';
        console.log(`⚠️ GitHub App not installed on ${repo.owner}/${repo.repo}`);
      } else if (error.status === 404) {
        repoInfo.status = 'missing';
        repoInfo.errorMessage = 'Workflow file not found or repository not accessible';
        console.log(`⚠️ Repository or workflow file not found: ${repo.owner}/${repo.repo}`);
      } else {
        repoInfo.status = 'error';
        repoInfo.errorMessage = error.message;
        console.error(`❌ Error checking ${repo.owner}/${repo.repo}:`, error.message);
      }
    }

    return repoInfo;
  }

  /**
   * Compare versions and update status
   */
  private updateVersionStatus(repositories: RepositoryInfo[], centralVersion: string): void {
    for (const repo of repositories) {
      if (repo.status === 'error' || repo.status === 'missing') {
        continue;
      }

      if (repo.currentVersion === centralVersion || 
          repo.currentVersion === `v${centralVersion}` ||
          repo.currentVersion === 'main') {
        repo.status = 'up-to-date';
      } else {
        repo.status = 'outdated';
      }
    }
  }

  /**
   * Generate version distribution summary
   */
  private generateSummary(repositories: RepositoryInfo[]): VersionReport['summary'] {
    const versionDistribution: Record<string, number> = {};
    let oldestVersion: string | null = null;
    let newestVersion: string | null = null;

    for (const repo of repositories) {
      if (repo.currentVersion) {
        versionDistribution[repo.currentVersion] = (versionDistribution[repo.currentVersion] || 0) + 1;
        
        // Simple version comparison (works for semantic versions)
        if (!oldestVersion || repo.currentVersion < oldestVersion) {
          oldestVersion = repo.currentVersion;
        }
        
        if (!newestVersion || repo.currentVersion > newestVersion) {
          newestVersion = repo.currentVersion;
        }
      }
    }

    return {
      versionDistribution,
      oldestVersion,
      newestVersion,
    };
  }

  /**
   * Generate HTML report
   */
  private generateHtmlReport(report: VersionReport): string {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Workflow Version Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { padding: 20px; border-radius: 6px; text-align: center; }
        .stat-card.up-to-date { background: #d4edda; border-left: 4px solid #28a745; }
        .stat-card.outdated { background: #f8d7da; border-left: 4px solid #dc3545; }
        .stat-card.missing { background: #fff3cd; border-left: 4px solid #ffc107; }
        .stat-card.error { background: #f8d7da; border-left: 4px solid #dc3545; }
        .stat-number { font-size: 2em; font-weight: bold; margin-bottom: 5px; }
        .repository-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        .repository-table th, .repository-table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        .repository-table th { background: #f8f9fa; font-weight: 600; }
        .status-badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .status-up-to-date { background: #d4edda; color: #155724; }
        .status-outdated { background: #f8d7da; color: #721c24; }
        .status-missing { background: #fff3cd; color: #856404; }
        .status-error { background: #f8d7da; color: #721c24; }
        .version-distribution { margin: 20px 0; }
        .version-bar { display: flex; align-items: center; margin: 5px 0; }
        .version-label { min-width: 100px; }
        .version-progress { flex-grow: 1; height: 20px; background: #e9ecef; border-radius: 4px; margin: 0 10px; overflow: hidden; }
        .version-fill { height: 100%; background: #007bff; }
        .timestamp { color: #666; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🤖 Workflow Version Report</h1>
            <p class="timestamp">Generated on ${report.reportDate.toLocaleString()}</p>
            <p>Central Version: <strong>v${report.centralVersion}</strong></p>
        </div>

        <div class="stats">
            <div class="stat-card up-to-date">
                <div class="stat-number">${report.upToDate}</div>
                <div>Up to Date</div>
            </div>
            <div class="stat-card outdated">
                <div class="stat-number">${report.outdated}</div>
                <div>Outdated</div>
            </div>
            <div class="stat-card missing">
                <div class="stat-number">${report.missing}</div>
                <div>Missing</div>
            </div>
            <div class="stat-card error">
                <div class="stat-number">${report.errors}</div>
                <div>Errors</div>
            </div>
        </div>

        <div class="version-distribution">
            <h3>Version Distribution</h3>
            ${Object.entries(report.summary.versionDistribution).map(([version, count]) => `
                <div class="version-bar">
                    <div class="version-label">v${version}</div>
                    <div class="version-progress">
                        <div class="version-fill" style="width: ${(count / report.totalRepositories) * 100}%"></div>
                    </div>
                    <div>${count} repos</div>
                </div>
            `).join('')}
        </div>

        <table class="repository-table">
            <thead>
                <tr>
                    <th>Repository</th>
                    <th>Status</th>
                    <th>Current Version</th>
                    <th>Profile</th>
                    <th>Last Checked</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${report.repositories.map(repo => `
                    <tr>
                        <td><strong>${repo.owner}/${repo.repo}</strong></td>
                        <td><span class="status-badge status-${repo.status}">${repo.status.replace('-', ' ').toUpperCase()}</span></td>
                        <td>${repo.currentVersion || 'N/A'}</td>
                        <td>${repo.configProfile || 'default'}</td>
                        <td class="timestamp">${repo.lastChecked.toLocaleString()}</td>
                        <td>
                            ${repo.pullRequestUrl ? `<a href="${repo.pullRequestUrl}" target="_blank">View PR</a>` : ''}
                            ${repo.errorMessage ? `<br><small style="color: #dc3545;">${repo.errorMessage}</small>` : ''}
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
</body>
</html>`;
    
    return html;
  }

  /**
   * Run the version check process
   */
  async run(): Promise<VersionReport> {
    console.log(`🚀 Starting workflow version check`);
    
    // Get central version
    const centralVersion = await this.getCentralVersion();
    console.log(`📋 Central version: v${centralVersion}`);
    console.log(`📊 Repositories to check: ${this.repositories.length}`);

    // Check all repositories
    const repositories: RepositoryInfo[] = [];
    
    for (const repo of this.repositories) {
      const repoInfo = await this.checkRepositoryVersion(repo);
      repositories.push(repoInfo);
    }

    // Update status based on version comparison
    this.updateVersionStatus(repositories, centralVersion);

    // Calculate statistics
    const upToDate = repositories.filter(r => r.status === 'up-to-date').length;
    const outdated = repositories.filter(r => r.status === 'outdated').length;
    const missing = repositories.filter(r => r.status === 'missing').length;
    const errors = repositories.filter(r => r.status === 'error').length;

    // Generate report
    const report: VersionReport = {
      centralVersion,
      reportDate: new Date(),
      totalRepositories: repositories.length,
      upToDate,
      outdated,
      missing,
      errors,
      repositories,
      summary: this.generateSummary(repositories),
    };

    // Save reports
    const jsonReportPath = './version-report.json';
    const htmlReportPath = './version-report.html';
    
    writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));
    writeFileSync(htmlReportPath, this.generateHtmlReport(report));

    // Print summary
    console.log(`\n📈 Version Check Summary:`);
    console.log(`  ✅ Up to date: ${upToDate}`);
    console.log(`  ⚠️ Outdated: ${outdated}`);
    console.log(`  ❓ Missing: ${missing}`);
    console.log(`  ❌ Errors: ${errors}`);
    console.log(`  📊 Consistency: ${((upToDate / repositories.length) * 100).toFixed(1)}%`);
    console.log(`\n📄 Reports saved:`);
    console.log(`  📋 JSON: ${jsonReportPath}`);
    console.log(`  🌐 HTML: ${htmlReportPath}`);

    return report;
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
    const checker = new VersionChecker(appId, privateKey, configPath);
    const report = await checker.run();
    
    // Exit with error code if there are issues
    if (report.outdated > 0 || report.missing > 0 || report.errors > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Version check failed:", error);
    process.exit(1);
  }
}

if (import.meta.main) {
  main().catch(console.error);
}

export { VersionChecker };