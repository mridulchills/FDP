// Base repository
export { BaseRepository } from './base-repository.js';

// Specific repositories
export { UserRepository } from './user-repository.js';
export { SubmissionRepository } from './submission-repository.js';
export { DepartmentRepository } from './department-repository.js';

// Import classes for instances
import { UserRepository } from './user-repository.js';
import { SubmissionRepository } from './submission-repository.js';
import { DepartmentRepository } from './department-repository.js';

// Repository instances (singletons)
const userRepository = new UserRepository();
const submissionRepository = new SubmissionRepository();
const departmentRepository = new DepartmentRepository();

export { userRepository, submissionRepository, departmentRepository };

// Utility exports
export { 
  QueryBuilder, 
  createQueryBuilder, 
  PreparedStatement, 
  SqlSanitizer 
} from '../utils/query-builder.js';

export { 
  TransactionManager, 
  TransactionContext, 
  TransactionUtils,
  IsolationLevel,
  withTransaction,
  type TransactionOptions 
} from '../utils/transaction-manager.js';