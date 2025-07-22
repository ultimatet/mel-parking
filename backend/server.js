const app = require("./src/app");
const scrapingScheduler = require("./src/jobs/scrapingScheduler");
const parkingScraperService = require("./src/services/parkingScraperService");

const PORT = process.env.PORT || 5000;

// Start the server
const server = app.listen(PORT, () => {
    console.log(`🚗 Melbourne Parking API (Web Scraping) running on port ${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🔄 Scraping updates: Every ${process.env.SCRAPE_INTERVAL_MINUTES || 2} minutes`);

    // Start the scraping scheduler
    scrapingScheduler.start();
});

// Graceful shutdown
process.on("SIGTERM", async () => {
    console.log("SIGTERM signal received: closing HTTP server");

    server.close(() => {
        console.log("HTTP server closed");
    });

    // Stop the scraping scheduler
    scrapingScheduler.stop();

    // Clean up the scraper service
    await parkingScraperService.cleanup();

    process.exit(0);
});


