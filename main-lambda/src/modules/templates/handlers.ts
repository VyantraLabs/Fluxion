import { Router, Request, Response } from 'express';
import { TemplateService } from './service';
import { 
  CreateTemplateSchema, 
  UpdateTemplateSchema, 
  TemplateFilterSchema,
  TemplateIdSchema,
  DuplicateTemplateSchema
} from '@/shared/validation/templates';
import { Logger } from '@/shared/utils/logger';
import { 
  authenticateJWT, 
  validateRequest, 
  asyncHandler 
} from '@/shared/middleware';
import { getTenantContext, extractTenantContext } from '@/shared/middleware/tenant';

const router = Router();
const templateService = new TemplateService();
const logger = new Logger('TemplateHandlers');

// =============================================================================
// TEMPLATE ROUTES (Support both authenticated and unauthenticated access)
// =============================================================================

/**
 * @swagger
 * /templates:
 *   get:
 *     tags:
 *       - Templates
 *     summary: List templates with auth-based access control
 *     description: |
 *       Retrieves templates with different behavior based on authentication:
 *       - No auth: Limited read-only public system templates
 *       - Organization auth: System templates + organization templates
 *       - Admin auth: All templates including deleted ones (future enhancement)
 *     security:
 *       - bearerAuth: [] # Optional
 *     parameters:
 *       - name: limit
 *         in: query
 *         description: Maximum number of templates to return
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - name: nextToken
 *         in: query
 *         description: Pagination token from previous response
 *         required: false
 *         schema:
 *           type: string
 *       - name: category
 *         in: query
 *         description: Filter templates by category ID
 *         required: false
 *         schema:
 *           type: string
 *       - name: search
 *         in: query
 *         description: Search templates by name
 *         required: false
 *         schema:
 *           type: string
 *       - name: name
 *         in: query
 *         description: Filter templates by name (partial match)
 *         required: false
 *         schema:
 *           type: string
 *       - name: isActive
 *         in: query
 *         description: Filter templates by active status
 *         required: false
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Templates retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     templates:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Template'
 *                     total:
 *                       type: integer
 *                       example: 42
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         hasMore:
 *                           type: boolean
 *                         nextToken:
 *                           type: string
 *                           nullable: true
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/', 
  // Make authentication optional but still extract context if present
  (req: Request, res: Response, next: any) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Authentication present, use normal auth flow
      return authenticateJWT(req, res, (error?: any) => {
        if (error) {
          // Authentication failed, continue as unauthenticated
          return next();
        }
        // Authentication succeeded, extract tenant context
        return extractTenantContext()(req, res, next);
      });
    } else {
      // No authentication, continue as public access
      return next();
    }
  },
  validateRequest({ query: TemplateFilterSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { limit, nextToken, name, search, isActive, categoryId, categoryIds, categories } = req.query as any;
    
    // Check if user is authenticated
    const isAuthenticated = !!(req.context?.userId);
    const tenantContext = isAuthenticated ? getTenantContext(req) : {
      tenantId: '010000000000000000000000', // System tenant
      userId: null,
      organizationId: '010000000000000000000000'
    };
    
    // Handle category filtering - accept arrays of category IDs
    let categoryFilter: string[] | undefined;
    if (categoryId) {
      categoryFilter = [categoryId];
    } else if (categoryIds && categoryIds.length > 0) {
      categoryFilter = categoryIds;
    } else if (categories && categories.length > 0) {
      categoryFilter = categories;
    }
    
    // Build organization filter - system templates + user org templates
    const organizationIds = isAuthenticated 
      ? ['010000000000000000000000', tenantContext.tenantId] // System + user org
      : ['010000000000000000000000']; // Only system for unauthenticated
    
    // Build search options
    let searchOptions: any = {
      name: name || search, // Support both 'name' and 'search' parameters
      isActive: isActive !== undefined ? Boolean(isActive) : true, // Default to active templates
      organizationIds, // Filter by system + user org
      ...(categoryFilter && categoryFilter.length > 0 && { categoryIds: categoryFilter })
    };
    
    logger.info('Templates requested', { 
      isAuthenticated,
      tenantId: isAuthenticated ? tenantContext.tenantId : 'unauthenticated',
      searchOptions,
      categoryFilter,
      limit: limit || 20
    });
    
    const result = await templateService.searchTemplates(tenantContext, searchOptions, {
      limit,
      nextToken
    });
    
    // Return appropriate data based on authentication level
    const responseData = {
      templates: !isAuthenticated 
        ? result.items.map(template => ({
            id: template.id,
            name: template.name,
            description: template.description,
            categoryId: template.categoryId,
            category: template.category,
            previewImageUrl: template.previewImageUrl,
            fullPreviewImageUrl: template.fullPreviewImageUrl,
            isSystemTemplate: template.isSystemTemplate,
            createdAt: template.createdAt
          }))
        : result.items, // Full data for authenticated users
      total: result.total,
      pagination: {
        hasMore: !!result.nextToken,
        nextToken: result.nextToken
      }
    };
    
    logger.info('Templates retrieved successfully', { 
      isAuthenticated,
      tenantId: isAuthenticated ? tenantContext.tenantId : 'unauthenticated',
      count: result.items.length,
      total: result.total,
      organizationIds
    });
    
    res.success(responseData);
  })
);

/**
 * @swagger
 * /templates/categories:
 *   get:
 *     tags:
 *       - Templates
 *     summary: Get template categories with auth-based access control
 *     description: |
 *       Retrieves template categories with different behavior based on authentication:
 *       - No auth: Public categories with limited information
 *       - Organization auth: All categories with full details and counts
 *     security:
 *       - bearerAuth: [] # Optional
 *     responses:
 *       200:
 *         description: Template categories retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     categories:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: "invoice"
 *                           name:
 *                             type: string
 *                             example: "Invoices"
 *                           description:
 *                             type: string
 *                             example: "Standard invoice templates"
 *                           count:
 *                             type: integer
 *                             example: 12
 *                           isSystem:
 *                             type: boolean
 *                             example: true
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/categories', 
  // Make authentication optional
  (req: Request, res: Response, next: any) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authenticateJWT(req, res, (error?: any) => {
        if (error) {
          return next();
        }
        return extractTenantContext()(req, res, next);
      });
    } else {
      return next();
    }
  },
  asyncHandler(async (req: Request, res: Response) => {
    const isAuthenticated = !!(req.context?.userId);
    const tenantContext = isAuthenticated ? getTenantContext(req) : {
      tenantId: '00000000-0000-0000-0000-000000000000',
      userId: null,
      organizationId: '00000000-0000-0000-0000-000000000000'
    };
    
    const categories = await templateService.getTemplateCategories(tenantContext);
    
    if (isAuthenticated) {
      logger.info('Template categories retrieved via API (authenticated)', { 
        tenantId: tenantContext.tenantId,
        categoriesCount: categories.length
      });
    } else {
      logger.info('Public template categories retrieved successfully', {
        categoriesCount: categories.length
      });
    }
    
    res.success({ categories });
  })
);

/**
 * @swagger
 * /templates/{id}:
 *   get:
 *     tags:
 *       - Templates
 *     summary: Get template by ID
 *     description: Retrieves a specific invoice template by its ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Unique template ID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Template retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Template'
 *       404:
 *         description: Template not found
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/:id', 
  authenticateJWT,
  extractTenantContext(),
  validateRequest({ params: TemplateIdSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const templateId = req.params.id;
    const tenantContext = getTenantContext(req);
    
    const template = await templateService.getTemplateById(tenantContext, templateId);
    
    logger.info('Template retrieved via API', { templateId });
    res.success(template);
  })
);

/**
 * @swagger
 * /templates:
 *   post:
 *     tags:
 *       - Templates
 *     summary: Create a new invoice template
 *     description: Creates a new invoice template for the authenticated organization
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 255
 *                 example: "Monthly Service Template"
 *               description:
 *                 type: string
 *                 maxLength: 500
 *                 example: "Template for monthly recurring services"
 *               defaultTitle:
 *                 type: string
 *                 maxLength: 255
 *                 example: "Monthly Services - {{month}} {{year}}"
 *               defaultDescription:
 *                 type: string
 *                 maxLength: 500
 *                 example: "Monthly services provided for {{client_name}}"
 *               defaultDueDays:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 365
 *                 example: 30
 *               defaultNetworkId:
 *                 type: string
 *                 format: uuid
 *                 example: "1501e461-3295-4b7c-bd4a-a0643b7c9a93"
 *               defaultTokenId:
 *                 type: string
 *                 format: uuid
 *                 example: "f6ec8763-b80f-4031-a420-100213e0be73"
 *               configuration:
 *                 type: object
 *                 description: Template configuration settings
 *                 example:
 *                   autoSend: true
 *                   reminderDays: [7, 3, 1]
 *                   customFields:
 *                     - name: "Project ID"
 *                       required: true
 *                     - name: "Service Period"
 *                       required: false
 *     responses:
 *       201:
 *         description: Template created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Template'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/', 
  authenticateJWT,
  extractTenantContext(),
  validateRequest({ body: CreateTemplateSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    const userId = req.context?.userId!;
    
    const templateData = {
      ...req.body,
      createdBy: userId
    };
    
    const template = await templateService.createTemplate(tenantContext, templateData);
    
    logger.info('Template created via API', { 
      templateId: template.id,
      name: template.name,
      userId
    });
    
    res.success(template, 201);
  })
);

/**
 * @swagger
 * /templates/{id}:
 *   put:
 *     tags:
 *       - Templates
 *     summary: Update an invoice template
 *     description: Updates an existing invoice template
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Unique template ID
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 255
 *               description:
 *                 type: string
 *                 maxLength: 500
 *               defaultTitle:
 *                 type: string
 *                 maxLength: 255
 *               defaultDescription:
 *                 type: string
 *                 maxLength: 500
 *               defaultDueDays:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 365
 *               defaultNetworkId:
 *                 type: string
 *                 format: uuid
 *               defaultTokenId:
 *                 type: string
 *                 format: uuid
 *               configuration:
 *                 type: object
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Template updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Template'
 *       404:
 *         description: Template not found
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.put('/:id', 
  authenticateJWT,
  extractTenantContext(),
  validateRequest({ 
    params: TemplateIdSchema,
    body: UpdateTemplateSchema 
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const templateId = req.params.id;
    const tenantContext = getTenantContext(req);
    
    const template = await templateService.updateTemplate(tenantContext, templateId, req.body);
    
    logger.info('Template updated via API', { templateId });
    res.success(template);
  })
);

/**
 * @swagger
 * /templates/{id}:
 *   delete:
 *     tags:
 *       - Templates
 *     summary: Delete an invoice template
 *     description: Soft deletes an invoice template (deactivates it)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Unique template ID
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Template deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Template deleted successfully"
 *       404:
 *         description: Template not found
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.delete('/:id', 
  authenticateJWT,
  extractTenantContext(),
  validateRequest({ params: TemplateIdSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const templateId = req.params.id;
    const tenantContext = getTenantContext(req);
    
    await templateService.deleteTemplate(tenantContext, templateId);
    
    logger.info('Template deleted via API', { templateId });
    res.success({ message: 'Template deleted successfully' });
  })
);

/**
 * @swagger
 * /templates/{id}/duplicate:
 *   post:
 *     tags:
 *       - Templates
 *     summary: Duplicate an invoice template
 *     description: Creates a copy of an existing template with a new name
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Template ID to duplicate
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 255
 *                 example: "Copy of Monthly Service Template"
 *     responses:
 *       201:
 *         description: Template duplicated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Template'
 *       404:
 *         description: Template not found
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.post('/:id/duplicate', 
  authenticateJWT,
  extractTenantContext(),
  validateRequest({ 
    params: TemplateIdSchema,
    body: DuplicateTemplateSchema 
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const templateId = req.params.id;
    const tenantContext = getTenantContext(req);
    const { name } = req.body;
    
    const template = await templateService.duplicateTemplate(tenantContext, templateId, name);
    
    logger.info('Template duplicated via API', { 
      originalId: templateId,
      duplicateId: template.id,
      newName: name
    });
    
    res.success(template, 201);
  })
);

/**
 * @swagger
 * /templates/{id}/preview:
 *   get:
 *     tags:
 *       - Templates
 *     summary: Preview template with sample data
 *     description: |
 *       Generates a preview of how an invoice would look when created from this template,
 *       using sample data to populate template variables.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         description: Template ID to preview
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Template preview generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     preview:
 *                       type: object
 *                       description: Preview of invoice data with sample values
 *                     sampleData:
 *                       type: object
 *                       description: Sample data used for preview generation
 *       404:
 *         description: Template not found
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/:id/preview', 
  authenticateJWT,
  extractTenantContext(),
  validateRequest({ params: TemplateIdSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const templateId = req.params.id;
    const tenantContext = getTenantContext(req);
    
    const preview = await templateService.generateTemplatePreview(tenantContext, templateId);
    
    logger.info('Template preview generated via API', { templateId });
    res.success(preview);
  })
);

/**
 * @swagger
 * /templates/usage-stats:
 *   get:
 *     tags:
 *       - Templates
 *     summary: Get template usage statistics
 *     description: |
 *       Retrieves analytics about template usage for the authenticated organization,
 *       including most used templates and overall statistics.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Template statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 15
 *                     active:
 *                       type: integer
 *                       example: 12
 *                     inactive:
 *                       type: integer
 *                       example: 3
 *                     totalUsage:
 *                       type: integer
 *                       example: 247
 *                     mostUsed:
 *                       $ref: '#/components/schemas/Template'
 *                       nullable: true
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */
router.get('/usage-stats', 
  authenticateJWT,
  extractTenantContext(),
  asyncHandler(async (req: Request, res: Response) => {
    const tenantContext = getTenantContext(req);
    
    const stats = await templateService.getTemplateStats(tenantContext);
    
    logger.info('Template usage stats retrieved via API', { 
      tenantId: tenantContext.tenantId,
      stats: {
        total: stats.total,
        active: stats.active,
        totalUsage: stats.totalUsage
      }
    });
    
    res.success(stats);
  })
);

export const templateRoutes = router;