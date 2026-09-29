import { Injectable } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}
  findUserByPhone(phone: string): Promise<User | null> { return this.prisma.user.findUnique({ where: { phone } }); }
  findUserById(id: string): Promise<User | null> { return this.prisma.user.findUnique({ where: { id } }); }
  updateUser(id: string, data: Prisma.UserUpdateInput): Promise<User> { return this.prisma.user.update({ where: { id }, data }); }
}
