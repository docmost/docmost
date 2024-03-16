import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { UserRepository } from './repositories/user.repository';
import { User } from './entities/user.entity';
import { BadRequestException } from '@nestjs/common';
import { CreateUserDto } from '../auth/dto/create-user.dto';

describe('UserService', () => {
  let userService: UserService;
  let userRepository: any;

  const mockUserRepository = () => ({
    findByEmail: jest.fn(),
    save: jest.fn(),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: UserRepository,
          useFactory: mockUserRepository,
        },
      ],
    }).compile();

    userService = module.get<UserService>(UserService);
    userRepository = module.get<UserRepository>(UserRepository);
  });

  it('should be defined', () => {
    expect(userService).toBeDefined();
    expect(userRepository).toBeDefined();
  });

  describe('create', () => {
    const createUserDto: CreateUserDto = {
      name: 'John Doe',
      email: 'test@test.com',
      password: 'password',
    };

    it('should throw an error if a user with this email already exists', async () => {
      userRepository.findByEmail.mockResolvedValue(new User());
      await expect(userService.create(createUserDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create the user if it does not already exist', async () => {
      const savedUser = {
        ...createUserDto,
        id: expect.any(String),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
        lastLoginAt: expect.any(Date),
        locale: 'en',
        emailVerifiedAt: null,
        avatar_url: null,
        timezone: null,
        settings: null,
        lastLoginIp: null,
      };

      //userRepository.findByEmail.mockResolvedValue(undefined);
      userRepository.save.mockResolvedValue(savedUser);

      const result = await userService.create(createUserDto);
      expect(result).toMatchObject(savedUser);

      expect(userRepository.save).toHaveBeenCalledWith(
        expect.objectContaining(createUserDto),
      );
    });
  });
});
