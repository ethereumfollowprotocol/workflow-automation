import { describe, it, expect } from "bun:test";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import Ajv from "ajv";

describe("Configuration Tests", () => {
  const schemaPath = join(process.cwd(), "configs", "schema.json");
  const profilesPath = join(process.cwd(), "configs", "profiles");
  const defaultsPath = join(process.cwd(), "configs", "defaults.json");

  let schema: any;
  let ajv: Ajv;

  beforeAll(() => {
    const schemaContent = readFileSync(schemaPath, "utf-8");
    schema = JSON.parse(schemaContent);
    ajv = new Ajv({ allErrors: true });
  });

  describe("Schema Validation", () => {
    it("should have a valid JSON schema", () => {
      expect(schema).toBeDefined();
      expect(schema.$schema).toBe("http://json-schema.org/draft-07/schema#");
      expect(schema.type).toBe("object");
      expect(schema.properties).toBeDefined();
    });

    it("should define required properties", () => {
      const requiredProperties = ["model", "review_rules", "security_rules"];
      
      for (const prop of requiredProperties) {
        expect(schema.properties[prop]).toBeDefined();
      }
    });

    it("should have valid enum values for model", () => {
      const modelProperty = schema.properties.model;
      expect(modelProperty.enum).toContain("claude-3-5-sonnet-20241022");
      expect(modelProperty.enum).toContain("claude-3-haiku-20240307");
    });
  });

  describe("Default Configuration", () => {
    let defaultConfig: any;

    beforeAll(() => {
      const defaultContent = readFileSync(defaultsPath, "utf-8");
      defaultConfig = JSON.parse(defaultContent);
    });

    it("should be valid JSON", () => {
      expect(defaultConfig).toBeDefined();
    });

    it("should validate against schema", () => {
      const validate = ajv.compile(schema);
      const isValid = validate(defaultConfig);
      
      if (!isValid) {
        console.log("Validation errors:", validate.errors);
      }
      
      expect(isValid).toBe(true);
    });

    it("should have required fields", () => {
      expect(defaultConfig.model).toBeDefined();
      expect(defaultConfig.review_rules).toBeDefined();
      expect(defaultConfig.security_rules).toBeDefined();
    });

    it("should have reasonable default values", () => {
      expect(defaultConfig.review_rules.min_test_coverage).toBeGreaterThan(0);
      expect(defaultConfig.review_rules.min_test_coverage).toBeLessThanOrEqual(100);
      expect(defaultConfig.review_rules.max_complexity).toBeGreaterThan(0);
      expect(defaultConfig.review_rules.max_function_length).toBeGreaterThan(0);
    });
  });

  describe("Configuration Profiles", () => {
    const profileFiles = readdirSync(profilesPath).filter(file => file.endsWith('.json'));

    it("should have profile files", () => {
      expect(profileFiles.length).toBeGreaterThan(0);
      expect(profileFiles).toContain("default.json");
      expect(profileFiles).toContain("frontend.json");
      expect(profileFiles).toContain("backend.json");
      expect(profileFiles).toContain("security.json");
    });

    profileFiles.forEach(profileFile => {
      describe(`Profile: ${profileFile}`, () => {
        let profileConfig: any;

        beforeAll(() => {
          const profilePath = join(profilesPath, profileFile);
          const profileContent = readFileSync(profilePath, "utf-8");
          profileConfig = JSON.parse(profileContent);
        });

        it("should be valid JSON", () => {
          expect(profileConfig).toBeDefined();
        });

        it("should validate against schema", () => {
          const validate = ajv.compile(schema);
          const isValid = validate(profileConfig);
          
          if (!isValid) {
            console.log(`Validation errors for ${profileFile}:`, validate.errors);
          }
          
          expect(isValid).toBe(true);
        });

        it("should have a valid model", () => {
          expect(profileConfig.model).toBeDefined();
          expect(schema.properties.model.enum).toContain(profileConfig.model);
        });

        it("should have consistent review rules", () => {
          const rules = profileConfig.review_rules;
          
          if (rules) {
            if (rules.min_test_coverage !== undefined) {
              expect(rules.min_test_coverage).toBeGreaterThanOrEqual(0);
              expect(rules.min_test_coverage).toBeLessThanOrEqual(100);
            }
            
            if (rules.max_complexity !== undefined) {
              expect(rules.max_complexity).toBeGreaterThan(0);
            }
            
            if (rules.max_function_length !== undefined) {
              expect(rules.max_function_length).toBeGreaterThan(0);
            }
          }
        });
      });
    });

    it("should have profile-specific optimizations", () => {
      const frontendPath = join(profilesPath, "frontend.json");
      const backendPath = join(profilesPath, "backend.json");
      const securityPath = join(profilesPath, "security.json");

      const frontend = JSON.parse(readFileSync(frontendPath, "utf-8"));
      const backend = JSON.parse(readFileSync(backendPath, "utf-8"));
      const security = JSON.parse(readFileSync(securityPath, "utf-8"));

      // Frontend should focus less on SQL injection
      expect(frontend.security_rules?.check_sql_injection).toBe(false);
      
      // Backend should have higher test coverage requirements
      expect(backend.review_rules?.min_test_coverage).toBeGreaterThan(frontend.review_rules?.min_test_coverage || 0);
      
      // Security profile should be most strict
      expect(security.review_rules?.max_complexity).toBeLessThan(backend.review_rules?.max_complexity || 20);
    });
  });

  describe("Language-Specific Configurations", () => {
    it("should have valid TypeScript configuration", () => {
      const frontendPath = join(profilesPath, "frontend.json");
      const frontend = JSON.parse(readFileSync(frontendPath, "utf-8"));
      
      if (frontend.language_specific?.typescript) {
        const tsConfig = frontend.language_specific.typescript;
        expect(typeof tsConfig.strict_mode).toBe("boolean");
        expect(typeof tsConfig.check_types).toBe("boolean");
      }
    });

    it("should have valid Python configuration", () => {
      const backendPath = join(profilesPath, "backend.json");
      const backend = JSON.parse(readFileSync(backendPath, "utf-8"));
      
      if (backend.language_specific?.python) {
        const pyConfig = backend.language_specific.python;
        expect(typeof pyConfig.check_pep8).toBe("boolean");
        expect(typeof pyConfig.check_type_hints).toBe("boolean");
        
        if (pyConfig.version) {
          expect(["3.8", "3.9", "3.10", "3.11", "3.12"]).toContain(pyConfig.version);
        }
      }
    });
  });

  describe("Exclusion Patterns", () => {
    profileFiles.forEach(profileFile => {
      it(`should have sensible exclusions in ${profileFile}`, () => {
        const profilePath = join(profilesPath, profileFile);
        const config = JSON.parse(readFileSync(profilePath, "utf-8"));
        
        if (config.exclusions) {
          // Should exclude common build/dependency directories
          const patterns = [
            ...(config.exclusions.file_patterns || []),
            ...(config.exclusions.directory_patterns || [])
          ];
          
          // Common patterns that should be excluded
          const expectedExclusions = ["node_modules", ".git", "dist", "build"];
          let hasCommonExclusions = false;
          
          for (const exclusion of expectedExclusions) {
            if (patterns.some(pattern => pattern.includes(exclusion))) {
              hasCommonExclusions = true;
              break;
            }
          }
          
          expect(hasCommonExclusions).toBe(true);
        }
      });
    });
  });

  describe("Response Settings", () => {
    it("should have reasonable response length limits", () => {
      profileFiles.forEach(profileFile => {
        const profilePath = join(profilesPath, profileFile);
        const config = JSON.parse(readFileSync(profilePath, "utf-8"));
        
        if (config.response_settings?.max_response_length) {
          expect(config.response_settings.max_response_length).toBeGreaterThan(100);
          expect(config.response_settings.max_response_length).toBeLessThan(10000);
        }
      });
    });

    it("should have valid tone settings", () => {
      const validTones = ["professional", "friendly", "technical", "casual"];
      
      profileFiles.forEach(profileFile => {
        const profilePath = join(profilesPath, profileFile);
        const config = JSON.parse(readFileSync(profilePath, "utf-8"));
        
        if (config.response_settings?.tone) {
          expect(validTones).toContain(config.response_settings.tone);
        }
      });
    });
  });
});