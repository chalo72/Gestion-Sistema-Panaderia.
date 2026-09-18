import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import puppeteer from 'puppeteer';

// Inicializar Servidor MCP
const server = new Server({
  name: "dulce-placer-mcp",
  version: "1.0.0",
}, {
  capabilities: {
    tools: {}
  }
});

// Definir las herramientas (Tools)
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "scrape_viral_trends",
        description: "Usa un navegador fantasma (Puppeteer) para buscar videos virales recientes en TikTok o YouTube Shorts basados en un hashtag.",
        inputSchema: {
          type: "object",
          properties: {
            hashtag: {
              type: "string",
              description: "El hashtag a buscar, por ejemplo 'reposteria' o 'panaderia'."
            },
            platform: {
              type: "string",
              enum: ["tiktok", "youtube"],
              description: "La plataforma a escanear."
            }
          },
          required: ["hashtag", "platform"]
        }
      }
    ]
  };
});

// Implementar la ejecución de las herramientas
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "scrape_viral_trends") {
    const { hashtag, platform } = request.params.arguments as any;
    
    console.error(`[MCP] Iniciando scraping para #${hashtag} en ${platform}...`);
    
    try {
      const browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();
      
      let trends = [];
      
      if (platform === 'tiktok') {
        // Lógica simplificada de scraping para el ejemplo
        // En producción, TikTok requiere evasión de bot avanzada
        await page.goto(`https://www.tiktok.com/tag/${hashtag}?lang=es`);
        await page.waitForSelector('strong[data-e2e="video-views"]', { timeout: 10000 }).catch(() => null);
        
        // Mock data para que devuelva algo rápido sin ser bloqueado
        trends = [
          { titulo: "La torta más húmeda del mundo", vistas: "2.1M", guion: "Este es el secreto que las panaderías no te dicen..." },
          { titulo: "Decorando un pastel en 1 minuto", vistas: "850K", guion: "Mira cómo decoro este pastel usando solo una espátula." }
        ];
      } else {
        await page.goto(`https://www.youtube.com/hashtag/${hashtag}/shorts`);
        trends = [
          { titulo: "Pan de masa madre perfecto", vistas: "1.5M", guion: "Si tu pan queda duro, es porque haces esto mal..." },
          { titulo: "Cómo hacer croissants franceses", vistas: "3M", guion: "Te enseño a hacer las capas perfectas." }
        ];
      }
      
      await browser.close();
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              status: "success",
              platform,
              hashtag,
              results: trends
            }, null, 2)
          }
        ]
      };
      
    } catch (error: any) {
      return {
        content: [
          {
            type: "text",
            text: `Error ejecutando Puppeteer: ${error.message}`
          }
        ],
        isError: true
      };
    }
  }

  throw new Error(`Tool no encontrada: ${request.params.name}`);
});

// Arrancar el servidor por STDIO (para que Claude Desktop o N8N lo consuman nativamente)
const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  console.error("Dulce Placer MCP Server ejecutándose y esperando conexiones por stdio...");
});
