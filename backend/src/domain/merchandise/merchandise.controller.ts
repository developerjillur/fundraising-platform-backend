import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';
import { MerchandiseService } from './merchandise.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@ApiTags('merchandise')
@Controller('merchandise')
export class MerchandiseController {
  constructor(private merchService: MerchandiseService) {}

  @Get('products')
  @ApiOperation({ summary: 'Get active products' })
  @ApiResponse({ status: 200, description: 'List of active merchandise products returned successfully.' })
  getProducts() {
    return this.merchService.getActiveProducts();
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Get a single product by ID' })
  @ApiParam({ name: 'id', description: 'Product ID' })
  @ApiResponse({ status: 200, description: 'Product details returned successfully.' })
  @ApiResponse({ status: 404, description: 'Product not found.' })
  getProduct(@Param('id') id: string) {
    return this.merchService.getProduct(id);
  }

  @Post('orders/lookup')
  @ApiOperation({ summary: 'Look up an order by email or order number' })
  @ApiBody({
    description: 'Order lookup criteria',
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'customer@example.com', description: 'Customer email address' },
        order_number: { type: 'string', example: 'ORD-12345', description: 'Order number' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Order details returned successfully.' })
  @ApiResponse({ status: 404, description: 'Order not found.' })
  lookupOrder(@Body() body: { email?: string; order_number?: string }) {
    return this.merchService.lookupOrder(body.email, body.order_number);
  }

  @Get('orders/by-session/:sessionId')
  @ApiOperation({ summary: 'Get order by Stripe checkout session ID' })
  @ApiParam({ name: 'sessionId', description: 'Stripe checkout session ID' })
  @ApiResponse({ status: 200, description: 'Order details returned successfully.' })
  @ApiResponse({ status: 404, description: 'Order not found for the given session.' })
  getOrderBySession(@Param('sessionId') sessionId: string) {
    return this.merchService.getOrderBySession(sessionId);
  }

  @Post('webhooks/printful')
  @ApiOperation({ summary: 'Handle Printful webhook events' })
  @ApiBody({
    description: 'Printful webhook payload',
    schema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Webhook event type' },
        data: { type: 'object', description: 'Event data payload' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Webhook received and acknowledged.' })
  handlePrintfulWebhook(@Body() body: any) {
    // Handle Printful webhook events
    return { received: true };
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('sync')
  @ApiOperation({ summary: 'Sync products from Printful' })
  @ApiResponse({ status: 201, description: 'Printful products synced successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  syncProducts() {
    return this.merchService.syncPrintfulProducts();
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('sync-status')
  @ApiOperation({ summary: 'Sync order statuses from Printful' })
  @ApiResponse({ status: 201, description: 'Printful order statuses synced successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  syncStatus() {
    return this.merchService.syncPrintfulStatus();
  }
}
