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
{{- printf "postgresql://$(PGUSER):$(PGPASSWORD)@%s-pooler-rw:5432/$(PGDATABASE)?sslmode=require" (include "edk.fullname" .) }}
{{- else }}
{{- printf "postgresql://$(PGUSER):$(PGPASSWORD)@$(PGHOST):$(PGPORT)/$(PGDATABASE)?sslmode=require" }}
{{- end }}
{{- end }}

{{/*
Common environment variables
*/}}
{{- define "edk.commonEnv" -}}
- name: NODE_ENV
  value: {{ .Values.global.env.NODE_ENV | quote }}
- name: EDK_CONTAINER
  value: {{ .Values.global.env.EDK_CONTAINER | quote }}
- name: REDIS_HOST
  value: {{ .Values.global.env.REDIS_HOST | quote }}
- name: REDIS_PORT
  value: {{ .Values.global.env.REDIS_PORT | quote }}
# Database credentials from CloudNativePG
- name: PGHOST
  valueFrom:
    secretKeyRef:
      name: {{ .Values.database.secretName }}
      key: host
- name: PGPORT
  valueFrom:
    secretKeyRef:
      name: {{ .Values.database.secretName }}
      key: port
- name: PGDATABASE
  valueFrom:
    secretKeyRef:
      name: {{ .Values.database.secretName }}
      key: dbname
- name: PGUSER
  valueFrom:
    secretKeyRef:
      name: {{ .Values.database.secretName }}
      key: username
- name: PGPASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ .Values.database.secretName }}
      key: password
- name: DATABASE_URL
  value: {{ include "edk.databaseURL" . | quote }}
# Redis password from Bitnami Redis chart
{{- if .Values.redis.enabled }}
- name: REDIS_PASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ include "edk.fullname" . }}-redis
      key: redis-password
{{- else if .Values.global.env.sensitive.REDIS_PASSWORD }}
- name: REDIS_PASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ include "edk.fullname" . }}-secrets
      key: redis-password
{{- end }}
{{- end }}
