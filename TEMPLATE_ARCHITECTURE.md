# Template Storage Architecture

## Overview

This document outlines the refactored template storage system that provides flexibility, maintainability, and environment independence for the Fluxion platform.

## Key Changes Made

### 1. Database Schema Updates

- **Relative Path Storage**: Templates now store only relative paths (e.g., `templates/system/invoices/professional-service/template.html`) instead of full S3 URLs
- **Environment Independence**: Full URLs are constructed dynamically by the application layer based on environment variables
- **Migration Added**: `ConvertTemplateUrlsToRelativePaths` migration handles the conversion of existing records

### 2. Application Layer Improvements

- **Dynamic URL Construction**: `InvoiceTemplate` entity now has improved `getS3BaseUrl()` method with environment-specific fallbacks
- **Multiple Environment Variable Support**: Supports `TEMPLATE_S3_BASE_URL`, `S3_BUCKET_URL`, or `AWS_S3_BUCKET_URL`
- **Backward Compatibility**: Existing full URLs are still supported during transition period

### 3. Template Organization

Templates are now organized in a hierarchical S3 structure:

```
templates/
├── system/                           # Built-in system templates
│   ├── invoices/
│   │   ├── professional-service/
│   │   │   ├── template.html
│   │   │   └── preview.png
│   │   ├── creative-freelancer/
│   │   │   ├── template.html  
│   │   │   └── preview.png
│   │   ├── product-sales/
│   │   │   ├── template.html
│   │   │   └── preview.png
│   │   └── recurring-subscription/
│   │       ├── template.html
│   │       └── preview.png
│   ├── payslips/
│   │   ├── monthly-salary/
│   │   │   ├── template.html
│   │   │   └── preview.png
│   │   ├── freelancer-contractor/
│   │   ├── bonus-payment/
│   │   └── commission-payment/
│   ├── reminders/
│   │   ├── friendly-reminder/
│   │   ├── overdue-notice/
│   │   ├── final-warning/
│   │   └── payment-thank-you/
│   ├── receipts/
│   │   ├── payment-receipt/
│   │   ├── service-completion/
│   │   ├── product-delivery/
│   │   └── subscription-renewal/
│   ├── estimates/
│   │   ├── project-quote/
│   │   ├── service-estimate/
│   │   ├── product-pricing/
│   │   └── website-development/
│   └── contracts/
│       ├── freelance-agreement/
│       ├── nda/
│       ├── payment-terms/
│       └── consulting-retainer/
└── tenants/                          # Organization-specific templates
    └── {organization-id}/
        └── {category}/
            └── {template-id}/
                ├── template.html
                └── preview.png
```

## Environment Configuration

### Development
```bash
TEMPLATE_S3_BASE_URL=https://fluxion-templates-dev.s3.ap-south-1.amazonaws.com
# OR
S3_BUCKET_URL=https://fluxion-templates-dev.s3.ap-south-1.amazonaws.com
```

### Staging
```bash
TEMPLATE_S3_BASE_URL=https://fluxion-templates-staging.s3.ap-south-1.amazonaws.com
```

### Production
```bash
TEMPLATE_S3_BASE_URL=https://fluxion-templates-prod.s3.ap-south-1.amazonaws.com
```

## Template Structure

### HTML Templates

Each template is a complete HTML document with:
- **Professional styling** using CSS Grid and Flexbox
- **Responsive design** that works on all screen sizes
- **Print optimization** for PDF generation
- **Handlebars variables** for dynamic content (e.g., `{{client_name}}`, `{{total_amount}}`)
- **Crypto payment sections** with QR codes and wallet addresses
- **Brand customization** through `{{branding.*}}` variables

### Template Categories

1. **Invoices** (4 templates)
   - Professional Service Invoice - Clean, corporate layout
   - Creative Freelancer Invoice - Modern, creative design  
   - Product Sales Invoice - E-commerce focused with item tables
   - Recurring Subscription Invoice - SaaS billing layout

2. **Payslips** (4 templates)
   - Monthly Salary Slip - Standard payroll format
   - Freelance Contractor Payment - Independent contractor layout
   - Bonus Payment Slip - Special payment format
   - Commission Payment - Sales commission layout

3. **Reminders** (4 templates)
   - Friendly Payment Reminder - Polite, professional tone
   - Overdue Payment Notice - Urgent but professional
   - Final Payment Warning - Formal warning layout
   - Payment Confirmation Thank You - Positive confirmation

4. **Receipts** (4 templates)
   - Payment Receipt - Official transaction record
   - Service Completion Receipt - Service delivery confirmation  
   - Product Delivery Receipt - Shipping confirmation
   - Subscription Renewal Receipt - Recurring billing confirmation

5. **Estimates** (4 templates)
   - Project Quote - Detailed project estimate
   - Service Estimate - Hourly service breakdown
   - Product Pricing Quote - Bulk pricing layout
   - Website Development Quote - Technical specification format

6. **Contracts** (4 templates)
   - Freelance Service Agreement - Service contract layout
   - Non-Disclosure Agreement (NDA) - Legal document format
   - Payment Terms Agreement - Billing terms layout
   - Consulting Retainer Agreement - Retainer contract format

## Template Variables

### Standard Variables
All templates support these standard variables:
- `{{client_name}}` - Customer/client name
- `{{client_email}}` - Client email address
- `{{total_amount}}` - Total amount in USD
- `{{crypto_amount}}` - Amount in cryptocurrency
- `{{token_symbol}}` - Crypto token symbol (USDC, ETH, etc.)
- `{{network_name}}` - Blockchain network name
- `{{recipient_address}}` - Payment wallet address
- `{{invoice_number}}` - Unique invoice identifier
- `{{issue_date}}` - Invoice creation date
- `{{due_date}}` - Payment due date
- `{{qr_code_url}}` - QR code for crypto payment

### Branding Variables
- `{{branding.companyName}}` - Company name
- `{{branding.companyAddress}}` - Company address
- `{{branding.companyPhone}}` - Phone number
- `{{branding.companyEmail}}` - Email address
- `{{branding.website}}` - Company website
- `{{branding.primaryColor}}` - Primary brand color
- `{{branding.secondaryColor}}` - Secondary brand color

### Template-Specific Variables
Each template type includes additional relevant variables (e.g., `{{employee_id}}` for payslips, `{{project_name}}` for invoices).

## Migration Path

### Phase 1: Infrastructure Setup ✅
- [x] Create migration to convert existing URLs to relative paths
- [x] Update entity methods for dynamic URL construction
- [x] Update seeding migrations

### Phase 2: Template Creation ✅
- [x] Create professional HTML templates for all categories
- [x] Implement responsive design and print optimization
- [x] Add comprehensive Handlebars variable system

### Phase 3: Service Layer Updates (Next)
- [ ] Update template service methods
- [ ] Test URL construction across environments
- [ ] Verify template rendering with sample data

### Phase 4: Deployment & Testing (Next)
- [ ] Deploy templates to S3 buckets
- [ ] Test in development environment
- [ ] Validate production deployment

## Benefits of New Architecture

1. **Environment Flexibility**: Easy switching between dev/staging/prod S3 buckets
2. **Infrastructure Independence**: No hardcoded URLs in database
3. **Better Organization**: Hierarchical folder structure for easy management
4. **Professional Templates**: High-quality HTML templates with proper styling
5. **Maintainability**: Clear separation of data and presentation
6. **Scalability**: Easy addition of new templates and categories
7. **Version Control**: Templates can be version controlled separately

## Testing Strategy

1. **Unit Tests**: Test URL construction methods with different environment variables
2. **Integration Tests**: Verify template loading and rendering
3. **End-to-End Tests**: Test complete invoice generation flow
4. **Cross-Environment Tests**: Ensure templates work in dev/staging/prod

## Future Enhancements

1. **Template Versioning**: Support for multiple template versions
2. **Custom CSS**: Allow per-organization custom styling
3. **Template Builder**: Visual template customization interface  
4. **Preview Generation**: Automated preview image generation
5. **Template Analytics**: Usage tracking and optimization insights