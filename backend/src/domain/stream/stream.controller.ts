import { Controller, Get, Post, Body, Param, Sse } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiParam } from '@nestjs/swagger';
import { Observable, interval, from, switchMap, map, startWith } from 'rxjs';
import { StreamService } from './stream.service';

@ApiTags('stream')
@Controller('stream')
export class StreamController {
  constructor(private streamService: StreamService) {}

  @Get('queue')
  @ApiOperation({ summary: 'Get current queue state' })
  @ApiResponse({ status: 200, description: 'Current queue state returned successfully.' })
  getQueue() {
    return this.streamService.getQueue();
  }

  @Get('queue/next')
  @ApiOperation({ summary: 'Grab next queue item (atomic operation)' })
  @ApiResponse({ status: 200, description: 'Next queue item returned and locked for processing.' })
  @ApiResponse({ status: 404, description: 'No items waiting in the queue.' })
  getNextQueueItem() {
    return this.streamService.grabNextQueueItem();
  }

  @Post('queue/advance')
  @ApiOperation({ summary: 'Advance queue by marking an item as displayed' })
  @ApiBody({
    description: 'Queue item to advance',
    schema: {
      type: 'object',
      properties: {
        queue_id: { type: 'string', description: 'ID of the queue item to mark as displayed' },
        screenshot_url: { type: 'string', description: 'Optional screenshot URL captured during display' },
      },
      required: ['queue_id'],
    },
  })
  @ApiResponse({ status: 201, description: 'Queue item advanced successfully.' })
  @ApiResponse({ status: 404, description: 'Queue item not found.' })
  advanceQueue(@Body() body: { queue_id: string; screenshot_url?: string }) {
    return this.streamService.advanceQueue(body.queue_id, body.screenshot_url);
  }

  @Get('queue/display')
  @ApiOperation({ summary: 'Get queue display data for the stream overlay' })
  @ApiResponse({ status: 200, description: 'Queue display data returned successfully.' })
  getQueueDisplay() {
    return this.streamService.getQueueDisplay();
  }

  @Get('queue/eta/:supporterId')
  @ApiOperation({ summary: 'Get estimated display time for a supporter' })
  @ApiParam({ name: 'supporterId', description: 'Supporter UUID' })
  getEta(@Param('supporterId') supporterId: string) {
    return this.streamService.calculateEta(supporterId);
  }

  @Get('queue/count')
  @ApiOperation({ summary: 'Count waiting items in the queue' })
  @ApiResponse({ status: 200, description: 'Count of waiting items returned.', schema: { type: 'object', properties: { count: { type: 'number' } } } })
  async countWaiting() {
    const count = await this.streamService.countWaiting();
    return { count };
  }

  @Post('queue/track-view')
  @ApiOperation({ summary: 'Track view time for a queue item' })
  @ApiBody({
    description: 'View tracking data',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Queue item ID' },
        screen_time_seconds: { type: 'number', description: 'Number of seconds the item was displayed on screen' },
      },
      required: ['id', 'screen_time_seconds'],
    },
  })
  @ApiResponse({ status: 201, description: 'View time tracked successfully.' })
  @ApiResponse({ status: 404, description: 'Queue item not found.' })
  trackView(@Body() body: { id: string; screen_time_seconds: number }) {
    return this.streamService.trackView(body.id, body.screen_time_seconds);
  }

  @Post('screenshot')
  @ApiOperation({ summary: 'Save a screenshot for a queue item' })
  @ApiBody({
    description: 'Screenshot data',
    schema: {
      type: 'object',
      properties: {
        queue_id: { type: 'string', description: 'Queue item ID' },
        screenshot_base64: { type: 'string', description: 'Base64-encoded screenshot image' },
      },
      required: ['queue_id', 'screenshot_base64'],
    },
  })
  @ApiResponse({ status: 201, description: 'Screenshot saved successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid screenshot data.' })
  async saveScreenshot(@Body() body: { queue_id: string; screenshot_base64: string }) {
    return this.streamService.saveScreenshot(body.queue_id, body.screenshot_base64);
  }

  @Get('youtube-viewers')
  @ApiOperation({ summary: 'Get current YouTube viewer count' })
  @ApiResponse({ status: 200, description: 'YouTube viewer count returned successfully.' })
  getYoutubeViewers() {
    return this.streamService.getYoutubeViewers();
  }

  @Sse('queue/stream')
  @ApiOperation({ summary: 'Real-time queue stream via Server-Sent Events' })
  @ApiResponse({ status: 200, description: 'SSE stream of queue display data, updated every 3 seconds.' })
  streamQueue(): Observable<MessageEvent> {
    return interval(3000).pipe(
      startWith(0),
      switchMap(() => from(this.streamService.getQueueDisplay())),
      map((data) => ({ data } as any)),
    );
  }
}
