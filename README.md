# LLM Service

## Configuration

Create a `.env` file with the appropriate values for your provider.

### Common

```env
LLM_PROVIDER=openai
LLM_MODEL=gpt-4.1-mini
```

### API-based providers

```env
LLM_API_KEY=<your-api-key>
```

Supported providers include:

- openai
- anthropic
- google-genai
- xai
- groq
- mistralai
- deepseek
- cohere
- fireworks
- perplexity
- together
- cerebras
- azure_openai
- bedrock
- google-vertexai
- google-vertexai-web

### Ollama

```env
LLM_PROVIDER=ollama
LLM_MODEL=qwen3:8b
LLM_BASE_URL=http://localhost:11434
```
