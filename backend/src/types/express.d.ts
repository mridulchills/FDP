import { JwtPayload } from './index.js';
import { ApiVersion, VersionConfig } from '../utils/versioning.js';
import { QueryParams } from '../utils/pagination.js';
import { ResponseSender } from '../utils/response.js';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      requestId: string;
      queryParams: QueryParams;
      apiVersion: ApiVersion;
      versionConfig: VersionConfig;
    }
    
    interface Response {
      respond: ResponseSender;
    }
  }
}