import { ArgumentMetadata, BadRequestException, ValidationPipe } from '@nestjs/common';
import { OnboardingController } from './onboarding.controller';
import { ResetDashboardOnboardingDto } from './dtos/onboarding.dto';

describe('OnboardingController & ResetDashboardOnboardingDto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  const metadata: ArgumentMetadata = {
    type: 'body',
    metatype: ResetDashboardOnboardingDto,
  };

  it('accepts valid tutorialVersion', async () => {
    const result = await pipe.transform({ tutorialVersion: 2 }, metadata);
    expect(result).toBeInstanceOf(ResetDashboardOnboardingDto);
    expect(result.tutorialVersion).toBe(2);
  });

  it('accepts missing optional tutorialVersion', async () => {
    const result = await pipe.transform({}, metadata);
    expect(result).toBeInstanceOf(ResetDashboardOnboardingDto);
    expect(result.tutorialVersion).toBeUndefined();
  });

  it('rejects zero and negative tutorialVersion', async () => {
    await expect(pipe.transform({ tutorialVersion: 0 }, metadata)).rejects.toThrow(
      BadRequestException,
    );
    await expect(pipe.transform({ tutorialVersion: -3 }, metadata)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects non-numeric string tutorialVersion under existing transform policy', async () => {
    await expect(pipe.transform({ tutorialVersion: '1' }, metadata)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects unexpected properties via forbidNonWhitelisted', async () => {
    await expect(
      pipe.transform({ tutorialVersion: 1, userId: 'evil-override' }, metadata),
    ).rejects.toThrow(BadRequestException);
  });

  it('delegates resetDashboardState using authenticated req.user.id', async () => {
    const mockService = {
      resetState: jest.fn().mockResolvedValue({ status: 'IN_PROGRESS' }),
    };
    const controller = new OnboardingController(mockService as any);
    const res = await controller.resetDashboardState(
      { user: { id: 'usr-auth-1' } },
      'RETAIL',
      { tutorialVersion: 2 },
    );
    expect(mockService.resetState).toHaveBeenCalledWith('usr-auth-1', 'RETAIL', 2);
    expect(res).toEqual({ status: 'IN_PROGRESS' });
  });
});
