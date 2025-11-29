# EVE-KILL EDK Helm Chart

This Helm chart deploys the EVE-KILL EDK application on Kubernetes with the following components:

## Components

- **Web Frontend** (3 replicas with HPA)
- **Queue Workers** (separate pods per queue type):
  - Alliance queue (1 replica)
  - Auth queue (1 replica)
  - Character queue (2 replicas)
  - Corporation queue (1 replica)
  - Killmail queue (3 replicas)
  - Price queue (1 replica)
- **Cronjobs** (1 replica)
- **WebSocket Listener** (1 replica)

## Prerequisites

- Kubernetes 1.25+
- Helm 3.10+
- Gateway API installed (Cilium Gateway API controller)
- cert-manager installed
- CloudNativePG operator installed
- Existing PostgreSQL cluster named `postgres` in `eve-kill` namespace (via CloudNativePG)

## Installation

### 1. Add Bitnami Helm Repository

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
```

### 2. Install the Chart

```bash
helm install edk ./chart \
  --namespace eve-kill \
  --create-namespace \
  --set global.image.tag=latest \
  --set database.clusterName=postgres-cluster \
  --set database.secretName=postgres-cluster-app \
  --set gateway.httpRoute.hostnames[0]=edk.eve-kill.com \
  --set gateway.certificate.dnsNames[0]=edk.eve-kill.com
```

### 3. With Custom Values

Create a `values-prod.yaml`:

```yaml
global:
  image:
    tag: 'sha-abc123' # Use specific image tag

database:
  clusterName: postgres
  secretName: postgres-app-credentials
  pooler:
    enabled: true
    instances: 3
    poolMode: transaction

redis:
  enabled: true
  auth:
    password: 'your-redis-password'
  master:
    persistence:
      size: 16Gi

gateway:
  httpRoute:
    hostnames:
      - eve-kill.com
  certificate:
    issuerRef:
      name: letsencrypt-prod
      kind: ClusterIssuer
    dnsNames:
      - eve-kill.com

web:
  replicaCount: 5
  autoscaling:
    maxReplicas: 20

queue:
  workers:
    killmail:
      replicaCount: 5
      concurrency: 30
```

Install with custom values:

```bash
helm install edk ./chart \
  --namespace eve-kill \
  --values values-prod.yaml
```

## Configuration

### Database Connection (CloudNativePG)

The chart automatically connects to your CloudNativePG cluster using the app secret:

- Cluster name: `postgres` (in eve-kill namespace)
- Secret name: `postgres-app-credentials`
- Contains: `host`, `port`, `dbname`, `username`, `password`

The `DATABASE_URL` environment variable is constructed automatically from these values.

#### PgBouncer Connection Pooling

Enable PgBouncer for improved connection management and performance:

```yaml
database:
  pooler:
    enabled: true
    instances: 3
    poolMode: transaction # or session
    parameters:
      max_client_conn: '1000'
      default_pool_size: '25'
```

When enabled, the chart creates a CloudNativePG Pooler resource and automatically configures the application to connect through PgBouncer.

### Queue Workers

Each queue type runs as a separate deployment for better resource allocation and scaling:

```yaml
queue:
  workers:
    killmail:
      enabled: true
      replicaCount: 3
      concurrency: 20
      resources:
        requests:
          cpu: 200m
          memory: 256Mi
```

### Gateway API & TLS

The chart uses Gateway API with Cilium and cert-manager for ingress and TLS:

- **HTTPRoute**: Routes traffic to the web service
- **Certificate**: Automatically provisions Let's Encrypt certificates

## Upgrading

```bash
helm upgrade edk ./chart \
  --namespace eve-kill \
  --values values-prod.yaml
```

## Uninstalling

```bash
helm uninstall edk --namespace eve-kill
```

## Values

| Key                                 | Type   | Default                  | Description                  |
| ----------------------------------- | ------ | ------------------------ | ---------------------------- |
| `global.image.registry`             | string | `"ghcr.io"`              | Container registry           |
| `global.image.repository`           | string | `"eve-kill/edk"`         | Image repository             |
| `global.image.tag`                  | string | `"latest"`               | Image tag                    |
| `web.replicaCount`                  | int    | `3`                      | Number of web replicas       |
| `web.autoscaling.enabled`           | bool   | `true`                   | Enable HPA for web           |
| `web.autoscaling.maxReplicas`       | int    | `10`                     | Maximum replicas             |
| `queue.workers.<name>.replicaCount` | int    | varies                   | Replicas per queue           |
| `queue.workers.<name>.concurrency`  | int    | varies                   | Worker concurrency           |
| `database.clusterName`              | string | `"postgres-cluster"`     | CNPG cluster name            |
| `database.secretName`               | string | `"postgres-cluster-app"` | CNPG app secret              |
| `gateway.enabled`                   | bool   | `true`                   | Enable Gateway API resources |
| `gateway.httpRoute.hostnames`       | list   | `["edk.eve-kill.com"]`   | Hostnames                    |

See `values.yaml` for all available options.

## Monitoring

The chart is designed to work with Prometheus and Grafana:

- Pods expose metrics on `/metrics` (if configured in app)
- Use `podAnnotations` to add Prometheus scrape annotations
- HPA metrics available via Kubernetes metrics server

## Troubleshooting

### Check Database Connection

```bash
kubectl exec -it deployment/edk-web -n eve-kill -- bun cli db:test
```

### Check Queue Status

```bash
kubectl logs -l app.kubernetes.io/component=queue -n eve-kill --tail=100
```

### View All Pods

```bash
kubectl get pods -n eve-kill -l app.kubernetes.io/instance=edk
```

### Database Secret

```bash
kubectl get secret postgres-cluster-app -n eve-kill -o yaml
```
