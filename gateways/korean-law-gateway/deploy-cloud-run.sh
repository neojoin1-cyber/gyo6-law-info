#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-gyo6-law-info}"
REGION="${REGION:-asia-northeast3}"
SERVICE_NAME="${SERVICE_NAME:-gyo6-korean-law-gateway}"
LAW_OC_SECRET="${LAW_OC_SECRET:-gyo6-law-oc}"
TOKEN_SECRET="${TOKEN_SECRET:-gyo6-law-gateway-token}"
LAW_OPEN_API_REFERER="${LAW_OPEN_API_REFERER:-https://gyo6.kr/}"
LAW_API_PROTOCOL="${LAW_API_PROTOCOL:-auto}"
LAW_GATEWAY_TIMEOUT_MS="${LAW_GATEWAY_TIMEOUT_MS:-12000}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
SOURCE_DIR="${SOURCE_DIR:-${SCRIPT_DIR}}"

cd "${REPO_ROOT}"

echo "GYO6 Korean Law Gateway Cloud Run deploy"
echo "Project : ${PROJECT_ID}"
echo "Region  : ${REGION}"
echo "Service : ${SERVICE_NAME}"
echo

gcloud config set project "${PROJECT_ID}"

echo "Enabling required Google Cloud APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com

if [[ -z "${LAW_OC:-}" ]]; then
  read -r -s -p "법제처 OC 인증키(LAW_OC)를 입력하세요: " LAW_OC
  echo
fi

if [[ -z "${GYO6_MCP_TOKEN:-}" ]]; then
  read -r -s -p "Worker와 공유할 서버간 토큰(GYO6_MCP_TOKEN)을 입력하세요: " GYO6_MCP_TOKEN
  echo
fi

if [[ -z "${LAW_OC}" || -z "${GYO6_MCP_TOKEN}" ]]; then
  echo "LAW_OC와 GYO6_MCP_TOKEN은 비워둘 수 없습니다." >&2
  exit 1
fi

put_secret() {
  local name="$1"
  local value="$2"

  if gcloud secrets describe "${name}" >/dev/null 2>&1; then
    printf "%s" "${value}" | gcloud secrets versions add "${name}" --data-file=-
  else
    printf "%s" "${value}" | gcloud secrets create "${name}" --data-file=-
  fi
}

echo "Writing secrets to Secret Manager..."
put_secret "${LAW_OC_SECRET}" "${LAW_OC}"
put_secret "${TOKEN_SECRET}" "${GYO6_MCP_TOKEN}"

PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
CLOUD_RUN_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

echo "Granting Cloud Run service account access to secrets..."
gcloud secrets add-iam-policy-binding "${LAW_OC_SECRET}" \
  --member="serviceAccount:${CLOUD_RUN_SA}" \
  --role="roles/secretmanager.secretAccessor" >/dev/null
gcloud secrets add-iam-policy-binding "${TOKEN_SECRET}" \
  --member="serviceAccount:${CLOUD_RUN_SA}" \
  --role="roles/secretmanager.secretAccessor" >/dev/null

echo "Deploying Cloud Run service..."
gcloud run deploy "${SERVICE_NAME}" \
  --source "${SOURCE_DIR}" \
  --region "${REGION}" \
  --allow-unauthenticated \
  --port 8080 \
  --memory 256Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --timeout 20s \
  --set-env-vars "LAW_OPEN_API_REFERER=${LAW_OPEN_API_REFERER},LAW_API_PROTOCOL=${LAW_API_PROTOCOL},LAW_GATEWAY_TIMEOUT_MS=${LAW_GATEWAY_TIMEOUT_MS}" \
  --set-secrets "LAW_OC=${LAW_OC_SECRET}:latest,GYO6_MCP_TOKEN=${TOKEN_SECRET}:latest"

SERVICE_URL="$(gcloud run services describe "${SERVICE_NAME}" --region "${REGION}" --format='value(status.url)')"

echo
echo "Cloud Run URL:"
echo "${SERVICE_URL}"
echo
echo "Health check:"
curl -fsS "${SERVICE_URL}/health"
echo
echo
echo "Original text check:"
curl -fsS \
  -H "content-type: application/json" \
  -H "x-gyo6-mcp-token: ${GYO6_MCP_TOKEN}" \
  -d '{"queries":["직업교육훈련 촉진법"],"keywords":["현장실습","청소"],"maxArticles":4}' \
  "${SERVICE_URL}/gyo6/law/search-and-read"
echo
echo
echo "Next local Worker settings:"
echo "KOREAN_LAW_MCP_BASE_URL=${SERVICE_URL}"
echo "KOREAN_LAW_MCP_TOKEN=<same token you typed above>"
