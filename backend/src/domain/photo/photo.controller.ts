import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiConsumes } from '@nestjs/swagger';
import { PhotoService } from './photo.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('photos')
@Controller('photos')
export class PhotoController {
  constructor(private photoService: PhotoService) {}

  @Get('packages')
  @ApiOperation({ summary: 'Get active photo packages (public)' })
  @ApiResponse({ status: 200, description: 'List of active photo packages returned successfully.' })
  getPackages() {
    return this.photoService.getActivePackages();
  }

  @Post('reupload/:supporterId')
  @ApiOperation({ summary: 'Re-upload a photo after moderation rejection (public)' })
  @ApiParam({ name: 'supporterId', description: 'Supporter ID from rejection email' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      cb(null, allowed.includes(file.mimetype));
    },
  }))
  async reuploadPhoto(
    @Param('supporterId') supporterId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) return { error: 'No valid file uploaded' };
    return this.photoService.reuploadPhoto(supporterId, file);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload a photo (public, multipart)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Photo file to upload (max 10MB, jpeg/png/gif/webp)',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file (jpeg, png, gif, webp)',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ status: 201, description: 'Photo uploaded successfully.' })
  @ApiResponse({ status: 400, description: 'No valid file uploaded or unsupported file type.' })
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      cb(null, allowed.includes(file.mimetype));
    },
  }))
  async uploadPhoto(@UploadedFile() file: Express.Multer.File) {
    if (!file) return { error: 'No valid file uploaded' };
    const result = await this.photoService.moderateAndSave(file);
    return {
      path: result.path,
      url: result.url,
      moderation_status: result.moderation.approved ? 'approved' : 'rejected',
      moderation_reason: result.moderation.reason,
    };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('packages/all')
  @ApiOperation({ summary: 'Get all photo packages including inactive (JWT required)' })
  @ApiResponse({ status: 200, description: 'List of all photo packages returned successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized. JWT token missing or invalid.' })
  getAllPackages() {
    return this.photoService.getAllPackages();
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('packages')
  @ApiOperation({ summary: 'Create a new photo package (JWT required)' })
  @ApiBody({
    description: 'Photo package data',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Package name' },
        description: { type: 'string', description: 'Package description' },
        price: { type: 'number', description: 'Package price' },
        is_active: { type: 'boolean', description: 'Whether the package is active' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Photo package created successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized. JWT token missing or invalid.' })
  createPackage(@Body() data: any) {
    return this.photoService.createPackage(data);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Put('packages/:id')
  @ApiOperation({ summary: 'Update an existing photo package (JWT required)' })
  @ApiParam({ name: 'id', description: 'Photo package ID', type: 'string' })
  @ApiBody({
    description: 'Updated photo package data',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Package name' },
        description: { type: 'string', description: 'Package description' },
        price: { type: 'number', description: 'Package price' },
        is_active: { type: 'boolean', description: 'Whether the package is active' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Photo package updated successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized. JWT token missing or invalid.' })
  @ApiResponse({ status: 404, description: 'Photo package not found.' })
  updatePackage(@Param('id') id: string, @Body() data: any) {
    return this.photoService.updatePackage(id, data);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('packages/:id')
  @ApiOperation({ summary: 'Delete a photo package (JWT required)' })
  @ApiParam({ name: 'id', description: 'Photo package ID', type: 'string' })
  @ApiResponse({ status: 200, description: 'Photo package deleted successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized. JWT token missing or invalid.' })
  @ApiResponse({ status: 404, description: 'Photo package not found.' })
  deletePackage(@Param('id') id: string) {
    return this.photoService.deletePackage(id);
  }
}
