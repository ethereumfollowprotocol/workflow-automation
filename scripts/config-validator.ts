#!/usr/bin/env bun

/**
 * Configuration Validator Script
 * 
 * Validates configuration files against the JSON schema and
 * checks for common configuration issues across profiles.
 */

import Ajv from "ajv";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join, extname } from "path";

interface ValidationResult {
  file: string;
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface ValidationReport {
  timestamp: Date;
  schemaVersion: string;
  totalFiles: number;
  validFiles: number;
  invalidFiles: number;
  results: ValidationResult[];
  summary: {
    commonErrors: Record<string, number>;
    commonWarnings: Record<string, number>;
  };
}

class ConfigValidator {
  private ajv: Ajv;
  private schema: any;
  private schemaPath: string;
  private configPaths: string[];

  constructor(schemaPath: string, configPaths: string[]) {
    this.ajv = new Ajv({ allErrors: true });
    this.schemaPath = schemaPath;
    this.configPaths = configPaths;
    this.loadSchema();
  }

  private loadSchema(): void {
    if (!existsSync(this.schemaPath)) {
      throw new Error(`Schema file not found: ${this.schemaPath}`);
    }
    
    const schemaContent = readFileSync(this.schemaPath, 'utf-8');
    this.schema = JSON.parse(schemaContent);
  }

  /**
   * Validate a single configuration file
   */
  private validateConfig(filePath: string): ValidationResult {
    const result: ValidationResult = {
      file: filePath,
      valid: false,
      errors: [],
      warnings: [],
    };

    try {
      if (!existsSync(filePath)) {
        result.errors.push('Configuration file not found');
        return result;
      }

      const configContent = readFileSync(filePath, 'utf-8');
      let config: any;

      try {
        config = JSON.parse(configContent);
      } catch (parseError: any) {
        result.errors.push(`JSON parsing error: ${parseError.message}`);
        return result;
      }

      // Validate against schema
      const validate = this.ajv.compile(this.schema);
      const isValid = validate(config);

      if (isValid) {
        result.valid = true;
        
        // Add custom warnings for best practices
        this.addCustomWarnings(config, result);
      } else {
        result.valid = false;
        
        if (validate.errors) {
          for (const error of validate.errors) {
            const errorMsg = this.formatAjvError(error);
            result.errors.push(errorMsg);
          }
        }
      }

      // Additional semantic validations
      this.performSemanticValidation(config, result);

    } catch (error: any) {
      result.errors.push(`Validation error: ${error.message}`);
    }

    return result;
  }

  /**
   * Format AJV validation errors into readable messages
   */
  private formatAjvError(error: any): string {
    const instancePath = error.instancePath || 'root';
    const message = error.message;
    
    switch (error.keyword) {
      case 'required':
        return `Missing required property: ${error.params.missingProperty}`;
      case 'type':
        return `Property '${instancePath}' should be ${error.params.type}`;
      case 'enum':
        return `Property '${instancePath}' should be one of: ${error.params.allowedValues.join(', ')}`;
      case 'minimum':
        return `Property '${instancePath}' should be >= ${error.params.limit}`;
      case 'maximum':
        return `Property '${instancePath}' should be <= ${error.params.limit}`;
      default:
        return `${instancePath}: ${message}`;
    }
  }

  /**
   * Add custom warnings for configuration best practices
   */
  private addCustomWarnings(config: any, result: ValidationResult): void {
    // Check for potentially problematic settings
    if (config.review_rules?.min_test_coverage < 50) {
      result.warnings.push('Low test coverage requirement (< 50%) may indicate insufficient testing standards');
    }

    if (config.review_rules?.max_complexity > 20) {
      result.warnings.push('High complexity threshold (> 20) may allow overly complex code');
    }

    if (config.review_rules?.max_function_length > 100) {
      result.warnings.push('High function length limit (> 100) may allow overly long functions');
    }

    // Check security settings
    if (config.security_rules && Object.values(config.security_rules).some((rule: any) => rule === false)) {
      const disabledRules = Object.entries(config.security_rules)
        .filter(([_, enabled]) => enabled === false)
        .map(([rule]) => rule);
      result.warnings.push(`Disabled security checks: ${disabledRules.join(', ')}`);
    }

    // Check exclusion patterns
    if (config.exclusions?.file_patterns?.length > 20) {
      result.warnings.push('Large number of file exclusion patterns may hide important files from review');
    }

    // Check response settings
    if (config.response_settings?.max_response_length > 5000) {
      result.warnings.push('Very high response length limit may lead to overly verbose responses');
    }

    // Check for deprecated or risky model settings
    if (config.model && config.model.includes('haiku')) {
      result.warnings.push('Using Haiku model may provide less comprehensive reviews than Sonnet');
    }

    // Check language-specific configurations
    if (config.language_specific?.typescript?.strict_mode === false) {
      result.warnings.push('TypeScript strict mode disabled - may miss type-related issues');
    }

    if (config.language_specific?.python?.check_type_hints === false) {
      result.warnings.push('Python type hint checking disabled - may miss type-related issues');
    }
  }

  /**
   * Perform semantic validation beyond schema checking
   */
  private performSemanticValidation(config: any, result: ValidationResult): void {
    // Check for logical inconsistencies
    if (config.review_rules?.check_tests === false && config.review_rules?.min_test_coverage > 0) {
      result.errors.push('Inconsistent configuration: test coverage specified but test checking disabled');
    }

    if (config.review_rules?.check_documentation === false && 
        (config.documentation_rules?.require_function_docs === true || 
         config.documentation_rules?.require_class_docs === true)) {
      result.errors.push('Inconsistent configuration: documentation requirements specified but documentation checking disabled');
    }

    // Check for circular or contradictory exclusions
    if (config.exclusions?.file_patterns && config.exclusions?.directory_patterns) {
      const filePatterns = config.exclusions.file_patterns;
      const dirPatterns = config.exclusions.directory_patterns;
      
      for (const filePattern of filePatterns) {
        for (const dirPattern of dirPatterns) {
          if (filePattern.includes(dirPattern.replace('/', ''))) {
            result.warnings.push(`Potential redundant exclusion: file pattern '${filePattern}' may be covered by directory pattern '${dirPattern}'`);
          }
        }
      }
    }

    // Validate notification settings
    if (config.notification_settings?.slack_webhook && 
        !config.notification_settings.slack_webhook.startsWith('https://hooks.slack.com/')) {
      result.errors.push('Invalid Slack webhook URL format');
    }

    if (config.notification_settings?.discord_webhook && 
        !config.notification_settings.discord_webhook.startsWith('https://discord.com/api/webhooks/')) {
      result.errors.push('Invalid Discord webhook URL format');
    }
  }

  /**
   * Find all configuration files to validate
   */
  private findConfigFiles(): string[] {
    const files: string[] = [];
    
    for (const configPath of this.configPaths) {
      if (!existsSync(configPath)) {
        console.warn(`⚠️ Configuration path not found: ${configPath}`);
        continue;
      }

      try {
        const stat = Bun.file(configPath);
        if (stat.size === undefined) {
          // It's a directory
          const dirFiles = readdirSync(configPath);
          for (const file of dirFiles) {
            if (extname(file) === '.json') {
              files.push(join(configPath, file));
            }
          }
        } else {
          // It's a file
          if (extname(configPath) === '.json') {
            files.push(configPath);
          }
        }
      } catch (error: any) {
        console.warn(`⚠️ Error reading path ${configPath}: ${error.message}`);
      }
    }

    return files;
  }

  /**
   * Generate summary statistics
   */
  private generateSummary(results: ValidationResult[]): ValidationReport['summary'] {
    const commonErrors: Record<string, number> = {};
    const commonWarnings: Record<string, number> = {};

    for (const result of results) {
      for (const error of result.errors) {
        commonErrors[error] = (commonErrors[error] || 0) + 1;
      }
      
      for (const warning of result.warnings) {
        commonWarnings[warning] = (commonWarnings[warning] || 0) + 1;
      }
    }

    return {
      commonErrors,
      commonWarnings,
    };
  }

  /**
   * Run the validation process
   */
  async run(): Promise<ValidationReport> {
    console.log(`🚀 Starting configuration validation`);
    console.log(`📄 Schema: ${this.schemaPath}`);
    
    const configFiles = this.findConfigFiles();
    console.log(`📊 Configuration files found: ${configFiles.length}`);

    if (configFiles.length === 0) {
      throw new Error('No configuration files found to validate');
    }

    const results: ValidationResult[] = [];
    let validFiles = 0;
    let invalidFiles = 0;

    for (const file of configFiles) {
      console.log(`🔍 Validating: ${file}`);
      const result = this.validateConfig(file);
      results.push(result);

      if (result.valid) {
        validFiles++;
        if (result.warnings.length > 0) {
          console.log(`  ⚠️ Valid with ${result.warnings.length} warnings`);
        } else {
          console.log(`  ✅ Valid`);
        }
      } else {
        invalidFiles++;
        console.log(`  ❌ Invalid (${result.errors.length} errors)`);
      }
    }

    const report: ValidationReport = {
      timestamp: new Date(),
      schemaVersion: this.schema.title || 'Unknown',
      totalFiles: configFiles.length,
      validFiles,
      invalidFiles,
      results,
      summary: this.generateSummary(results),
    };

    // Print detailed results
    console.log(`\n📈 Validation Summary:`);
    console.log(`  ✅ Valid files: ${validFiles}`);
    console.log(`  ❌ Invalid files: ${invalidFiles}`);
    console.log(`  📊 Success rate: ${((validFiles / configFiles.length) * 100).toFixed(1)}%`);

    // Show common issues
    if (Object.keys(report.summary.commonErrors).length > 0) {
      console.log(`\n❌ Common Errors:`);
      Object.entries(report.summary.commonErrors)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .forEach(([error, count]) => {
          console.log(`  • ${error} (${count} files)`);
        });
    }

    if (Object.keys(report.summary.commonWarnings).length > 0) {
      console.log(`\n⚠️ Common Warnings:`);
      Object.entries(report.summary.commonWarnings)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .forEach(([warning, count]) => {
          console.log(`  • ${warning} (${count} files)`);
        });
    }

    // Show detailed errors for invalid files
    const invalidResults = results.filter(r => !r.valid);
    if (invalidResults.length > 0) {
      console.log(`\n🔍 Detailed Errors:`);
      for (const result of invalidResults) {
        console.log(`\n📁 ${result.file}:`);
        for (const error of result.errors) {
          console.log(`  ❌ ${error}`);
        }
      }
    }

    return report;
  }
}

// CLI usage
async function main() {
  const schemaPath = process.argv[2] || './configs/schema.json';
  const configPaths = process.argv.slice(3);
  
  if (configPaths.length === 0) {
    configPaths.push('./configs/profiles/', './configs/defaults.json');
  }

  try {
    const validator = new ConfigValidator(schemaPath, configPaths);
    const report = await validator.run();
    
    // Save report
    const reportPath = './validation-report.json';
    Bun.write(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Validation report saved: ${reportPath}`);
    
    // Exit with error code if validation failed
    if (report.invalidFiles > 0) {
      process.exit(1);
    }
    
  } catch (error) {
    console.error("❌ Configuration validation failed:", error);
    process.exit(1);
  }
}

if (import.meta.main) {
  main().catch(console.error);
}

export { ConfigValidator };