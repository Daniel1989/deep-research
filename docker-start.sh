#!/bin/bash

# Docker startup script for Deep Research

set -e

echo "🔬 Deep Research Docker Setup"
echo "=============================="

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "⚠️  .env.local file not found!"
    echo "Creating a template .env.local file..."
    cat > .env.local << EOF
# Required API Keys
FIRECRAWL_KEY=your_firecrawl_api_key_here
OPENAI_KEY=your_openai_api_key_here
SERPER_API_KEY=your_serper_api_key_here

# Optional API Keys
FIREWORKS_KEY=your_fireworks_api_key_here

# Optional Configuration
# FIRECRAWL_BASE_URL=https://api.firecrawl.dev
# OPENAI_ENDPOINT=https://api.openai.com/v1
# CUSTOM_MODEL=gpt-4o-mini
# CONTEXT_SIZE=128000
# FIRECRAWL_CONCURRENCY=2
# PORT=3051
EOF
    echo "📝 Please edit .env.local with your API keys before running again."
    echo "   You need at least FIRECRAWL_KEY, OPENAI_KEY, and SERPER_API_KEY"
    exit 1
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Function to show usage
show_usage() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  prod     Start production container (default)"
    echo "  dev      Start development container with hot reload"
    echo "  build    Build the Docker image"
    echo "  stop     Stop all containers"
    echo "  logs     Show container logs"
    echo "  clean    Remove containers and images"
    echo ""
}

# Default command
COMMAND=${1:-prod}

case $COMMAND in
    "prod")
        echo "🚀 Starting production container..."
        docker-compose up -d deep-research
        echo "✅ Deep Research API is running at http://localhost:3051"
        echo "📊 Check status: docker-compose ps"
        echo "📋 View logs: docker-compose logs -f deep-research"
        ;;
    
    "dev")
        echo "🛠️  Starting development container with hot reload..."
        docker-compose --profile dev up -d deep-research-dev
        echo "✅ Deep Research API (dev) is running at http://localhost:3052"
        echo "📊 Check status: docker-compose ps"
        echo "📋 View logs: docker-compose logs -f deep-research-dev"
        ;;
    
    "build")
        echo "🔨 Building Docker image..."
        docker-compose build --no-cache
        echo "✅ Build complete!"
        ;;
    
    "stop")
        echo "⏹️  Stopping all containers..."
        docker-compose down
        echo "✅ All containers stopped"
        ;;
    
    "logs")
        echo "📋 Showing logs..."
        docker-compose logs -f
        ;;
    
    "clean")
        echo "🧹 Cleaning up containers and images..."
        docker-compose down --rmi all --volumes --remove-orphans
        echo "✅ Cleanup complete!"
        ;;
    
    "help"|"-h"|"--help")
        show_usage
        ;;
    
    *)
        echo "❌ Unknown command: $COMMAND"
        show_usage
        exit 1
        ;;
esac 