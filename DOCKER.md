# Docker Setup for Deep Research

This guide explains how to run the Deep Research project using Docker for both development and production environments.

## Prerequisites

- Docker and Docker Compose installed
- API keys for Firecrawl and OpenAI (minimum required)

## Quick Start

### 1. Setup Environment Variables

The easiest way to get started is using the provided script:

```bash
./docker-start.sh
```

On first run, this will create a template `.env.local` file. Edit it with your API keys:

```bash
# Required API Keys
FIRECRAWL_KEY=your_firecrawl_api_key_here
OPENAI_KEY=your_openai_api_key_here
SERPAPI_KEY=your_serpapi_api_key_here

# Optional API Keys  
FIREWORKS_KEY=your_fireworks_api_key_here

# Optional Configuration
# FIRECRAWL_BASE_URL=https://api.firecrawl.dev
# OPENAI_ENDPOINT=https://api.openai.com/v1
# CUSTOM_MODEL=gpt-4o-mini
# CONTEXT_SIZE=128000
# FIRECRAWL_CONCURRENCY=2
# PORT=3051
```

### 2. Start the Application

**Production mode:**
```bash
./docker-start.sh prod
# or simply
./docker-start.sh
```

**Development mode (with hot reload):**
```bash
./docker-start.sh dev
```

## Manual Docker Commands

If you prefer using Docker commands directly:

### Production Setup

```bash
# Build the image
docker-compose build

# Start the production container
docker-compose up -d deep-research

# View logs
docker-compose logs -f deep-research

# Stop the container
docker-compose down
```

### Development Setup

```bash
# Start development container with hot reload
docker-compose --profile dev up -d deep-research-dev

# View logs
docker-compose logs -f deep-research-dev
```

## Available Services

| Service | Port | Description |
|---------|------|-------------|
| `deep-research` | 3051 | Production API server |
| `deep-research-dev` | 3052 | Development server with hot reload |

## API Endpoints

Once running, you can access these endpoints:

- **Research API**: `POST http://localhost:3051/api/research`
- **Generate Report**: `POST http://localhost:3051/api/generate-report`  
- **Generate Feedback**: `POST http://localhost:3051/api/generate-feedback`

### Example API Usage

```bash
# Generate a research report
curl -X POST http://localhost:3051/api/research \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Latest trends in AI research 2024",
    "mode": "report",
    "depth": 2,
    "breadth": 4
  }'

# Get a specific answer
curl -X POST http://localhost:3051/api/research \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is the capital of France?",
    "mode": "answer",
    "depth": 1,
    "breadth": 2
  }'
```

## Docker Script Commands

The `docker-start.sh` script supports these commands:

```bash
./docker-start.sh prod      # Start production container (default)
./docker-start.sh dev       # Start development container  
./docker-start.sh build     # Build Docker image
./docker-start.sh stop      # Stop all containers
./docker-start.sh logs      # Show container logs
./docker-start.sh clean     # Remove containers and images
./docker-start.sh help      # Show help
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `FIRECRAWL_KEY` | ✅ | Firecrawl API key for web scraping |
| `OPENAI_KEY` | ✅ | OpenAI API key for AI processing |
| `SERPAPI_KEY` | ✅ | SERPAPI key for web search |
| `FIREWORKS_KEY` | ❌ | Fireworks API key (alternative AI provider) |
| `FIRECRAWL_BASE_URL` | ❌ | Custom Firecrawl endpoint |
| `OPENAI_ENDPOINT` | ❌ | Custom OpenAI endpoint |
| `CUSTOM_MODEL` | ❌ | Override default AI model |
| `CONTEXT_SIZE` | ❌ | Token limit (default: 128000) |
| `FIRECRAWL_CONCURRENCY` | ❌ | Concurrent requests (default: 2) |
| `PORT` | ❌ | Server port (default: 3051) |

## Security Features

- **Non-root user**: Container runs as unprivileged user
- **No sensitive data**: `.env` files excluded from image
- **Minimal attack surface**: Only necessary files included
- **Health checks**: Built-in container health monitoring

## Troubleshooting

### Container won't start
```bash
# Check logs
docker-compose logs deep-research

# Verify environment variables
docker-compose config
```

### API not responding
```bash
# Check if container is running
docker-compose ps

# Test container health
docker exec deep-research node --version
```

### Permission errors
```bash
# Rebuild with no cache
docker-compose build --no-cache
```

### Port conflicts
```bash
# Use different ports in docker-compose.yml
ports:
  - "3053:3051"  # Change external port
```

## Performance Optimization

- **Layer caching**: Dependencies installed before copying source code
- **Multi-stage builds**: Production image excludes dev dependencies
- **Minimal base image**: Uses Alpine Linux for smaller size
- **Efficient copying**: Only necessary files included via `.dockerignore`

## Development Workflow

1. Make code changes in `src/` directory
2. Development container automatically reloads
3. Test via API endpoints at `http://localhost:3052`
4. Build production image when ready: `./docker-start.sh build`

## Production Deployment

For production deployment:

1. Set environment variables in production environment
2. Use the production service: `docker-compose up -d deep-research`
3. Configure reverse proxy (nginx, traefik) for HTTPS
4. Set up monitoring and logging
5. Configure backup for generated reports

## Monitoring

```bash
# Container resource usage
docker stats deep-research

# Application logs
docker-compose logs -f --tail=100 deep-research

# Health check status
docker inspect deep-research --format='{{.State.Health.Status}}'
``` 