/**
 * Query Parser Utility
 * Provides helper functions for parsing and validating query parameters
 */

import { QueryOptions } from '../../types/common';

/**
 * Parse pagination options from query parameters
 */
export function parsePaginationOptions(query: any): QueryOptions {
  const limit = parseInt(query.limit as string) || 20;
  const offset = parseInt(query.offset as string) || 0;
  const page = parseInt(query.page as string) || 1;
  
  return {
    limit: Math.min(Math.max(limit, 1), 100), // Limit between 1-100
    skip: offset || (page - 1) * limit, // TypeORM uses 'skip' not 'offset'
    nextToken: query.nextToken as string,
  };
}

/**
 * Parse sort options from query parameters
 */
export function parseSortOptions(query: any, allowedFields: string[] = []): { field: string; order: 'ASC' | 'DESC' } | undefined {
  const sortField = query.sortBy || query.sort_by;
  const sortOrder = (query.sortOrder || query.sort_order || 'DESC').toUpperCase();
  
  if (!sortField) {
    return undefined;
  }
  
  // Validate sort field if allowed fields are specified
  if (allowedFields.length > 0 && !allowedFields.includes(sortField)) {
    return undefined;
  }
  
  return {
    field: sortField,
    order: sortOrder === 'ASC' ? 'ASC' : 'DESC',
  };
}

/**
 * Parse filter options from query parameters
 */
export function parseFilterOptions(query: any, allowedFilters: string[] = []): Record<string, any> {
  const filters: Record<string, any> = {};
  
  for (const key of allowedFilters) {
    if (query[key] !== undefined && query[key] !== '') {
      // Handle boolean values
      if (query[key] === 'true' || query[key] === 'false') {
        filters[key] = query[key] === 'true';
      }
      // Handle arrays
      else if (query[key].includes(',')) {
        filters[key] = query[key].split(',').map((v: string) => v.trim());
      }
      // Handle regular values
      else {
        filters[key] = query[key];
      }
    }
  }
  
  return filters;
}

/**
 * Parse date range from query parameters
 */
export function parseDateRange(query: any): { startDate?: Date; endDate?: Date } {
  const result: { startDate?: Date; endDate?: Date } = {};
  
  if (query.startDate || query.start_date || query.from) {
    const dateStr = query.startDate || query.start_date || query.from;
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      result.startDate = date;
    }
  }
  
  if (query.endDate || query.end_date || query.to) {
    const dateStr = query.endDate || query.end_date || query.to;
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      result.endDate = date;
    }
  }
  
  return result;
}

/**
 * Parse search query from query parameters
 */
export function parseSearchQuery(query: any): string | undefined {
  return query.search || query.q || query.query || undefined;
}

/**
 * Parse boolean value from query parameter
 */
export function parseBoolean(value: any): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  
  if (typeof value === 'boolean') {
    return value;
  }
  
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (lower === 'true' || lower === '1' || lower === 'yes') {
      return true;
    }
    if (lower === 'false' || lower === '0' || lower === 'no') {
      return false;
    }
  }
  
  return undefined;
}

/**
 * Parse array from query parameter
 */
export function parseArray(value: any, delimiter = ','): string[] {
  if (!value) {
    return [];
  }
  
  if (Array.isArray(value)) {
    return value;
  }
  
  if (typeof value === 'string') {
    return value.split(delimiter).map(v => v.trim()).filter(v => v.length > 0);
  }
  
  return [];
}

/**
 * Parse numeric value from query parameter
 */
export function parseNumber(value: any, defaultValue?: number): number | undefined {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }
  
  const num = Number(value);
  if (isNaN(num)) {
    return defaultValue;
  }
  
  return num;
}

/**
 * Sanitize and validate query parameters
 */
export function sanitizeQuery(query: any, allowedParams: string[] = []): Record<string, any> {
  const sanitized: Record<string, any> = {};
  
  for (const key of allowedParams) {
    if (query[key] !== undefined) {
      sanitized[key] = query[key];
    }
  }
  
  return sanitized;
}