import { Controller, Get, Put, Query, Body, Sse, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiBody, ApiQuery } from '@nestjs/swagger';
import { Observable, interval, map, startWith } from 'rxjs';
import { FundraisingService } from './fundraising.service';

@ApiTags('fundraising')
@Controller('fundraising')
export class FundraisingController {
  constructor(private fundraisingService: FundraisingService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get fundraising stats' })
  @ApiResponse({ status: 200, description: 'Returns current fundraising statistics.' })
  getStats() {
    return this.fundraisingService.getStats();
  }

  @Get('recent-supporters')
  @ApiOperation({ summary: 'Get recent supporters list' })
  @ApiResponse({ status: 200, description: 'Returns a list of recent supporters.' })
  getRecentSupporters() {
    return this.fundraisingService.getRecentSupporters();
  }

  @Get('displayed-photos')
  @ApiOperation({ summary: 'Get displayed photos' })
  @ApiResponse({ status: 200, description: 'Returns the list of displayed photos.' })
  getDisplayedPhotos() {
    return this.fundraisingService.getDisplayedPhotos();
  }

  @Get('prize-count')
  @ApiOperation({ summary: 'Count prize entries, optionally filtered by email' })
  @ApiQuery({ name: 'email', required: false, type: String, description: 'Optional email to filter prize entries' })
  @ApiResponse({ status: 200, description: 'Returns the count of prize entries.' })
  async countPrizeEntries(@Query('email') email?: string) {
    const count = await this.fundraisingService.countPrizeEntries(email);
    return { count };
  }

  @Put('stats')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update fundraising stats (JWT protected)' })
  @ApiBody({
    description: 'Fundraising stats fields to update',
    schema: {
      type: 'object',
      additionalProperties: true,
      example: { totalRaised: 5000, goalAmount: 10000 },
    },
  })
  @ApiResponse({ status: 200, description: 'Stats updated successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid JWT token.' })
  updateStats(@Body() body: any) {
    return this.fundraisingService.updateStats(body);
  }

  @Sse('stream')
  @ApiOperation({ summary: 'Real-time fundraising stats stream (SSE)' })
  @ApiResponse({ status: 200, description: 'Server-Sent Events stream of fundraising stats.' })
  streamStats(): Observable<MessageEvent> {
    return interval(3000).pipe(
      startWith(0),
      map(() => this.fundraisingService.getStats()),
      map((statsPromise) => {
        return { data: statsPromise } as any;
      }),
    );
  }
}
