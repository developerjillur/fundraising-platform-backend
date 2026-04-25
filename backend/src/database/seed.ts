import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const dataSource = new DataSource({
  type: 'mysql',
  socketPath: '/Users/mac/Library/Application Support/Local/run/V5I7qH_lx/mysql/mysqld.sock',
  username: 'root',
  password: 'root',
  database: 'fundraising_db',
  synchronize: false,
  logging: true,
});

async function seed() {
  await dataSource.initialize();
  const qr = dataSource.createQueryRunner();

  console.log('Seeding database...');

  // 1. Fundraising stats (singleton)
  const statsExists = await qr.query('SELECT COUNT(*) as c FROM fundraising_stats');
  if (Number(statsExists[0].c) === 0) {
    await qr.query(`INSERT INTO fundraising_stats (id, total_raised_cents, goal_amount_cents, supporter_count, merch_order_count, photos_displayed, current_viewer_count) VALUES (1, 0, 200000000, 0, 0, 0, 0)`);
    console.log('  Created fundraising_stats row');
  }

  // 2. Admin user
  const adminExists = await qr.query("SELECT COUNT(*) as c FROM admins WHERE email = 'developerjillur@gmail.com'");
  if (Number(adminExists[0].c) === 0) {
    const hash = await bcrypt.hash('admin12345', 10);
    await qr.query(`INSERT INTO admins (id, email, password_hash, role) VALUES (?, ?, ?, 'admin')`, [uuidv4(), 'developerjillur@gmail.com', hash]);
    console.log('  Created admin user: developerjillur@gmail.com');
  }

  // 3. Photo packages
  const pkgExists = await qr.query('SELECT COUNT(*) as c FROM photo_packages');
  if (Number(pkgExists[0].c) === 0) {
    await qr.query(`INSERT INTO photo_packages (id, slug, name, description, price_cents, display_duration_seconds, has_badge, active, sort_order) VALUES (?, 'standard', 'Standard', 'Your photo displayed on the live stream', 1000, 10, false, true, 1)`, [uuidv4()]);
    await qr.query(`INSERT INTO photo_packages (id, slug, name, description, price_cents, display_duration_seconds, has_badge, active, sort_order) VALUES (?, 'premium', 'Premium', 'Extended display time with a premium badge overlay', 2500, 30, true, true, 2)`, [uuidv4()]);
    console.log('  Created photo packages (standard + premium)');
  }

  // 4. Default site settings
  const settingsExists = await qr.query('SELECT COUNT(*) as c FROM site_settings');
  if (Number(settingsExists[0].c) === 0) {
    const settings = [
      ['site_title', 'The Last McDonald\'s Burger', 'general'],
      ['hero_headline', 'The Last McDonald\'s Burger', 'general'],
      ['hero_subheadline', 'Be Part of History', 'general'],
      ['hero_cta_text', 'GET YOUR PHOTO — $10', 'general'],
      ['fundraising_goal_cents', '200000000', 'general'],
      ['youtube_video_id', '', 'stream'],
      ['stream_queue_paused', 'false', 'stream'],
      ['stream_display_interval', '10', 'stream'],
      ['livestream_enabled', 'true', 'features'],
      ['merch_enabled', 'true', 'features'],
      ['faq_enabled', 'true', 'features'],
      ['grand_prize_enabled', 'true', 'features'],
      ['photo_gallery_enabled', 'true', 'features'],
      ['social_proof_enabled', 'true', 'features'],
      ['moderation_enabled', 'false', 'integrations'],
      ['stripe_connected', 'false', 'integrations'],
    ];
    for (const [key, value, category] of settings) {
      await qr.query(
        'INSERT INTO site_settings (`key`, value, category) VALUES (?, ?, ?)',
        [key, value, category],
      );
    }
    console.log('  Created default site settings');
  }

  // 4b. Milestone 2 settings (insert if missing)
  const m2Settings = [
    ['moderation_enabled', 'true', 'moderation', 'Enable AWS Rekognition content moderation'],
    ['rekognition_min_confidence', '75', 'moderation', 'Minimum confidence threshold for Rekognition (0-100)'],
    ['moderation_fail_open', 'true', 'moderation', 'Approve photos when moderation service is unavailable'],
    ['max_reupload_attempts', '3', 'moderation', 'Maximum re-upload attempts per supporter'],
    ['rejection_message', 'Your photo was flagged by our content filter. Please upload a different photo.', 'moderation', 'Default rejection message'],
    ['premium_badge_enabled', 'true', 'stream', 'Show premium badge overlay on stream and screenshots'],
    ['obs_poll_interval_ms', '3000', 'stream', 'How often OBS service polls for next queue item (ms)'],
    ['obs_transition_type', 'fade', 'stream', 'OBS scene transition type (fade, cut, slide)'],
    ['obs_transition_duration_ms', '500', 'stream', 'OBS transition duration in milliseconds'],
    ['printful_auto_confirm', 'false', 'integrations', 'Auto-confirm Printful orders on creation (false = manual review in Printful dashboard)'],
    ['printful_webhook_secret', '', 'integrations', 'Optional shared secret for Printful webhook signature verification'],
  ];
  for (const [key, value, category, description] of m2Settings) {
    const exists = await qr.query('SELECT COUNT(*) as c FROM site_settings WHERE `key` = ?', [key]);
    if (Number(exists[0].c) === 0) {
      await qr.query(
        'INSERT INTO site_settings (`key`, value, category, description) VALUES (?, ?, ?, ?)',
        [key, value, category, description],
      );
    }
  }
  console.log('  Milestone 2 settings ensured');

  // Update photo_rejected template to include reupload_url variable (only if it doesn't already have it)
  const rejectedTmpl = await qr.query("SELECT body_html FROM email_templates WHERE template_key = 'photo_rejected'");
  if (rejectedTmpl.length > 0 && !rejectedTmpl[0].body_html?.includes('reupload_url')) {
    await qr.query(
      "UPDATE email_templates SET body_html = '<h1>Hi {{name}}</h1><p>Unfortunately your photo was not approved. Reason: {{reason}}</p><p><a href=\"{{reupload_url}}\">Click here to upload a different photo</a></p>', variables = ? WHERE template_key = 'photo_rejected'",
      [JSON.stringify(['name', 'reason', 'reupload_url'])],
    );
  }

  // 5. Email templates
  const tmplExists = await qr.query('SELECT COUNT(*) as c FROM email_templates');
  if (Number(tmplExists[0].c) === 0) {
    const templates = [
      {
        key: 'photo_purchased',
        name: 'Photo Purchase Confirmation',
        subject: 'Your photo is in the queue! 🎉',
        body_html: '<h1>Thanks {{name}}!</h1><p>Your {{package_type}} photo package ({{amount}}) has been confirmed. Your photo will appear on the live stream soon!</p>',
        category: 'purchase',
        variables: JSON.stringify(['name', 'package_type', 'amount']),
      },
      {
        key: 'photo_displayed',
        name: 'Photo Displayed on Stream',
        subject: 'Your photo was just on stream! 📸',
        body_html: '<h1>{{name}}, your photo was displayed!</h1><p>Your photo just appeared on the live stream.</p>',
        category: 'stream',
        variables: JSON.stringify(['name', 'screenshot_url']),
      },
      {
        key: 'merch_order_confirmation',
        name: 'Merchandise Order Confirmation',
        subject: 'Order Confirmed — {{order_number}}',
        body_html: '<h1>Thanks {{name}}!</h1><p>Your order {{order_number}} for {{amount}} has been confirmed.</p>',
        category: 'purchase',
        variables: JSON.stringify(['name', 'order_number', 'amount']),
      },
      {
        key: 'merch_shipped',
        name: 'Order Shipped',
        subject: 'Your order {{order_number}} has shipped! 📦',
        body_html: '<h1>{{name}}, your order is on its way!</h1><p>Order <strong>{{order_number}}</strong> just shipped from our fulfillment partner.</p><p>Tracking number: <strong>{{tracking_number}}</strong></p><p><a href="{{tracking_url}}">Track your package →</a></p>',
        category: 'fulfillment',
        variables: JSON.stringify(['name', 'order_number', 'tracking_number', 'tracking_url']),
      },
      {
        key: 'payment_failed',
        name: 'Payment Failed',
        subject: 'Payment issue with your order',
        body_html: '<h1>Hi {{name}}</h1><p>Your payment could not be processed. Please try again.</p>',
        category: 'payment',
        variables: JSON.stringify(['name', 'email']),
      },
      {
        key: 'photo_rejected',
        name: 'Photo Rejected',
        subject: 'Your photo submission was not approved',
        body_html: '<h1>Hi {{name}}</h1><p>Unfortunately your photo was not approved. Reason: {{reason}}</p>',
        category: 'moderation',
        variables: JSON.stringify(['name', 'reason', 'email']),
      },
    ];
    for (const t of templates) {
      await qr.query(
        'INSERT INTO email_templates (id, template_key, name, subject, body_html, body_text, enabled, category, variables) VALUES (?, ?, ?, ?, ?, ?, true, ?, ?)',
        [uuidv4(), t.key, t.name, t.subject, t.body_html, '', t.category, t.variables],
      );
    }
    console.log('  Created email templates');
  }

  console.log('Seed complete!');
  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
