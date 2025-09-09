import { MigrationInterface, QueryRunner } from 'typeorm';
import { ulid } from 'ulid';

export class SeedS3Templates1757610000000 implements MigrationInterface {
  name = 'SeedS3Templates1757610000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    console.log('Seeding comprehensive template system with S3 support...');

    // Define comprehensive system templates with S3 URLs and preview images
    const s3Templates = [
      // Professional Invoice Templates
      {
        id: ulid(),
        categoryId: '01HZ0000000000000000000001', // Invoices
        name: 'Professional Business Invoice Template',
        description: 'Professional invoice template with company branding and detailed line items',
        templateType: 's3_based',
        s3TemplateUrl: 'templates/system/invoices/professional-business.html',
        previewImageUrl: 'templates/system/previews/professional-business-invoice.png',
        isPublic: true,
        tags: ['business', 'professional', 'detailed'],
        variables: {
          company_name: { type: 'text', required: true, placeholder: 'Company Name' },
          company_address: { type: 'text', required: false, placeholder: 'Company Address' },
          company_email: { type: 'email', required: true, placeholder: 'contact@company.com' },
          company_phone: { type: 'text', required: false, placeholder: '+1 (555) 123-4567' },
          company_website: { type: 'url', required: false, placeholder: 'https://company.com' },
          client_name: { type: 'text', required: true, placeholder: 'Client Name' },
          client_email: { type: 'email', required: true, placeholder: 'client@email.com' },
          invoice_number: { type: 'text', required: true, placeholder: 'INV-001' },
          invoice_date: { type: 'date', required: true },
          due_date: { type: 'date', required: true },
          payment_terms: { type: 'number', required: true, placeholder: '30' }
        },
        content: {
          type: 'invoice',
          layout: 'professional',
          version: '1.0',
          features: ['logo', 'colors', 'line_items', 'taxes', 'payment_info']
        }
      },
      {
        id: ulid(),
        categoryId: '01HZ0000000000000000000001', // Invoices
        name: 'Modern Minimalist Invoice Template',
        description: 'Clean and modern invoice template with minimal design elements',
        templateType: 's3_based',
        s3TemplateUrl: 'templates/system/invoices/modern-minimalist.html',
        previewImageUrl: 'templates/system/previews/modern-minimalist-invoice.png',
        isPublic: true,
        tags: ['modern', 'minimal', 'clean'],
        variables: {
          company_name: { type: 'text', required: true, placeholder: 'Your Company' },
          client_name: { type: 'text', required: true, placeholder: 'Client Name' },
          service_description: { type: 'textarea', required: true, placeholder: 'Service Description' },
          amount: { type: 'number', required: true, placeholder: '1000' }
        },
        content: {
          type: 'invoice',
          layout: 'minimalist',
          version: '1.0',
          features: ['simple_header', 'single_item', 'crypto_payment']
        }
      },
      {
        id: ulid(),
        categoryId: '01HZ0000000000000000000001', // Invoices
        name: 'Tech Startup Invoice Template',
        description: 'Modern invoice template designed for tech companies and startups',
        templateType: 's3_based',
        s3TemplateUrl: 'templates/system/invoices/tech-startup.html',
        previewImageUrl: 'templates/system/previews/tech-startup-invoice.png',
        isPublic: true,
        tags: ['tech', 'startup', 'modern', 'gradient'],
        variables: {
          startup_name: { type: 'text', required: true, placeholder: 'TechCorp Inc.' },
          project_name: { type: 'text', required: true, placeholder: 'Project Alpha' },
          milestone: { type: 'text', required: false, placeholder: 'Phase 1 Completion' }
        },
        content: {
          type: 'invoice',
          layout: 'tech',
          version: '1.0',
          features: ['gradient_header', 'project_info', 'milestone_tracking']
        }
      },
      
      // Creative Agency Templates
      {
        id: ulid(),
        categoryId: '01HZ0000000000000000000001', // Invoices
        name: 'Creative Agency Invoice Template',
        description: 'Stylish invoice template for creative agencies and designers',
        templateType: 's3_based',
        s3TemplateUrl: 'templates/system/invoices/creative-agency.html',
        previewImageUrl: 'templates/system/previews/creative-agency-invoice.png',
        isPublic: true,
        tags: ['creative', 'agency', 'design', 'colorful'],
        variables: {
          agency_name: { type: 'text', required: true, placeholder: 'Creative Studio' },
          project_type: { type: 'select', required: true, options: ['Branding', 'Web Design', 'App Design', 'Marketing'] },
          creative_director: { type: 'text', required: false, placeholder: 'John Doe' }
        },
        content: {
          type: 'invoice',
          layout: 'creative',
          version: '1.0',
          features: ['bold_colors', 'project_showcase', 'team_info']
        }
      },

      // Consulting Templates
      {
        id: ulid(),
        categoryId: '01HZ0000000000000000000001', // Invoices
        name: 'Consulting Services Invoice Template',
        description: 'Professional invoice template for consulting and professional services',
        templateType: 's3_based',
        s3TemplateUrl: 'templates/system/invoices/consulting-services.html',
        previewImageUrl: 'templates/system/previews/consulting-services-invoice.png',
        isPublic: true,
        tags: ['consulting', 'professional', 'hourly', 'services'],
        variables: {
          consultant_name: { type: 'text', required: true, placeholder: 'Consultant Name' },
          consultation_type: { type: 'text', required: true, placeholder: 'Business Strategy' },
          hourly_rate: { type: 'number', required: true, placeholder: '150' },
          total_hours: { type: 'number', required: true, placeholder: '20' }
        },
        content: {
          type: 'invoice',
          layout: 'consulting',
          version: '1.0',
          features: ['hourly_breakdown', 'consultant_info', 'time_tracking']
        }
      },

      // Receipt Templates
      {
        id: ulid(),
        categoryId: '01HZ0000000000000000000002', // Receipts
        name: 'Crypto Payment Receipt Template',
        description: 'Receipt template specifically designed for cryptocurrency payments',
        templateType: 's3_based',
        s3TemplateUrl: 'templates/system/receipts/crypto-payment.html',
        previewImageUrl: 'templates/system/previews/crypto-payment-receipt.png',
        isPublic: true,
        tags: ['crypto', 'blockchain', 'receipt', 'transaction'],
        variables: {
          transaction_hash: { type: 'text', required: true, placeholder: '0x...' },
          blockchain_network: { type: 'select', required: true, options: ['Ethereum', 'Polygon', 'BSC', 'Arbitrum'] },
          payment_token: { type: 'text', required: true, placeholder: 'USDC' },
          block_confirmations: { type: 'number', required: false, placeholder: '12' }
        },
        content: {
          type: 'receipt',
          layout: 'crypto',
          version: '1.0',
          features: ['blockchain_info', 'transaction_details', 'confirmation_status']
        }
      },
      {
        id: ulid(),
        categoryId: '01HZ0000000000000000000002', // Receipts
        name: 'Service Payment Receipt Template',
        description: 'General service payment receipt with professional formatting',
        templateType: 's3_based',
        s3TemplateUrl: 'templates/system/receipts/service-payment.html',
        previewImageUrl: 'templates/system/previews/service-payment-receipt.png',
        isPublic: true,
        tags: ['service', 'payment', 'professional'],
        variables: {
          receipt_number: { type: 'text', required: true, placeholder: 'RCP-001' },
          payment_date: { type: 'date', required: true },
          service_period: { type: 'text', required: false, placeholder: 'January 2025' }
        },
        content: {
          type: 'receipt',
          layout: 'standard',
          version: '1.0',
          features: ['payment_confirmation', 'service_details']
        }
      },

      // Estimate Templates
      {
        id: ulid(),
        categoryId: '01HZ0000000000000000000003', // Estimates
        name: 'Detailed Project Estimate Template',
        description: 'Comprehensive project estimate with phases and milestone breakdown',
        templateType: 's3_based',
        s3TemplateUrl: 'templates/system/estimates/detailed-project.html',
        previewImageUrl: 'templates/system/previews/detailed-project-estimate.png',
        isPublic: true,
        tags: ['project', 'detailed', 'phases', 'milestones'],
        variables: {
          project_name: { type: 'text', required: true, placeholder: 'Website Redesign' },
          project_duration: { type: 'text', required: true, placeholder: '8-12 weeks' },
          total_phases: { type: 'number', required: true, placeholder: '4' },
          estimate_valid_until: { type: 'date', required: true }
        },
        content: {
          type: 'estimate',
          layout: 'detailed',
          version: '1.0',
          features: ['phase_breakdown', 'timeline', 'milestone_payments']
        }
      },
      {
        id: ulid(),
        categoryId: '01HZ0000000000000000000003', // Estimates
        name: 'Quick Service Quote Template',
        description: 'Simple and fast quote template for service-based businesses',
        templateType: 's3_based',
        s3TemplateUrl: 'templates/system/estimates/quick-service-quote.html',
        previewImageUrl: 'templates/system/previews/quick-service-quote.png',
        isPublic: true,
        tags: ['quick', 'service', 'simple'],
        variables: {
          service_type: { type: 'text', required: true, placeholder: 'Web Development' },
          estimated_completion: { type: 'text', required: true, placeholder: '2-3 weeks' },
          quote_number: { type: 'text', required: true, placeholder: 'QTE-001' }
        },
        content: {
          type: 'estimate',
          layout: 'simple',
          version: '1.0',
          features: ['quick_quote', 'service_focus']
        }
      },

      // Proposal Templates
      {
        id: ulid(),
        categoryId: '01HZ0000000000000000000004', // Proposals
        name: 'Business Proposal Template',
        description: 'Comprehensive business proposal template with executive summary',
        templateType: 's3_based',
        s3TemplateUrl: 'templates/system/proposals/business-proposal.html',
        previewImageUrl: 'templates/system/previews/business-proposal.png',
        isPublic: true,
        tags: ['business', 'proposal', 'executive', 'comprehensive'],
        variables: {
          proposal_title: { type: 'text', required: true, placeholder: 'Digital Transformation Strategy' },
          executive_summary: { type: 'textarea', required: true, placeholder: 'Executive summary...' },
          proposal_value: { type: 'number', required: true, placeholder: '50000' }
        },
        content: {
          type: 'proposal',
          layout: 'business',
          version: '1.0',
          features: ['executive_summary', 'scope_of_work', 'timeline', 'pricing']
        }
      },
      {
        id: ulid(),
        categoryId: '01HZ0000000000000000000004', // Proposals
        name: 'Creative Project Proposal Template',
        description: 'Creative proposal template for design and marketing projects',
        templateType: 's3_based',
        s3TemplateUrl: 'templates/system/proposals/creative-project.html',
        previewImageUrl: 'templates/system/previews/creative-project-proposal.png',
        isPublic: true,
        tags: ['creative', 'design', 'marketing'],
        variables: {
          creative_concept: { type: 'textarea', required: true, placeholder: 'Creative concept description...' },
          design_approach: { type: 'textarea', required: true, placeholder: 'Our design approach...' },
          deliverables: { type: 'textarea', required: true, placeholder: 'Project deliverables...' }
        },
        content: {
          type: 'proposal',
          layout: 'creative',
          version: '1.0',
          features: ['concept_presentation', 'design_samples', 'creative_process']
        }
      },

      // Contract Templates
      {
        id: ulid(),
        categoryId: '01HZ0000000000000000000005', // Contracts
        name: 'Service Agreement Template',
        description: 'Standard service agreement template with terms and conditions',
        templateType: 's3_based',
        s3TemplateUrl: 'templates/system/contracts/service-agreement.html',
        previewImageUrl: 'templates/system/previews/service-agreement.png',
        isPublic: true,
        tags: ['contract', 'service', 'agreement', 'legal'],
        variables: {
          service_description: { type: 'textarea', required: true, placeholder: 'Description of services...' },
          contract_duration: { type: 'text', required: true, placeholder: '12 months' },
          termination_clause: { type: 'textarea', required: true, placeholder: 'Termination conditions...' }
        },
        content: {
          type: 'contract',
          layout: 'legal',
          version: '1.0',
          features: ['legal_terms', 'payment_schedule', 'termination_clauses']
        }
      },
      {
        id: ulid(),
        categoryId: '01HZ0000000000000000000005', // Contracts
        name: 'Freelance Contract Template',
        description: 'Freelance work contract with intellectual property and payment terms',
        templateType: 's3_based',
        s3TemplateUrl: 'templates/system/contracts/freelance-contract.html',
        previewImageUrl: 'templates/system/previews/freelance-contract.png',
        isPublic: true,
        tags: ['freelance', 'independent', 'contractor'],
        variables: {
          freelancer_name: { type: 'text', required: true, placeholder: 'Freelancer Name' },
          work_description: { type: 'textarea', required: true, placeholder: 'Work to be performed...' },
          payment_schedule: { type: 'select', required: true, options: ['Weekly', 'Bi-weekly', 'Monthly', 'Upon Completion'] }
        },
        content: {
          type: 'contract',
          layout: 'freelance',
          version: '1.0',
          features: ['ip_rights', 'payment_terms', 'work_scope']
        }
      },

      // Report Templates
      {
        id: ulid(),
        categoryId: '01HZ0000000000000000000006', // Reports
        name: 'Monthly Progress Report Template',
        description: 'Monthly progress and analytics report template',
        templateType: 's3_based',
        s3TemplateUrl: 'templates/system/reports/monthly-progress.html',
        previewImageUrl: 'templates/system/previews/monthly-progress-report.png',
        isPublic: true,
        tags: ['monthly', 'progress', 'analytics', 'kpi'],
        variables: {
          report_period: { type: 'text', required: true, placeholder: 'January 2025' },
          key_achievements: { type: 'textarea', required: true, placeholder: 'Key achievements this month...' },
          next_month_goals: { type: 'textarea', required: true, placeholder: 'Goals for next month...' }
        },
        content: {
          type: 'report',
          layout: 'progress',
          version: '1.0',
          features: ['progress_charts', 'kpi_metrics', 'goal_tracking']
        }
      },
      {
        id: ulid(),
        categoryId: '01HZ0000000000000000000006', // Reports
        name: 'Financial Summary Report Template',
        description: 'Financial summary and analytics report with charts and insights',
        templateType: 's3_based',
        s3TemplateUrl: 'templates/system/reports/financial-summary.html',
        previewImageUrl: 'templates/system/previews/financial-summary-report.png',
        isPublic: true,
        tags: ['financial', 'summary', 'analytics', 'charts'],
        variables: {
          financial_period: { type: 'text', required: true, placeholder: 'Q1 2025' },
          total_revenue: { type: 'number', required: true, placeholder: '150000' },
          total_expenses: { type: 'number', required: true, placeholder: '75000' }
        },
        content: {
          type: 'report',
          layout: 'financial',
          version: '1.0',
          features: ['revenue_charts', 'expense_breakdown', 'profit_analysis']
        }
      }
    ];

    // Define system organization ID for system templates (using a special ULID for system templates)
    const SYSTEM_ORG_ID = '01SYSTEM0000000000000000'; // Special ULID format for system organization
    
    // Insert S3-based system templates
    console.log(`Inserting ${s3Templates.length} S3-based templates with system organization ID...`);
    
    for (const template of s3Templates) {
      await queryRunner.query(`
        INSERT INTO templates (
          id, organization_id, category_id, name, description, content,
          template_type, s3_template_url, preview_image_url, is_public, tags, variables,
          is_active, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) ON CONFLICT (id) DO NOTHING
      `, [
        template.id,
        SYSTEM_ORG_ID, // Use system organization ID instead of NULL
        template.categoryId,
        template.name,
        template.description,
        JSON.stringify(template.content),
        template.templateType,
        template.s3TemplateUrl,
        template.previewImageUrl,
        template.isPublic,
        template.tags,
        JSON.stringify(template.variables),
      ]);
    }

    console.log('S3-based template system seeded successfully!');
    console.log(`Total templates created: ${s3Templates.length}`);
    console.log('Template categories covered:');
    console.log('- Invoices: 5 templates');
    console.log('- Receipts: 2 templates');
    console.log('- Estimates: 2 templates');
    console.log('- Proposals: 2 templates');
    console.log('- Contracts: 2 templates');
    console.log('- Reports: 2 templates');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    console.log('Removing S3-based system templates...');
    
    const SYSTEM_ORG_ID = '01SYSTEM0000000000000000'; // Same system organization ID
    
    // Remove S3-based system templates
    await queryRunner.query(`
      DELETE FROM templates 
      WHERE organization_id = $1 
      AND template_type = 's3_based'
    `, [SYSTEM_ORG_ID]);

    console.log('S3-based templates removed successfully.');
  }
}