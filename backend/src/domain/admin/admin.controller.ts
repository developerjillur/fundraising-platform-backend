import { Controller, Get, Put, Post, Delete, Body, Param, Query, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody, ApiParam, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { FundraisingService } from '../fundraising/fundraising.service';
import { StreamService } from '../stream/stream.service';
import { MerchandiseService } from '../merchandise/merchandise.service';
import { PhotoService } from '../photo/photo.service';
import { NotificationService } from '../notification/notification.service';
import { SettingsService } from '../settings/settings.service';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private fundraisingService: FundraisingService,
    private streamService: StreamService,
    private merchService: MerchandiseService,
    private photoService: PhotoService,
    private notificationService: NotificationService,
    private settingsService: SettingsService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get aggregated dashboard data' })
  @ApiResponse({ status: 200, description: 'Dashboard data including stats, supporters, orders, queue, customers, prize entries, packages, merchandise, and settings.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async getDashboard() {
    const [stats, supporters, orders, queue, customerStats, prizeEntries, packages, merchandise, settings] = await Promise.all([
      this.fundraisingService.getStats(),
      this.fundraisingService.getSupporters(),
      this.merchService.getOrders(),
      this.streamService.getFullQueue(),
      this.fundraisingService.getCustomerStats(),
      this.fundraisingService.getPrizeEntries(),
      this.photoService.getAllPackages(),
      this.merchService.getAllProducts(),
      this.settingsService.getAll(),
    ]);
    return { stats, supporters, orders, queue, customerStats, prizeEntries, packages, merchandise, settings };
  }

  @Get('supporters')
  @ApiOperation({ summary: 'List supporters' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum number of supporters to return (default: 200)' })
  @ApiResponse({ status: 200, description: 'List of supporters returned successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  getSupporters(@Query('limit') limit?: number) {
    return this.fundraisingService.getSupporters(limit || 200);
  }

  @Put('supporters/:id')
  @ApiOperation({ summary: 'Update a supporter' })
  @ApiParam({ name: 'id', description: 'Supporter ID' })
  @ApiBody({
    description: 'Supporter data to update',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Supporter name' },
        email: { type: 'string', description: 'Supporter email' },
        amount: { type: 'number', description: 'Donation amount' },
        message: { type: 'string', description: 'Supporter message' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Supporter updated successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Supporter not found.' })
  updateSupporter(@Param('id') id: string, @Body() data: any) {
    return this.fundraisingService.updateSupporter(id, data);
  }

  @Get('orders')
  @ApiOperation({ summary: 'List merchandise orders' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum number of orders to return (default: 200)' })
  @ApiResponse({ status: 200, description: 'List of orders returned successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  getOrders(@Query('limit') limit?: number) {
    return this.merchService.getOrders(limit || 200);
  }

  @Put('orders/:id')
  @ApiOperation({ summary: 'Update an order' })
  @ApiParam({ name: 'id', description: 'Order ID' })
  @ApiBody({
    description: 'Order data to update',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Order status' },
        tracking_number: { type: 'string', description: 'Shipping tracking number' },
        notes: { type: 'string', description: 'Admin notes' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Order updated successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Order not found.' })
  updateOrder(@Param('id') id: string, @Body() data: any) {
    return this.merchService.updateOrder(id, data);
  }

  @Get('queue')
  @ApiOperation({ summary: 'Get the full stream queue' })
  @ApiResponse({ status: 200, description: 'Full queue returned successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  getQueue() {
    return this.streamService.getFullQueue();
  }

  @Put('queue/:id')
  @ApiOperation({ summary: 'Update a queue item' })
  @ApiParam({ name: 'id', description: 'Queue item ID' })
  @ApiBody({
    description: 'Queue item data to update',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Queue item status' },
        position: { type: 'number', description: 'Position in queue' },
        message: { type: 'string', description: 'Display message' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Queue item updated successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Queue item not found.' })
  updateQueueItem(@Param('id') id: string, @Body() data: any) {
    return this.streamService.updateQueueItem(id, data);
  }

  @Post('queue/:id/skip')
  @ApiOperation({ summary: 'Skip a queue item' })
  @ApiParam({ name: 'id', description: 'Queue item ID' })
  @ApiResponse({ status: 201, description: 'Queue item skipped successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Queue item not found.' })
  skipQueueItem(@Param('id') id: string) {
    return this.streamService.skipQueueItem(id);
  }

  @Post('queue/:id/requeue')
  @ApiOperation({ summary: 'Requeue a previously skipped or completed item' })
  @ApiParam({ name: 'id', description: 'Queue item ID' })
  @ApiResponse({ status: 201, description: 'Item requeued successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Queue item not found.' })
  requeueItem(@Param('id') id: string) {
    return this.streamService.requeueItem(id);
  }

  @Delete('queue/displayed')
  @ApiOperation({ summary: 'Clear all displayed queue items' })
  @ApiResponse({ status: 200, description: 'Displayed items cleared successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  clearDisplayed() {
    return this.streamService.clearDisplayed();
  }

  @Post('queue/pause')
  @ApiOperation({ summary: 'Toggle queue pause state' })
  @ApiBody({
    description: 'Pause state',
    schema: {
      type: 'object',
      required: ['paused'],
      properties: {
        paused: { type: 'boolean', description: 'Whether the queue should be paused' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Queue pause state toggled successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  async togglePause(@Body() body: { paused: boolean }) {
    await this.settingsService.set('stream_queue_paused', String(body.paused));
    return { paused: body.paused };
  }

  @Post('queue/swap')
  @ApiOperation({ summary: 'Swap positions of two queue items' })
  @ApiBody({
    description: 'IDs of two queue items to swap',
    schema: {
      type: 'object',
      required: ['id1', 'id2'],
      properties: {
        id1: { type: 'string', description: 'First queue item ID' },
        id2: { type: 'string', description: 'Second queue item ID' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Queue positions swapped successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  swapPositions(@Body() body: { id1: string; id2: string }) {
    return this.streamService.swapPositions(body.id1, body.id2);
  }

  @Get('customers')
  @ApiOperation({ summary: 'Get customer statistics' })
  @ApiResponse({ status: 200, description: 'Customer statistics returned successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  getCustomers() {
    return this.fundraisingService.getCustomerStats();
  }

  @Get('prize-entries')
  @ApiOperation({ summary: 'Get prize entries' })
  @ApiResponse({ status: 200, description: 'Prize entries returned successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  getPrizeEntries() {
    return this.fundraisingService.getPrizeEntries();
  }

  @Get('products')
  @ApiOperation({ summary: 'Get all products (including inactive)' })
  @ApiResponse({ status: 200, description: 'All products returned successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  getProducts() {
    return this.merchService.getAllProducts();
  }

  @Post('products')
  @ApiOperation({ summary: 'Create a new product' })
  @ApiBody({
    description: 'Product data',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Product name' },
        description: { type: 'string', description: 'Product description' },
        price: { type: 'number', description: 'Product price in cents' },
        image_url: { type: 'string', description: 'Product image URL' },
        active: { type: 'boolean', description: 'Whether the product is active' },
        variants: { type: 'array', description: 'Product variants', items: { type: 'object' } },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Product created successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  createProduct(@Body() data: any) {
    return this.merchService.createProduct(data);
  }

  @Put('products/:id')
  @ApiOperation({ summary: 'Update a product' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiBody({
    description: 'Product data to update',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Product name' },
        description: { type: 'string', description: 'Product description' },
        price: { type: 'number', description: 'Product price in cents' },
        image_url: { type: 'string', description: 'Product image URL' },
        active: { type: 'boolean', description: 'Whether the product is active' },
        variants: { type: 'array', description: 'Product variants', items: { type: 'object' } },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Product updated successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Product not found.' })
  updateProduct(@Param('id') id: string, @Body() data: any) {
    return this.merchService.updateProduct(id, data);
  }

  @Delete('products/:id')
  @ApiOperation({ summary: 'Delete a product' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product deleted successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Product not found.' })
  deleteProduct(@Param('id') id: string) {
    return this.merchService.deleteProduct(id);
  }

  @Post('products/upload-image')
  @ApiOperation({ summary: 'Upload a product image' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Product image file (max 10MB)',
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'Image file to upload' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Image uploaded successfully.' })
  @ApiResponse({ status: 400, description: 'No file provided.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 10 * 1024 * 1024 },
  }))
  async uploadProductImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) return { error: 'No file' };
    return this.photoService.saveUploadedFile(file);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get fundraising stats' })
  @ApiResponse({ status: 200, description: 'Stats returned successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  getStats() {
    return this.fundraisingService.getStats();
  }

  @Put('stats')
  @ApiOperation({ summary: 'Update fundraising stats' })
  @ApiBody({
    description: 'Stats data to update',
    schema: {
      type: 'object',
      properties: {
        total_raised: { type: 'number', description: 'Total amount raised' },
        goal: { type: 'number', description: 'Fundraising goal' },
        supporter_count: { type: 'number', description: 'Number of supporters' },
        burgers_eaten: { type: 'number', description: 'Number of burgers eaten' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Stats updated successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  updateStats(@Body() data: any) {
    return this.fundraisingService.updateStats(data);
  }

  @Get('email-templates')
  @ApiOperation({ summary: 'List email templates' })
  @ApiResponse({ status: 200, description: 'Email templates returned successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  getEmailTemplates() {
    return this.notificationService.getTemplates();
  }

  @Put('email-templates/:id')
  @ApiOperation({ summary: 'Update an email template' })
  @ApiParam({ name: 'id', description: 'Email template ID' })
  @ApiBody({
    description: 'Email template data to update',
    schema: {
      type: 'object',
      properties: {
        subject: { type: 'string', description: 'Email subject line' },
        body_html: { type: 'string', description: 'Email body in HTML' },
        body_text: { type: 'string', description: 'Email body in plain text' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Email template updated successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Template not found.' })
  updateEmailTemplate(@Param('id') id: string, @Body() data: any) {
    return this.notificationService.updateTemplate(id, data);
  }

  @Post('send-email')
  @ApiOperation({ summary: 'Send a templated email' })
  @ApiBody({
    description: 'Email sending parameters',
    schema: {
      type: 'object',
      required: ['template_key', 'to_email', 'to_name', 'variables'],
      properties: {
        template_key: { type: 'string', description: 'Template key to use' },
        to_email: { type: 'string', description: 'Recipient email address' },
        to_name: { type: 'string', description: 'Recipient name' },
        variables: { type: 'object', description: 'Template variable key-value pairs', additionalProperties: { type: 'string' } },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Email sent successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  sendEmail(@Body() body: { template_key: string; to_email: string; to_name: string; variables: Record<string, string> }) {
    return this.notificationService.sendTemplateEmail(body.template_key, body.to_email, body.to_name, body.variables);
  }

  @Post('notifications/send-email')
  @ApiOperation({ summary: 'Send a notification email' })
  @ApiBody({
    description: 'Notification email parameters',
    schema: {
      type: 'object',
      required: ['to', 'template_key', 'variables'],
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        template_key: { type: 'string', description: 'Template key to use' },
        variables: { type: 'object', description: 'Template variable key-value pairs', additionalProperties: { type: 'string' } },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Notification email sent successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  sendNotificationEmail(@Body() body: { to: string; template_key: string; variables: Record<string, string> }) {
    return this.notificationService.sendTemplateEmail(body.template_key, body.to, body.to?.split('@')[0] || 'User', body.variables);
  }

  @Post('notifications/send-klaviyo-event')
  @ApiOperation({ summary: 'Send a Klaviyo tracking event' })
  @ApiBody({
    description: 'Klaviyo event parameters',
    schema: {
      type: 'object',
      required: ['event', 'email', 'properties'],
      properties: {
        event: { type: 'string', description: 'Event name' },
        email: { type: 'string', description: 'User email address' },
        properties: { type: 'object', description: 'Event properties', additionalProperties: true },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Klaviyo event sent successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  sendKlaviyoEvent(@Body() body: { event: string; email: string; properties: Record<string, any> }) {
    return this.notificationService.sendKlaviyoEvent(body.event, body.email, body.email?.split('@')[0] || 'User', body.properties);
  }

  @Get('packages')
  @ApiOperation({ summary: 'Get all photo packages' })
  @ApiResponse({ status: 200, description: 'Photo packages returned successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  getPackages() {
    return this.photoService.getAllPackages();
  }

  @Post('packages')
  @ApiOperation({ summary: 'Create a photo package' })
  @ApiBody({
    description: 'Photo package data',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Package name' },
        description: { type: 'string', description: 'Package description' },
        price: { type: 'number', description: 'Package price in cents' },
        photo_count: { type: 'number', description: 'Number of photos included' },
        active: { type: 'boolean', description: 'Whether the package is active' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Package created successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  createPackage(@Body() data: any) {
    return this.photoService.createPackage(data);
  }

  @Put('packages/:id')
  @ApiOperation({ summary: 'Update a photo package' })
  @ApiParam({ name: 'id', description: 'Package ID' })
  @ApiBody({
    description: 'Photo package data to update',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Package name' },
        description: { type: 'string', description: 'Package description' },
        price: { type: 'number', description: 'Package price in cents' },
        photo_count: { type: 'number', description: 'Number of photos included' },
        active: { type: 'boolean', description: 'Whether the package is active' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Package updated successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Package not found.' })
  updatePackage(@Param('id') id: string, @Body() data: any) {
    return this.photoService.updatePackage(id, data);
  }

  @Delete('packages/:id')
  @ApiOperation({ summary: 'Delete a photo package' })
  @ApiParam({ name: 'id', description: 'Package ID' })
  @ApiResponse({ status: 200, description: 'Package deleted successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @ApiResponse({ status: 404, description: 'Package not found.' })
  deletePackage(@Param('id') id: string) {
    return this.photoService.deletePackage(id);
  }

  @Post('merchandise/sync')
  @ApiOperation({ summary: 'Sync products from Printful' })
  @ApiResponse({ status: 201, description: 'Printful products synced successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  syncPrintfulProducts() {
    return this.merchService.syncPrintfulProducts();
  }

  @Post('merchandise/sync-status')
  @ApiOperation({ summary: 'Sync order statuses from Printful' })
  @ApiResponse({ status: 201, description: 'Printful order statuses synced successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  syncPrintfulStatus() {
    return this.merchService.syncPrintfulStatus();
  }
}
