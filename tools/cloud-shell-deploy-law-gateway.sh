#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/neojoin1-cyber/gyo6-law-info.git}"
REPO_DIR="${REPO_DIR:-${HOME}/gyo6-law-info}"
BRANCH="${BRANCH:-main}"

echo "GYO6 Korean Law Gateway Cloud Shell bootstrap"
echo "Repository: ${REPO_URL}"
echo "Directory : ${REPO_DIR}"
echo "Branch    : ${BRANCH}"
echo

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud 명령을 찾을 수 없습니다. Google Cloud Shell에서 실행해 주세요." >&2
  exit 1
fi

if [[ -d "${REPO_DIR}/.git" ]]; then
  echo "Updating existing repository..."
  git -C "${REPO_DIR}" fetch origin "${BRANCH}"
  git -C "${REPO_DIR}" checkout "${BRANCH}"
  git -C "${REPO_DIR}" pull --ff-only origin "${BRANCH}"
else
  echo "Cloning repository..."
  git clone --branch "${BRANCH}" "${REPO_URL}" "${REPO_DIR}"
fi

cd "${REPO_DIR}"

echo
echo "Deploying gateway. You will be asked for:"
echo "- LAW_OC: 법제처 OC 인증키"
echo "- GYO6_MCP_TOKEN: Worker와 공유할 긴 서버간 토큰"
echo

LAW_API_PROTOCOL="${LAW_API_PROTOCOL:-auto}" bash gateways/korean-law-gateway/deploy-cloud-run.sh
