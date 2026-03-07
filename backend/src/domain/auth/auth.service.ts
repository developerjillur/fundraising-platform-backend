import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Admin } from './admin.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Admin) private adminRepo: Repository<Admin>,
    private jwtService: JwtService,
  ) {}

  async register(email: string, password: string) {
    const existing = await this.adminRepo.findOne({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');
    const hash = await bcrypt.hash(password, 10);
    const admin = this.adminRepo.create({ email, password_hash: hash, role: 'admin' });
    await this.adminRepo.save(admin);
    return this.buildTokenResponse(admin);
  }

  async login(email: string, password: string) {
    const admin = await this.adminRepo.findOne({ where: { email } });
    if (!admin) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    return this.buildTokenResponse(admin);
  }

  async getProfile(userId: string) {
    const admin = await this.adminRepo.findOne({ where: { id: userId } });
    if (!admin) throw new UnauthorizedException('User not found');
    return { id: admin.id, email: admin.email, role: admin.role };
  }

  private buildTokenResponse(admin: Admin) {
    const payload = { sub: admin.id, email: admin.email, role: admin.role };
    return {
      access_token: this.jwtService.sign(payload),
      user: { id: admin.id, email: admin.email, role: admin.role },
    };
  }
}
