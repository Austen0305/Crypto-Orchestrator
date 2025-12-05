# Monitoring Setup Guide (Prometheus + Grafana + Loki)

Complete guide to setting up a free, production-grade monitoring stack for Crypto-Orchestrator using Prometheus (metrics), Grafana (visualization), and Loki (logs).

## Overview

This guide covers:
- **Prometheus**: Time-series database for metrics collection
- **Grafana**: Visualization and dashboards
- **Loki**: Log aggregation system
- **Promtail**: Log shipping agent
- **Alertmanager**: Alert routing and management

**Cost: $0** (Self-hosted on free tier services or local)

---

## Architecture

```
┌─────────────────┐
│   Application   │
│  (FastAPI/React)│
└────────┬────────┘
         │
         ├─── Metrics ──────► Prometheus ──┐
         │                                   │
         ├─── Logs ─────────► Loki ◄──Promtail
         │                                   │
         └──────────────────────────────────┼─► Grafana
                                             │   (Dashboards)
                                             │
                                             └─► Alertmanager
                                                  (Notifications)
```

---

## Step 1: Install Prometheus

### Using Docker Compose (Recommended)

Create `docker-compose.observability.yml`:

```yaml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--storage.tsdb.retention.time=30d'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--web.enable-lifecycle'
    ports:
      - "9090:9090"
    restart: unless-stopped
    networks:
      - monitoring

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
      - ./grafana/dashboards:/var/lib/grafana/dashboards
    environment:
      - GF_SECURITY_ADMIN_USER=admin
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_INSTALL_PLUGINS=grafana-clock-panel,grafana-simple-json-datasource
      - GF_SERVER_ROOT_URL=http://localhost:3001
    ports:
      - "3001:3000"
    restart: unless-stopped
    networks:
      - monitoring
    depends_on:
      - prometheus

  loki:
    image: grafana/loki:latest
    container_name: loki
    volumes:
      - ./loki/loki-config.yml:/etc/loki/loki-config.yml
      - loki_data:/loki
    command: -config.file=/etc/loki/loki-config.yml
    ports:
      - "3100:3100"
    restart: unless-stopped
    networks:
      - monitoring

  promtail:
    image: grafana/promtail:latest
    container_name: promtail
    volumes:
      - ./promtail/promtail-config.yml:/etc/promtail/config.yml
      - /var/log:/var/log
      - ./logs:/app/logs
    command: -config.file=/etc/promtail/config.yml
    restart: unless-stopped
    networks:
      - monitoring
    depends_on:
      - loki

  alertmanager:
    image: prom/alertmanager:latest
    container_name: alertmanager
    volumes:
      - ./alertmanager/alertmanager.yml:/etc/alertmanager/alertmanager.yml
      - alertmanager_data:/alertmanager
    command:
      - '--config.file=/etc/alertmanager/alertmanager.yml'
      - '--storage.path=/alertmanager'
    ports:
      - "9093:9093"
    restart: unless-stopped
    networks:
      - monitoring

volumes:
  prometheus_data:
  grafana_data:
  loki_data:
  alertmanager_data:

networks:
  monitoring:
    driver: bridge
```

### Prometheus Configuration

Create `prometheus/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    cluster: 'crypto-orchestrator'
    env: 'production'

# Alertmanager configuration
alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - alertmanager:9093

# Load rules once and periodically evaluate them
rule_files:
  - "rules/*.yml"

# Scrape configurations
scrape_configs:
  # Prometheus itself
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  # FastAPI backend
  - job_name: 'fastapi'
    static_configs:
      - targets: ['host.docker.internal:8000']
    metrics_path: '/metrics'
    scrape_interval: 10s

  # Node exporter (system metrics)
  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']

  # Redis (if using redis_exporter)
  - job_name: 'redis'
    static_configs:
      - targets: ['redis-exporter:9121']

  # PostgreSQL (if using postgres_exporter)
  - job_name: 'postgresql'
    static_configs:
      - targets: ['postgres-exporter:9187']
```

---

## Step 2: Configure Loki

Create `loki/loki-config.yml`:

```yaml
auth_enabled: false

server:
  http_listen_port: 3100
  grpc_listen_port: 9096

common:
  path_prefix: /loki
  storage:
    filesystem:
      chunks_directory: /loki/chunks
      rules_directory: /loki/rules
  replication_factor: 1
  ring:
    instance_addr: 127.0.0.1
    kvstore:
      store: inmemory

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

storage_config:
  boltdb_shipper:
    active_index_directory: /loki/boltdb-shipper-active
    cache_location: /loki/boltdb-shipper-cache
    cache_ttl: 24h
    shared_store: filesystem
  filesystem:
    directory: /loki/chunks

compactor:
  working_directory: /loki/boltdb-shipper-compactor
  shared_store: filesystem

limits_config:
  reject_old_samples: true
  reject_old_samples_max_age: 168h
  ingestion_rate_mb: 10
  ingestion_burst_size_mb: 20

chunk_store_config:
  max_look_back_period: 0s

table_manager:
  retention_deletes_enabled: true
  retention_period: 720h  # 30 days
```

---

## Step 3: Configure Promtail

Create `promtail/promtail-config.yml`:

```yaml
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  # FastAPI application logs
  - job_name: fastapi
    static_configs:
      - targets:
          - localhost
        labels:
          job: fastapi
          app: crypto-orchestrator
          __path__: /app/logs/*log
    pipeline_stages:
      - json:
          expressions:
            timestamp: timestamp
            level: level
            message: message
            module: name
      - labels:
          level:
          module:
      - timestamp:
          source: timestamp
          format: RFC3339

  # System logs
  - job_name: system
    static_configs:
      - targets:
          - localhost
        labels:
          job: varlogs
          __path__: /var/log/*log
```

---

## Step 4: Configure Alertmanager

Create `alertmanager/alertmanager.yml`:

```yaml
global:
  resolve_timeout: 5m
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@cryptoorchestrator.com'
  smtp_auth_username: 'your-email@gmail.com'
  smtp_auth_password: 'your-app-password'

# The root route
route:
  group_by: ['alertname', 'cluster', 'service']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'email'
  routes:
    - match:
        severity: critical
      receiver: 'critical'
      continue: true
    - match:
        severity: warning
      receiver: 'warning'

receivers:
  - name: 'email'
    email_configs:
      - to: 'team@cryptoorchestrator.com'
        send_resolved: true

  - name: 'critical'
    email_configs:
      - to: 'oncall@cryptoorchestrator.com'
        send_resolved: true
        headers:
          Subject: '[CRITICAL] {{ .GroupLabels.alertname }}'

  - name: 'warning'
    email_configs:
      - to: 'team@cryptoorchestrator.com'
        send_resolved: true
        headers:
          Subject: '[WARNING] {{ .GroupLabels.alertname }}'

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'cluster', 'service']
```

---

## Step 5: Add Prometheus Metrics to FastAPI

### Install Prometheus Client

Already in `requirements.txt`:
```
prometheus-client==0.19.0
```

### Update FastAPI Application

Update `server_fastapi/main.py`:

```python
from prometheus_client import Counter, Histogram, Gauge, make_asgi_app
from prometheus_client import multiprocess
from prometheus_client import generate_latest, CollectorRegistry, CONTENT_TYPE_LATEST
import time
import os

# Prometheus metrics
REQUEST_COUNT = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

REQUEST_DURATION = Histogram(
    'http_request_duration_seconds',
    'HTTP request duration in seconds',
    ['method', 'endpoint']
)

ACTIVE_REQUESTS = Gauge(
    'http_requests_active',
    'Number of active HTTP requests'
)

TRADING_OPERATIONS = Counter(
    'trading_operations_total',
    'Total trading operations',
    ['operation', 'status']
)

ML_PREDICTIONS = Counter(
    'ml_predictions_total',
    'Total ML predictions made',
    ['model', 'status']
)

# Middleware for automatic metrics
@app.middleware("http")
async def prometheus_middleware(request: Request, call_next):
    """Record Prometheus metrics for all requests"""
    start_time = time.time()
    ACTIVE_REQUESTS.inc()
    
    try:
        response = await call_next(request)
        duration = time.time() - start_time
        
        # Record metrics
        REQUEST_COUNT.labels(
            method=request.method,
            endpoint=request.url.path,
            status=response.status_code
        ).inc()
        
        REQUEST_DURATION.labels(
            method=request.method,
            endpoint=request.url.path
        ).observe(duration)
        
        return response
    finally:
        ACTIVE_REQUESTS.dec()

# Prometheus metrics endpoint
@app.get("/metrics")
async def metrics():
    """Expose Prometheus metrics"""
    from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
    
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST
    )
```

### Add Custom Business Metrics

Create `server_fastapi/metrics.py`:

```python
"""
Custom Prometheus metrics for business logic
"""
from prometheus_client import Counter, Gauge, Histogram, Summary

# Trading metrics
TRADES_TOTAL = Counter(
    'trades_total',
    'Total number of trades executed',
    ['exchange', 'symbol', 'side', 'status']
)

TRADE_VOLUME = Counter(
    'trade_volume_total',
    'Total trading volume',
    ['exchange', 'symbol', 'side']
)

TRADE_PROFIT = Gauge(
    'trade_profit_current',
    'Current profit from trades',
    ['exchange', 'symbol']
)

ORDER_LATENCY = Histogram(
    'order_execution_latency_seconds',
    'Order execution latency in seconds',
    ['exchange', 'order_type'],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
)

# ML metrics
MODEL_INFERENCE_TIME = Histogram(
    'model_inference_seconds',
    'Model inference time in seconds',
    ['model_name', 'model_version']
)

MODEL_ACCURACY = Gauge(
    'model_accuracy',
    'Current model accuracy',
    ['model_name', 'dataset']
)

PREDICTIONS_TOTAL = Counter(
    'predictions_total',
    'Total predictions made',
    ['model_name', 'prediction_class']
)

# System metrics
DB_CONNECTIONS = Gauge(
    'database_connections_active',
    'Number of active database connections'
)

CACHE_HITS = Counter(
    'cache_hits_total',
    'Total cache hits',
    ['cache_type']
)

CACHE_MISSES = Counter(
    'cache_misses_total',
    'Total cache misses',
    ['cache_type']
)

QUEUE_SIZE = Gauge(
    'task_queue_size',
    'Number of tasks in queue',
    ['queue_name']
)
```

---

## Step 6: Create Alert Rules

Create `prometheus/rules/alerts.yml`:

```yaml
groups:
  - name: application
    interval: 30s
    rules:
      # High error rate
      - alert: HighErrorRate
        expr: |
          rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} requests/s ({{ $labels.instance }})"

      # High response time
      - alert: HighResponseTime
        expr: |
          histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
          description: "95th percentile response time is {{ $value }}s"

      # Application down
      - alert: ApplicationDown
        expr: up{job="fastapi"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Application is down"
          description: "{{ $labels.instance }} has been down for more than 1 minute"

  - name: database
    interval: 30s
    rules:
      # High database connections
      - alert: HighDatabaseConnections
        expr: database_connections_active > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High number of database connections"
          description: "{{ $value }} active database connections"

  - name: trading
    interval: 30s
    rules:
      # High trade failure rate
      - alert: HighTradeFailureRate
        expr: |
          rate(trades_total{status="failed"}[5m]) / rate(trades_total[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High trade failure rate"
          description: "{{ $value | humanizePercentage }} of trades are failing"

      # Order execution slow
      - alert: SlowOrderExecution
        expr: |
          histogram_quantile(0.95, rate(order_execution_latency_seconds_bucket[5m])) > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Slow order execution"
          description: "95th percentile order execution time is {{ $value }}s"
```

---

## Step 7: Configure Grafana Dashboards

### Provision Data Sources

Create `grafana/provisioning/datasources/datasources.yml`:

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true

  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    editable: true
```

### Create Application Dashboard

Create `grafana/dashboards/application-dashboard.json`:

This is a complex JSON file. Instead, import these community dashboards:

1. **FastAPI Dashboard**: Import ID `17912`
2. **Prometheus Stats**: Import ID `2`
3. **Node Exporter Full**: Import ID `1860`
4. **Loki Dashboard**: Import ID `13407`

Or create custom dashboards in Grafana UI.

---

## Step 8: Start Monitoring Stack

### Using Docker Compose

```bash
# Create required directories
mkdir -p prometheus/rules grafana/provisioning/datasources grafana/dashboards loki promtail alertmanager logs

# Start all services
docker-compose -f docker-compose.observability.yml up -d

# Check status
docker-compose -f docker-compose.observability.yml ps

# View logs
docker-compose -f docker-compose.observability.yml logs -f grafana
```

### Access Dashboards

- **Grafana**: http://localhost:3001 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093
- **Loki**: http://localhost:3100

---

## Step 9: Create Grafana Dashboards

### Log in to Grafana

1. Open http://localhost:3001
2. Login: `admin` / `admin`
3. Change password when prompted

### Import Dashboards

1. Click "+" → "Import"
2. Enter dashboard ID or paste JSON
3. Select Prometheus data source
4. Click "Import"

### Recommended Dashboard IDs

- **17912**: FastAPI Observability
- **1860**: Node Exporter Full
- **13407**: Loki Logs
- **7362**: PostgreSQL Database
- **763**: Redis

### Create Custom Dashboard

Example queries for custom panels:

**Request Rate**:
```promql
rate(http_requests_total[5m])
```

**Error Rate**:
```promql
rate(http_requests_total{status=~"5.."}[5m])
```

**Response Time (95th percentile)**:
```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

**Active Users**:
```promql
count(rate(http_requests_total{endpoint="/api/auth/me"}[5m]) > 0)
```

**Trade Volume**:
```promql
sum(rate(trade_volume_total[5m])) by (exchange, symbol)
```

---

## Step 10: Configure Alerts in Grafana

### Create Alert Rule

1. Go to "Alerting" → "Alert rules"
2. Click "New alert rule"
3. Configure query and thresholds
4. Set evaluation interval
5. Add notification channel

### Notification Channels

Configure in "Alerting" → "Contact points":

**Email**:
```yaml
Type: Email
Addresses: team@cryptoorchestrator.com
```

**Slack** (if using):
```yaml
Type: Slack
Webhook URL: https://hooks.slack.com/services/YOUR/WEBHOOK/URL
Channel: #alerts
```

**Discord** (if using):
```yaml
Type: Discord
Webhook URL: https://discord.com/api/webhooks/YOUR/WEBHOOK/URL
```

---

## Monitoring Best Practices

### Metrics to Monitor

✅ **Application Health**:
- Request rate
- Error rate
- Response time
- Active connections

✅ **Trading Operations**:
- Trade volume
- Trade success/failure rate
- Order execution latency
- Position sizes

✅ **ML Performance**:
- Inference time
- Model accuracy
- Prediction count
- Feature processing time

✅ **System Resources**:
- CPU usage
- Memory usage
- Disk I/O
- Network I/O

✅ **Database**:
- Connection pool size
- Query duration
- Slow queries
- Deadlocks

✅ **Cache**:
- Hit rate
- Miss rate
- Eviction rate
- Memory usage

### Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Error Rate | > 1% | > 5% |
| Response Time (p95) | > 1s | > 3s |
| CPU Usage | > 70% | > 90% |
| Memory Usage | > 80% | > 95% |
| Disk Usage | > 80% | > 95% |
| Trade Failure Rate | > 5% | > 10% |

---

## Troubleshooting

### Prometheus Not Scraping Metrics

1. Check target status: http://localhost:9090/targets
2. Verify application exposes `/metrics` endpoint
3. Check firewall/network connectivity
4. Review Prometheus logs: `docker logs prometheus`

### Grafana Can't Connect to Prometheus

1. Verify Prometheus is running: `curl http://localhost:9090/-/healthy`
2. Check datasource configuration in Grafana
3. Ensure correct URL: `http://prometheus:9090`
4. Test connection in datasource settings

### Loki Not Receiving Logs

1. Check Promtail status: `docker logs promtail`
2. Verify log file paths in promtail config
3. Check Loki is running: `curl http://localhost:3100/ready`
4. Review Promtail scrape positions: `/tmp/positions.yaml`

### Alerts Not Firing

1. Check alert rules syntax in Prometheus UI
2. Verify Alertmanager is running
3. Check alert routing in Alertmanager
4. Test notification channels
5. Review Alertmanager logs

---

## Production Deployment

### Using Grafana Cloud (Free Tier)

Alternative to self-hosting:

1. Sign up at [Grafana Cloud](https://grafana.com/products/cloud/)
2. Get free tier: 10K metrics, 50GB logs
3. Configure Prometheus to remote_write to Grafana Cloud
4. Configure Promtail to push to Grafana Cloud Loki

### Configuration for Remote Write

Add to `prometheus.yml`:

```yaml
remote_write:
  - url: https://prometheus-prod-01-eu-west-0.grafana.net/api/prom/push
    basic_auth:
      username: YOUR_USERNAME
      password: YOUR_API_KEY
```

---

## Cost Summary

**Free Options**:
- Self-hosted: $0 (uses existing infrastructure)
- Grafana Cloud Free Tier: $0 (10K metrics, 50GB logs/month)

**When to Upgrade**:
- Need more than 10K active series
- Need more than 50GB logs/month
- Want managed service with SLA
- Need longer retention (> 30 days)

---

## Next Steps

1. ✅ Set up monitoring stack
2. Create custom dashboards for your KPIs
3. Configure alerts for critical metrics
4. Test alert notifications
5. Document runbooks for common issues
6. Set up log retention policies
7. Schedule regular review of metrics

---

## Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Loki Documentation](https://grafana.com/docs/loki/)
- [PromQL Tutorial](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Grafana Dashboards](https://grafana.com/grafana/dashboards/)
