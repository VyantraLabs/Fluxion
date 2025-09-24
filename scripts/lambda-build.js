#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const config = {
  sharedLib: {
    name: '@fluxion/shared-lib',
    path: 'packages/fluxion-shared-lib'
  },
  services: [
    {
      name: 'main-service',
      path: 'services/main-service',
      handler: 'dist/index.handler',
      timeout: 30,
      memory: 512
    },
    {
      name: 'admin-service', 
      path: 'services/admin-service',
      handler: 'dist/index.handler',
      timeout: 30,
      memory: 256
    }
  ],
  buildDir: 'deployment/lambda-services',
  nodeVersion: '18.x'
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const colors = {
    info: '\x1b[36m',    // cyan
    success: '\x1b[32m', // green  
    warn: '\x1b[33m',    // yellow
    error: '\x1b[31m',   // red
    reset: '\x1b[0m'
  };
  
  console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`);
}

function execCommand(command, cwd = process.cwd()) {
  log(`Executing: ${command}`, 'info');
  try {
    return execSync(command, { 
      cwd, 
      stdio: 'inherit',
      encoding: 'utf8'
    });
  } catch (error) {
    log(`Command failed: ${error.message}`, 'error');
    throw error;
  }
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    log(`Created directory: ${dirPath}`, 'success');
  }
}

function copyFile(src, dest) {
  const destDir = path.dirname(dest);
  ensureDir(destDir);
  fs.copyFileSync(src, dest);
  log(`Copied: ${src} -> ${dest}`, 'info');
}

function copyDir(src, dest, exclude = []) {
  ensureDir(dest);
  
  const items = fs.readdirSync(src);
  
  for (const item of items) {
    if (exclude.includes(item)) continue;
    
    const srcPath = path.join(src, item);
    const destPath = path.join(dest, item);
    
    const stat = fs.statSync(srcPath);
    
    if (stat.isDirectory()) {
      copyDir(srcPath, destPath, exclude);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function createPackageJson(service, buildPath) {
  const servicePath = path.join(process.cwd(), service.path);
  const originalPackage = JSON.parse(
    fs.readFileSync(path.join(servicePath, 'package.json'), 'utf8')
  );

  // Create Lambda-optimized package.json
  const lambdaPackage = {
    name: `${originalPackage.name}-lambda`,
    version: originalPackage.version,
    description: `${originalPackage.description} - Lambda deployment`,
    main: 'index.js',
    engines: {
      node: config.nodeVersion
    },
    dependencies: {
      ...originalPackage.dependencies,
      // Ensure AWS SDK is included for Lambda
      'aws-sdk': '^2.1400.0',
      'aws-serverless-express': '^3.4.0'
    },
    // Remove dev dependencies for smaller bundle
    scripts: {
      start: 'node index.js'
    }
  };

  // Remove shared lib workspace reference for production
  if (lambdaPackage.dependencies['@fluxion/shared-lib']) {
    delete lambdaPackage.dependencies['@fluxion/shared-lib'];
  }

  fs.writeFileSync(
    path.join(buildPath, 'package.json'),
    JSON.stringify(lambdaPackage, null, 2)
  );

  log(`Created Lambda package.json for ${service.name}`, 'success');
}

function buildSharedLibrary() {
  log('Building shared library...', 'info');
  
  const sharedLibPath = path.join(process.cwd(), config.sharedLib.path);
  
  // Clean and build
  execCommand('npm run clean', sharedLibPath);
  execCommand('npm run build', sharedLibPath);
  
  log('Shared library built successfully', 'success');
}

function packageSharedLibrary(destPath) {
  log('Packaging shared library...', 'info');
  
  const sharedLibPath = path.join(process.cwd(), config.sharedLib.path);
  const sharedLibDest = path.join(destPath, 'node_modules', '@fluxion', 'shared-lib');
  
  ensureDir(sharedLibDest);
  
  // Copy built files
  copyDir(
    path.join(sharedLibPath, 'dist'),
    path.join(sharedLibDest, 'dist')
  );
  
  // Copy package.json
  copyFile(
    path.join(sharedLibPath, 'package.json'),
    path.join(sharedLibDest, 'package.json')
  );
  
  log('Shared library packaged successfully', 'success');
}

function buildService(service) {
  log(`Building service: ${service.name}`, 'info');
  
  const servicePath = path.join(process.cwd(), service.path);
  const buildPath = path.join(process.cwd(), config.buildDir, service.name);
  
  // Clean build directory
  if (fs.existsSync(buildPath)) {
    fs.rmSync(buildPath, { recursive: true });
  }
  ensureDir(buildPath);
  
  // Build TypeScript
  log(`Compiling TypeScript for ${service.name}...`, 'info');
  execCommand('npm run build', servicePath);
  
  // Copy built files
  copyDir(
    path.join(servicePath, 'dist'),
    buildPath,
    ['node_modules', '.git', 'tests', '*.test.js', '*.spec.js']
  );
  
  // Create Lambda package.json
  createPackageJson(service, buildPath);
  
  // Package shared library
  packageSharedLibrary(buildPath);
  
  log(`Service ${service.name} built successfully`, 'success');
  return buildPath;
}

function installDependencies(buildPath, service) {
  log(`Installing dependencies for ${service.name}...`, 'info');
  
  // Install production dependencies only
  execCommand('npm install --production --no-package-lock', buildPath);
  
  log(`Dependencies installed for ${service.name}`, 'success');
}

function createLambdaHandler(service, buildPath) {
  const handlerContent = `// Generated Lambda handler for ${service.name}
const { createLambdaAdapter } = require('@fluxion/shared-lib/lambda/adapter');

// Import the Express app
const { app } = require('./app');

// Create Lambda adapter
const adapter = createLambdaAdapter(app, {
  binaryMimeTypes: ['multipart/form-data'],
  requestWaitTime: 10000
});

// Export Lambda handlers
exports.handler = adapter.handler;
exports.warmup = adapter.warmup;
`;

  fs.writeFileSync(path.join(buildPath, 'lambda.js'), handlerContent);
  log(`Created Lambda handler for ${service.name}`, 'success');
}

function generateSAMTemplate(services) {
  const template = {
    AWSTemplateFormatVersion: '2010-09-09',
    Transform: 'AWS::Serverless-2016-10-31',
    Description: 'Fluxion Microservices Lambda Deployment',
    
    Parameters: {
      Environment: {
        Type: 'String',
        Default: 'dev',
        AllowedValues: ['dev', 'staging', 'production'],
        Description: 'Environment name'
      },
      VpcSecurityGroupIds: {
        Type: 'CommaDelimitedList',
        Description: 'VPC Security Group IDs'
      },
      VpcSubnetIds: {
        Type: 'CommaDelimitedList', 
        Description: 'VPC Subnet IDs'
      }
    },
    
    Globals: {
      Function: {
        Runtime: `nodejs${config.nodeVersion}`,
        Timeout: 30,
        MemorySize: 512,
        Environment: {
          Variables: {
            NODE_ENV: { Ref: 'Environment' },
            LOG_LEVEL: 'info'
          }
        },
        VpcConfig: {
          SecurityGroupIds: { Ref: 'VpcSecurityGroupIds' },
          SubnetIds: { Ref: 'VpcSubnetIds' }
        }
      },
      Api: {
        Cors: {
          AllowMethods: "'GET,POST,PUT,DELETE,OPTIONS'",
          AllowHeaders: "'Content-Type,Authorization,X-Requested-With'",
          AllowOrigin: "'*'"
        }
      }
    },
    
    Resources: {},
    
    Outputs: {}
  };
  
  // Add Lambda functions for each service
  services.forEach(service => {
    const functionName = `${service.name.charAt(0).toUpperCase() + service.name.slice(1)}Function`;
    
    template.Resources[functionName] = {
      Type: 'AWS::Serverless::Function',
      Properties: {
        CodeUri: `${config.buildDir}/${service.name}/`,
        Handler: service.handler.replace('dist/', ''),
        Runtime: `nodejs${config.nodeVersion}`,
        Timeout: service.timeout,
        MemorySize: service.memory,
        Events: {
          Api: {
            Type: 'Api',
            Properties: {
              Path: `/${service.name.replace('-service', '')}/{proxy+}`,
              Method: 'ANY'
            }
          }
        }
      }
    };
    
    template.Outputs[`${functionName}Url`] = {
      Description: `API Gateway endpoint URL for ${service.name}`,
      Value: {
        'Fn::Sub': `https://\${ServerlessRestApi}.execute-api.\${AWS::Region}.amazonaws.com/Prod/${service.name.replace('-service', '')}/`
      }
    };
  });
  
  const templatePath = path.join(process.cwd(), 'template.yaml');
  fs.writeFileSync(templatePath, require('js-yaml').dump(template));
  log('Generated SAM template', 'success');
}

function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'build';
  const serviceName = args[1];
  
  try {
    log('Starting Lambda build process...', 'info');
    
    // Build shared library first
    buildSharedLibrary();
    
    let servicesToBuild = config.services;
    if (serviceName) {
      servicesToBuild = config.services.filter(s => s.name === serviceName);
      if (servicesToBuild.length === 0) {
        throw new Error(`Service ${serviceName} not found`);
      }
    }
    
    const builtServices = [];
    
    for (const service of servicesToBuild) {
      const buildPath = buildService(service);
      
      if (command !== 'build-only') {
        installDependencies(buildPath, service);
        createLambdaHandler(service, buildPath);
      }
      
      builtServices.push(service);
    }
    
    // Generate SAM template
    if (command !== 'build-only') {
      generateSAMTemplate(builtServices);
    }
    
    log('Lambda build completed successfully!', 'success');
    log(`Built services: ${builtServices.map(s => s.name).join(', ')}`, 'info');
    
  } catch (error) {
    log(`Build failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Handle command line arguments
if (require.main === module) {
  main();
}

module.exports = { buildService, buildSharedLibrary, packageSharedLibrary };