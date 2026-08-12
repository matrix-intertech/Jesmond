import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterProviderDto, RegisterStudentDto, LoginDto } from '../dtos/auth.dto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UserRole, AccountStatus, OrgType } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async registerProvider(dto: RegisterProviderDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('Email already in use.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create Organization
      const org = await tx.organization.create({
        data: {
          name: dto.organizationName,
          type: dto.organizationType,
          status: 'PENDING',
        },
      });

      // 2. Create User
      const user = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          password: hashedPassword,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: UserRole.ORG_STAFF,
          accountStatus: AccountStatus.ACTIVE, // Normally PENDING_VERIFICATION, but making ACTIVE for testing/immediate use
        },
      });

      // 3. Link via OrgStaff
      await tx.orgStaff.create({
        data: {
          userId: user.id,
          organizationId: org.id,
          role: UserRole.ORG_STAFF,
          permissions: ['*'],
        },
      });

      return { user, org };
    });

    const payload = { sub: result.user.id, email: result.user.email, role: result.user.role };
    const access_token = this.jwtService.sign(payload);

    return {
      message: 'Provider registered successfully',
      access_token,
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        role: result.user.role,
        organizationId: result.org.id,
      },
    };
  }

  async registerStudent(dto: RegisterStudentDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException('Email already in use.');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: UserRole.STUDENT,
        accountStatus: AccountStatus.ACTIVE,
      },
    });

    const payload = { sub: user.id, email: user.email, role: user.role };
    const access_token = this.jwtService.sign(payload);

    return {
      message: 'Student registered successfully',
      access_token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: {
        orgStaffRoles: {
          include: { organization: true },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.accountStatus === AccountStatus.SUSPENDED || user.accountStatus === AccountStatus.DEACTIVATED) {
      throw new UnauthorizedException('Account is suspended or deactivated');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email, role: user.role };
    const access_token = this.jwtService.sign(payload);

    const organizationId = user.orgStaffRoles.length > 0 ? user.orgStaffRoles[0].organizationId : undefined;

    return {
      access_token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId,
      },
    };
  }
}
