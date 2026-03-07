import { Controller, Post, Body, Headers, RawBodyRequest, Req, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { Request } from 'express';
import { PaymentService } from './payment.service';
import { StripeWebhookService } from './stripe-webhook.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentController {
  constructor(
    private paymentService: PaymentService,
    private stripeWebhookService: StripeWebhookService,
  ) {}

  @Post('checkout/photo')
  @ApiOperation({ summary: 'Create a photo checkout session via Stripe' })
  @ApiBody({
    description: 'Photo checkout details',
    schema: {
      type: 'object',
      properties: {
        package_id: { type: 'string', description: 'Photo package ID' },
        email: { type: 'string', description: 'Customer email address' },
        photo_url: { type: 'string', description: 'URL of the uploaded photo' },
        message: { type: 'string', description: 'Optional message from the customer' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Stripe checkout session created. Returns session URL.' })
  @ApiResponse({ status: 400, description: 'Invalid checkout data.' })
  createPhotoCheckout(@Body() body: any) {
    return this.paymentService.createPhotoCheckout(body);
  }

  @Post('checkout/merch')
  @ApiOperation({ summary: 'Create a merch checkout session via Stripe' })
  @ApiBody({
    description: 'Merch checkout details',
    schema: {
      type: 'object',
      properties: {
        items: {
          type: 'array',
          description: 'Array of merch items to purchase',
          items: {
            type: 'object',
            properties: {
              product_id: { type: 'string', description: 'Merch product ID' },
              variant_id: { type: 'string', description: 'Product variant ID' },
              quantity: { type: 'number', description: 'Quantity to purchase' },
            },
          },
        },
        email: { type: 'string', description: 'Customer email address' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Stripe checkout session created. Returns session URL.' })
  @ApiResponse({ status: 400, description: 'Invalid checkout data.' })
  createMerchCheckout(@Body() body: any) {
    return this.paymentService.createMerchCheckout(body);
  }

  @Post('webhooks/stripe')
  @HttpCode(200)
  @ApiOperation({ summary: 'Handle Stripe webhook events' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid webhook signature or payload.' })
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
    return this.stripeWebhookService.handleWebhook(rawBody, signature);
  }
}
