import { MigrationInterface, QueryRunner } from 'typeorm';
import { ulid } from 'ulid';

export class SeedTemplateSystemData1757510000000 implements MigrationInterface {
  name = 'SeedTemplateSystemData1757510000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Define system template categories
    const categories = [
      {
        id: '01HZ0000000000000000000001',
        name: 'Invoices',
        slug: 'invoices',
        description: 'Standard business invoices for services and products',
        icon: 'FileText',
        color: '#3B82F6',
        sortOrder: 1,
      },
      {
        id: '01HZ0000000000000000000002',
        name: 'Receipts',
        slug: 'receipts',
        description: 'Payment confirmation and receipt templates',
        icon: 'CheckCircle',
        color: '#10B981',
        sortOrder: 2,
      },
      {
        id: '01HZ0000000000000000000003',
        name: 'Estimates',
        slug: 'estimates',
        description: 'Project estimates and quotes',
        icon: 'Calculator',
        color: '#F59E0B',
        sortOrder: 3,
      },
      {
        id: '01HZ0000000000000000000004',
        name: 'Proposals',
        slug: 'proposals',
        description: 'Business proposals and project bids',
        icon: 'Briefcase',
        color: '#8B5CF6',
        sortOrder: 4,
      },
      {
        id: '01HZ0000000000000000000005',
        name: 'Contracts',
        slug: 'contracts',
        description: 'Service agreements and contract templates',
        icon: 'FileSignature',
        color: '#EF4444',
        sortOrder: 5,
      },
      {
        id: '01HZ0000000000000000000006',
        name: 'Reports',
        slug: 'reports',
        description: 'Business reports and analytics templates',
        icon: 'BarChart',
        color: '#6B7280',
        sortOrder: 6,
      },
    ];

    // Insert template categories
    for (const category of categories) {
      await queryRunner.query(`
        INSERT INTO template_categories (
          id, name, slug, description, icon, color, sort_order, 
          is_system, is_active, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) ON CONFLICT (id) DO NOTHING
      `, [
        category.id,
        category.name,
        category.slug,
        category.description,
        category.icon,
        category.color,
        category.sortOrder,
      ]);
    }

    // Define system templates with comprehensive content
    const systemTemplates = [
      // Invoice Templates
      {
        id: ulid(),
        categoryId: '01HZ0000000000000000000001', // Invoices
        name: 'Professional Invoice',
        description: 'A clean and professional invoice template for businesses',
        content: {
          type: 'invoice',
          layout: 'professional',
          sections: {
            header: {
              company: {
                name: '{{company_name}}',
                address: '{{company_address}}',
                email: '{{company_email}}',
                phone: '{{company_phone}}',
                website: '{{company_website}}',
              },
              invoice: {
                number: '{{invoice_number}}',
                date: '{{invoice_date}}',
                dueDate: '{{due_date}}',
                title: 'INVOICE',
              },
            },
            billing: {
              to: {
                name: '{{client_name}}',
                address: '{{client_address}}',
                email: '{{client_email}}',
              },
            },
            items: [
              {
                description: '{{item_description}}',
                quantity: '{{item_quantity}}',
                rate: '{{item_rate}}',
                amount: '{{item_amount}}',
              },
            ],
            totals: {
              subtotal: '{{subtotal}}',
              tax: '{{tax_amount}}',
              total: '{{total_amount}}',
            },
            payment: {
              instructions: 'Please send payment to the crypto address specified below.',
              blockchain: '{{blockchain_network}}',
              token: '{{payment_token}}',
              address: '{{payment_address}}',
              amount: '{{crypto_amount}}',
            },
            footer: {
              notes: '{{notes}}',
              terms: 'Payment is due within {{payment_terms}} days.',
            },
          },
          styling: {
            primaryColor: '#2563EB',
            secondaryColor: '#64748B',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '14px',
          },
        },
      },
      {
        id: ulid(),
        categoryId: '01HZ0000000000000000000001', // Invoices
        name: 'Minimalist Invoice',
        description: 'A simple and clean invoice template with minimal design',
        content: {
          type: 'invoice',
          layout: 'minimalist',
          sections: {
            header: {
              title: 'Invoice',
              number: '{{invoice_number}}',
              date: '{{invoice_date}}',
            },
            company: {
              name: '{{company_name}}',
              contact: '{{company_email}}',
            },
            client: {
              name: '{{client_name}}',
              email: '{{client_email}}',
            },
            items: [
              {
                description: '{{service_description}}',
                amount: '{{amount}}',
              },
            ],
            payment: {
              total: '{{total_amount}}',
              currency: '{{token_symbol}}',
              address: '{{payment_address}}',
              network: '{{blockchain_network}}',
            },
          },
          styling: {
            primaryColor: '#000000',
            backgroundColor: '#FFFFFF',
            fontFamily: 'system-ui, sans-serif',
          },
        },
      },
      // Receipt Templates
      {
        id: ulid(),
        categoryId: '01HZ0000000000000000000002', // Receipts
        name: 'Payment Receipt',
        description: 'Standard payment receipt for completed transactions',
        content: {
          type: 'receipt',
          layout: 'standard',
          sections: {
            header: {
              title: 'PAYMENT RECEIPT',
              receiptNumber: '{{receipt_number}}',
              date: '{{payment_date}}',
            },
            company: {
              name: '{{company_name}}',
              address: '{{company_address}}',
            },
            transaction: {
              invoiceNumber: '{{invoice_number}}',
              paymentMethod: 'Cryptocurrency',
              transactionHash: '{{transaction_hash}}',
              blockchain: '{{blockchain_network}}',
              amount: '{{paid_amount}}',
              token: '{{payment_token}}',
            },
            client: {
              name: '{{client_name}}',
              email: '{{client_email}}',
            },
            confirmation: {
              status: 'PAID IN FULL',
              message: 'Thank you for your payment. This receipt serves as proof of payment.',
            },
          },
        },
      },
      // Estimate Templates
      {
        id: ulid(),
        categoryId: '01HZ0000000000000000000003', // Estimates
        name: 'Project Estimate',
        description: 'Detailed project estimate with itemized costs',
        content: {
          type: 'estimate',
          layout: 'detailed',
          sections: {
            header: {
              title: 'PROJECT ESTIMATE',
              estimateNumber: '{{estimate_number}}',
              date: '{{estimate_date}}',
              validUntil: '{{valid_until}}',
            },
            company: {
              name: '{{company_name}}',
              contact: '{{company_email}}',
            },
            client: {
              name: '{{client_name}}',
              project: '{{project_name}}',
            },
            phases: [
              {
                name: '{{phase_name}}',
                description: '{{phase_description}}',
                items: [
                  {
                    task: '{{task_name}}',
                    hours: '{{estimated_hours}}',
                    rate: '{{hourly_rate}}',
                    amount: '{{phase_amount}}',
                  },
                ],
              },
            ],
            totals: {
              subtotal: '{{subtotal}}',
              total: '{{total_estimate}}',
              currency: '{{payment_token}}',
            },
            terms: {
              payment: 'Payment due within 30 days of project completion',
              validity: 'This estimate is valid for 30 days from the date above',
            },
          },
        },
      },
    ];

    // Insert system templates
    for (const template of systemTemplates) {
      await queryRunner.query(`
        INSERT INTO templates (
          id, organization_id, category_id, name, description, content,
          is_active, created_at, updated_at
        ) VALUES (
          $1, NULL, $2, $3, $4, $5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) ON CONFLICT (id) DO NOTHING
      `, [
        template.id,
        template.categoryId,
        template.name,
        template.description,
        JSON.stringify(template.content),
      ]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove system templates
    await queryRunner.query(`
      DELETE FROM templates WHERE organization_id IS NULL
    `);

    // Remove system template categories
    await queryRunner.query(`
      DELETE FROM template_categories WHERE is_system = true
    `);
  }
}
