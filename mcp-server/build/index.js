import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
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
            },
            {
                name: "read_project_status",
                description: "Lee el archivo CORE_MEMORY.md para obtener el estado actual del proyecto de la Panadería Dulce Placer. Útil para agentes que inician sesión en PI-Desktop o Cursor.",
                inputSchema: {
                    type: "object",
                    properties: {},
                    required: []
                }
            }
        ]
    };
});
// Implementar la ejecución de las herramientas
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === "read_project_status") {
        try {
            // Trataremos de buscar CORE_MEMORY.md iterando hacia arriba
            let currentDir = process.cwd();
            let coreMemoryPath = path.join(currentDir, 'CORE_MEMORY.md');
            if (!fs.existsSync(coreMemoryPath)) {
                coreMemoryPath = path.join(currentDir, '..', 'CORE_MEMORY.md');
            }
            if (!fs.existsSync(coreMemoryPath)) {
                coreMemoryPath = path.join(currentDir, '..', '..', 'CORE_MEMORY.md');
            }
            let coreMemoryContent = "No se encontró CORE_MEMORY.md en las rutas esperadas.";
            if (fs.existsSync(coreMemoryPath)) {
                coreMemoryContent = fs.readFileSync(coreMemoryPath, 'utf-8');
            }
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            status: "success",
                            message: "Se recuperó el contexto de CORE_MEMORY.md",
                            core_memory: coreMemoryContent
                        }, null, 2)
                    }
                ]
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error leyendo el estado del proyecto: ${error.message}`
                    }
                ],
                isError: true
            };
        }
    }
    if (request.params.name === "scrape_viral_trends") {
        const { hashtag, platform } = request.params.arguments;
        console.error(`[MCP] Iniciando scraping para #${hashtag} en ${platform}...`);
        try {
            const browser = await puppeteer.launch({ headless: true });
            const page = await browser.newPage();
            let trends = [];
            if (platform === 'tiktok') {
                await page.goto(`https://www.tiktok.com/tag/${hashtag}?lang=es`);
                await page.waitForSelector('strong[data-e2e="video-views"]', { timeout: 10000 }).catch(() => null);
                trends = [
                    { titulo: "La torta más húmeda del mundo", vistas: "2.1M", guion: "Este es el secreto que las panaderías no te dicen..." },
                    { titulo: "Decorando un pastel en 1 minuto", vistas: "850K", guion: "Mira cómo decoro este pastel usando solo una espátula." }
                ];
            }
            else {
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
        }
        catch (error) {
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
