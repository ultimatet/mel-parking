const cron = require("node-cron");
const parkingScraperService = require("../services/parkingScraperService");

class ScrapingScheduler {
    constructor() {
        this.job = null;
        this.isRunning = false;
        this.scrapeCount = 0;
        this.errorCount = 0;
        this.lastError = null;
    }

    /**
     * Start the scraping job
     */
    start() {
        const intervalMinutes = 2;

        // Create cron pattern (every N minutes)
        const cronPattern = `*/${intervalMinutes} * * * *`;

        // Schedule the job
        this.job = cron.schedule(cronPattern, async () => {
            await this.executeScrape();
        });

        console.log(`Scraping scheduler started - will run every ${intervalMinutes} minutes`);

        // Run immediately on start
        this.runNow();
    }

    /**
     * Execute a scrape operation
     */
    async executeScrape() {
        if (this.isRunning) {
            console.log("[Scraping Job] Previous scrape still running, skipping...");
            return;
        }

        this.isRunning = true;
        const startTime = Date.now();

        console.log(`[Scraping Job] Starting scheduled scrape #${this.scrapeCount + 1}...`);

        try {
            await parkingScraperService.scrapeParkingData();

            const duration = Date.now() - startTime;
            this.scrapeCount++;

            console.log(
                `[Scraping Job] Scrape #${this.scrapeCount} completed successfully in ${duration}ms`
            );
        } catch (error) {
            this.errorCount++;
            this.lastError = {
                message: error.message,
                timestamp: new Date().toISOString(),
            };

            console.error(
                `[Scraping Job] Scrape failed (error #${this.errorCount}):`,
                error.message
            );

            // If too many consecutive errors, consider stopping
            if (this.errorCount > 5) {
                console.error(
                    "[Scraping Job] Too many consecutive errors, consider checking the scraper"
                );
            }
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Run scraping immediately
     */
    async runNow() {
        await this.executeScrape();
    }

    /**
     * Stop the scraping job
     */
    stop() {
        if (this.job) {
            this.job.stop();
            console.log("Scraping scheduler stopped");
        }
    }

    /**
     * Get scheduler status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            scrapeCount: this.scrapeCount,
            errorCount: this.errorCount,
            lastError: this.lastError,
            nextRun: this.job ? this.job.nextDates(1)[0] : null,
        };
    }
}

module.exports = new ScrapingScheduler();
