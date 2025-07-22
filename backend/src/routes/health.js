const express = require("express");
const router = express.Router();
const cacheService = require("../services/cacheService");
const parkingScraperService = require("../services/parkingScraperService");

/**
 * Health check endpoint
 * GET /api/health
 */
router.get("/", (req, res) => {
    const cacheStats = cacheService.getStats();

    res.json({
        status: "OK",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV || "development",
        scraper: {
            isInitialized: parkingScraperService.isInitialized,
            lastScrapeTime: parkingScraperService.lastScrapeTime
                ? new Date(parkingScraperService.lastScrapeTime).toISOString()
                : "Never",
            nextScrapeIn: parkingScraperService.lastScrapeTime
                ? Math.max(
                      0,
                      (parkingScraperService.scrapeInterval -
                          (Date.now() - parkingScraperService.lastScrapeTime)) /
                          1000
                  ) + " seconds"
                : "Unknown",
        },
        cache: cacheStats,
        memory: {
            used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
            total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
        },
    });
});

module.exports = router;
