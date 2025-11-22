# Nitro App

This is a starter template for a Nitro application.

## Development

To get started, install the dependencies and start the development server:

```bash
bun install
bun dev
```

## Monitoring

This application includes a monitoring and observability stack using Prometheus and Grafana.

### Services

- **Prometheus**: A metrics collection and alerting system.
- **Grafana**: A data visualization and dashboarding tool.

These services are defined in the `docker-compose.yml` file and can be started with:

```bash
docker-compose up -d
```

### Endpoints

- **Metrics**: The `/metrics` endpoint exposes the application's metrics in a Prometheus-compatible format.
- **Prometheus**: The Prometheus UI is available at `http://localhost:9090`.
- **Grafana**: The Grafana UI is available at `http://localhost:3001`. The default credentials are `admin`/`admin`.

### Dashboards

A pre-configured Grafana dashboard can be imported to visualize the application's metrics. The dashboard can be found in the `grafana/dashboards` directory.
