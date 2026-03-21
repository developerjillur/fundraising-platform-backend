#!/bin/bash
set -e

# Config
AWS_REGION="us-east-1"
AWS_PROFILE="burger"
ECR_REGISTRY="391824190859.dkr.ecr.us-east-1.amazonaws.com"
ECS_CLUSTER="burger-prod"
ALB_URL="http://burger-prod-alb-1319169104.us-east-1.elb.amazonaws.com"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# Parse args
SERVICE="${1:-all}" # all, backend, frontend
TAG="${2:-latest}"
COMMIT_SHA=$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || echo "unknown")

echo "========================================="
echo "  Burger Deploy — $SERVICE"
echo "  Tag: $TAG | Commit: $COMMIT_SHA"
echo "========================================="

# Login to ECR
echo "→ Logging into ECR..."
aws ecr get-login-password --region "$AWS_REGION" --profile "$AWS_PROFILE" | \
  docker login --username AWS --password-stdin "$ECR_REGISTRY" > /dev/null 2>&1
echo "  ✓ ECR login"

deploy_backend() {
  echo ""
  echo "→ Building backend..."
  cd "$ROOT_DIR/backend"
  npm ci
  npm run build
  npm prune --production

  docker build -t "$ECR_REGISTRY/burger-backend:$TAG" \
               -t "$ECR_REGISTRY/burger-backend:$COMMIT_SHA" .
  echo "  ✓ Backend image built"

  echo "→ Pushing backend image..."
  docker push "$ECR_REGISTRY/burger-backend:$TAG"
  docker push "$ECR_REGISTRY/burger-backend:$COMMIT_SHA"
  echo "  ✓ Backend image pushed"

  echo "→ Deploying backend to ECS..."
  aws ecs update-service \
    --cluster "$ECS_CLUSTER" \
    --service burger-prod-backend \
    --force-new-deployment \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" > /dev/null
  echo "  ✓ Backend deployment triggered"
}

deploy_frontend() {
  echo ""
  echo "→ Building frontend..."
  cd "$ROOT_DIR/frontend"
  npm ci
  NEXT_PUBLIC_API_URL="$ALB_URL/api" NEXT_PRIVATE_STANDALONE=true npx next build

  docker build -t "$ECR_REGISTRY/burger-frontend:$TAG" \
               -t "$ECR_REGISTRY/burger-frontend:$COMMIT_SHA" .
  echo "  ✓ Frontend image built"

  echo "→ Pushing frontend image..."
  docker push "$ECR_REGISTRY/burger-frontend:$TAG"
  docker push "$ECR_REGISTRY/burger-frontend:$COMMIT_SHA"
  echo "  ✓ Frontend image pushed"

  echo "→ Deploying frontend to ECS..."
  aws ecs update-service \
    --cluster "$ECS_CLUSTER" \
    --service burger-prod-frontend \
    --force-new-deployment \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" > /dev/null
  echo "  ✓ Frontend deployment triggered"
}

case "$SERVICE" in
  backend)  deploy_backend ;;
  frontend) deploy_frontend ;;
  all)      deploy_backend && deploy_frontend ;;
  *)        echo "Usage: ./deploy.sh [all|backend|frontend] [tag]"; exit 1 ;;
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
echo "  ✓ Deployment complete!"
echo "  Frontend: $ALB_URL"
echo "  Backend:  $ALB_URL/api/health"
echo "  Images tagged: $TAG, $COMMIT_SHA"
echo "========================================="
