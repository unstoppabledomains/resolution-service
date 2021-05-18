#!/bin/bash

[[ $SERVICE_NAME = "workers" ]] && SCALING="manual_scaling:\n\tinstances: 1" || SCALING="ing"

echo -e "service: resolution-service-${SERVICE_NAME}
runtime: custom
env: flex

env_variables:
  RESOLUTION_RUNNING_MODE: ${RESOLUTION_RUNNING_MODE}
  RESOLUTION_POSTGRES_URL: ${RESOLUTION_POSTGRES_URL}

beta_settings:
  cloud_sql_instances: ${GCP_SQL_INSTANCE}

${SCALING}

" > "${SERVICE_NAME}.yaml"
