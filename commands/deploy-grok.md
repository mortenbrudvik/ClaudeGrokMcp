# /deploy-grok

Deploy the Grok MCP plugin from the development directory to the installed plugin cache.

## Usage

```
/deploy-grok
```

## Description

This command copies the compiled plugin files from your development directory to the Claude Code plugin cache, allowing you to test changes without reinstalling the plugin.

**Source:** `C:\code\projects\GrokMcp\mcp\dist\`
**Target:** `C:\Users\morte\.claude\plugins\cache\grok-mcp-dev\grok-mcp\1.0.0\mcp\dist\`

## Instructions

When the user runs `/deploy-grok`, execute the following:

1. Build the plugin first to ensure latest changes are compiled:
   ```bash
   cd /c/code/projects/GrokMcp/mcp && npm run build
   ```

2. Copy the dist files to the installed plugin location:
   ```bash
   cp -r /c/code/projects/GrokMcp/mcp/dist/* ~/.claude/plugins/cache/grok-mcp-dev/grok-mcp/1.0.0/mcp/dist/
   ```

3. Report success and remind the user to run `/mcp` to reconnect the plugin.

## Example Output

```
Building Grok MCP plugin...
Build complete.

Deploying to plugin cache...
Copied dist files to ~/.claude/plugins/cache/grok-mcp-dev/grok-mcp/1.0.0/mcp/dist/

Deployment complete. Run /mcp to reconnect the plugin.
```
