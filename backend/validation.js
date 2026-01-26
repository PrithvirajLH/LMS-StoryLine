/**
 * Input Validation Schemas using Zod
 * Centralized validation for all API inputs
 */

import { z } from 'zod';

// ============================================================================
// Auth Schemas
// ============================================================================

export const registerSchema = z.object({
  email: z.string()
    .email('Invalid email address')
    .max(255, 'Email must be less than 255 characters')
    .transform(val => val.toLowerCase().trim()),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters'),
  firstName: z.string()
    .max(100, 'First name must be less than 100 characters')
    .optional()
    .transform(val => val?.trim()),
  lastName: z.string()
    .max(100, 'Last name must be less than 100 characters')
    .optional()
    .transform(val => val?.trim()),
  name: z.string()
    .max(200, 'Name must be less than 200 characters')
    .optional()
    .transform(val => val?.trim()),
});

export const loginSchema = z.object({
  email: z.string()
    .email('Invalid email address')
    .transform(val => val.toLowerCase().trim()),
  password: z.string()
    .min(1, 'Password is required')
    .max(128, 'Password must be less than 128 characters'),
});

// ============================================================================
// Course Schemas
// ============================================================================

export const createCourseSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must be less than 200 characters')
    .transform(val => val.trim()),
  description: z.string()
    .max(2000, 'Description must be less than 2000 characters')
    .optional()
    .default('')
    .transform(val => val?.trim() || ''),
  thumbnailUrl: z.string()
    .max(500, 'Thumbnail URL must be less than 500 characters')
    .optional()
    .default(''),
  activityId: z.string()
    .min(1, 'Activity ID is required')
    .max(500, 'Activity ID must be less than 500 characters')
    .refine(val => val.startsWith('urn:') || val.startsWith('http://') || val.startsWith('https://'), {
      message: 'Activity ID must be a valid URN or URL'
    }),
  launchFile: z.string()
    .min(1, 'Launch file is required')
    .max(200, 'Launch file must be less than 200 characters')
    .regex(/^[a-zA-Z0-9_.\-\/]+\.html?$/i, 'Launch file must be a valid HTML file path'),
  coursePath: z.string()
    .max(500, 'Course path must be less than 500 characters')
    .optional()
    .default(''),
  modules: z.array(z.object({
    id: z.string().max(100),
    name: z.string().max(200),
  })).optional().default([]),
});

export const updateCourseSchema = createCourseSchema.partial();

// ============================================================================
// xAPI Schemas
// ============================================================================

export const xapiAgentSchema = z.object({
  objectType: z.literal('Agent').optional(),
  name: z.string().max(200).optional(),
  mbox: z.string()
    .regex(/^mailto:.+@.+\..+$/, 'Invalid mbox format (should be mailto:email)')
    .optional(),
  mbox_sha1sum: z.string().length(40).optional(),
  openid: z.string().url().optional(),
  account: z.object({
    homePage: z.string().url(),
    name: z.string().max(200),
  }).optional(),
}).refine(
  data => data.mbox || data.mbox_sha1sum || data.openid || data.account,
  { message: 'Agent must have at least one identifier (mbox, mbox_sha1sum, openid, or account)' }
);

export const xapiVerbSchema = z.object({
  id: z.string().url('Verb ID must be a valid URL'),
  display: z.record(z.string()).optional(),
});

export const xapiObjectSchema = z.object({
  id: z.string().min(1, 'Object ID is required'),
  objectType: z.enum(['Activity', 'Agent', 'Group', 'SubStatement', 'StatementRef']).optional(),
  definition: z.object({
    name: z.record(z.string()).optional(),
    description: z.record(z.string()).optional(),
    type: z.string().url().optional(),
    moreInfo: z.string().url().optional(),
    interactionType: z.string().optional(),
    correctResponsesPattern: z.array(z.string()).optional(),
    choices: z.array(z.any()).optional(),
    scale: z.array(z.any()).optional(),
    source: z.array(z.any()).optional(),
    target: z.array(z.any()).optional(),
    steps: z.array(z.any()).optional(),
    extensions: z.record(z.any()).optional(),
  }).optional(),
});

export const xapiStatementSchema = z.object({
  id: z.string().uuid().optional(),
  actor: xapiAgentSchema,
  verb: xapiVerbSchema,
  object: xapiObjectSchema,
  result: z.object({
    score: z.object({
      scaled: z.number().min(-1).max(1).optional(),
      raw: z.number().optional(),
      min: z.number().optional(),
      max: z.number().optional(),
    }).optional(),
    success: z.boolean().optional(),
    completion: z.boolean().optional(),
    response: z.string().optional(),
    duration: z.string().optional(),
    extensions: z.record(z.any()).optional(),
  }).optional(),
  context: z.object({
    registration: z.string().uuid().optional(),
    instructor: xapiAgentSchema.optional(),
    team: z.any().optional(),
    contextActivities: z.any().optional(),
    revision: z.string().optional(),
    platform: z.string().optional(),
    language: z.string().optional(),
    statement: z.any().optional(),
    extensions: z.record(z.any()).optional(),
  }).optional(),
  timestamp: z.string().datetime().optional(),
  stored: z.string().datetime().optional(),
  authority: xapiAgentSchema.optional(),
  version: z.string().optional(),
  attachments: z.array(z.any()).optional(),
});

// ============================================================================
// Custom Verb Schema
// ============================================================================

export const customVerbSchema = z.object({
  verbId: z.string().url('Verb ID must be a valid URL'),
  config: z.object({
    category: z.enum(['completion', 'progress', 'interaction', 'assessment', 'social', 'other']),
    action: z.string().min(1).max(100),
    description: z.string().min(1).max(500),
    customHandler: z.any().optional(),
  }),
});

// ============================================================================
// Module Rules Schema
// ============================================================================

export const moduleRuleSchema = z.object({
  moduleId: z.string().min(1).max(100),
  moduleName: z.string().max(200).optional(),
  matchType: z.enum(['prefix', 'contains', 'exact']).default('prefix'),
  matchValue: z.string().max(500).optional(), // Allow empty for newly created rules
  completionVerbs: z.array(z.string().min(1).max(500)).optional().default([]), // Accept verb names or full URLs
  scoreThreshold: z.number().min(0).max(100).nullable().optional(),
});

export const moduleRulesSchema = z.object({
  rules: z.array(moduleRuleSchema),
});

// ============================================================================
// Provider Schemas
// ============================================================================

export const providerSchema = z.object({
  name: z.string()
    .min(1, 'Provider name is required')
    .max(200, 'Provider name must be less than 200 characters')
    .transform(val => val.trim())
});

export const providerCourseSchema = z.object({
  courseId: z.string()
    .min(1, 'Course ID is required')
    .max(100, 'Course ID must be less than 100 characters')
});

export const userProviderSchema = z.object({
  providerId: z.string().max(100).nullable().optional()
});

// User Roles Schema
const roleNameSchema = z.enum([
  'learner',
  'admin',
  'manager',
  'coordinator',
  'learningCoordinator',
  'coach',
  'instructionalCoach',
  'corporate',
  'hr'
]);

export const userRolesSchema = z.object({
  role: roleNameSchema.optional(),
  roles: z.array(roleNameSchema).optional(),
  flags: z.object({
    isAdmin: z.boolean().optional(),
    isManager: z.boolean().optional(),
    isCoordinator: z.boolean().optional(),
    isLearningCoordinator: z.boolean().optional(),
    isCoach: z.boolean().optional(),
    isInstructionalCoach: z.boolean().optional(),
    isCorporate: z.boolean().optional(),
    isHr: z.boolean().optional(),
    isLearner: z.boolean().optional()
  }).optional()
}).refine((data) => data.role || data.roles || data.flags, {
  message: 'At least one of role, roles, or flags must be provided.'
});

// ============================================================================
// Query Parameter Schemas
// ============================================================================

export const courseIdParamSchema = z.string()
  .min(1, 'Course ID is required')
  .max(100, 'Course ID must be less than 100 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Course ID must only contain alphanumeric characters, underscores, and hyphens');

export const userIdParamSchema = z.string()
  .min(1, 'User ID is required')
  .max(255, 'User ID must be less than 255 characters');

// ============================================================================
// Validation Helper
// ============================================================================

/**
 * Validate request body against schema
 * @param {z.ZodSchema} schema - Zod schema to validate against
 * @param {any} data - Data to validate
 * @returns {{ success: boolean, data?: any, error?: string }}
 */
export function validate(schema, data) {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const messages = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return { success: false, error: messages };
    }
    return { success: false, error: 'Validation failed' };
  }
}

/**
 * Express middleware for body validation
 * @param {z.ZodSchema} schema - Zod schema to validate against
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const result = validate(schema, req.body);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    req.body = result.data;
    next();
  };
}

/**
 * Express middleware for query validation
 * @param {z.ZodSchema} schema - Zod schema to validate against
 */
export function validateQuery(schema) {
  return (req, res, next) => {
    const result = validate(schema, req.query);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    req.query = result.data;
    next();
  };
}

/**
 * Express middleware for params validation
 * @param {z.ZodSchema} schema - Zod schema to validate against
 */
export function validateParams(schema) {
  return (req, res, next) => {
    const result = validate(schema, req.params);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    req.params = result.data;
    next();
  };
}
