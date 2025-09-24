#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const archiver = require('archiver');

// Configuration
const config = {
  sharedLibPath: 'packages/fluxion-shared-lib',
  outputDir: 'deployment/layer-build',
  layerName: 'fluxion-shared-layer',
  description: 'Fluxion shared library and common dependencies'
};

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    warn: '\x1b[33m',
    error: '\x1b[31m',
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

function buildSharedLibrary() {
  log('Building shared library...', 'info');
  
  const sharedLibPath = path.join(process.cwd(), config.sharedLibPath);
  
  // Clean and build
  execCommand('npm run clean', sharedLibPath);
  execCommand('npm run build', sharedLibPath);
  
  log('Shared library built successfully', 'success');
}

function createLayerStructure() {
  log('Creating Lambda layer structure...', 'info');
  
  const layerPath = path.join(process.cwd(), config.outputDir, 'nodejs');
  const nodeModulesPath = path.join(layerPath, 'node_modules');
  const sharedLibPath = path.join(process.cwd(), config.sharedLibPath);
  
  // Clean output directory
  if (fs.existsSync(path.dirname(layerPath))) {
    fs.rmSync(path.dirname(layerPath), { recursive: true });
  }
  ensureDir(layerPath);
  ensureDir(nodeModulesPath);
  
  // Copy shared library
  const sharedLibDest = path.join(nodeModulesPath, '@fluxion', 'shared-lib');
  ensureDir(path.dirname(sharedLibDest));
  
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
  
  // Create layer package.json with common dependencies
  const layerPackage = {
    name: config.layerName,
    version: '1.0.0',
    description: config.description,
    dependencies: {
      'express': '^4.18.0',
      'typeorm': '^0.3.17',
      'pg': '^8.11.0',
      'redis': '^4.6.0',
      'ioredis': '^5.3.0',
      'winston': '^3.10.0',
      'zod': '^3.22.0',
      'jsonwebtoken': '^9.0.0',
      'ethers': '^6.7.0',
      'bcrypt': '^5.1.0',
      'cors': '^2.8.5',
      'helmet': '^7.0.0',
      'ulid': '^2.3.0',
      'dotenv': '^16.3.0',
      'aws-serverless-express': '^3.4.0',
      'aws-sdk': '^2.1400.0',
      '@aws-sdk/client-sqs': '^3.888.0'
    }
  };
  
  fs.writeFileSync(
    path.join(layerPath, 'package.json'),
    JSON.stringify(layerPackage, null, 2)
  );
  
  log('Layer structure created successfully', 'success');
  return layerPath;
}

function installLayerDependencies(layerPath) {
  log('Installing layer dependencies...', 'info');
  
  // Install production dependencies
  execCommand('npm install --production --no-package-lock', layerPath);
  
  log('Layer dependencies installed successfully', 'success');
}

function createLayerZip(layerPath) {
  log('Creating layer ZIP file...', 'info');
  
  const zipPath = path.join(
    path.dirname(layerPath),
    `${config.layerName}.zip`
  );
  
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    output.on('close', () => {
      log(`Layer ZIP created: ${zipPath} (${archive.pointer()} bytes)`, 'success');
      resolve(zipPath);
    });
    
    archive.on('error', reject);
    archive.pipe(output);
    
    // Add the nodejs directory to the root of the ZIP
    archive.directory(layerPath, false);
    archive.finalize();
  });
}

function generateLayerTemplate(layerZipPath) {
  const template = {
    AWSTemplateFormatVersion: '2010-09-09',
    Transform: 'AWS::Serverless-2016-10-31',
    Description: 'Fluxion Shared Library Lambda Layer',
    
    Parameters: {
      LayerName: {
        Type: 'String',
        Default: config.layerName,
        Description: 'Name for the Lambda layer'
      }
    },
    
    Resources: {
      FluxionSharedLayer: {
        Type: 'AWS::Lambda::LayerVersion',
        Properties: {
          LayerName: { Ref: 'LayerName' },
          Description: config.description,
          Content: {
            S3Bucket: 'SET_YOUR_BUCKET_NAME',
            S3Key: 'SET_YOUR_S3_KEY'
          },
          CompatibleRuntimes: ['nodejs18.x', 'nodejs20.x'],
          LicenseInfo: 'MIT'
        }
      }
    },
    
    Outputs: {
      LayerArn: {
        Description: 'ARN of the created Lambda layer',
        Value: { Ref: 'FluxionSharedLayer' },
        Export: {
          Name: `${config.layerName}-arn`
        }
      },
      LayerVersion: {
        Description: 'Version of the created Lambda layer',
        Value: { 'Fn::GetAtt': ['FluxionSharedLayer', 'Version'] }
      }
    }
  };
  
  const templatePath = path.join(
    path.dirname(layerZipPath),
    'layer-template.yaml'
  );
  
  fs.writeFileSync(templatePath, require('js-yaml').dump(template));
  log(`Generated layer template: ${templatePath}`, 'success');
  
  return templatePath;
}

function generateDeployScript(layerZipPath, templatePath) {
  const deployScript = `#!/bin/bash

# Fluxion Shared Library Layer Deployment Script
# Usage: ./deploy-layer.sh [environment] [region]

set -e

LAYER_NAME="${config.layerName}"
ENVIRONMENT=\${1:-dev}
REGION=\${2:-us-east-1}
BUCKET_NAME="fluxion-layers-\$ENVIRONMENT-\$REGION"
S3_KEY="layers/\$LAYER_NAME/\$(date +%Y%m%d-%H%M%S).zip"
STACK_NAME="fluxion-shared-layer-\$ENVIRONMENT"

echo "Deploying Lambda layer..."
echo "Environment: \$ENVIRONMENT"
echo "Region: \$REGION"
echo "Bucket: \$BUCKET_NAME"

# Create S3 bucket if it doesn't exist
if ! aws s3 ls "s3://\$BUCKET_NAME" &>/dev/null; then
    echo "Creating S3 bucket: \$BUCKET_NAME"
    if [ "\$REGION" = "us-east-1" ]; then
        aws s3 mb "s3://\$BUCKET_NAME"
    else
        aws s3 mb "s3://\$BUCKET_NAME" --region "\$REGION"
    fi
fi

# Upload layer ZIP to S3
echo "Uploading layer to S3..."
aws s3 cp "${path.basename(layerZipPath)}" "s3://\$BUCKET_NAME/\$S3_KEY"

# Deploy CloudFormation stack
echo "Deploying CloudFormation stack..."
sam deploy \\
    --template-file "${path.basename(templatePath)}" \\
    --stack-name "\$STACK_NAME" \\
    --parameter-overrides \\
        LayerName="\$LAYER_NAME-\$ENVIRONMENT" \\
    --capabilities CAPABILITY_IAM \\
    --region "\$REGION" \\
    --no-fail-on-empty-changeset \\
    --tags \\
        Environment="\$ENVIRONMENT" \\
        Component="SharedLayer"

# Get layer ARN
LAYER_ARN=\$(aws cloudformation describe-stacks \\
    --stack-name "\$STACK_NAME" \\
    --region "\$REGION" \\
    --query 'Stacks[0].Outputs[?OutputKey==\`LayerArn\`].OutputValue' \\
    --output text)

echo "Layer deployed successfully!"
echo "Layer ARN: \$LAYER_ARN"
echo ""
echo "To use this layer in your Lambda functions, add the following to your SAM template:"
echo ""
echo "Globals:"
echo "  Function:"
echo "    Layers:"
echo "      - \$LAYER_ARN"
echo ""
`;

  const scriptPath = path.join(
    path.dirname(layerZipPath),
    'deploy-layer.sh'
  );
  
  fs.writeFileSync(scriptPath, deployScript);
  fs.chmodSync(scriptPath, 0o755);
  
  log(`Generated deploy script: ${scriptPath}`, 'success');
  return scriptPath;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'build';
  
  try {
    log('Starting shared library packaging...', 'info');
    
    // Build shared library
    buildSharedLibrary();
    
    // Create layer structure
    const layerPath = createLayerStructure();
    
    // Install dependencies
    installLayerDependencies(layerPath);
    
    if (command !== 'build-only') {
      // Create ZIP file
      const zipPath = await createLayerZip(layerPath);
      
      // Generate deployment files
      const templatePath = generateLayerTemplate(zipPath);
      const scriptPath = generateDeployScript(zipPath, templatePath);
      
      log('Shared library layer packaged successfully!', 'success');
      log(`ZIP file: ${zipPath}`, 'info');
      log(`Template: ${templatePath}`, 'info');
      log(`Deploy script: ${scriptPath}`, 'info');
      log('', 'info');
      log('To deploy the layer, run:', 'info');
      log(`  cd ${path.dirname(zipPath)}`, 'info');
      log(`  ./deploy-layer.sh [environment] [region]`, 'info');
    } else {
      log('Layer build completed (build-only mode)', 'success');
    }
    
  } catch (error) {
    log(`Packaging failed: ${error.message}`, 'error');
    process.exit(1);
  }
}

// Install archiver if not present
if (!fs.existsSync(path.join(process.cwd(), 'node_modules', 'archiver'))) {
  log('Installing archiver dependency...', 'info');
  execCommand('npm install archiver js-yaml --save-dev');
}

// Handle command line execution
if (require.main === module) {
  main();
}

module.exports = { createLayerStructure, buildSharedLibrary };