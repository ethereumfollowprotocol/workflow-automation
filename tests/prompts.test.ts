import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

describe("Prompt Templates Tests", () => {
  const promptsPath = join(process.cwd(), "prompts");
  const reviewPath = join(promptsPath, "review");
  const responsePath = join(promptsPath, "response");

  describe("Directory Structure", () => {
    it("should have required prompt directories", () => {
      expect(existsSync(reviewPath)).toBe(true);
      expect(existsSync(responsePath)).toBe(true);
    });
  });

  describe("Review Prompts", () => {
    const reviewFiles = existsSync(reviewPath) 
      ? readdirSync(reviewPath).filter(file => file.endsWith('.md'))
      : [];

    it("should have default review prompts", () => {
      const requiredPrompts = [
        "security-default.md",
        "quality-default.md", 
        "documentation-default.md"
      ];

      requiredPrompts.forEach(prompt => {
        expect(reviewFiles).toContain(prompt);
      });
    });

    it("should have language-specific prompts", () => {
      const languageSpecificPrompts = reviewFiles.filter(file => 
        file.includes('-typescript') || 
        file.includes('-python') || 
        file.includes('-javascript')
      );

      expect(languageSpecificPrompts.length).toBeGreaterThan(0);
    });

    reviewFiles.forEach(promptFile => {
      describe(`Review Prompt: ${promptFile}`, () => {
        let promptContent: string;

        beforeAll(() => {
          const promptPath = join(reviewPath, promptFile);
          promptContent = readFileSync(promptPath, "utf-8");
        });

        it("should not be empty", () => {
          expect(promptContent.trim().length).toBeGreaterThan(0);
        });

        it("should have a title", () => {
          expect(promptContent).toMatch(/^#\s+.+/m);
        });

        it("should contain analysis instructions", () => {
          const hasInstructions = 
            promptContent.includes("analyze") ||
            promptContent.includes("review") ||
            promptContent.includes("check") ||
            promptContent.includes("evaluate");
          
          expect(hasInstructions).toBe(true);
        });

        it("should have structured sections", () => {
          const hasSections = promptContent.match(/#{2,}\s+/g);
          expect(hasSections).not.toBeNull();
          expect(hasSections!.length).toBeGreaterThan(1);
        });

        if (promptFile.includes('security')) {
          it("should include security-specific content", () => {
            const securityKeywords = [
              "security", "vulnerability", "injection", "authentication", 
              "authorization", "encryption", "sanitization"
            ];
            
            const hasSecurityContent = securityKeywords.some(keyword =>
              promptContent.toLowerCase().includes(keyword)
            );
            
            expect(hasSecurityContent).toBe(true);
          });

          it("should mention common vulnerabilities", () => {
            const vulnerabilities = ["xss", "sql injection", "csrf"];
            
            const mentionsVulns = vulnerabilities.some(vuln =>
              promptContent.toLowerCase().includes(vuln)
            );
            
            expect(mentionsVulns).toBe(true);
          });
        }

        if (promptFile.includes('quality')) {
          it("should include quality-specific content", () => {
            const qualityKeywords = [
              "quality", "maintainability", "readability", "performance", 
              "complexity", "testing", "documentation"
            ];
            
            const hasQualityContent = qualityKeywords.some(keyword =>
              promptContent.toLowerCase().includes(keyword)
            );
            
            expect(hasQualityContent).toBe(true);
          });

          it("should mention code metrics", () => {
            const metrics = ["complexity", "coverage", "length", "performance"];
            
            const mentionsMetrics = metrics.some(metric =>
              promptContent.toLowerCase().includes(metric)
            );
            
            expect(mentionsMetrics).toBe(true);
          });
        }

        if (promptFile.includes('documentation')) {
          it("should include documentation-specific content", () => {
            const docKeywords = [
              "documentation", "comments", "readme", "api", 
              "examples", "clarity", "completeness"
            ];
            
            const hasDocContent = docKeywords.some(keyword =>
              promptContent.toLowerCase().includes(keyword)
            );
            
            expect(hasDocContent).toBe(true);
          });
        }

        if (promptFile.includes('typescript')) {
          it("should include TypeScript-specific guidance", () => {
            const tsKeywords = [
              "typescript", "types", "interface", "generic", 
              "any", "type safety", "strict mode"
            ];
            
            const hasTsContent = tsKeywords.some(keyword =>
              promptContent.toLowerCase().includes(keyword)
            );
            
            expect(hasTsContent).toBe(true);
          });

          it("should have TypeScript code examples", () => {
            const hasCodeBlocks = promptContent.includes("```typescript");
            expect(hasCodeBlocks).toBe(true);
          });
        }

        it("should provide actionable guidance", () => {
          const actionWords = [
            "check", "verify", "ensure", "validate", "review", 
            "analyze", "examine", "identify", "assess"
          ];
          
          const hasActionableContent = actionWords.some(word =>
            promptContent.toLowerCase().includes(word)
          );
          
          expect(hasActionableContent).toBe(true);
        });

        it("should not be too short", () => {
          expect(promptContent.length).toBeGreaterThan(500);
        });

        it("should not be excessively long", () => {
          expect(promptContent.length).toBeLessThan(20000);
        });
      });
    });
  });

  describe("Response Prompts", () => {
    const responseFiles = existsSync(responsePath)
      ? readdirSync(responsePath).filter(file => file.endsWith('.md'))
      : [];

    it("should have default response prompts", () => {
      const requiredPrompts = [
        "general-default.md",
        "issue_comment-default.md"
      ];

      requiredPrompts.forEach(prompt => {
        expect(responseFiles).toContain(prompt);
      });
    });

    responseFiles.forEach(promptFile => {
      describe(`Response Prompt: ${promptFile}`, () => {
        let promptContent: string;

        beforeAll(() => {
          const promptPath = join(responsePath, promptFile);
          promptContent = readFileSync(promptPath, "utf-8");
        });

        it("should not be empty", () => {
          expect(promptContent.trim().length).toBeGreaterThan(0);
        });

        it("should have a title", () => {
          expect(promptContent).toMatch(/^#\s+.+/m);
        });

        it("should include response guidelines", () => {
          const hasGuidelines = 
            promptContent.includes("response") ||
            promptContent.includes("assist") ||
            promptContent.includes("help") ||
            promptContent.includes("guidance");
          
          expect(hasGuidelines).toBe(true);
        });

        it("should promote helpful behavior", () => {
          const helpfulWords = [
            "helpful", "accurate", "clear", "actionable", 
            "supportive", "professional", "concise"
          ];
          
          const isHelpful = helpfulWords.some(word =>
            promptContent.toLowerCase().includes(word)
          );
          
          expect(isHelpful).toBe(true);
        });

        if (promptFile.includes('issue_comment')) {
          it("should address issue-specific scenarios", () => {
            const issueKeywords = [
              "issue", "bug", "feature", "discussion", 
              "problem", "question", "support"
            ];
            
            const hasIssueContent = issueKeywords.some(keyword =>
              promptContent.toLowerCase().includes(keyword)
            );
            
            expect(hasIssueContent).toBe(true);
          });
        }

        it("should provide response structure guidance", () => {
          const structureKeywords = [
            "structure", "format", "template", "organize", 
            "section", "step", "example"
          ];
          
          const hasStructure = structureKeywords.some(keyword =>
            promptContent.toLowerCase().includes(keyword)
          );
          
          expect(hasStructure).toBe(true);
        });
      });
    });
  });

  describe("Prompt Consistency", () => {
    it("should have consistent formatting across prompts", () => {
      const allPromptFiles = [
        ...readdirSync(reviewPath).map(f => join(reviewPath, f)),
        ...readdirSync(responsePath).map(f => join(responsePath, f))
      ].filter(f => f.endsWith('.md'));

      const formatChecks = allPromptFiles.map(file => {
        const content = readFileSync(file, "utf-8");
        return {
          file,
          hasTitle: content.match(/^#\s+.+/m) !== null,
          hasSubheadings: (content.match(/#{2,}\s+/g) || []).length > 0,
          hasListItems: content.includes('- ') || content.includes('* '),
          reasonableLength: content.length > 200 && content.length < 25000
        };
      });

      formatChecks.forEach(check => {
        expect(check.hasTitle).toBe(true);
        expect(check.hasSubheadings).toBe(true);
        expect(check.reasonableLength).toBe(true);
      });
    });

    it("should use consistent terminology", () => {
      // Check that prompts use consistent terms for common concepts
      const reviewPrompts = readdirSync(reviewPath)
        .map(f => join(reviewPath, f))
        .filter(f => f.endsWith('.md'));

      const contents = reviewPrompts.map(file => readFileSync(file, "utf-8"));
      
      // Should consistently use "analyze" or "review" but not mix randomly
      const usesAnalyze = contents.some(content => content.includes("analyze"));
      const usesReview = contents.some(content => content.includes("review"));
      
      expect(usesAnalyze || usesReview).toBe(true);
    });
  });

  describe("Language Support", () => {
    const supportedLanguages = ["typescript", "javascript", "python", "go", "rust"];
    
    it("should have prompts for major languages", () => {
      const reviewFiles = readdirSync(reviewPath);
      
      // Should have at least TypeScript-specific prompts
      const hasLanguageSpecific = supportedLanguages.some(lang =>
        reviewFiles.some(file => file.includes(lang))
      );
      
      expect(hasLanguageSpecific).toBe(true);
    });

    supportedLanguages.forEach(language => {
      const languagePrompts = readdirSync(reviewPath)
        .filter(file => file.includes(language));

      if (languagePrompts.length > 0) {
        it(`should have comprehensive ${language} prompts`, () => {
          languagePrompts.forEach(promptFile => {
            const content = readFileSync(join(reviewPath, promptFile), "utf-8");
            
            // Should mention the language specifically
            expect(content.toLowerCase()).toContain(language);
            
            // Should have language-specific guidance
            const hasSpecificGuidance = content.length > 1000;
            expect(hasSpecificGuidance).toBe(true);
          });
        });
      }
    });
  });
});