import * as Joi from 'joi';

export const environmentSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().uri({ scheme: ['postgres', 'postgresql'] }).required(),
  FRONTEND_URL: Joi.string().uri().required(),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).invalid(Joi.ref('JWT_ACCESS_SECRET')).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().required(),
  COOKIE_DOMAIN: Joi.string().allow('').optional(),
  COOKIE_SECURE: Joi.boolean().truthy('true').falsy('false').default(false),
  REDIS_URL: Joi.string().uri({ scheme: ['redis', 'rediss'] }).required(),
  THROTTLE_TTL: Joi.number().integer().min(1000).default(60000),
  THROTTLE_LIMIT: Joi.number().integer().min(1).default(100),
  SMS_ENABLED: Joi.boolean().truthy('true').falsy('false').default(false),
  SMS_PROVIDER: Joi.string().allow('').when('SMS_ENABLED', { is: true, then: Joi.required(), otherwise: Joi.optional() }),
  SMS_API_URL: Joi.string().allow('').when('SMS_ENABLED', { is: true, then: Joi.string().uri().required(), otherwise: Joi.optional() }),
  SMS_API_KEY: Joi.string().allow('').when('SMS_ENABLED', { is: true, then: Joi.required(), otherwise: Joi.optional() }),
  SMS_SENDER: Joi.string().allow('').when('SMS_ENABLED', { is: true, then: Joi.required(), otherwise: Joi.optional() }),
}).unknown(true);
