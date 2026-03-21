#!/bin/bash
set -e

# Config
AWS_REGION="us-east-1"
AWS_PROFILE="burger"
ECR_REGISTRY="391824190859.dkr.ecr.us-east-1.amazonaws.com"
ECS_CLUSTER="burger-prod"

# Parse args
COMMIT="${1:-}"
SERVICE="${2:-all}" # all, backend, frontend

if [ -z "$COMMIT" ]; then
  echo "Usage: ./rollback.sh <commit-sha> [all|backend|frontend]"
  echo ""
  echo "Examples:"
  echo "  ./rollback.sh abc1234           # Rollback both services to commit abc1234"
  echo "  ./rollback.sh abc1234 backend   # Rollback only backend"
  echo "  ./rollback.sh abc1234 frontend  # Rollback only frontend"
  echo ""
  echo "Available backend images:"
  aws ecr describe-images --repository-name burger-backend --region "$AWS_REGION" --profile "$AWS_PROFILE" \
    --query 'imageDetails[*].{tags:imageTags,pushed:imagePushedAt}' --output table 2>/dev/null || echo "  (login required)"
  exit 1
fi

echo "========================================="
echo "  Burger Rollback"
echo "  Commit: $COMMIT | Service: $SERVICE"
echo "========================================="

# Login to ECR
echo "→ Logging into ECR..."
aws ecr get-login-password --region "$AWS_REGION" --profile "$AWS_PROFILE" | \
  docker login --username AWS --password-stdin "$ECR_REGISTRY" > /dev/null 2>&1

rollback_service() {
  local svc_name="$1"    # burger-prod-backend or burger-prod-frontend
  local repo_name="$2"   # burger-backend or burger-frontend
  local container="$3"   # backend or frontend

  echo ""
  echo "→ Checking image $repo_name:$COMMIT exists..."

  if ! aws ecr describe-images --repository-name "$repo_name" --image-ids imageTag="$COMMIT" \
    --region "$AWS_REGION" --profile "$AWS_PROFILE" > /dev/null 2>&1; then
    echo "  ✗ Image $repo_name:$COMMIT not found in ECR!"
    echo "  Available tags:"
    aws ecr describe-images --repository-name "$repo_name" --region "$AWS_REGION" --profile "$AWS_PROFILE" \
      --query 'imageDetails[*].imageTags[]' --output text 2>/dev/null | tr '\t' '\n' | grep -v latest | sort -r | head -10
    return 1
  fi
  echo "  ✓ Image found"

  echo "→ Getting current task definition for $svc_name..."
  TASK_DEF=$(aws ecs describe-services --cluster "$ECS_CLUSTER" --services "$svc_name" \
    --query 'services[0].taskDefinition' --output text \
    --region "$AWS_REGION" --profile "$AWS_PROFILE")

  echo "→ Creating new task definition with image $repo_name:$COMMIT..."
  NEW_TASK_DEF=$(aws ecs describe-task-definition --task-definition "$TASK_DEF" \
    --query 'taskDefinition' \
    --region "$AWS_REGION" --profile "$AWS_PROFILE" | \
    sed "s|$ECR_REGISTRY/$repo_name:[a-zA-Z0-9_.-]*|$ECR_REGISTRY/$repo_name:$COMMIT|g")

  # Register new task definition (strip fields that can't be included in registration)
  NEW_REVISION=$(echo "$NEW_TASK_DEF" | \
    python3 -c "
import sys, json
td = json.load(sys.stdin)
for key in ['taskDefinitionArn', 'revision', 'status', 'requiresAttributes', 'compatibilities', 'registeredAt', 'registeredBy']:
    td.pop(key, None)
print(json.dumps(td))
" | \
    aws ecs register-task-definition --cli-input-json file:///dev/stdin \
      --query 'taskDefinition.taskDefinitionArn' --output text \
      --region "$AWS_REGION" --profile "$AWS_PROFILE")

  echo "  ✓ New task definition: $NEW_REVISION"

  echo "→ Updating service $svc_name..."
  aws ecs update-service \
    --cluster "$ECS_CLUSTER" \
    --service "$svc_name" \
    --task-definition "$NEW_REVISION" \
    --force-new-deployment \
    --region "$AWS_REGION" --profile "$AWS_PROFILE" > /dev/null
  echo "  ✓ Service updated"
}

case "$SERVICE" in
  backend)  rollback_service "burger-prod-backend" "burger-backend" "backend" ;;
  frontend) rollback_service "burger-prod-frontend" "burger-frontend" "frontend" ;;
  all)
    rollback_service "burger-prod-backend" "burger-backend" "backend"
    rollback_service "burger-prod-frontend" "burger-frontend" "frontend"
    ;;
  *)
    echo "Usage: ./rollback.sh <commit-sha> [all|backend|frontend]"
    exit 1
    ;;
esac

echo ""
echo "→ Waiting for services to stabilize..."
if [ "$SERVICE" = "all" ] || [ "$SERVICE" = "backend" ]; then
  aws ecs wait services-stable --cluster "$ECS_CLUSTER" --services burger-prod-backend \
    --profile "$AWS_PROFILE" --region "$AWS_REGION" &
fi
if [ "$SERVICE" = "all" ] || [ "$SERVICE" = "frontend" ]; then
  aws ecs wait services-stable --cluster "$ECS_CLUSTER" --services burger-prod-frontend \
    --profile "$AWS_PROFILE" --region "$AWS_REGION" &
fi
wait

echo ""
echo "========================================="
echo "  ✓ Rollback complete!"
echo "  Rolled back to commit: $COMMIT"
echo "========================================="
