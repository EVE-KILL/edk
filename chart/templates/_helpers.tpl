{{/*
Expand the name of the chart.
*/}}
{{- define "edk.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "edk.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "edk.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "edk.labels" -}}
helm.sh/chart: {{ include "edk.chart" . }}
{{ include "edk.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "edk.selectorLabels" -}}
app.kubernetes.io/name: {{ include "edk.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "edk.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "edk.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Database connection URL from CloudNativePG secret
*/}}
{{- define "edk.databaseURL" -}}
{{- if .Values.database.pooler.enabled }}
{{- printf "postgresql://%s:%s@%s-pooler:5432/%s?sslmode=disable" .Values.database.owner .Values.database.password (include "edk.fullname" .) .Values.database.database }}
{{- else }}
{{- printf "postgresql://%s:%s@%s-rw:5432/%s?sslmode=disable" .Values.database.owner .Values.database.password .Values.database.clusterName .Values.database.database }}
{{- end }}
{{- end }}

{{/*
Common environment variables
*/}}
{{- define "edk.commonEnv" -}}
# Application
- name: NODE_ENV
  value: {{ .Values.global.env.NODE_ENV | quote }}
- name: THEME
  value: {{ .Values.global.env.THEME | quote }}
# EVE Online
- name: IMAGE_SERVER_URL
  value: {{ .Values.global.env.IMAGE_SERVER_URL | quote }}
- name: ESI_SERVER_URL
  value: {{ .Values.global.env.ESI_SERVER_URL | quote }}
# Redis Cache
- name: REDIS_HOST
  value: {{ .Values.global.env.REDIS_HOST | quote }}
- name: REDIS_PORT
  value: {{ .Values.global.env.REDIS_PORT | quote }}
# Redis Queue
- name: REDIS_QUEUE_HOST
  value: {{ .Values.global.env.REDIS_QUEUE_HOST | quote }}
- name: REDIS_QUEUE_PORT
  value: {{ .Values.global.env.REDIS_QUEUE_PORT | quote }}
# WebSocket
- name: WS_PORT
  value: {{ .Values.global.env.WS_PORT | quote }}
- name: WS_HOST
  value: {{ .Values.global.env.WS_HOST | quote }}
- name: WS_PING_INTERVAL
  value: {{ .Values.global.env.WS_PING_INTERVAL | quote }}
- name: WS_PING_TIMEOUT
  value: {{ .Values.global.env.WS_PING_TIMEOUT | quote }}
- name: WS_CLEANUP_INTERVAL
  value: {{ .Values.global.env.WS_CLEANUP_INTERVAL | quote }}
- name: WS_URL
  value: {{ .Values.global.env.WS_URL | quote }}
# Followed entities
- name: FOLLOWED_CHARACTER_IDS
  value: {{ .Values.global.env.FOLLOWED_CHARACTER_IDS | quote }}
- name: FOLLOWED_CORPORATION_IDS
  value: {{ .Values.global.env.FOLLOWED_CORPORATION_IDS | quote }}
- name: FOLLOWED_ALLIANCE_IDS
  value: {{ .Values.global.env.FOLLOWED_ALLIANCE_IDS | quote }}
# Database credentials from CloudNativePG secret
- name: POSTGRES_HOST
  valueFrom:
    secretKeyRef:
      name: {{ .Values.database.secretName }}
      key: host
- name: POSTGRES_PORT
  valueFrom:
    secretKeyRef:
      name: {{ .Values.database.secretName }}
      key: port
- name: POSTGRES_DB
  valueFrom:
    secretKeyRef:
      name: {{ .Values.database.secretName }}
      key: dbname
- name: POSTGRES_USER
  valueFrom:
    secretKeyRef:
      name: {{ .Values.database.secretName }}
      key: username
- name: POSTGRES_PASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ .Values.database.secretName }}
      key: password
- name: DATABASE_URL
  value: {{ include "edk.databaseURL" . | quote }}
# Secrets from edk-secrets (if they exist)
{{- if .Values.global.env.sensitive.REDIS_PASSWORD }}
- name: REDIS_PASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ include "edk.fullname" . }}-secret
      key: REDIS_PASSWORD
      optional: true
{{- end }}
{{- if .Values.global.env.sensitive.EVE_CLIENT_ID }}
- name: EVE_CLIENT_ID
  valueFrom:
    secretKeyRef:
      name: {{ include "edk.fullname" . }}-secret
      key: eve-client-id
      optional: true
- name: EVE_CLIENT_SECRET
  valueFrom:
    secretKeyRef:
      name: {{ include "edk.fullname" . }}-secret
      key: eve-client-secret
      optional: true
- name: EVE_CLIENT_REDIRECT
  valueFrom:
    secretKeyRef:
      name: {{ include "edk.fullname" . }}-secret
      key: eve-client-redirect
      optional: true
{{- end }}
- name: REDISQ_ID
  valueFrom:
    secretKeyRef:
      name: {{ include "edk.fullname" . }}-secret
      key: redisq-id
{{- if .Values.global.env.sensitive.OPENAI_API_KEY }}
- name: OPENAI_API_KEY
  valueFrom:
    secretKeyRef:
      name: {{ include "edk.fullname" . }}-secret
      key: openai-api-key
      optional: true
- name: AI_MODEL
  valueFrom:
    secretKeyRef:
      name: {{ include "edk.fullname" . }}-secret
      key: ai-model
      optional: true
{{- end }}
{{- end }}
