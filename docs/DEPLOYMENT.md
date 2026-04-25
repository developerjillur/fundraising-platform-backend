# Burger Fundraising Platform — Deployment Guide

## Architecture

```
                         ┌────────────────────┐
                         │  Route 53 (DNS)    │ (optional, when domain configured)
                         └──────────┬─────────┘
                                    │
                         ┌──────────▼─────────┐
                         │  ALB (HTTPS via    │   burger-prod-alb-1319169104
                         │      ACM cert)     │   .us-east-1.elb.amazonaws.com
                         └────┬───────────┬───┘
                              │           │
                ┌─────────────▼─┐    ┌────▼─────────────┐
                │ ECS Fargate   │    │  ECS Fargate     │
                │ burger-prod-  │    │  burger-prod-    │
                │   backend     │    │     frontend     │
                │ (NestJS:3000) │    │  (Next.js:3000)  │
                └─────┬─────────┘    └──────────────────┘
                      │
        ┌─────────────┼──────────────┬──────────────┐
        ▼             ▼              ▼              ▼
   ┌─────────┐  ┌──────────┐  ┌───────────┐  ┌─────────────┐
   │ RDS     │  │ S3       │  │ SSM       │  │ CloudWatch  │
   │ MySQL 8 │  │ photos/  │  │ /burger/  │  │ logs +      │
   │         │  │ screens  │  │ /prod/*   │  │ alarms      │
   └─────────┘  └──────────┘  └───────────┘  └─────────────┘
                      │
                      └─── Rekognition (moderation, on-demand)

         ┌──────────────────────┐
         │  EC2 (t3.small)      │   burger-obs-ec2 (98.91.185.143)
         │  - Xvfb              │   Polls backend API every 3s
         │  - OBS Studio        │   Pushes photos to OBS scene
         │  - burger-obs svc    │   Streams via OBS to YouTube
         └──────────┬───────────┘
                    │
                    ▼
              YouTube Live
```

**Compute model:** ECS Fargate (serverless containers, no EC2 to manage for the app).
**Database:** RDS MySQL 8 (`db.t3.micro`).
**Object storage:** S3 (`burger-prod-assets`) for photo + screenshot uploads.
**Secrets:** SSM Parameter Store under `/burger/prod/*`. Never committed.
**Container registry:** ECR (`burger-backend`, `burger-frontend`).
**OBS automation:** Standalone EC2 in the same VPC.

## Resource naming convention

Per client policy, all resources use the `burger-` prefix and `burger-prod-*` for production. Tags `Project=burger`, `Environment=prod`.

| Resource | Name |
|---|---|
| ECS cluster | `burger-prod` |
| ECS services | `burger-prod-backend`, `burger-prod-frontend` |
| ECR repos | `burger-backend`, `burger-frontend` |
| ALB | `burger-prod-alb` |
| Target group | `burger-prod-backend-tg` |
| RDS instance | `burger-prod-db` |
| S3 bucket | `burger-prod-assets` |
| Task roles | `burger-ecs-task-role`, `burger-ecs-task-execution-role` |
| OBS EC2 | `burger-obs-ec2` |
| OBS security group | `burger-obs-sg` |
| OBS SSH key | `burger-obs-key` |
| SNS alert topic | `burger-prod-alerts` |

## Prerequisites

- AWS CLI v2
- Docker (with buildx for `--platform linux/amd64`)
- Node.js 22+
- IAM Identity Center access — SSO start URL: `https://d-c367678880.awsapps.com/start`, region `eu-north-1`, account `391824190859`, permission set `burger-deploy-access`

## SSO setup (one-time)

```bash
# Add to ~/.aws/config
cat >> ~/.aws/config <<'EOF'

[profile burger]
sso_start_url = https://d-c367678880.awsapps.com/start
sso_region = eu-north-1
sso_account_id = 391824190859
sso_role_name = burger-deploy-access
region = us-east-1
output = json
EOF

aws sso login --profile burger
aws sts get-caller-identity --profile burger
```

Token expires after a few hours; re-run `aws sso login --profile burger` when needed.

## Deploying the backend

```bash
cd backend

# 1. Build image (must target linux/amd64 to match Fargate)
docker build --platform linux/amd64 \
  -t 391824190859.dkr.ecr.us-east-1.amazonaws.com/burger-backend:latest \
  -t 391824190859.dkr.ecr.us-east-1.amazonaws.com/burger-backend:$(git rev-parse --short HEAD) \
  .

# 2. Login to ECR
aws ecr get-login-password --profile burger --region us-east-1 \
  | docker login --username AWS --password-stdin 391824190859.dkr.ecr.us-east-1.amazonaws.com

# 3. Push
docker push 391824190859.dkr.ecr.us-east-1.amazonaws.com/burger-backend:latest
docker push 391824190859.dkr.ecr.us-east-1.amazonaws.com/burger-backend:$(git rev-parse --short HEAD)

# 4. Force ECS to pull and roll
aws ecs update-service --profile burger --region us-east-1 \
  --cluster burger-prod --service burger-prod-backend --force-new-deployment
```

Watch deployment:
```bash
aws ecs describe-services --profile burger --region us-east-1 \
  --cluster burger-prod --services burger-prod-backend \
  --query 'services[0].deployments[*].{status:status,running:runningCount,desired:desiredCount,rolloutState:rolloutState}'
```

Tail logs:
```bash
aws logs tail /ecs/burger-prod-backend --profile burger --region us-east-1 --follow
```

## Deploying the frontend

Same flow as backend, with image `burger-frontend` and service `burger-prod-frontend`.

```bash
cd frontend
docker build --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_API_URL=http://burger-prod-alb-1319169104.us-east-1.elb.amazonaws.com \
  -t 391824190859.dkr.ecr.us-east-1.amazonaws.com/burger-frontend:latest .

docker push 391824190859.dkr.ecr.us-east-1.amazonaws.com/burger-frontend:latest

aws ecs update-service --profile burger --region us-east-1 \
  --cluster burger-prod --service burger-prod-frontend --force-new-deployment
```

## Database migrations / seeding

The schema is created by TypeORM `synchronize` on first deploy with `NODE_ENV=development`. Production runs with `NODE_ENV=production` (no auto-sync).

To seed or run a one-off DB script in production, use a one-off ECS task:

```bash
# 1. Generate seed task definition (Python helper at scripts/gen-seed-task.py)
python3 scripts/gen-seed-task.py > /tmp/seed-task.json
aws ecs register-task-definition --profile burger --region us-east-1 \
  --cli-input-json file:///tmp/seed-task.json

# 2. Run it on the same VPC + subnets as the service
aws ecs run-task --profile burger --region us-east-1 \
  --cluster burger-prod \
  --task-definition burger-prod-backend-seed \
  --launch-type FARGATE \
  --network-configuration 'awsvpcConfiguration={subnets=["subnet-0821dacf206ad67ea","subnet-0d943318b50534ee8"],securityGroups=["sg-02496d36fe715c046"],assignPublicIp=ENABLED}'

# 3. Watch logs
aws logs tail /ecs/burger-prod-backend --profile burger --region us-east-1 --follow
```

Schema changes after launch should be done with a proper TypeORM migration in code, then deployed normally.

## Secrets management (SSM)

```bash
# Set / update a secret
aws ssm put-parameter --profile burger --region us-east-1 \
  --name /burger/prod/STRIPE_SECRET_KEY \
  --value "sk_live_..." \
  --type SecureString --overwrite

# Read (auditing)
aws ssm get-parameter --profile burger --region us-east-1 \
  --name /burger/prod/STRIPE_SECRET_KEY \
  --with-decryption --query 'Parameter.Value' --output text
```

After updating an SSM parameter that's wired into the task definition's `secrets[]`, force a new ECS deployment so containers pick up the new value.

Many "secrets" (Stripe keys, Klaviyo, Printful, Resend) are also stored in the `site_setting` table and resolved by `SettingsService` at runtime. Those can be updated live via the admin dashboard without a redeploy.

## OBS EC2 deployment

Already provisioned at `98.91.185.143` (instance `i-0817a953ebf54d9e5`). To redeploy the OBS service code:

```bash
ssh -i ~/.ssh/burger-obs-key.pem ubuntu@98.91.185.143

# On the EC2:
cd /opt/burger-obs-service
sudo systemctl stop burger-obs

# Pull new source (or scp it from local)
# Then rebuild
sudo npx tsc
sudo chown -R obsuser:obsuser /opt/burger-obs-service
sudo systemctl start burger-obs
sudo journalctl -u burger-obs --no-pager -n 30
```

The three systemd units, in order:
- `xvfb.service` — virtual display on `:99`
- `obs-studio.service` — headless OBS on the virtual display, WebSocket on port 4455
- `burger-obs.service` — Node.js service polling the API and driving OBS

## Monitoring

Run once to wire up alarms, log metric filters, and a CloudWatch dashboard:

```bash
ALERT_EMAIL=ops@example.com aws/setup-monitoring.sh
```

After running, confirm the SNS subscription email — alerts won't deliver until you click the confirmation link.

Key destinations:
- Dashboard: `https://us-east-1.console.aws.amazon.com/cloudwatch/home#dashboards:name=burger-prod-overview`
- Alarms: `https://us-east-1.console.aws.amazon.com/cloudwatch/home#alarmsV2:`

## Load testing

```bash
# Install k6 (https://k6.io/docs/getting-started/installation/)
cd load-tests
k6 run scenarios/read-heavy.js
k6 run scenarios/sse-readers.js
k6 run scenarios/photo-checkout.js
k6 run scenarios/mixed-traffic.js   # full simulation, 10 minutes
```

See `load-tests/README.md` for the scenarios and target thresholds.

## Domain + HTTPS (optional)

When the client provides a domain:

```bash
# 1. Request an ACM cert in us-east-1 for both apex and www
aws acm request-certificate --profile burger --region us-east-1 \
  --domain-name example.com --subject-alternative-names www.example.com \
  --validation-method DNS

# 2. Add validation CNAMEs to the domain's DNS (or use Route 53)
# 3. Add the cert to the ALB's HTTPS listener
# 4. Add a Route 53 alias A record pointing to the ALB
# 5. Update FRONTEND_URL and CORS origin in SSM:
aws ssm put-parameter --profile burger --region us-east-1 \
  --name /burger/prod/FRONTEND_URL --value "https://example.com" --overwrite
```

## Rollback

ECS keeps previous task definitions. To roll back:

```bash
# List revisions
aws ecs list-task-definitions --profile burger --region us-east-1 \
  --family-prefix burger-prod-backend --status ACTIVE --sort DESC

# Roll to a specific revision
aws ecs update-service --profile burger --region us-east-1 \
  --cluster burger-prod --service burger-prod-backend \
  --task-definition burger-prod-backend:N
```

## Troubleshooting

**Backend tasks fail health checks:** Check `/api/health` directly via the running task's IP. Common cause: ALB health check path drift (must be `/api/health`, not `/health`).

**500 on `/api/photos/packages`:** DB tables missing. Either redeploy with `NODE_ENV=development` once to let TypeORM auto-sync, then revert to `production`, or apply a migration.

**Stripe webhook signature failures:** SSM `STRIPE_WEBHOOK_SECRET` mismatch with the secret in the Stripe dashboard. Update the SSM parameter and force a new deployment.

**Klaviyo events not appearing:** Verify `klaviyo_api_key` in the admin settings (or `/burger/prod/KLAVIYO_API_KEY` in SSM). Tail logs for `Klaviyo event failed`.

**Rekognition `AccessDenied`:** Add `rekognition:DetectModerationLabels` (and `rekognition:DetectLabels`) to the `burger-ecs-task-role`. The service fails open by default, so photos pass through but moderation is effectively disabled.

**OBS not picking up next item:** SSH to the EC2 and `sudo journalctl -u burger-obs -n 100`. Check that the backend ALB is reachable from the instance and the `OBS_WS_PASSWORD` matches.

## Cost reference

| Resource | Spec | Monthly |
|---|---|---|
| ECS Fargate (backend) | 0.25 vCPU, 0.5 GB | ~$8 |
| ECS Fargate (frontend) | 0.25 vCPU, 0.5 GB | ~$8 |
| RDS MySQL | db.t3.micro, 20 GB | ~$15 |
| ALB | 1 LB | ~$18 |
| S3 | ~5 GB | ~$1 |
| CloudFront | (optional) | ~$5 |
| CloudWatch | logs + metrics | ~$3 |
| Route 53 | 1 hosted zone | ~$1 |
| OBS EC2 | t3.small | ~$15 |
| Rekognition | ~$1 / 1k images | usage-based |
| **Total** | | **~$74-99 / mo** |

(NAT Gateway not used; tasks run in public subnets with security group ingress restricted to the ALB.)
