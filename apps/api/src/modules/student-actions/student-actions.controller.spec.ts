import { Test, TestingModule } from '@nestjs/testing';
import { StudentActionsController } from './student-actions.controller';
import { StudentActionsService } from './student-actions.service';
import { BadRequestException } from '@nestjs/common';

describe('StudentActionsController', () => {
  let controller: StudentActionsController;
  let service: jest.Mocked<StudentActionsService>;

  beforeEach(async () => {
    const mockService = {
      getSavedProperties: jest.fn(),
      saveProperty: jest.fn(),
      unsaveProperty: jest.fn(),
      createEnquiry: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StudentActionsController],
      providers: [
        {
          provide: StudentActionsService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<StudentActionsController>(StudentActionsController);
    service = module.get(StudentActionsService);
  });

  describe('createEnquiry', () => {
    it('should throw BadRequestException when message is missing or empty', async () => {
      const req = { user: { id: 'student-123' } };

      await expect(
        controller.createEnquiry('prop-1', { message: '' } as any, req),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.createEnquiry('prop-1', {} as any, req),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.createEnquiry('prop-1', null as any, req),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when message is not a string', async () => {
      const req = { user: { id: 'student-123' } };

      await expect(
        controller.createEnquiry('prop-1', { message: 12345 } as any, req),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.createEnquiry('prop-1', { message: true } as any, req),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.createEnquiry('prop-1', { message: {} } as any, req),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully create an enquiry when message is valid', async () => {
      const req = { user: { id: 'student-123' } };
      const mockResult = {
        id: 'enquiry-1',
        studentId: 'student-123',
        propertyId: 'prop-1',
        message: 'Is this room still available?',
        roomTypeId: 'room-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      service.createEnquiry.mockResolvedValue(mockResult as any);

      const result = await controller.createEnquiry(
        'prop-1',
        { message: 'Is this room still available?', roomTypeId: 'room-1' },
        req,
      );

      expect(service.createEnquiry).toHaveBeenCalledWith(
        'student-123',
        'prop-1',
        'Is this room still available?',
        'room-1',
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('saved properties', () => {
    it('should delegate getSavedProperties to service', async () => {
      const req = { user: { id: 'student-123' } };
      service.getSavedProperties.mockResolvedValue([{ id: 'prop-1' }] as any);

      const result = await controller.getSavedProperties(req);
      expect(service.getSavedProperties).toHaveBeenCalledWith('student-123');
      expect(result).toEqual([{ id: 'prop-1' }]);
    });

    it('should delegate saveProperty to service', async () => {
      const req = { user: { id: 'student-123' } };
      service.saveProperty.mockResolvedValue({ id: 'saved-1' } as any);

      const result = await controller.saveProperty('prop-1', req);
      expect(service.saveProperty).toHaveBeenCalledWith('student-123', 'prop-1');
      expect(result).toEqual({ id: 'saved-1' });
    });

    it('should delegate unsaveProperty to service', async () => {
      const req = { user: { id: 'student-123' } };
      service.unsaveProperty.mockResolvedValue({ success: true } as any);

      const result = await controller.unsaveProperty('prop-1', req);
      expect(service.unsaveProperty).toHaveBeenCalledWith('student-123', 'prop-1');
      expect(result).toEqual({ success: true });
    });
  });
});
