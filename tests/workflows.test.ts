import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import { load } from "js-yaml";

describe("Workflow Tests", () => {
  const workflowsPath = join(process.cwd(), ".github", "workflows");
  
  describe("Workflow Files", () => {
    const workflowFiles = readdirSync(workflowsPath).filter(file => 
      file.endsWith('.yml') || file.endsWith('.yaml')
    );

    it("should have required workflow files", () => {
      const requiredWorkflows = [
        "pr-review.yml",
        "issue-response.yml", 
        "update-propagation.yml",
        "version-monitoring.yml"
      ];

      requiredWorkflows.forEach(workflow => {
        expect(workflowFiles).toContain(workflow);
      });
    });

    workflowFiles.forEach(workflowFile => {
      describe(`Workflow: ${workflowFile}`, () => {
        let workflow: any;

        beforeAll(() => {
          const workflowPath = join(workflowsPath, workflowFile);
          const workflowContent = readFileSync(workflowPath, "utf-8");
          workflow = load(workflowContent);
        });

        it("should be valid YAML", () => {
          expect(workflow).toBeDefined();
        });

        it("should have required top-level properties", () => {
          expect(workflow.name).toBeDefined();
          expect(workflow.on).toBeDefined();
          expect(workflow.jobs).toBeDefined();
        });

        it("should have a descriptive name", () => {
          expect(workflow.name).toBeTruthy();
          expect(workflow.name.length).toBeGreaterThan(5);
        });

        if (workflowFile.includes('pr-review') || workflowFile.includes('issue-response')) {
          it("should be a reusable workflow", () => {
            expect(workflow.on.workflow_call).toBeDefined();
          });

          it("should have proper inputs", () => {
            const inputs = workflow.on.workflow_call.inputs;
            expect(inputs).toBeDefined();
            
            // Should have config-profile input
            expect(inputs['config-profile']).toBeDefined();
          });

          it("should have required secrets", () => {
            const secrets = workflow.on.workflow_call.secrets;
            expect(secrets).toBeDefined();
            
            // Should require Claude Code token
            expect(secrets.CLAUDE_CODE_OAUTH_TOKEN).toBeDefined();
            expect(secrets.CLAUDE_CODE_OAUTH_TOKEN.required).toBe(true);
          });
        }

        it("should have jobs with valid structure", () => {
          const jobs = workflow.jobs;
          
          Object.keys(jobs).forEach(jobName => {
            const job = jobs[jobName];
            
            expect(job['runs-on']).toBeDefined();
            
            if (job.steps) {
              expect(Array.isArray(job.steps)).toBe(true);
              expect(job.steps.length).toBeGreaterThan(0);
              
              job.steps.forEach((step: any, index: number) => {
                expect(step.name || step.uses || step.run).toBeDefined();
              });
            }
          });
        });

        if (workflowFile === 'pr-review.yml') {
          describe("PR Review Workflow Specifics", () => {
            it("should have configuration loading job", () => {
              expect(workflow.jobs['load-configuration']).toBeDefined();
            });

            it("should have review jobs", () => {
              const jobNames = Object.keys(workflow.jobs);
              expect(jobNames).toContain('security-review');
              expect(jobNames).toContain('quality-review'); 
              expect(jobNames).toContain('documentation-review');
            });

            it("should have summary job", () => {
              expect(workflow.jobs['post-review-summary']).toBeDefined();
            });

            it("should have proper job dependencies", () => {
              const summaryJob = workflow.jobs['post-review-summary'];
              expect(summaryJob.needs).toContain('load-configuration');
            });

            it("should use correct claude-code-action", () => {
              const inputs = workflow.on.workflow_call.inputs;
              expect(inputs['claude-code-action-ref']).toBeDefined();
              
              const defaultRef = inputs['claude-code-action-ref'].default;
              expect(defaultRef).toMatch(/0xthrpw\/claude-code-action@/);
            });

            it("should have conditional job execution", () => {
              const securityJob = workflow.jobs['security-review'];
              expect(securityJob.if).toContain('enable-security-review');
            });

            it("should have proper permissions", () => {
              Object.values(workflow.jobs).forEach((job: any) => {
                if (job.permissions) {
                  expect(job.permissions).toHaveProperty('contents');
                  expect(job.permissions).toHaveProperty('pull-requests');
                }
              });
            });
          });
        }

        if (workflowFile === 'issue-response.yml') {
          describe("Issue Response Workflow Specifics", () => {
            it("should have validation job", () => {
              expect(workflow.jobs['validate-trigger']).toBeDefined();
            });

            it("should have AI response job", () => {
              expect(workflow.jobs['ai-response']).toBeDefined();
            });

            it("should have auto-labeling job", () => {
              expect(workflow.jobs['auto-labeling']).toBeDefined();
            });

            it("should have escalation job", () => {
              expect(workflow.jobs['escalation']).toBeDefined();
            });

            it("should have proper conditional execution", () => {
              const responseJob = workflow.jobs['ai-response'];
              expect(responseJob.needs).toContain('validate-trigger');
            });
          });
        }

        if (workflowFile === 'update-propagation.yml') {
          describe("Update Propagation Workflow Specifics", () => {
            it("should trigger on releases", () => {
              expect(workflow.on.release).toBeDefined();
              expect(workflow.on.release.types).toContain('published');
            });

            it("should have manual trigger", () => {
              expect(workflow.on.workflow_dispatch).toBeDefined();
            });

            it("should have version determination", () => {
              const job = workflow.jobs['propagate-updates'];
              const versionStep = job.steps.find((step: any) => 
                step.name && step.name.includes('Version')
              );
              expect(versionStep).toBeDefined();
            });

            it("should have notification job", () => {
              expect(workflow.jobs['notify-completion']).toBeDefined();
            });
          });
        }

        if (workflowFile === 'version-monitoring.yml') {
          describe("Version Monitoring Workflow Specifics", () => {
            it("should have scheduled trigger", () => {
              expect(workflow.on.schedule).toBeDefined();
              expect(Array.isArray(workflow.on.schedule)).toBe(true);
            });

            it("should have version check job", () => {
              expect(workflow.jobs['version-check']).toBeDefined();
            });

            it("should create GitHub Pages deployment", () => {
              const job = workflow.jobs['version-check'];
              const pagesStep = job.steps.find((step: any) => 
                step.uses && step.uses.includes('deploy-pages')
              );
              expect(pagesStep).toBeDefined();
            });

            it("should have issue management", () => {
              const job = workflow.jobs['version-check'];
              const issueSteps = job.steps.filter((step: any) => 
                step.name && (
                  step.name.includes('Issue') || 
                  step.name.includes('issue')
                )
              );
              expect(issueSteps.length).toBeGreaterThan(0);
            });
          });
        }

        it("should use secure practices", () => {
          const workflowContent = readFileSync(join(workflowsPath, workflowFile), "utf-8");
          
          // Should not contain hardcoded secrets
          expect(workflowContent).not.toMatch(/sk-[a-zA-Z0-9]{32,}/); // OpenAI API key pattern
          expect(workflowContent).not.toMatch(/xoxb-[a-zA-Z0-9-]+/); // Slack token pattern
          
          // Should use secrets properly
          if (workflowContent.includes('token') || workflowContent.includes('key')) {
            expect(workflowContent).toMatch(/\$\{\{\s*secrets\./);
          }
        });

        it("should have reasonable timeout settings", () => {
          Object.values(workflow.jobs).forEach((job: any) => {
            if (job.steps) {
              job.steps.forEach((step: any) => {
                if (step['timeout-minutes']) {
                  expect(step['timeout-minutes']).toBeGreaterThan(0);
                  expect(step['timeout-minutes']).toBeLessThan(60); // Reasonable limit
                }
              });
            }
          });
        });

        it("should handle errors gracefully", () => {
          Object.values(workflow.jobs).forEach((job: any) => {
            if (job.steps) {
              const hasErrorHandling = job.steps.some((step: any) => 
                step['continue-on-error'] === true ||
                step.if && (
                  step.if.includes('failure()') || 
                  step.if.includes('always()')
                )
              );
              
              // At least some steps should have error handling
              if (job.steps.length > 3) {
                // Only check for larger workflows
                expect(hasErrorHandling).toBe(true);
              }
            }
          });
        });
      });
    });
  });

  describe("Workflow Integration", () => {
    it("should have consistent action references", () => {
      const workflowFiles = readdirSync(workflowsPath).filter(file => 
        file.endsWith('.yml') || file.endsWith('.yaml')
      );

      const actionReferences: string[] = [];

      workflowFiles.forEach(file => {
        const content = readFileSync(join(workflowsPath, file), "utf-8");
        const workflow = load(content);

        Object.values(workflow.jobs).forEach((job: any) => {
          if (job.steps) {
            job.steps.forEach((step: any) => {
              if (step.uses) {
                actionReferences.push(step.uses);
              }
            });
          }
        });
      });

      // Check for consistent versions of common actions
      const checkoutActions = actionReferences.filter(ref => ref.includes('actions/checkout'));
      if (checkoutActions.length > 1) {
        const versions = [...new Set(checkoutActions)];
        expect(versions.length).toBeLessThanOrEqual(2); // Allow some version variation
      }
    });

    it("should have consistent secret naming", () => {
      const workflowFiles = readdirSync(workflowsPath).filter(file => 
        file.endsWith('.yml') || file.endsWith('.yaml')
      );

      const secretNames: Set<string> = new Set();

      workflowFiles.forEach(file => {
        const content = readFileSync(join(workflowsPath, file), "utf-8");
        
        // Extract secret references
        const secretMatches = content.match(/\$\{\{\s*secrets\.(\w+)\s*\}\}/g);
        if (secretMatches) {
          secretMatches.forEach(match => {
            const secretName = match.match(/secrets\.(\w+)/)?.[1];
            if (secretName) {
              secretNames.add(secretName);
            }
          });
        }
      });

      // Should have consistent naming conventions
      const secretList = Array.from(secretNames);
      
      // All secrets should use UPPER_CASE
      secretList.forEach(secret => {
        expect(secret).toMatch(/^[A-Z][A-Z0-9_]*$/);
      });

      // Should have expected core secrets
      expect(secretList).toContain('CLAUDE_CODE_OAUTH_TOKEN');
      expect(secretList).toContain('APP_ID');
      expect(secretList).toContain('PRIVATE_KEY');
    });
  });

  describe("Workflow Performance", () => {
    it("should use caching where appropriate", () => {
      const workflowFiles = readdirSync(workflowsPath);
      
      workflowFiles.forEach(file => {
        const content = readFileSync(join(workflowsPath, file), "utf-8");
        
        // If it installs dependencies, should consider caching
        if (content.includes('bun install') || content.includes('npm install')) {
          // This is more of a suggestion than a requirement
          // Could add caching steps for better performance
        }
      });
    });

    it("should have parallel job execution where possible", () => {
      const prReviewWorkflow = load(
        readFileSync(join(workflowsPath, 'pr-review.yml'), "utf-8")
      );

      // Security, quality, and documentation reviews should be able to run in parallel
      const securityJob = prReviewWorkflow.jobs['security-review'];
      const qualityJob = prReviewWorkflow.jobs['quality-review'];
      const docsJob = prReviewWorkflow.jobs['documentation-review'];

      // They should all depend on the same job (load-configuration)
      expect(securityJob.needs).toContain('load-configuration');
      expect(qualityJob.needs).toContain('load-configuration');
      expect(docsJob.needs).toContain('load-configuration');

      // But not depend on each other (allowing parallel execution)
      expect(securityJob.needs).not.toContain('quality-review');
      expect(qualityJob.needs).not.toContain('security-review');
    });
  });
});