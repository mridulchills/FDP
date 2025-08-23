/**
 * API Versioning Utilities
 * 
 * Provides API versioning support for the FDTS API.
 */

import { Request, Response, NextFunction, Router } from 'express';

// Supported API versions
export enum ApiVersion {
  V1 = 'v1',
  V2 = 'v2'
}

// Version configuration
export interface VersionConfig {
  version: ApiVersion;
  deprecated?: boolean;
  deprecationDate?: Date;
  sunsetDate?: Date;
  description?: string;
}

// Version registry
const versionRegistry = new Map<ApiVersion, VersionConfig>();

/**
 * Register an API version
 */
export function registerVersion(config: VersionConfig) {
  versionRegistry.set(config.version, config);
}

/**
 * Get version configuration
 */
export function getVersionConfig(version: ApiVersion): VersionConfig | undefined {
  return versionRegistry.get(version);
}

/**
 * Get all registered versions
 */
export function getAllVersions(): VersionConfig[] {
  return Array.from(versionRegistry.values());
}

/**
 * Extract API version from request
 */
export function extractVersion(req: Request): ApiVersion {
  // Check URL path first (/api/v1/...)
  const pathMatch = req.path.match(/^\/api\/(v\d+)\//);
  if (pathMatch) {
    const version = pathMatch[1] as ApiVersion;
    if (versionRegistry.has(version)) {
      return version;
    }
  }

  // Check Accept header (application/vnd.fdts.v1+json)
  const acceptHeader = req.headers.accept;
  if (acceptHeader) {
    const headerMatch = acceptHeader.match(/application\/vnd\.fdts\.(v\d+)\+json/);
    if (headerMatch) {
      const version = headerMatch[1] as ApiVersion;
      if (versionRegistry.has(version)) {
        return version;
      }
    }
  }

  // Check custom version header
  const versionHeader = req.headers['api-version'] as string;
  if (versionHeader && versionRegistry.has(versionHeader as ApiVersion)) {
    return versionHeader as ApiVersion;
  }

  // Default to v1
  return ApiVersion.V1;
}

/**
 * Version middleware
 */
export function versionMiddleware(req: Request, res: Response, next: NextFunction) {
  const version = extractVersion(req);
  const config = getVersionConfig(version);

  if (!config) {
    return res.status(400).json({
      success: false,
      error: `Unsupported API version: ${version}`,
      supportedVersions: Array.from(versionRegistry.keys()),
      timestamp: new Date().toISOString()
    });
  }

  // Add version info to request
  req.apiVersion = version;
  req.versionConfig = config;

  // Add version headers to response
  res.setHeader('API-Version', version);
  res.setHeader('API-Supported-Versions', Array.from(versionRegistry.keys()).join(', '));

  // Add deprecation warnings if applicable
  if (config.deprecated) {
    res.setHeader('API-Deprecated', 'true');
    
    if (config.deprecationDate) {
      res.setHeader('API-Deprecation-Date', config.deprecationDate.toISOString());
    }
    
    if (config.sunsetDate) {
      res.setHeader('API-Sunset-Date', config.sunsetDate.toISOString());
    }

    // Add deprecation warning to response
    const originalJson = res.json;
    res.json = function(obj: any) {
      if (typeof obj === 'object' && obj !== null) {
        obj._deprecation = {
          message: `API version ${version} is deprecated`,
          deprecationDate: config.deprecationDate?.toISOString(),
          sunsetDate: config.sunsetDate?.toISOString()
        };
      }
      return originalJson.call(this, obj);
    };
  }

  return next();
}

/**
 * Create versioned router
 */
export function createVersionedRouter(version: ApiVersion): Router {
  const router = Router();
  
  // Add version-specific middleware
  router.use((req: Request, _res: Response, next: NextFunction) => {
    req.apiVersion = version;
    req.versionConfig = getVersionConfig(version)!;
    next();
  });

  return router;
}

/**
 * Version compatibility checker
 */
export function isVersionCompatible(
  requestedVersion: ApiVersion,
  supportedVersions: ApiVersion[]
): boolean {
  return supportedVersions.includes(requestedVersion);
}

/**
 * Get latest version
 */
export function getLatestVersion(): ApiVersion {
  const versions = Array.from(versionRegistry.keys());
  return versions.sort().reverse()[0] || ApiVersion.V1;
}

/**
 * Version migration helper
 */
export interface VersionMigration {
  from: ApiVersion;
  to: ApiVersion;
  migrate: (data: any) => any;
}

const migrations = new Map<string, VersionMigration>();

/**
 * Register version migration
 */
export function registerMigration(migration: VersionMigration) {
  const key = `${migration.from}->${migration.to}`;
  migrations.set(key, migration);
}

/**
 * Migrate data between versions
 */
export function migrateData(
  data: any,
  fromVersion: ApiVersion,
  toVersion: ApiVersion
): any {
  const key = `${fromVersion}->${toVersion}`;
  const migration = migrations.get(key);
  
  if (migration) {
    return migration.migrate(data);
  }
  
  return data; // No migration needed
}

// Request interface is now declared in types/express.d.ts

// Initialize default versions
registerVersion({
  version: ApiVersion.V1,
  description: 'Initial API version'
});

registerVersion({
  version: ApiVersion.V2,
  description: 'Enhanced API version with improved response formats'
});