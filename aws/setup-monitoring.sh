#!/bin/bash
# Burger Fundraising Platform — CloudWatch Monitoring Setup
#
# Creates an SNS topic, alarms, log metric filters, and a dashboard.
# Idempotent — safe to re-run.
#
# Usage:
#   ./setup-monitoring.sh                                            # uses default email below
#   ALERT_EMAIL=ops@example.com ./setup-monitoring.sh
#   PROFILE=burger REGION=us-east-1 ./setup-monitoring.sh

set -euo pipefail

PROFILE="${PROFILE:-burger}"
REGION="${REGION:-us-east-1}"
ALERT_EMAIL="${ALERT_EMAIL:-developerjillur@gmail.com}"
TOPIC_NAME="burger-prod-alerts"
CLUSTER="burger-prod"
BACKEND_SERVICE="burger-prod-backend"
FRONTEND_SERVICE="burger-prod-frontend"
ALB_NAME="burger-prod-alb"
TG_NAME="burger-prod-backend-tg"
RDS_INSTANCE="burger-prod-db"
LOG_GROUP_BACKEND="/ecs/burger-prod-backend"
DASHBOARD_NAME="burger-prod-overview"

aws() { command aws --profile "$PROFILE" --region "$REGION" "$@"; }

echo "=== Burger CloudWatch monitoring setup ==="
echo "Profile: $PROFILE  Region: $REGION  Email: $ALERT_EMAIL"
echo

# ----- 1. SNS topic for alerts (best-effort; gracefully skip if no permissions) -----
echo "[1/5] SNS topic..."
TOPIC_ARN=""
if TOPIC_ARN=$(aws sns create-topic --name "$TOPIC_NAME" --query 'TopicArn' --output text 2>/dev/null); then
  echo "  Topic: $TOPIC_ARN"
  aws sns tag-resource --resource-arn "$TOPIC_ARN" \
    --tags Key=Project,Value=burger Key=Environment,Value=prod 2>/dev/null || true
  SUB=$(aws sns list-subscriptions-by-topic --topic-arn "$TOPIC_ARN" \
    --query "Subscriptions[?Endpoint=='$ALERT_EMAIL'].SubscriptionArn" --output text 2>/dev/null || echo "")
  if [ -z "$SUB" ] || [ "$SUB" = "None" ]; then
    aws sns subscribe --topic-arn "$TOPIC_ARN" --protocol email \
      --notification-endpoint "$ALERT_EMAIL" --query 'SubscriptionArn' --output text > /dev/null 2>&1 \
      && echo "  Subscribed $ALERT_EMAIL — check inbox to confirm" \
      || echo "  Couldn't subscribe (insufficient SNS perms)"
  else
    echo "  Already subscribed: $ALERT_EMAIL"
  fi
else
  echo "  WARN: SNS access denied — alarms will be created without notification actions."
  echo "        Add SNS permissions and re-run to wire up email/SMS alerts."
  TOPIC_ARN=""
fi

# Helper: emit --alarm-actions / --ok-actions only when we have a topic
alarm_actions() {
  if [ -n "$TOPIC_ARN" ]; then
    echo "--alarm-actions $TOPIC_ARN --ok-actions $TOPIC_ARN"
  fi
}
alarm_action_only() {
  if [ -n "$TOPIC_ARN" ]; then
    echo "--alarm-actions $TOPIC_ARN"
  fi
}

# ----- 2. Log metric filters (errors / unhandled exceptions) -----
echo "[2/5] Log metric filters..."

aws logs put-metric-filter \
  --log-group-name "$LOG_GROUP_BACKEND" \
  --filter-name "burger-backend-errors" \
  --filter-pattern '?ERROR ?Error ?error ?"unhandled exception"' \
  --metric-transformations \
    metricName=BackendErrorCount,metricNamespace=Burger/Backend,metricValue=1,defaultValue=0 \
  >/dev/null
echo "  BackendErrorCount filter created"

aws logs put-metric-filter \
  --log-group-name "$LOG_GROUP_BACKEND" \
  --filter-name "burger-backend-rekognition-fail" \
  --filter-pattern '"Rekognition moderation failed"' \
  --metric-transformations \
    metricName=ModerationFailureCount,metricNamespace=Burger/Backend,metricValue=1,defaultValue=0 \
  >/dev/null
echo "  ModerationFailureCount filter created"

aws logs put-metric-filter \
  --log-group-name "$LOG_GROUP_BACKEND" \
  --filter-name "burger-backend-stripe-fail" \
  --filter-pattern '"Webhook signature verification failed"' \
  --metric-transformations \
    metricName=StripeWebhookFailureCount,metricNamespace=Burger/Backend,metricValue=1,defaultValue=0 \
  >/dev/null
echo "  StripeWebhookFailureCount filter created"

# ----- 3. Alarms -----
echo "[3/5] Alarms..."

# Backend ECS — high CPU
aws cloudwatch put-metric-alarm \
  --alarm-name "burger-backend-high-cpu" \
  --alarm-description "Backend CPU > 80% for 10m" \
  --metric-name CPUUtilization --namespace AWS/ECS \
  --statistic Average --period 300 --evaluation-periods 2 \
  --threshold 80 --comparison-operator GreaterThanThreshold \
  --dimensions Name=ClusterName,Value="$CLUSTER" Name=ServiceName,Value="$BACKEND_SERVICE" \
  $(alarm_actions) \
  --treat-missing-data notBreaching \
  --tags Key=Project,Value=burger Key=Environment,Value=prod
echo "  burger-backend-high-cpu"

# Backend ECS — high memory
aws cloudwatch put-metric-alarm \
  --alarm-name "burger-backend-high-memory" \
  --alarm-description "Backend memory > 85% for 10m" \
  --metric-name MemoryUtilization --namespace AWS/ECS \
  --statistic Average --period 300 --evaluation-periods 2 \
  --threshold 85 --comparison-operator GreaterThanThreshold \
  --dimensions Name=ClusterName,Value="$CLUSTER" Name=ServiceName,Value="$BACKEND_SERVICE" \
  $(alarm_actions) \
  --treat-missing-data notBreaching \
  --tags Key=Project,Value=burger Key=Environment,Value=prod
echo "  burger-backend-high-memory"

# Backend running count = 0 (service is dead)
aws cloudwatch put-metric-alarm \
  --alarm-name "burger-backend-running-count-zero" \
  --alarm-description "Backend has zero running tasks" \
  --metric-name RunningTaskCount --namespace ECS/ContainerInsights \
  --statistic Average --period 60 --evaluation-periods 2 \
  --threshold 1 --comparison-operator LessThanThreshold \
  --dimensions Name=ClusterName,Value="$CLUSTER" Name=ServiceName,Value="$BACKEND_SERVICE" \
  $(alarm_action_only) \
  --treat-missing-data breaching \
  --tags Key=Project,Value=burger Key=Environment,Value=prod
echo "  burger-backend-running-count-zero"

# ALB 5xx surge
ALB_ARN=$(aws elbv2 describe-load-balancers --names "$ALB_NAME" \
  --query 'LoadBalancers[0].LoadBalancerArn' --output text 2>/dev/null || echo "")
if [ -n "$ALB_ARN" ] && [ "$ALB_ARN" != "None" ]; then
  ALB_DIM_NAME=$(echo "$ALB_ARN" | awk -F'loadbalancer/' '{print $2}')
  aws cloudwatch put-metric-alarm \
    --alarm-name "burger-alb-5xx-surge" \
    --alarm-description "ALB returning > 10 5xx errors per minute" \
    --metric-name HTTPCode_Target_5XX_Count --namespace AWS/ApplicationELB \
    --statistic Sum --period 60 --evaluation-periods 3 \
    --threshold 10 --comparison-operator GreaterThanThreshold \
    --dimensions Name=LoadBalancer,Value="$ALB_DIM_NAME" \
    $(alarm_actions) \
    --treat-missing-data notBreaching \
    --tags Key=Project,Value=burger Key=Environment,Value=prod
  echo "  burger-alb-5xx-surge"

  # ALB target health
  TG_ARN=$(aws elbv2 describe-target-groups --names "$TG_NAME" \
    --query 'TargetGroups[0].TargetGroupArn' --output text 2>/dev/null || echo "")
  if [ -n "$TG_ARN" ] && [ "$TG_ARN" != "None" ]; then
    TG_DIM=$(echo "$TG_ARN" | awk -F':' '{print $NF}')
    aws cloudwatch put-metric-alarm \
      --alarm-name "burger-target-unhealthy" \
      --alarm-description "Backend target group has unhealthy hosts" \
      --metric-name UnHealthyHostCount --namespace AWS/ApplicationELB \
      --statistic Maximum --period 60 --evaluation-periods 2 \
      --threshold 0 --comparison-operator GreaterThanThreshold \
      --dimensions Name=TargetGroup,Value="$TG_DIM" Name=LoadBalancer,Value="$ALB_DIM_NAME" \
      $(alarm_actions) \
      --treat-missing-data notBreaching \
      --tags Key=Project,Value=burger Key=Environment,Value=prod
    echo "  burger-target-unhealthy"
  fi
fi

# Backend error log count
aws cloudwatch put-metric-alarm \
  --alarm-name "burger-backend-error-log-spike" \
  --alarm-description "Backend logging > 20 errors per 5m" \
  --metric-name BackendErrorCount --namespace Burger/Backend \
  --statistic Sum --period 300 --evaluation-periods 1 \
  --threshold 20 --comparison-operator GreaterThanThreshold \
  $(alarm_actions) \
  --treat-missing-data notBreaching \
  --tags Key=Project,Value=burger Key=Environment,Value=prod
echo "  burger-backend-error-log-spike"

# Stripe webhook signature failures
aws cloudwatch put-metric-alarm \
  --alarm-name "burger-stripe-webhook-failures" \
  --alarm-description "Stripe webhook signature failures (possible config or attack)" \
  --metric-name StripeWebhookFailureCount --namespace Burger/Backend \
  --statistic Sum --period 300 --evaluation-periods 1 \
  --threshold 3 --comparison-operator GreaterThanThreshold \
  $(alarm_action_only) \
  --treat-missing-data notBreaching \
  --tags Key=Project,Value=burger Key=Environment,Value=prod
echo "  burger-stripe-webhook-failures"

# RDS — high CPU
aws cloudwatch put-metric-alarm \
  --alarm-name "burger-rds-high-cpu" \
  --alarm-description "RDS CPU > 80% for 10m" \
  --metric-name CPUUtilization --namespace AWS/RDS \
  --statistic Average --period 300 --evaluation-periods 2 \
  --threshold 80 --comparison-operator GreaterThanThreshold \
  --dimensions Name=DBInstanceIdentifier,Value="$RDS_INSTANCE" \
  $(alarm_actions) \
  --treat-missing-data notBreaching \
  --tags Key=Project,Value=burger Key=Environment,Value=prod 2>/dev/null || echo "  (skipped — RDS instance not found)"
echo "  burger-rds-high-cpu"

# RDS — low storage
aws cloudwatch put-metric-alarm \
  --alarm-name "burger-rds-low-storage" \
  --alarm-description "RDS free storage < 2GB" \
  --metric-name FreeStorageSpace --namespace AWS/RDS \
  --statistic Average --period 300 --evaluation-periods 1 \
  --threshold 2147483648 --comparison-operator LessThanThreshold \
  --dimensions Name=DBInstanceIdentifier,Value="$RDS_INSTANCE" \
  $(alarm_actions) \
  --treat-missing-data notBreaching \
  --tags Key=Project,Value=burger Key=Environment,Value=prod 2>/dev/null || echo "  (skipped — RDS instance not found)"
echo "  burger-rds-low-storage"

# ----- 4. Set log retention (30 days, saves cost) -----
echo "[4/5] Log retention..."
aws logs put-retention-policy --log-group-name "$LOG_GROUP_BACKEND" --retention-in-days 30 || true
echo "  $LOG_GROUP_BACKEND → 30 days"

# ----- 5. Dashboard -----
echo "[5/5] Dashboard..."

if [ -n "${ALB_DIM_NAME:-}" ]; then
  ALB_WIDGET="[\"AWS/ApplicationELB\",\"RequestCount\",\"LoadBalancer\",\"$ALB_DIM_NAME\"],[\".\",\"HTTPCode_Target_2XX_Count\",\".\",\".\"],[\".\",\"HTTPCode_Target_4XX_Count\",\".\",\".\"],[\".\",\"HTTPCode_Target_5XX_Count\",\".\",\".\"]"
  ALB_LATENCY="[\"AWS/ApplicationELB\",\"TargetResponseTime\",\"LoadBalancer\",\"$ALB_DIM_NAME\"]"
else
  ALB_WIDGET="[\"AWS/ApplicationELB\",\"RequestCount\"]"
  ALB_LATENCY="[\"AWS/ApplicationELB\",\"TargetResponseTime\"]"
fi

cat > /tmp/burger-dashboard.json <<DASHEOF
{
  "widgets": [
    {
      "type": "metric", "x": 0, "y": 0, "width": 12, "height": 6,
      "properties": {
        "title": "ALB Request Volume + Status Codes",
        "metrics": [$ALB_WIDGET],
        "view": "timeSeries", "stacked": false, "region": "$REGION", "stat": "Sum", "period": 60
      }
    },
    {
      "type": "metric", "x": 12, "y": 0, "width": 12, "height": 6,
      "properties": {
        "title": "ALB Target Response Time (p50, p95, p99)",
        "metrics": [
          $ALB_LATENCY,
          [".",".",".",".", { "stat": "p95" }],
          [".",".",".",".", { "stat": "p99" }]
        ],
        "view": "timeSeries", "region": "$REGION", "period": 60
      }
    },
    {
      "type": "metric", "x": 0, "y": 6, "width": 12, "height": 6,
      "properties": {
        "title": "Backend ECS — CPU & Memory",
        "metrics": [
          ["AWS/ECS","CPUUtilization","ClusterName","$CLUSTER","ServiceName","$BACKEND_SERVICE"],
          [".","MemoryUtilization",".",".",".","."]
        ],
        "view": "timeSeries", "region": "$REGION", "stat": "Average", "period": 60
      }
    },
    {
      "type": "metric", "x": 12, "y": 6, "width": 12, "height": 6,
      "properties": {
        "title": "Backend Error Log Volume",
        "metrics": [
          ["Burger/Backend","BackendErrorCount"],
          [".","ModerationFailureCount"],
          [".","StripeWebhookFailureCount"]
        ],
        "view": "timeSeries", "region": "$REGION", "stat": "Sum", "period": 300
      }
    },
    {
      "type": "metric", "x": 0, "y": 12, "width": 12, "height": 6,
      "properties": {
        "title": "RDS — CPU, Connections, Storage",
        "metrics": [
          ["AWS/RDS","CPUUtilization","DBInstanceIdentifier","$RDS_INSTANCE"],
          [".","DatabaseConnections",".","."],
          [".","FreeableMemory",".",".", { "yAxis": "right" }]
        ],
        "view": "timeSeries", "region": "$REGION", "stat": "Average", "period": 300
      }
    },
    {
      "type": "log", "x": 12, "y": 12, "width": 12, "height": 6,
      "properties": {
        "title": "Backend recent errors",
        "query": "SOURCE '$LOG_GROUP_BACKEND' | filter @message like /(?i)(error|exception|fail)/ | sort @timestamp desc | limit 50",
        "region": "$REGION", "view": "table"
      }
    }
  ]
}
DASHEOF

aws cloudwatch put-dashboard \
  --dashboard-name "$DASHBOARD_NAME" \
  --dashboard-body file:///tmp/burger-dashboard.json >/dev/null
echo "  $DASHBOARD_NAME"

echo
echo "=== Setup complete ==="
echo "Dashboard: https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#dashboards:name=${DASHBOARD_NAME}"
echo "Alarms:    https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#alarmsV2:"
echo
echo "ACTION: confirm the SNS subscription email at $ALERT_EMAIL"
