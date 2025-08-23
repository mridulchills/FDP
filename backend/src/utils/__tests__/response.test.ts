import { Response } from 'express';
import {
  successResponse,
  errorResponse,
  paginatedResponse,
  createdResponse,
  notFoundResponse,
  validationErrorResponse,
  unauthorizedResponse,
  forbiddenResponse
} from '../response';

describe('Response Utilities', () => {
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  describe('successResponse', () => {
    it('should send success response with data', () => {
      const data = { id: 1, name: 'Test' };
      const message = 'Success';

      successResponse(mockResponse as Response, data, message);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data,
        message,
        timestamp: expect.any(String)
      });
    });

    it('should send success response without message', () => {
      const data = { id: 1, name: 'Test' };

      successResponse(mockResponse as Response, data);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data,
        timestamp: expect.any(String)
      });
    });

    it('should send success response without data', () => {
      const message = 'Operation completed';

      successResponse(mockResponse as Response, undefined, message);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message,
        timestamp: expect.any(String)
      });
    });
  });

  describe('errorResponse', () => {
    it('should send error response with custom status', () => {
      const error = 'Something went wrong';
      const statusCode = 400;

      errorResponse(mockResponse as Response, error, statusCode);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error,
        timestamp: expect.any(String)
      });
    });

    it('should send error response with default status 500', () => {
      const error = 'Internal error';

      errorResponse(mockResponse as Response, error);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error,
        timestamp: expect.any(String)
      });
    });

    it('should send error response with details', () => {
      const error = 'Validation failed';
      const details = [{ field: 'name', message: 'Required' }];

      errorResponse(mockResponse as Response, error, 400, details);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error,
        details,
        timestamp: expect.any(String)
      });
    });
  });

  describe('paginatedResponse', () => {
    it('should send paginated response', () => {
      const data = [{ id: 1 }, { id: 2 }];
      const pagination = {
        page: 1,
        limit: 10,
        total: 25,
        totalPages: 3
      };

      paginatedResponse(mockResponse as Response, data, pagination);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data,
        pagination,
        timestamp: expect.any(String)
      });
    });

    it('should send paginated response with message', () => {
      const data = [{ id: 1 }];
      const pagination = {
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1
      };
      const message = 'Users retrieved';

      paginatedResponse(mockResponse as Response, data, pagination, message);

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data,
        pagination,
        message,
        timestamp: expect.any(String)
      });
    });
  });

  describe('createdResponse', () => {
    it('should send created response', () => {
      const data = { id: 1, name: 'New Item' };
      const message = 'Item created';

      createdResponse(mockResponse as Response, data, message);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data,
        message,
        timestamp: expect.any(String)
      });
    });

    it('should send created response without message', () => {
      const data = { id: 1, name: 'New Item' };

      createdResponse(mockResponse as Response, data);

      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data,
        timestamp: expect.any(String)
      });
    });
  });

  describe('notFoundResponse', () => {
    it('should send not found response with custom message', () => {
      const message = 'User not found';

      notFoundResponse(mockResponse as Response, message);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: message,
        timestamp: expect.any(String)
      });
    });

    it('should send not found response with default message', () => {
      notFoundResponse(mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Resource not found',
        timestamp: expect.any(String)
      });
    });
  });

  describe('validationErrorResponse', () => {
    it('should send validation error response', () => {
      const errors = [
        { field: 'name', message: 'Name is required' },
        { field: 'email', message: 'Invalid email format' }
      ];

      validationErrorResponse(mockResponse as Response, errors);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation failed',
        details: errors,
        timestamp: expect.any(String)
      });
    });
  });

  describe('unauthorizedResponse', () => {
    it('should send unauthorized response with custom message', () => {
      const message = 'Invalid token';

      unauthorizedResponse(mockResponse as Response, message);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: message,
        timestamp: expect.any(String)
      });
    });

    it('should send unauthorized response with default message', () => {
      unauthorizedResponse(mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Unauthorized',
        timestamp: expect.any(String)
      });
    });
  });

  describe('forbiddenResponse', () => {
    it('should send forbidden response with custom message', () => {
      const message = 'Access denied';

      forbiddenResponse(mockResponse as Response, message);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: message,
        timestamp: expect.any(String)
      });
    });

    it('should send forbidden response with default message', () => {
      forbiddenResponse(mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Forbidden',
        timestamp: expect.any(String)
      });
    });
  });
});