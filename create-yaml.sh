#!/bin/bash

[[ $SERVICE_NAME = "workers" ]] && SCALING="manual_scaling:\n  instances: 1" || SCALING="resources:\n  cpu: 1\n  memory_gb: 2\n\nautomatic_scaling:\n  min_num_instances: 4\n  max_num_instances: 50"
[[ $BUGSNAG_API_KEY = "" ]] && BUGSNAG_API_KEY_FIELD="" || BUGSNAG_API_KEY_FIELD="BUGSNAG_API_KEY: ${BUGSNAG_API_KEY}"
[[ $NEW_RELIC_APP_NAME = "" ]] && NEW_RELIC_APP_NAME_FIELD="" || NEW_RELIC_APP_NAME_FIELD="NEW_RELIC_APP_NAME: ${NEW_RELIC_APP_NAME}"
[[ $NEW_RELIC_LICENSE_KEY = "" ]] && NEW_RELIC_LICENSE_KEY_FIELD="" || NEW_RELIC_LICENSE_KEY_FIELD="NEW_RELIC_LICENSE_KEY: ${NEW_RELIC_LICENSE_KEY}"

echo -e "service: resolution-service-${SERVICE_NAME}
runtime: custom
env: flex

liveness_check:
  path: '/liveness_check'
  check_interval_sec: 30
  timeout_sec: 4
  failure_threshold: 4
  success_threshold: 2
  initial_delay_sec: 300

readiness_check:
  path: '/readiness_check'
  check_interval_sec: 5
  timeout_sec: 4
  failure_threshold: 2
  success_threshold: 2
  app_start_timeout_sec: 300

env_variables:
  POLYGON_CONFIRMATION_BLOCKS: ${POLYGON_CONFIRMATION_BLOCKS}
  POLYGON_BLOCK_FETCH_LIMIT: ${POLYGON_BLOCK_FETCH_LIMIT}
  RESOLUTION_RUNNING_MODE: ${RESOLUTION_RUNNING_MODE}
  RESOLUTION_POSTGRES_HOST: ${RESOLUTION_POSTGRES_HOST}
  RESOLUTION_POSTGRES_USERNAME: ${RESOLUTION_POSTGRES_USERNAME}
  RESOLUTION_POSTGRES_PASSWORD: ${RESOLUTION_POSTGRES_PASSWORD}
  RESOLUTION_POSTGRES_DATABASE: ${RESOLUTION_POSTGRES_DATABASE}
  ETHEREUM_JSON_RPC_API_URL: ${ETHEREUM_JSON_RPC_API_URL}
  POLYGON_JSON_RPC_API_URL: ${POLYGON_JSON_RPC_API_URL}
  VIEWBLOCK_API_KEY: ${VIEWBLOCK_API_KEY}
  ETHEREUM_NETWORK_ID: ${ETHEREUM_NETWORK_ID}
  POLYGON_NETWORK_ID: ${POLYGON_NETWORK_ID}
  ZNS_NETWORK: ${ZNS_NETWORK}
  METADATA_BASE_URI: ${METADATA_BASE_URI}
  ${BUGSNAG_API_KEY_FIELD}
  ${NEW_RELIC_APP_NAME_FIELD}
  ${NEW_RELIC_LICENSE_KEY_FIELD}

beta_settings:
  cloud_sql_instances: ${GCP_SQL_INSTANCE}

${SCALING}

" > "${SERVICE_NAME}.yaml"
